import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { habitRecommendationSchema } from '@/lib/ai/schemas';
import { buildHabitRecommendationPrompt } from '@/lib/ai/prompts';
import type { HabitRecommendationInput, HabitRecommendationOutput } from '@/lib/ai/types';

export async function POST(req: NextRequest) {
  try {
    // Check if AI features are enabled
    if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
      return NextResponse.json(
        { error: 'AI features are currently disabled' },
        { status: 503 }
      );
    }

    const body = await req.json() as HabitRecommendationInput;
    const { goals, currentHabits, categoryPerformance, userLevel } = body;

    if (!goals || goals.length === 0) {
      return NextResponse.json({
        error: 'At least one goal is required for habit recommendations'
      }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const ai = new HabitFlowAI('habits');
    const prompt = buildHabitRecommendationPrompt(body);

    // Cache for 24 hours, invalidate when goals/habits change
    const goalIds = goals.map(g => g.id).sort().join(',');
    const habitIds = currentHabits?.map(h => h.id).sort().join(',') || 'none';
    const cacheKey = `recommend-habits:${goalIds}:${habitIds}`;
    const cacheTTL = 24 * 60 * 60;

    console.log(`[AI Habits] Generating recommendations for ${goals.length} goals`);

    const result = await ai.generate<HabitRecommendationOutput>(
      'recommend-habits',
      prompt,
      habitRecommendationSchema,
      cacheKey,
      cacheTTL
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[AI Habits] Error:', error);

    const isRateLimit = error.message?.includes('429') ||
      error.message?.includes('quota') ||
      error.message?.includes('rate limit');

    return NextResponse.json(
      {
        error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to generate habit recommendations',
        details: error.message
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
