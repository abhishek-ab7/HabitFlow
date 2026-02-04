// Unified AI Service Layer for HabitFlow
// REFACTORED: Module-Based API Key Rotation System (3 pools × 3 keys)

import { GoogleGenAI } from '@google/genai';
import { getCachedResponse, setCachedResponse } from './cache';
import { retryWithBackoff } from './retry';
import type { AIFeature } from './types';

// Module type definition for isolated key pools
export type AIModule = 'dashboard' | 'tasks' | 'habits';

interface KeyHealth {
  lastFailureTime: number;
  cooldownMs: number;
}

export class HabitFlowAI {
  // Static configuration: Load all 9 keys from environment
  private static KEY_POOLS: Record<AIModule, string[]> = HabitFlowAI.initializeKeyPools();

  // Health tracking: Shared across all instances per module+key
  private static keyHealth = new Map<string, KeyHealth>();

  // Request queue: Per instance to prevent race conditions
  private requestQueue: Promise<void> = Promise.resolve();
  private lastRequestTime = 0;
  private MIN_REQUEST_INTERVAL = 4000; // 4 seconds = 15 requests per minute max

  // Instance configuration
  private module: AIModule;
  private currentKeyIndex: number = 0;
  private model = 'gemini-2.5-flash-lite';

  constructor(module: AIModule) {
    this.module = module;

    // Validate module has keys configured
    const keys = HabitFlowAI.KEY_POOLS[module];
    if (!keys || keys.length === 0) {
      throw new Error(
        `No API keys configured for module "${module}". ` +
        `Expected GEMINI_KEY_${module.toUpperCase()}_1, _2, _3 in environment.`
      );
    }

    console.log(`[AI Service] Initialized for module: ${module} with ${keys.length} keys`);
  }

  // Static initializer: Load keys from environment on first import
  private static initializeKeyPools(): Record<AIModule, string[]> {
    const modules: AIModule[] = ['dashboard', 'tasks', 'habits'];
    const pools: Record<AIModule, string[]> = {} as any;

    for (const module of modules) {
      const moduleUpper = module.toUpperCase();
      const keys: string[] = [];

      for (let i = 1; i <= 3; i++) {
        const envKey = `GEMINI_KEY_${moduleUpper}_${i}`;
        const apiKey = process.env[envKey];
        if (apiKey) {
          keys.push(apiKey);
        } else {
          console.warn(`[AI Service] Missing ${envKey} - pool will have only ${keys.length} keys`);
        }
      }

      pools[module] = keys;
    }

    return pools;
  }

  // Key selection with health tracking
  private selectHealthyKey(): string | null {
    const keys = HabitFlowAI.KEY_POOLS[this.module];
    const poolSize = keys.length;
    const now = Date.now();

    // Try all keys starting from current index (round-robin)
    for (let i = 0; i < poolSize; i++) {
      const keyIndex = (this.currentKeyIndex + i) % poolSize;
      const key = keys[keyIndex];
      const healthKey = `${this.module}:${keyIndex}`;
      const health = HabitFlowAI.keyHealth.get(healthKey);

      // Check if key is in cooldown
      if (health) {
        const timeSinceFailure = now - health.lastFailureTime;
        if (timeSinceFailure < health.cooldownMs) {
          console.log(
            `[AI Key Health] Skipping ${this.module} key #${keyIndex + 1} ` +
            `(cooldown: ${Math.round((health.cooldownMs - timeSinceFailure) / 1000)}s remaining)`
          );
          continue;
        } else {
          // Cooldown expired, clear health record
          HabitFlowAI.keyHealth.delete(healthKey);
        }
      }

      // Key is healthy, use it
      this.currentKeyIndex = keyIndex;
      console.log(`[AI Key Rotation] Using ${this.module} key #${keyIndex + 1} (round-robin)`);
      return key;
    }

    // All keys unhealthy
    console.error(`[AI Key Health] All keys for ${this.module} are in cooldown!`);
    return null;
  }

  // Mark key as unhealthy after 429 error
  private markKeyUnhealthy(keyIndex: number): void {
    const healthKey = `${this.module}:${keyIndex}`;
    HabitFlowAI.keyHealth.set(healthKey, {
      lastFailureTime: Date.now(),
      cooldownMs: 60000 // 60 seconds
    });
    console.warn(`[AI Key Health] Marked ${this.module} key #${keyIndex + 1} as unhealthy (60s cooldown)`);
  }

