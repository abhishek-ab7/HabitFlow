import { NextRequest, NextResponse } from 'next/server';
import { getAIService } from '@/lib/ai/service';
import { habitDescriptionSchema } from '@/lib/ai/schemas';
import { buildHabitDescriptionPrompt } from '@/lib/ai/prompts';
import type { HabitDescriptionInput, HabitDescriptionOutput } from '@/lib/ai/types';

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

    const input = body as HabitDescriptionInput;
    
    if (!input.habit || !input.habit.name) {
      return NextResponse.json({ error: 'Habit information is required' }, { status: 400 });
    }
    
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service is not configured.' },
        { status: 500 }
      );
    }

    const ai = getAIService();
    const prompt = buildHabitDescriptionPrompt(input);
    
    // Cache key: based on habit name and category (static content, long cache)
    const habitKey = `${input.habit.name}-${input.habit.category}`.toLowerCase().replace(/\s+/g, '-');
    const cacheKey = `habit-desc:${habitKey}`;
    const cacheTTL = 30 * 24 * 60 * 60; // 30 days (descriptions rarely change)

    console.log(`[AI Habit Description] Generating for ${input.habit.name} (${input.habit.category})`);

    const result = await ai.generate<HabitDescriptionOutput>(
      'enhance-habit',
      prompt,
      habitDescriptionSchema,
      cacheKey,
      cacheTTL
    );

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Habit Description Route Error:', error);

    // Check for rate limit error
    const isRateLimit = error.message?.includes('429') || 
                        error.message?.includes('quota') ||
                        error.message?.includes('rate limit');

    return NextResponse.json(
      {
        error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to generate habit description',
        details: error.message || 'Unknown error',
        isRateLimit
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
