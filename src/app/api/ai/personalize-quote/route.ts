import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { quotePersonalizationSchema } from '@/lib/ai/schemas';
import { buildQuotePersonalizationPrompt } from '@/lib/ai/prompts';
import type { QuotePersonalizationInput, QuotePersonalizationOutput } from '@/lib/ai/types';

function buildQuoteErrorResponse(error: any) {
  const msg = String(error?.message || '');
  const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('rate limit');
  return NextResponse.json(
    {
      error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to generate personalized quote',
      details: msg || 'Unknown error',
      isRateLimit,
    },
    { status: isRateLimit ? 429 : 500 }
  );
}

async function executeQuotePersonalization(input: QuotePersonalizationInput) {
  const ai = new HabitFlowAI('dashboard');
  const mood = input.userContext.currentMood || 'neutral';
  const context = input.context || 'general';
  const cacheKey = `quote:${input.userContext.userName}:${mood}:${context}:${new Date().toDateString()}`;

  console.log(`[AI Quote] Generating for ${input.userContext.userName} (${mood}, ${context})${input.forceRefresh ? ' [FORCE REFRESH]' : ''}`);
  return ai.generate<QuotePersonalizationOutput>(
    'motivate',
    buildQuotePersonalizationPrompt(input),
    quotePersonalizationSchema,
    input.forceRefresh ? undefined : cacheKey,
    6 * 60 * 60
  );
}

export async function POST(req: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
      return NextResponse.json({ error: 'AI features are currently disabled' }, { status: 503 });
    }

    const input = (await req.json().catch(() => null)) as QuotePersonalizationInput | null;
    if (!input) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    if (!input.userContext?.userName) {
      return NextResponse.json({ error: 'User context is required' }, { status: 400 });
    }

    return NextResponse.json(await executeQuotePersonalization(input));
  } catch (error: any) {
    console.error('Quote Personalization Route Error:', error);
    return buildQuoteErrorResponse(error);
  }
}
