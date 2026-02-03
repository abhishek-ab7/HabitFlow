import { NextRequest, NextResponse } from 'next/server';
import { getAIService } from '@/lib/ai/service';
import { taskPrioritySchema } from '@/lib/ai/schemas';
import { buildPrioritizePrompt } from '@/lib/ai/prompts';
import type { TaskPriorityInput, TaskPriorityOutput } from '@/lib/ai/types';

export async function POST(req: NextRequest) {
  try {
    // Check if AI features are enabled
    if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
      return NextResponse.json(
        { error: 'AI features are currently disabled' },
        { status: 503 }
      );
    }

    const body = await req.json() as TaskPriorityInput;
    const { task, userContext } = body;

    if (!task || !task.id || !task.title) {
      return NextResponse.json({ error: 'Task id and title are required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const ai = getAIService();
    const prompt = buildPrioritizePrompt(body);

    // Cache task priority for 6 hours (invalidate when task is updated/completed)
    const cacheKey = `priority:${task.id}:${task.due_date || 'no-due'}`;
    const cacheTTL = 6 * 60 * 60;

    console.log(`[AI Priority] Analyzing task: "${task.title}"`);

    const result = await ai.generate<TaskPriorityOutput>(
      'prioritize',
      prompt,
      taskPrioritySchema,
      cacheKey,
      cacheTTL
    );

    // Ensure taskId matches
    result.taskId = task.id;

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[AI Priority] Error:', error);

    const isRateLimit = error.message?.includes('429') || 
                        error.message?.includes('quota') ||
                        error.message?.includes('rate limit');

    return NextResponse.json(
      { 
        error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to prioritize task',
        details: error.message 
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
