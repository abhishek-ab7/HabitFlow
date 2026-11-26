import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { MealTemplate } from '@/lib/types';
import { buildStarterTemplates } from './diet-builders';

const seedingStarterLocks = new Map<string, Promise<void>>();

function getSafeLocalStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  if (typeof window.localStorage.getItem !== 'function') return null;
  if (typeof window.localStorage.setItem !== 'function') return null;
  return window.localStorage;
}

async function hasRemoteMealTemplates(userId: string): Promise<boolean> {
  if (userId === 'local-demo-user') return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try {
    const { getSupabaseClient } = await import('@/lib/supabase/client');
    const supabase = getSupabaseClient();
    if (!supabase || typeof supabase.from !== 'function') return false;
    const { count, error } = await (supabase.from('meal_templates') as any)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    return !error && typeof count === 'number' && count > 0;
  } catch {
    return false;
  }
}

interface SeedCheckContext {
  userId: string;
  storage: Storage | null;
  flagKey: string;
}

async function hasAnyExistingTemplates(ctx: SeedCheckContext): Promise<boolean> {
  if (ctx.storage?.getItem(ctx.flagKey)) return true;
  const totalEver = await db.mealTemplates.where('userId').equals(ctx.userId).count();
  if (totalEver > 0) {
    ctx.storage?.setItem(ctx.flagKey, '1');
    return true;
  }
  if (await hasRemoteMealTemplates(ctx.userId)) {
    ctx.storage?.setItem(ctx.flagKey, '1');
    return true;
  }
  return false;
}

async function runSeedStarterStaples(
  userId: string,
  onSeeded: (templates: MealTemplate[]) => void
): Promise<void> {
  const flagKey = `hf_fitness_staples_seeded_${userId}`;
  const storage = getSafeLocalStorage();
  if (await hasAnyExistingTemplates({ userId, storage, flagKey })) return;

  const recheckEver = await db.mealTemplates.where('userId').equals(userId).count();
  if (recheckEver > 0) return;

  const created = buildStarterTemplates(userId, new Date().toISOString());
  await db.mealTemplates.bulkPut(created);
  storage?.setItem(flagKey, '1');
  onSeeded([...created].sort((a, b) => a.order - b.order));
}

export async function seedStarterStaplesImpl(
  userId: string,
  onSeeded: (templates: MealTemplate[]) => void
): Promise<void> {
  if (!userId) return;
  const inflight = seedingStarterLocks.get(userId);
  if (inflight) return inflight;

  const run = runSeedStarterStaples(userId, onSeeded).catch((err) => {
    logger.warn('[FitnessStore] Starter staple seeding skipped:', err);
  });
  seedingStarterLocks.set(userId, run);
  try {
    await run;
  } finally {
    if (seedingStarterLocks.get(userId) === run) seedingStarterLocks.delete(userId);
  }
}
