// Unified AI Service Layer for HabitFlow

import { GoogleGenAI } from '@google/genai';
import { getCachedResponse, setCachedResponse } from './cache';
import { retryWithBackoff } from './retry';
import type { AIFeature } from './types';

export class HabitFlowAI {
  private static instance: HabitFlowAI;
  private client: GoogleGenAI;
  private model = 'gemini-2.0-flash'; // Standard free model

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  static getInstance(): HabitFlowAI {
    if (!HabitFlowAI.instance) {
      HabitFlowAI.instance = new HabitFlowAI();
    }
    return HabitFlowAI.instance;
  }

  async generate<T>(
    feature: AIFeature,
    prompt: string,
    schema?: any,
    cacheKey?: string,
    cacheTTL?: number
  ): Promise<T> {
    // Check cache first
    if (cacheKey) {
      const cached = await getCachedResponse<T>(cacheKey);
      if (cached) {
        console.log(`[AI Cache HIT] ${feature} - key: ${cacheKey}`);
        return cached;
      }
      console.log(`[AI Cache MISS] ${feature} - key: ${cacheKey}`);
    }

    // Generate with retry logic
    const result = await retryWithBackoff(
      async () => {
        const config: any = {};
        if (schema) {
          config.responseMimeType = 'application/json';
          config.responseSchema = schema;
        }

        const response = await this.client.models.generateContent({
          model: this.model,
          contents: prompt,
          ...(Object.keys(config).length > 0 && { config })
        });

        return response.text || '';
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        feature
      }
    );

    // Parse JSON response
    let data: T;
    try {
      if (!result) {
        throw new Error('Empty response from AI');
      }
      data = JSON.parse(result);
    } catch (error) {
      console.error(`[AI] Failed to parse JSON for ${feature}:`, result);
      throw new Error(`Failed to parse AI response for ${feature}`);
    }

    // Cache the result
    if (cacheKey && cacheTTL) {
      await setCachedResponse(cacheKey, data, cacheTTL);
      console.log(`[AI] Cached ${feature} for ${cacheTTL}s - key: ${cacheKey}`);
    }

    return data;
  }

  async generateWithoutSchema(
    feature: AIFeature,
    prompt: string,
    cacheKey?: string,
    cacheTTL?: number
  ): Promise<string> {
    // Check cache first
    if (cacheKey) {
      const cached = await getCachedResponse<string>(cacheKey);
      if (cached) {
        console.log(`[AI Cache HIT] ${feature} - key: ${cacheKey}`);
        return cached;
      }
    }

    // Generate with retry logic
    const result = await retryWithBackoff(
      async () => {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents: prompt
        });
        return response.text || '';
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        feature
      }
    );

    if (!result) {
      throw new Error(`Empty response from AI for ${feature}`);
    }

    // Cache the result
    if (cacheKey && cacheTTL) {
      await setCachedResponse(cacheKey, result, cacheTTL);
    }

    return result;
  }
}

// Export singleton instance getter
export function getAIService(): HabitFlowAI {
  return HabitFlowAI.getInstance();
}
