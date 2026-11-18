import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { quotePersonalizationSchema } from '@/lib/ai/schemas';
import { buildQuotePersonalizationPrompt } from '@/lib/ai/prompts';
import type { QuotePersonalizationInput, QuotePersonalizationOutput } from '@/lib/ai/types';

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

    const input = body as QuotePersonalizationInput;

    if (!input.userContext || !input.userContext.userName) {
      return NextResponse.json({ error: 'User context is required' }, { status: 400 });
    }

    // AI Service will handle key validation from pool

    const ai = new HabitFlowAI('dashboard');
    const prompt = buildQuotePersonalizationPrompt(input);

    // Cache key: based on context and user state (refresh more frequently)
    const mood = input.userContext.currentMood || 'neutral';
    const context = input.context || 'general';
    const date = new Date().toDateString();
    const cacheKey = `quote:${input.userContext.userName}:${mood}:${context}:${date}`;
    const cacheTTL = 6 * 60 * 60; // 6 hours (quotes should feel fresh)

    console.log(`[AI Quote] Generating for ${input.userContext.userName} (${mood}, ${context})${input.forceRefresh ? ' [FORCE REFRESH]' : ''}`);

    const result = await ai.generate<QuotePersonalizationOutput>(
      'motivate',
      prompt,
      quotePersonalizationSchema,
      input.forceRefresh ? undefined : cacheKey, // Skip cache if forceRefresh
      cacheTTL
    );

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Quote Personalization Route Error:', error);

    // Check for rate limit error
    const isRateLimit = error.message?.includes('429') ||
      error.message?.includes('quota') ||
      error.message?.includes('rate limit');

    return NextResponse.json(
      {
        error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to generate personalized quote',
        details: error.message || 'Unknown error',
        isRateLimit
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
