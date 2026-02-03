import { NextRequest, NextResponse } from 'next/server';
import { getAIService } from '@/lib/ai/service';
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
    
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service is not configured.' },
        { status: 500 }
      );
    }

    const ai = getAIService();
    const prompt = buildQuotePersonalizationPrompt(input);
    
    // Cache key: based on context and user state (refresh more frequently)
    const mood = input.userContext.currentMood || 'neutral';
    const context = input.context || 'general';
    const date = new Date().toDateString();
    const cacheKey = `quote:${input.userContext.userName}:${mood}:${context}:${date}`;
    const cacheTTL = 6 * 60 * 60; // 6 hours (quotes should feel fresh)

    console.log(`[AI Quote] Generating for ${input.userContext.userName} (${mood}, ${context})`);

    const result = await ai.generate<QuotePersonalizationOutput>(
      'motivate',
      prompt,
      quotePersonalizationSchema,
      cacheKey,
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
