import { NextRequest, NextResponse } from 'next/server';
import { getAIService } from '@/lib/ai/service';
import { burnoutCheckSchema } from '@/lib/ai/schemas';
import { buildBurnoutCheckPrompt } from '@/lib/ai/prompts';
import type { BurnoutCheckInput, BurnoutCheckOutput } from '@/lib/ai/types';

export async function POST(req: NextRequest) {
  try {
    // Check if AI features are enabled
    if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
      return NextResponse.json(
        { error: 'AI features are currently disabled' },
        { status: 503 }
      );
    }

    const body = await req.json() as BurnoutCheckInput;
    const { completionRates, streakData, taskVelocity } = body;

    if (!completionRates || !streakData || !taskVelocity) {
      return NextResponse.json({ 
        error: 'completionRates, streakData, and taskVelocity are required' 
      }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const ai = getAIService();
    const prompt = buildBurnoutCheckPrompt(body);

    // Cache for 4 hours (burnout detection should be fairly current)
    const userId = (req.headers.get('x-user-id') || 'anonymous');
    const cacheKey = `burnout:${userId}:${new Date().toDateString()}`;
    const cacheTTL = 4 * 60 * 60;

    console.log(`[AI Burnout] Analyzing burnout risk for user ${userId}`);

    const result = await ai.generate<BurnoutCheckOutput>(
      'burnout-check',
      prompt,
      burnoutCheckSchema,
      cacheKey,
      cacheTTL
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[AI Burnout] Error:', error);

    const isRateLimit = error.message?.includes('429') || 
                        error.message?.includes('quota') ||
                        error.message?.includes('rate limit');

    return NextResponse.json(
      { 
        error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to check burnout status',
        details: error.message 
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