  // Queue management (preserved from original)
  private async processInQueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.requestQueue.then(async () => {
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;

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
    // 1. Check Cache First
    if (cacheKey) {
      const cached = await getCachedResponse<T>(cacheKey);
      if (cached) {
        console.log(`[AI Cache HIT] ${feature} - key: ${cacheKey}`);
        return cached;
      }
      console.log(`[AI Cache MISS] ${feature} - key: ${cacheKey}`);
    }

    // 2. Select Healthy Key
    const apiKey = this.selectHealthyKey();
    if (!apiKey) {
      // All keys exhausted - try cache fallback
      if (cacheKey) {
        const staleCache = await getCachedResponse<T>(cacheKey);
        if (staleCache) {
          console.warn(`[AI Fallback] Returning stale cache for ${feature} (all keys unhealthy)`);
          return staleCache;
        }
      }
      throw new Error(
        `All API keys for module "${this.module}" are rate-limited. ` +
        `Please try again in 60 seconds or check your rate limits.`
      );
    }

    // 3. Execute with Rotation & Retry
    const result = await this.processInQueue(async () => {
      const currentKeyIndex = this.currentKeyIndex;

      try {
        return await retryWithBackoff(
          async () => {
            const client = new GoogleGenAI({ apiKey });
            const config: any = {};
            if (schema) {
              config.responseMimeType = 'application/json';
              config.responseSchema = schema;
            }

            const response = await client.models.generateContent({
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
      } catch (error: any) {
        // Check if 429 rate limit error
        if (error?.message?.includes('429') || error?.status === 429) {
          this.markKeyUnhealthy(currentKeyIndex);

          // Retry with next key (recursive call advances index internally)
          console.log(`[AI Retry] 429 error detected, retrying with next key...`);
          return this.generate<T>(feature, prompt, schema, cacheKey, cacheTTL) as any as string;
        }
        throw error;
      }
    });

    // 4. Advance to next key (round-robin)
    const keys = HabitFlowAI.KEY_POOLS[this.module];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % keys.length;

    // 5. Parse & Cache
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
    // 1. Check Cache
    if (cacheKey) {
      const cached = await getCachedResponse<string>(cacheKey);
      if (cached) {
        console.log(`[AI Cache HIT] ${feature} - key: ${cacheKey}`);
        return cached;
      }
    }

    // 2. Select Healthy Key
    const apiKey = this.selectHealthyKey();
    if (!apiKey) {
      if (cacheKey) {
        const staleCache = await getCachedResponse<string>(cacheKey);
        if (staleCache) {
          console.warn(`[AI Fallback] Returning stale cache for ${feature} (all keys unhealthy)`);
          return staleCache;
        }
      }
      throw new Error(`All API keys for module "${this.module}" are rate-limited.`);
    }

    // 3. Execute with Rotation
    const result = await this.processInQueue(async () => {
      const currentKeyIndex = this.currentKeyIndex;

      try {
        return await retryWithBackoff(
          async () => {
            const client = new GoogleGenAI({ apiKey });
            const response = await client.models.generateContent({
              model: this.model,
              contents: prompt
            });
            return response.text || '';
          },
          { maxRetries: 3, feature }
        );
      } catch (error: any) {
        if (error?.message?.includes('429') || error?.status === 429) {
          this.markKeyUnhealthy(currentKeyIndex);
          console.log(`[AI Retry] 429 error detected, retrying with next key...`);
          const keys = HabitFlowAI.KEY_POOLS[this.module];
          this.currentKeyIndex = (this.currentKeyIndex + 1) % keys.length;
          return await this.generateWithoutSchema(feature, prompt, cacheKey, cacheTTL);
        }
        throw error;
      }
    });

    // 4. Advance round-robin
    const keys = HabitFlowAI.KEY_POOLS[this.module];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % keys.length;

    // 5. Cache
    if (cacheKey && cacheTTL) {
      await setCachedResponse(cacheKey, result, cacheTTL);
    }

    return result;
  }
}
