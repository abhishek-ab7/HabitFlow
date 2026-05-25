import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { coachBriefingSchema } from '@/lib/ai/schemas';
import { buildCoachPrompt } from '@/lib/ai/prompts';
import type { CoachBriefingInput, CoachBriefingOutput } from '@/lib/ai/types';

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

    const { userData, context } = body as CoachBriefingInput;

    // AI Service will handle key validation from pool


    const ai = new (await import('@/lib/ai/service')).HabitFlowAI('dashboard');
    const prompt = buildCoachPrompt({ userData, context });

    // Generate cache key based on user and date
    const cacheKey = `coach:${userData?.userId || 'anonymous'}:${new Date().toDateString()}:${context?.mode || 'briefing'}`;
    const cacheTTL = 6 * 60 * 60; // 6 hours

    console.log(`[AI Coach] Generating briefing for user ${userData?.userId}${body.forceRefresh ? ' [FORCE REFRESH]' : ''}`);

    const result = await ai.generate<CoachBriefingOutput>(
      'coach',
      prompt,
      coachBriefingSchema,
      body.forceRefresh ? undefined : cacheKey, // Skip cache if forceRefresh
      cacheTTL
    );

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('AI Coach Route Error:', error);

    // Check for rate limit error
    const isRateLimit = error.message?.includes('429') ||
      error.message?.includes('quota') ||
      error.message?.includes('rate limit');

    return NextResponse.json(
      {
        error: isRateLimit ? 'Daily AI quota exceeded. Try again later.' : 'AI Coach error',
        details: error.message || 'Unknown error',
        isRateLimit
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
