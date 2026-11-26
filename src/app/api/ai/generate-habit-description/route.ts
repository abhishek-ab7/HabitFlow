import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { habitDescriptionSchema } from '@/lib/ai/schemas';
import { buildHabitDescriptionPrompt } from '@/lib/ai/prompts';
import type { HabitDescriptionInput, HabitDescriptionOutput } from '@/lib/ai/types';

function buildHabitDescriptionErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const isRateLimit = message.includes('429') || message.includes('quota') || message.includes('rate limit');
  return NextResponse.json(
    {
      error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to generate habit description',
      details: message,
      isRateLimit,
    },
    { status: isRateLimit ? 429 : 500 }
  );
}

async function generateHabitDescription(input: HabitDescriptionInput) {
  const ai = new HabitFlowAI('habits');
  const prompt = buildHabitDescriptionPrompt(input);
  const habitKey = `${input.habit.name}-${input.habit.category}`.toLowerCase().replace(/\s+/g, '-');
  const cacheKey = `habit-desc:${habitKey}`;
  const cacheTTL = 30 * 24 * 60 * 60;

  console.log(`[AI Habit Description] Generating for ${input.habit.name} (${input.habit.category})`);
  return ai.generate<HabitDescriptionOutput>('enhance-habit', prompt, habitDescriptionSchema, cacheKey, cacheTTL);
}

export async function POST(req: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
      return NextResponse.json({ error: 'AI features are currently disabled' }, { status: 503 });
    }

    const input = await req.json().catch(() => null) as HabitDescriptionInput | null;
    if (!input) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    if (!input.habit?.name) {
      return NextResponse.json({ error: 'Habit information is required' }, { status: 400 });
    }

    const result = await generateHabitDescription(input);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Habit Description Route Error:', error);
    return buildHabitDescriptionErrorResponse(error);
  }
}
