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
  const unfinished = context?.unfinishedTasks;
  const taskCount = Array.isArray(unfinished) ? unfinished.length : Number(unfinished || 0);
  if (taskCount <= 0) return null;

  const firstTask = Array.isArray(unfinished) ? unfinished[0] : context?.topPriorityTask;
  if (firstTask) return `Start your #1 priority "${firstTask}" with a 2-minute kickoff.`;
  return `Clear your top ${Math.min(3, taskCount)} MIT tasks today.`;
}

function buildProteinFocusLine(ft?: NonNullable<CoachBriefingInput['context']>['fitnessTelemetry']): string | null {
  if (!ft?.proteinTargetG || ft.avgProtein14dG == null) return null;
  if (ft.avgProtein14dG >= ft.proteinTargetG * 0.85) return null;
  return `Protein averaged ${ft.avgProtein14dG}g vs ${ft.proteinTargetG}g target — lock in a high-protein staple early.`;
}

function resolveEnergyForecast(ft?: NonNullable<CoachBriefingInput['context']>['fitnessTelemetry']): 'low' | 'medium' | 'high' {
  const avgSleep = ft?.avgSleepHours14d ?? 7;
  const avgEnergy = ft?.avgEnergy14d ?? 3;
  if (avgSleep < 6.5 || avgEnergy <= 2.3) return 'low';
  return avgSleep >= 7.2 ? 'high' : 'medium';
}

function buildDeterministicCoachBriefing(
  input: CoachBriefingInput,
  todayIst: string
): CoachBriefingOutput {
  const name = input.userData?.userName || 'Friend';
  const ft = input.context?.fitnessTelemetry;
  const alerts = input.context?.crossDomainInsights?.alerts ?? [];
  const focusParts = [
    buildTaskFocusLine(input.context),
    buildProteinFocusLine(ft),
    alerts[0]?.title ?? null,
  ].filter((part): part is string => Boolean(part));

  return {
    greeting: `Good day, ${name}! Here is your Life OS check-in for ${todayIst}.`,
    focus: focusParts.join(' ') || 'Keep momentum steady: protect sleep, hit one keystone habit early, and log meals cleanly.',
    quote: 'Small daily inputs compound faster than sporadic intensity.',
    energyForecast: resolveEnergyForecast(ft),
    quickWins: alerts.slice(0, 2).map((a) => a.title),
  };
}

const COACH_CACHE_TTL_SECONDS = 6 * 60 * 60;

function isValidCoachOutput(parsed: Partial<CoachBriefingOutput>): parsed is CoachBriefingOutput {
  return Boolean(parsed.greeting && parsed.focus && parsed.quote);
}

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

  const parsed = JSON.parse(text) as Partial<CoachBriefingOutput>;
  if (!isValidCoachOutput(parsed)) {
    throw new Error('Invalid AI Coach payload structure');
  }
  return parsed;
}

function isRateLimitMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return message.includes('429') || lower.includes('quota') || lower.includes('rate limit');
}

function buildCoachErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const isRateLimit = isRateLimitMessage(message);
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

async function parseCoachRequestBody(req: NextRequest): Promise<CoachBriefingInput | null> {
  try {
    return (await req.json()) || ({} as CoachBriefingInput);
  } catch {
    return null;
  }
}

function getCoachCacheKey(params: { userId: string; todayIst: string; mode?: string }): string {
  return `coach:${params.userId}:${params.todayIst}:${params.mode || 'briefing'}`;
}

function buildNormalizedCoachInput(params: {
  userId: string;
  todayIst: string;
  body: CoachBriefingInput;
}): CoachBriefingInput {
  const { userId, todayIst, body } = params;
  return {
    userData: {
      userName: body.userData?.userName,
      level: body.userData?.level,
      xp: body.userData?.xp,
      userId,
    },
    context: { ...(body.context || {}), todayIso: todayIst },
    forceRefresh: body.forceRefresh,
  };
}

async function handleCoachBriefing(params: { userId: string; body: CoachBriefingInput }) {
  const { userId, body } = params;
  const todayIst = getIstIsoDate();
  const cacheKey = getCoachCacheKey({ userId, todayIst, mode: body.context?.mode });

  if (!body.forceRefresh) {
    const cached = await getCachedResponse<CoachBriefingOutput>(cacheKey);
    if (cached) return NextResponse.json(cached);
  }

  const normalizedInput = buildNormalizedCoachInput({ userId, todayIst, body });
  const output = await generateCoachOutput(normalizedInput, todayIst);
  await setCachedResponse(cacheKey, output, COACH_CACHE_TTL_SECONDS);
  return NextResponse.json(output);
}

async function authorizeCoachRequest(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
    return { error: NextResponse.json({ error: 'AI features are currently disabled' }, { status: 503 }) };
  }

  const limitResult = await rateLimit(req, { limit: 20, windowMs: 60 * 1000 });
  if (!limitResult.success) return { error: rateLimitResponse(limitResult.retryAfter) };

  const body = await parseCoachRequestBody(req);
  if (!body) return { error: NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) };

  return { userId: user.id, body };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeCoachRequest(req);
    if (auth.error) return auth.error;
    return await handleCoachBriefing({ userId: auth.userId, body: auth.body });
  } catch (error: unknown) {
    return buildCoachErrorResponse(error);
  }
}
