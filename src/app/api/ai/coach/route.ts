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

function buildDeterministicCoachBriefing(
  input: CoachBriefingInput,
  todayIst: string
): CoachBriefingOutput {
  const name = input.userData?.userName || 'Friend';
  const ft = input.context?.fitnessTelemetry;
  const cd = input.context?.crossDomainInsights;

  const taskCount = Array.isArray(input.context?.unfinishedTasks)
    ? input.context.unfinishedTasks.length
    : Number(input.context?.unfinishedTasks || 0);

  const primaryFocusParts: string[] = [];
  if (taskCount > 0) {
    const firstTask = Array.isArray(input.context?.unfinishedTasks)
      ? input.context.unfinishedTasks[0]
      : input.context?.topPriorityTask;
    primaryFocusParts.push(
      firstTask
        ? `Start your #1 priority "${firstTask}" with a 2-minute kickoff.`
        : `Clear your top ${Math.min(3, taskCount)} MIT tasks today.`
    );
  }
  if (ft?.proteinTargetG && ft.avgProtein14dG !== null && ft.avgProtein14dG !== undefined) {
    if (ft.avgProtein14dG < ft.proteinTargetG * 0.85) {
      primaryFocusParts.push(
        `Protein averaged ${ft.avgProtein14dG}g vs ${ft.proteinTargetG}g target — lock in a high-protein staple early.`
      );
    }
  }
  if (cd?.alerts && cd.alerts.length > 0) {
    primaryFocusParts.push(cd.alerts[0].title);
  }

  const focus =
    primaryFocusParts.length > 0
      ? primaryFocusParts.join(' ')
      : 'Keep momentum steady: protect sleep, hit one keystone habit early, and log meals cleanly.';

  const energyForecast: 'low' | 'medium' | 'high' =
    (ft?.avgSleepHours14d !== null && ft?.avgSleepHours14d !== undefined && ft.avgSleepHours14d < 6.5) ||
    (ft?.avgEnergy14d !== null && ft?.avgEnergy14d !== undefined && ft.avgEnergy14d <= 2.3)
      ? 'low'
      : (ft?.avgSleepHours14d ?? 7) >= 7.2
        ? 'high'
        : 'medium';

  return {
    greeting: `Good day, ${name}! Here is your Life OS check-in for ${todayIst}.`,
    focus,
    quote: 'Small daily inputs compound faster than sporadic intensity.',
    energyForecast,
    quickWins:
      cd?.alerts?.slice(0, 2).map((a) => a.title) || ['Log today’s bio & top 3 MITs'],
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
      return NextResponse.json(
        { error: 'AI features are currently disabled' },
        { status: 503 }
      );
    }

    const limitResult = await rateLimit(req, { limit: 20, windowMs: 60 * 1000 });
    if (!limitResult.success) {
      return rateLimitResponse(limitResult.retryAfter);
    }

    let body: CoachBriefingInput;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { userData, context, forceRefresh } = body || ({} as CoachBriefingInput);
    const todayIst = getIstIsoDate();
    const mode = context?.mode || 'briefing';

    // Strictly key cache by verified Supabase auth user.id + IST date (prevents cross-user leakage)
    const cacheKey = `coach:${user.id}:${todayIst}:${mode}`;
    const cacheTTL = 6 * 60 * 60; // 6 hours

    if (!forceRefresh) {
      const cached = await getCachedResponse<CoachBriefingOutput>(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    const normalizedInput: CoachBriefingInput = {
      userData: {
        userName: userData?.userName,
        level: userData?.level,
        xp: userData?.xp,
        userId: user.id,
      },
      context: {
        ...(context || {}),
        todayIso: todayIst,
      },
      forceRefresh,
    };

    if (resolveGeminiApiKeys().length === 0) {
      const deterministic = buildDeterministicCoachBriefing(normalizedInput, todayIst);
      await setCachedResponse(cacheKey, deterministic, cacheTTL);
      return NextResponse.json(deterministic);
    }

    const prompt = buildCoachPrompt(normalizedInput);

    const response = await runWithGeminiFailover((ai) =>
      ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: COACH_RESPONSE_SCHEMA,
          temperature: 0.5,
        },
      })
    );

    const text = response.text?.trim();
    if (!text) {
      const deterministic = buildDeterministicCoachBriefing(normalizedInput, todayIst);
      await setCachedResponse(cacheKey, deterministic, cacheTTL);
      return NextResponse.json(deterministic);
    }

    const parsed = JSON.parse(text) as CoachBriefingOutput;
    if (!parsed.greeting || !parsed.focus || !parsed.quote) {
      throw new Error('Invalid AI Coach payload structure');
    }

    await setCachedResponse(cacheKey, parsed, cacheTTL);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isRateLimit =
      message.includes('429') ||
      message.toLowerCase().includes('quota') ||
      message.toLowerCase().includes('rate limit');

    console.error('[AI Coach Route Error]:', error);
    return NextResponse.json(
      {
        error: isRateLimit
          ? 'Daily AI quota exceeded. Try again later.'
          : 'AI Coach error',
        details: message,
        isRateLimit,
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
