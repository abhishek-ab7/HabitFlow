// Unified AI Service Layer for HabitFlow
// REFACTORED: Module-Based API Key Rotation System (3 pools × 3 keys)

import { GoogleGenAI } from '@google/genai';
import { getCachedResponse, setCachedResponse } from './cache';
import { resolveGeminiModel } from './model-router';
import { retryWithBackoff } from './retry';
import type { AIFeature } from './types';

// Module type definition for isolated key pools
export type AIModule = 'dashboard' | 'tasks' | 'habits';
export type PromptText = string;
export type CacheKey = string;
export type ApiKeyString = string;

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
  private model = resolveGeminiModel('fast');

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
  }

  private static loadModuleKeys(mod: AIModule, fallbackKey?: string): string[] {
    const moduleUpper = mod.toUpperCase();
    const keys: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const apiKey = process.env[`GEMINI_KEY_${moduleUpper}_${i}`];
      if (apiKey) keys.push(apiKey);
    }
    if (keys.length > 0) return keys;
    if (fallbackKey) return [fallbackKey];
    console.warn(`[AI Service] No keys configured for ${mod} (set GEMINI_API_KEY or GEMINI_KEY_${moduleUpper}_1..3)`);
    return [];
  }

  // Static initializer: Load keys from environment on first import
  private static initializeKeyPools(): Record<AIModule, string[]> {
    const modules: AIModule[] = ['dashboard', 'tasks', 'habits'];
    const pools: Record<AIModule, string[]> = {} as any;
    const fallbackKey = process.env.GEMINI_API_KEY;
    for (const mod of modules) {
      pools[mod] = HabitFlowAI.loadModuleKeys(mod, fallbackKey);
    }
    return pools;
  }

  private isKeyCoolingDown(healthKey: string, now: number): boolean {
    const health = HabitFlowAI.keyHealth.get(healthKey);
    if (!health) return false;
    const elapsed = now - health.lastFailureTime;
    if (elapsed < health.cooldownMs) {
      return true;
    }
    HabitFlowAI.keyHealth.delete(healthKey);
    return false;
  }

  // Key selection with health tracking
  private selectHealthyKey(): string | null {
    const keys = HabitFlowAI.KEY_POOLS[this.module];
    const now = Date.now();
    for (let i = 0; i < keys.length; i++) {
      const keyIndex = (this.currentKeyIndex + i) % keys.length;
      if (this.isKeyCoolingDown(`${this.module}:${keyIndex}`, now)) continue;
      this.currentKeyIndex = keyIndex;
      return keys[keyIndex];
    }
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

  private async tryReadCache<T>(feature: AIFeature, cacheKey?: CacheKey): Promise<T | null> {
    if (!cacheKey) return null;
    const cached = await getCachedResponse<T>(cacheKey);
    if (cached) {
      return cached;
    }
    return null;
  }

  private async resolveCacheFallback<T>(feature: AIFeature, cacheKey?: CacheKey): Promise<T> {
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

  private parseJsonResponse<T>(feature: AIFeature, result: string): T {
    try {
      if (!result) throw new Error('Empty response from AI');
      return JSON.parse(result) as T;
    } catch {
      console.error(`[AI] Failed to parse JSON for ${feature}:`, result);
      throw new Error(`Failed to parse AI response for ${feature}`);
    }
  }

  private async executePromptWithKey(params: {
    apiKey: ApiKeyString;
    feature: AIFeature;
    prompt: PromptText;
    schema?: any;
  }): Promise<string> {
    const { apiKey, feature, prompt, schema } = params;
    return retryWithBackoff(
      async () => {
        const client = new GoogleGenAI({ apiKey });
        const config = schema ? { responseMimeType: 'application/json', responseSchema: schema } : undefined;
        const response = await client.models.generateContent({
          model: this.model,
          contents: prompt,
          ...(config && { config }),
        });
        return response.text || '';
      },
      { maxRetries: 3, feature }
    );
  }

  private async runWithKeyRotation(params: {
    apiKey: ApiKeyString;
    feature: AIFeature;
    prompt: PromptText;
    schema?: any;
    onRetry: () => Promise<string>;
  }): Promise<string> {
    const { apiKey, feature, prompt, schema, onRetry } = params;
    return this.processInQueue(async () => {
      const currentKeyIndex = this.currentKeyIndex;
      try {
        return await this.executePromptWithKey({ apiKey, feature, prompt, schema });
      } catch (error: any) {
        const isRateLimit = error?.message?.includes('429') || error?.status === 429;
        if (!isRateLimit) throw error;
        this.markKeyUnhealthy(currentKeyIndex);
        return onRetry();
      }
    });
  }

  private advanceKeyIndex(): void {
    const keys = HabitFlowAI.KEY_POOLS[this.module];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % keys.length;
  }

  async generate<T>(
    feature: AIFeature,
    prompt: PromptText,
    schema?: any,
    cacheKey?: CacheKey,
    cacheTTL?: number
  ): Promise<T> {
    const cached = await this.tryReadCache<T>(feature, cacheKey);
    if (cached) return cached;

    const apiKey = this.selectHealthyKey();
    if (!apiKey) return this.resolveCacheFallback<T>(feature, cacheKey);

    const result = await this.runWithKeyRotation({
      apiKey,
      feature,
      prompt,
      schema,
      onRetry: () => this.generate<T>(feature, prompt, schema, cacheKey, cacheTTL) as any as Promise<string>,
    });

    this.advanceKeyIndex();
    const data = this.parseJsonResponse<T>(feature, result);
    if (cacheKey && cacheTTL) {
      await setCachedResponse(cacheKey, data, cacheTTL);
    }
    return data;
  }

  async generateWithoutSchema(
    feature: AIFeature,
    prompt: PromptText,
    cacheKey?: CacheKey,
    cacheTTL?: number
  ): Promise<string> {
    const cached = await this.tryReadCache<string>(feature, cacheKey);
    if (cached) return cached;

    const apiKey = this.selectHealthyKey();
    if (!apiKey) return this.resolveCacheFallback<string>(feature, cacheKey);

    const result = await this.runWithKeyRotation({
      apiKey,
      feature,
      prompt,
      onRetry: () => {
        this.advanceKeyIndex();
        return this.generateWithoutSchema(feature, prompt, cacheKey, cacheTTL);
      },
    });

    this.advanceKeyIndex();
    if (cacheKey && cacheTTL) await setCachedResponse(cacheKey, result, cacheTTL);
    return result;
  }
}
