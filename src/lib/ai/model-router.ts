import { DEFAULT_GEMINI_MODEL } from './gemini-server';

export type ModelTier = 'fast' | 'balanced' | 'reasoning';

const TIER_ENV_KEYS: Record<ModelTier, string> = {
  fast: 'GEMINI_MODEL_FAST',
  balanced: 'GEMINI_MODEL_BALANCED',
  reasoning: 'GEMINI_MODEL_REASONING',
};

const TIER_DEFAULTS: Record<ModelTier, string> = {
  fast: 'gemini-2.5-flash-lite',
  balanced: DEFAULT_GEMINI_MODEL,
  reasoning: DEFAULT_GEMINI_MODEL,
};

/**
 * Resolves the Gemini model identifier for a given latency/reasoning tier.
 * Pure TypeScript (zero DOM/Next imports) so Web and Expo Mobile share the same routing contract.
 */
export function resolveGeminiModel(tier: ModelTier = 'balanced'): string {
  const envKey = TIER_ENV_KEYS[tier];
  const override = typeof process !== 'undefined' ? process.env?.[envKey]?.trim() : undefined;
  return override || TIER_DEFAULTS[tier] || DEFAULT_GEMINI_MODEL;
}
