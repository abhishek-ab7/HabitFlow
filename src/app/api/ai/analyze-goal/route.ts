import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { smartGoalAnalysisSchema } from '@/lib/ai/schemas';
import { buildGoalAnalysisPrompt } from '@/lib/ai/prompts';

export async function POST(req: NextRequest) {
  try {
    // Check if AI features are enabled
    if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
      return NextResponse.json(
        { error: 'AI features are currently disabled' },
        { status: 503 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { goal } = body;

    if (!goal || !goal.id || !goal.title) {
      return NextResponse.json({ error: 'Goal information is required' }, { status: 400 });
    }

    const ai = new HabitFlowAI('dashboard');
    const prompt = buildGoalAnalysisPrompt(goal);

    // Cache key: goal-specific, cache for 1 day
    const cacheKey = `smart-analysis:${goal.id}:${goal.title.substring(0, 20)}`;
    const cacheTTL = 24 * 60 * 60; // 1 day

    console.log(`[AI Goal Analysis] Analyzing goal ${goal.id}: ${goal.title}`);

    const result = await ai.generate(
      'analyze-goal',
      prompt,
      smartGoalAnalysisSchema,
      body.forceRefresh ? undefined : cacheKey,
      cacheTTL
    );

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Goal Analysis Route Error:', error);

    const isRateLimit = error.message?.includes('429') ||
      error.message?.includes('quota') ||
      error.message?.includes('rate limit');

    return NextResponse.json(
      {
        error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to analyze goal',
        details: error.message || 'Unknown error',
        isRateLimit
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
