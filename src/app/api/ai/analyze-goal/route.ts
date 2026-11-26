import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { smartGoalAnalysisSchema } from '@/lib/ai/schemas';
import { buildGoalAnalysisPrompt } from '@/lib/ai/prompts';

function buildAiErrorResponse(error: any, fallbackMessage: string) {
  const msg = String(error?.message || '');
  const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('rate limit');
  return NextResponse.json(
    {
      error: isRateLimit ? 'AI quota exceeded. Try again later.' : fallbackMessage,
      details: msg || 'Unknown error',
      isRateLimit,
    },
    { status: isRateLimit ? 429 : 500 }
  );
}

async function executeGoalAnalysis(body: { goal: any; forceRefresh?: boolean }) {
  const { goal, forceRefresh } = body;
  const ai = new HabitFlowAI('dashboard');
  const prompt = buildGoalAnalysisPrompt(goal);
  const cacheKey = `smart-analysis:${goal.id}:${goal.title.substring(0, 20)}`;

  console.log(`[AI Goal Analysis] Analyzing goal ${goal.id}: ${goal.title}`);
  return ai.generate(
    'analyze-goal',
    prompt,
    smartGoalAnalysisSchema,
    forceRefresh ? undefined : cacheKey,
    24 * 60 * 60
  );
}

async function validateAnalyzeGoalRequest(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
    return { error: NextResponse.json({ error: 'AI features are currently disabled' }, { status: 503 }) };
  }

  const body = await req.json().catch(() => null);
  if (!body) return { error: NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) };
  if (!body.goal?.id || !body.goal?.title) {
    return { error: NextResponse.json({ error: 'Goal information is required' }, { status: 400 }) };
  }

  return { body };
}

export async function POST(req: NextRequest) {
  try {
    const validated = await validateAnalyzeGoalRequest(req);
    if (validated.error) return validated.error;
    return NextResponse.json(await executeGoalAnalysis(validated.body));
  } catch (error: any) {
    console.error('Goal Analysis Route Error:', error);
    return buildAiErrorResponse(error, 'Failed to analyze goal');
  }
}
