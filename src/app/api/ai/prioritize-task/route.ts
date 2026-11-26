import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { taskPrioritySchema } from '@/lib/ai/schemas';
import { buildPrioritizePrompt } from '@/lib/ai/prompts';
import type { TaskPriorityInput, TaskPriorityOutput } from '@/lib/ai/types';

function buildPriorityErrorResponse(error: any) {
  const msg = String(error?.message || '');
  const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('rate limit');
  return NextResponse.json(
    { error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to prioritize task', details: msg },
    { status: isRateLimit ? 429 : 500 }
  );
}

export async function POST(req: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
      return NextResponse.json({ error: 'AI features are currently disabled' }, { status: 503 });
    }

    const body = (await req.json()) as TaskPriorityInput;
    const { task } = body;
    const isValidTask = Boolean(task?.id && task?.title);
    if (!isValidTask) {
      return NextResponse.json({ error: 'Task id and title are required' }, { status: 400 });
    }

    const ai = new HabitFlowAI('tasks');
    const cacheKey = `priority:${task.id}:${task.due_date || 'no-due'}`;
    console.log(`[AI Priority] Analyzing task: "${task.title}"`);

    const result = await ai.generate<TaskPriorityOutput>(
      'prioritize',
      buildPrioritizePrompt(body),
      taskPrioritySchema,
      cacheKey,
      6 * 60 * 60
    );

    result.taskId = task.id;
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[AI Priority] Error:', error);
    return buildPriorityErrorResponse(error);
  }
}
