/**
 * AI Features Feature Flag
 * 
 * Centralized control for enabling/disabling all AI features in the app.
 * 
 * To disable AI features:
 * - Set NEXT_PUBLIC_ENABLE_AI_FEATURES=false in .env.local
 * - Restart the dev server
 * 
 * To enable AI features:
 * - Set NEXT_PUBLIC_ENABLE_AI_FEATURES=true in .env.local
 * - Restart the dev server
 */

export const isAIEnabled = (): boolean => {
  return process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES === 'true';
};
