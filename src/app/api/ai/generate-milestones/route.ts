import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { milestoneGenerationSchema } from '@/lib/ai/schemas';
import { buildMilestoneGenerationPrompt } from '@/lib/ai/prompts';
import type { MilestoneGenerationInput, MilestoneGenerationOutput } from '@/lib/ai/types';

function buildMilestoneErrorResponse(error: any) {
  const msg = String(error?.message || '');
  const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('rate limit');
  return NextResponse.json(
    {
      error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to generate milestones',
      details: msg || 'Unknown error',
      isRateLimit,
    },
    { status: isRateLimit ? 429 : 500 }
  );
}

async function executeMilestoneGeneration(input: MilestoneGenerationInput) {
  const ai = new HabitFlowAI('dashboard');
  const timeline = input.userContext?.timelinePreference || 'balanced';
  const cacheKey = `milestones:${input.goal.id}:${timeline}`;

  console.log(`[AI Milestones] Generating for goal ${input.goal.id} (${timeline} timeline)`);
  const result = await ai.generate<MilestoneGenerationOutput>(
    'generate-milestones',
    buildMilestoneGenerationPrompt(input),
    milestoneGenerationSchema,
    cacheKey,
    7 * 24 * 60 * 60
  );

  result.goalId = input.goal.id;
  return result;
}

async function validateMilestoneRequest(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
    return { error: NextResponse.json({ error: 'AI features are currently disabled' }, { status: 503 }) };
  }

  const input = (await req.json().catch(() => null)) as MilestoneGenerationInput | null;
  if (!input) return { error: NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) };
  if (!input.goal?.id || !input.goal?.title) {
    return { error: NextResponse.json({ error: 'Goal information is required' }, { status: 400 }) };
  }

  return { input };
}

export async function POST(req: NextRequest) {
  try {
    const validated = await validateMilestoneRequest(req);
    if (validated.error) return validated.error;
    return NextResponse.json(await executeMilestoneGeneration(validated.input));
  } catch (error: any) {
    console.error('Milestone Generation Route Error:', error);
    return buildMilestoneErrorResponse(error);
  }
}
