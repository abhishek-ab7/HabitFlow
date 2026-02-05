import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { habitStackingSchema } from '@/lib/ai/schemas';
import { buildHabitStackingPrompt } from '@/lib/ai/prompts';
import type { HabitStackingInput, HabitStackingOutput } from '@/lib/ai/types';

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

    const input = body as HabitStackingInput;

    if (!input.existingHabits || input.existingHabits.length < 2) {
      return NextResponse.json({ error: 'At least 2 habits are required for stacking suggestions' }, { status: 400 });
    }

    // AI Service will handle key validation from pool

    const ai = new HabitFlowAI('habits');
    const prompt = buildHabitStackingPrompt(input);

    // Cache key: based on habit IDs (changes when habits change)
    const habitIds = input.existingHabits.map(h => h.id).sort().join(',');
    const cacheKey = `habit-stacks:${habitIds}`;
    const cacheTTL = 3 * 24 * 60 * 60; // 3 days

    console.log(`[AI Habit Stacks] Generating for ${input.existingHabits.length} habits`);

    const result = await ai.generate<HabitStackingOutput>(
      'suggest-stacks',
      prompt,
      habitStackingSchema,
      cacheKey,
      cacheTTL
    );

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Habit Stacking Route Error:', error);

    // Check for rate limit error
    const isRateLimit = error.message?.includes('429') ||
      error.message?.includes('quota') ||
      error.message?.includes('rate limit');

    return NextResponse.json(
      {
        error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to generate habit stacks',
        details: error.message || 'Unknown error',
        isRateLimit
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
