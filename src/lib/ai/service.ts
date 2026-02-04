// Unified AI Service Layer for HabitFlow
// UPDATED: Added Rate Limiting Queue to prevent 429 Errors

import { GoogleGenAI } from '@google/genai';
import { getCachedResponse, setCachedResponse } from './cache';
import { retryWithBackoff } from './retry';
import type { AIFeature } from './types';

export class HabitFlowAI {
  private static instance: HabitFlowAI;
  private client: GoogleGenAI;
  private model = 'gemini-2.5-flash-lite';

  // 🟢 NEW: Queue system to enforce Rate Limits
  private requestQueue: Promise<void> = Promise.resolve();
  private lastRequestTime = 0;
  private MIN_REQUEST_INTERVAL = 4000; // 4 seconds = 15 requests per minute max

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

  // 🟢 NEW: Helper to throttle requests
  private async processInQueue<T>(operation: () => Promise<T>): Promise<T> {
    // Chain this request to the end of the current queue
    const result = this.requestQueue.then(async () => {
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;

      // If we are too fast, wait the difference
      if (timeSinceLast < this.MIN_REQUEST_INTERVAL) {
        const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLast;
        console.log(`[AI Queue] Throttling request by ${waitTime}ms to respect rate limits...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      try {
        this.lastRequestTime = Date.now();
        return await operation();
      } catch (e) {
        throw e;
      }
    });

    // Update the queue pointer (catch errors so the queue doesn't stall forever)
    this.requestQueue = result.then(() => { }).catch(() => { });

    return result;
  }

  async generate<T>(
    feature: AIFeature,
    prompt: string,
    schema?: any,
    cacheKey?: string,
    cacheTTL?: number
  ): Promise<T> {
    // 1. Check Cache First (Skip queue if cached!)
    if (cacheKey) {
      const cached = await getCachedResponse<T>(cacheKey);
      if (cached) {
        console.log(`[AI Cache HIT] ${feature} - key: ${cacheKey}`);
        return cached;
      }
      console.log(`[AI Cache MISS] ${feature} - key: ${cacheKey}`);
    }

    // 2. Add to Rate Limited Queue
    const result = await this.processInQueue(async () => {
      return await retryWithBackoff(
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
          feature
        }
      );
    });

    // 3. Parse & Cache
    let data: T;
    try {
      if (!result) throw new Error('Empty response from AI');
      data = JSON.parse(result);
    } catch (error) {
      console.error(`[AI] Failed to parse JSON for ${feature}:`, result);
      throw new Error(`Failed to parse AI response for ${feature}`);
    }

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
    if (cacheKey) {
      const cached = await getCachedResponse<string>(cacheKey);
      if (cached) {
        console.log(`[AI Cache HIT] ${feature} - key: ${cacheKey}`);
        return cached;
      }
    }

    // Wrap in queue
    const result = await this.processInQueue(async () => {
      return await retryWithBackoff(
        async () => {
          const response = await this.client.models.generateContent({
            model: this.model,
            contents: prompt
          });
          return response.text || '';
        },
        { maxRetries: 3, feature }
      );
    });

    if (cacheKey && cacheTTL) {
      await setCachedResponse(cacheKey, result, cacheTTL);
    }

    return result;
  }
}

export function getAIService(): HabitFlowAI {
  return HabitFlowAI.getInstance();
}
