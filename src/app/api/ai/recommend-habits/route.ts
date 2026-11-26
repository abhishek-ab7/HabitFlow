import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { habitRecommendationSchema } from '@/lib/ai/schemas';
import { buildHabitRecommendationPrompt } from '@/lib/ai/prompts';
import type { HabitRecommendationInput, HabitRecommendationOutput } from '@/lib/ai/types';

function buildRecommendHabitsErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const isRateLimit = message.includes('429') || message.includes('quota') || message.includes('rate limit');
  return NextResponse.json(
    {
      error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to generate habit recommendations',
      details: message,
    },
    { status: isRateLimit ? 429 : 500 }
  );
}

async function generateHabitRecommendations(body: HabitRecommendationInput) {
  const { goals, currentHabits } = body;
  const ai = new HabitFlowAI('habits');
  const prompt = buildHabitRecommendationPrompt(body);
  const goalIds = goals.map(g => g.id).sort().join(',');
  const habitIds = currentHabits?.map(h => h.id).sort().join(',') || 'none';
  const cacheKey = `recommend-habits:${goalIds}:${habitIds}`;
  const cacheTTL = 24 * 60 * 60;

  console.log(`[AI Habits] Generating recommendations for ${goals.length} goals`);
  return ai.generate<HabitRecommendationOutput>('recommend-habits', prompt, habitRecommendationSchema, cacheKey, cacheTTL);
}

export async function POST(req: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
      return NextResponse.json({ error: 'AI features are currently disabled' }, { status: 503 });
    }

    const body = await req.json() as HabitRecommendationInput;
    if (!body.goals || body.goals.length === 0) {
      return NextResponse.json({ error: 'At least one goal is required for habit recommendations' }, { status: 400 });
    }

    const result = await generateHabitRecommendations(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[AI Habits] Error:', error);
    return buildRecommendHabitsErrorResponse(error);
  }
}
