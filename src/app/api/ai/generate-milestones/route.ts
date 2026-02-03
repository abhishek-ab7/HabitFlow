import { NextRequest, NextResponse } from 'next/server';
import { getAIService } from '@/lib/ai/service';
import { milestoneGenerationSchema } from '@/lib/ai/schemas';
import { buildMilestoneGenerationPrompt } from '@/lib/ai/prompts';
import type { MilestoneGenerationInput, MilestoneGenerationOutput } from '@/lib/ai/types';

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

    const input = body as MilestoneGenerationInput;
    
    if (!input.goal || !input.goal.id || !input.goal.title) {
      return NextResponse.json({ error: 'Goal information is required' }, { status: 400 });
    }
    
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service is not configured.' },
        { status: 500 }
      );
    }

    const ai = getAIService();
    const prompt = buildMilestoneGenerationPrompt(input);
    
    // Cache key: goal-specific, long TTL (milestones don't change often)
    const timeline = input.userContext?.timelinePreference || 'balanced';
    const cacheKey = `milestones:${input.goal.id}:${timeline}`;
    const cacheTTL = 7 * 24 * 60 * 60; // 7 days

    console.log(`[AI Milestones] Generating for goal ${input.goal.id} (${timeline} timeline)`);

    const result = await ai.generate<MilestoneGenerationOutput>(
      'generate-milestones',
      prompt,
      milestoneGenerationSchema,
      cacheKey,
      cacheTTL
    );

    // Ensure goalId is set
    result.goalId = input.goal.id;

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Milestone Generation Route Error:', error);

    // Check for rate limit error
    const isRateLimit = error.message?.includes('429') || 
                        error.message?.includes('quota') ||
                        error.message?.includes('rate limit');

    return NextResponse.json(
      {
        error: isRateLimit ? 'AI quota exceeded. Try again later.' : 'Failed to generate milestones',
        details: error.message || 'Unknown error',
        isRateLimit
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
