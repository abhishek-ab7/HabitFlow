import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { subtaskGenerationSchema } from '@/lib/ai/schemas';
import { buildSubtaskPrompt } from '@/lib/ai/prompts';
import type { SubtaskGenerationInput, SubtaskGenerationOutput } from '@/lib/ai/types';

function buildSubtasksErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const isRateLimit = message.includes('429') || message.includes('quota') || message.includes('rate limit');
  return NextResponse.json(
    {
      error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to generate subtasks',
      details: message,
    },
    { status: isRateLimit ? 429 : 500 }
  );
}

export async function POST(req: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
      return NextResponse.json({ error: 'AI features are currently disabled' }, { status: 503 });
    }

    const { title, description } = await req.json() as SubtaskGenerationInput;
    const ai = new HabitFlowAI('tasks');
    const prompt = buildSubtaskPrompt({ title, description });

    console.log(`[AI Subtasks] Generating for task: "${title}"`);
    const result = await ai.generate<SubtaskGenerationOutput>('generate-subtasks', prompt, subtaskGenerationSchema);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('AI Generation Error:', error);
    return buildSubtasksErrorResponse(error);
  }
}
