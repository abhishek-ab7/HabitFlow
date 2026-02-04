import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { subtaskGenerationSchema } from '@/lib/ai/schemas';
import { buildSubtaskPrompt } from '@/lib/ai/prompts';
import type { SubtaskGenerationInput, SubtaskGenerationOutput } from '@/lib/ai/types';

export async function POST(req: NextRequest) {
  try {
    // Check if AI features are enabled
    if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
      return NextResponse.json(
        { error: 'AI features are currently disabled' },
        { status: 503 }
      );
    }

    const { title, description } = await req.json() as SubtaskGenerationInput;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const ai = new HabitFlowAI('tasks');
    const prompt = buildSubtaskPrompt({ title, description });

    console.log(`[AI Subtasks] Generating for task: "${title}"`);

    // No caching for subtasks - each task is unique
    const result = await ai.generate<SubtaskGenerationOutput>(
      'generate-subtasks',
      prompt,
      subtaskGenerationSchema
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('AI Generation Error:', error);

    const isRateLimit = error.message?.includes('429') ||
      error.message?.includes('quota') ||
      error.message?.includes('rate limit');

    return NextResponse.json(
      {
        error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to generate subtasks',
        details: error.message
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
