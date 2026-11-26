import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { habitStackingSchema } from '@/lib/ai/schemas';
import { buildHabitStackingPrompt } from '@/lib/ai/prompts';
import type { HabitStackingInput, HabitStackingOutput } from '@/lib/ai/types';

function buildHabitStacksErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const isRateLimit = message.includes('429') || message.includes('quota') || message.includes('rate limit');
  return NextResponse.json(
    {
      error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to generate habit stacks',
      details: message,
      isRateLimit,
    },
    { status: isRateLimit ? 429 : 500 }
  );
}

async function generateHabitStacks(input: HabitStackingInput) {
  const ai = new HabitFlowAI('habits');
  const prompt = buildHabitStackingPrompt(input);
  const habitIds = input.existingHabits.map(h => h.id).sort().join(',');
  const cacheKey = input.forceRefresh ? undefined : `habit-stacks:${habitIds}`;
  const cacheTTL = 3 * 24 * 60 * 60;

  console.log(`[AI Habit Stacks] Generating for ${input.existingHabits.length} habits${input.forceRefresh ? ' [FORCE REFRESH]' : ''}`);
  return ai.generate<HabitStackingOutput>('suggest-stacks', prompt, habitStackingSchema, cacheKey, cacheTTL);
}

export async function POST(req: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
      return NextResponse.json({ error: 'AI features are currently disabled' }, { status: 503 });
    }

    const input = await req.json().catch(() => null) as HabitStackingInput | null;
    if (!input) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    if (!input.existingHabits || input.existingHabits.length < 2) {
      return NextResponse.json({ error: 'At least 2 habits are required for stacking suggestions' }, { status: 400 });
    }

    const result = await generateHabitStacks(input);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Habit Stacking Route Error:', error);
    return buildHabitStacksErrorResponse(error);
  }
}
