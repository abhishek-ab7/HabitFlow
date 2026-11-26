import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiApiKeys,
  runWithGeminiFailover,
} from '@/lib/ai/gemini-server';
import { getCachedResponse, setCachedResponse } from '@/lib/ai/cache';
import { buildCoachPrompt } from '@/lib/ai/prompts';
import type { CoachBriefingInput, CoachBriefingOutput } from '@/lib/ai/types';
import { getIstIsoDate } from '@/lib/mcp/config';
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const COACH_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    greeting: { type: Type.STRING },
    focus: { type: Type.STRING },
    quote: { type: Type.STRING },
    energyForecast: { type: Type.STRING },
    streaksAtRisk: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    quickWins: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    goalsDeadline: { type: Type.STRING },
    weekMomentum: { type: Type.STRING },
  },
  required: ['greeting', 'focus', 'quote'],
};

function buildTaskFocusLine(context?: CoachBriefingInput['context']): string | null {
  const taskCount = Array.isArray(context?.unfinishedTasks)
    ? context.unfinishedTasks.length
    : Number(context?.unfinishedTasks || 0);
  if (taskCount <= 0) return null;

  const firstTask = Array.isArray(context?.unfinishedTasks)
    ? context.unfinishedTasks[0]
    : context?.topPriorityTask;
  return firstTask
    ? `Start your #1 priority "${firstTask}" with a 2-minute kickoff.`
    : `Clear your top ${Math.min(3, taskCount)} MIT tasks today.`;
}

function buildProteinFocusLine(ft?: CoachBriefingInput['context'] extends infer C ? C extends { fitnessTelemetry?: infer F } ? F : never : never): string | null {
  if (!ft?.proteinTargetG || ft.avgProtein14dG == null) return null;
  if (ft.avgProtein14dG >= ft.proteinTargetG * 0.85) return null;
  return `Protein averaged ${ft.avgProtein14dG}g vs ${ft.proteinTargetG}g target — lock in a high-protein staple early.`;
}

function resolveEnergyForecast(ft?: NonNullable<CoachBriefingInput['context']>['fitnessTelemetry']): 'low' | 'medium' | 'high' {
  const lowSleep = ft?.avgSleepHours14d != null && ft.avgSleepHours14d < 6.5;
  const lowEnergy = ft?.avgEnergy14d != null && ft.avgEnergy14d <= 2.3;
  if (lowSleep || lowEnergy) return 'low';
  return (ft?.avgSleepHours14d ?? 7) >= 7.2 ? 'high' : 'medium';
}

function buildDeterministicCoachBriefing(
  input: CoachBriefingInput,
  todayIst: string
): CoachBriefingOutput {
  const name = input.userData?.userName || 'Friend';
  const ft = input.context?.fitnessTelemetry;
  const cd = input.context?.crossDomainInsights;

  const focusParts = [
    buildTaskFocusLine(input.context),
    buildProteinFocusLine(ft),
    cd?.alerts?.[0]?.title || null,
  ].filter((part): part is string => Boolean(part));

  return {
    greeting: `Good day, ${name}! Here is your Life OS check-in for ${todayIst}.`,
    focus:
      focusParts.length > 0
        ? focusParts.join(' ')
        : 'Keep momentum steady: protect sleep, hit one keystone habit early, and log meals cleanly.',
    quote: 'Small daily inputs compound faster than sporadic intensity.',
    energyForecast: resolveEnergyForecast(ft),
    quickWins: cd?.alerts?.slice(0, 2).map((a) => a.title) || ['Log today’s bio & top 3 MITs'],
  };
}

const COACH_CACHE_TTL_SECONDS = 6 * 60 * 60;

async function generateCoachOutput(normalizedInput: CoachBriefingInput, todayIst: string): Promise<CoachBriefingOutput> {
  if (resolveGeminiApiKeys().length === 0) {
    return buildDeterministicCoachBriefing(normalizedInput, todayIst);
  }
  const response = await runWithGeminiFailover((ai) =>
    ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: buildCoachPrompt(normalizedInput),
      config: {
        responseMimeType: 'application/json',
        responseSchema: COACH_RESPONSE_SCHEMA,
        temperature: 0.5,
      },
    })
  );
  const text = response.text?.trim();
  if (!text) return buildDeterministicCoachBriefing(normalizedInput, todayIst);

  const parsed = JSON.parse(text) as CoachBriefingOutput;
  if (!parsed.greeting || !parsed.focus || !parsed.quote) {
    throw new Error('Invalid AI Coach payload structure');
  }
  return parsed;
}

function buildCoachErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const lower = message.toLowerCase();
  const isRateLimit = message.includes('429') || lower.includes('quota') || lower.includes('rate limit');
  console.error('[AI Coach Route Error]:', error);
  return NextResponse.json(
    {
      error: isRateLimit ? 'Daily AI quota exceeded. Try again later.' : 'AI Coach error',
      details: message,
      isRateLimit,
    },
    { status: isRateLimit ? 429 : 500 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
      return NextResponse.json({ error: 'AI features are currently disabled' }, { status: 503 });
    }

    const limitResult = await rateLimit(req, { limit: 20, windowMs: 60 * 1000 });
    if (!limitResult.success) return rateLimitResponse(limitResult.retryAfter);

    let body: CoachBriefingInput;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { userData, context, forceRefresh } = body || ({} as CoachBriefingInput);
    const todayIst = getIstIsoDate();
    const cacheKey = `coach:${user.id}:${todayIst}:${context?.mode || 'briefing'}`;

    if (!forceRefresh) {
      const cached = await getCachedResponse<CoachBriefingOutput>(cacheKey);
      if (cached) return NextResponse.json(cached);
    }

    const normalizedInput: CoachBriefingInput = {
      userData: { userName: userData?.userName, level: userData?.level, xp: userData?.xp, userId: user.id },
      context: { ...(context || {}), todayIso: todayIst },
      forceRefresh,
    };

    const output = await generateCoachOutput(normalizedInput, todayIst);
    await setCachedResponse(cacheKey, output, COACH_CACHE_TTL_SECONDS);
    return NextResponse.json(output);
  } catch (error: unknown) {
    return buildCoachErrorResponse(error);
  }
}
