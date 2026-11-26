/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/client';
import { db } from '@/lib/db';
import { ISynchronizer } from '../types';
import type { FitnessDailyLog, MealTemplate } from '@/lib/types';
import { shouldApplyRemoteRecord } from './column-fallback';
import {
  mapDailyLogToLocal,
  mapDailyLogToRemote,
  mergeDailyLogWithRemote,
  toNum,
} from './fitness-daily-merge';
import {
  mapMealLogToLocal,
  mapMealLogToRemote,
  mapMealTemplateToLocal,
  mapMealTemplateToRemote,
  mapProfileToLocal,
  mapProfileToRemote,
  mapSupplementLogToLocal,
  mapSupplementLogToRemote,
  mapSupplementToLocal,
  mapSupplementToRemote,
  mapWorkoutToLocal,
  mapWorkoutToRemote,
} from './fitness-mappers';
import {
  clearFitnessMissingTableCache,
  compareFitnessRecency,
  logFitnessSync,
  migrateOrphanedFitnessTables,
  pullFitnessTable,
  pullStandardFitnessRows,
  pushDirtyFitnessRows,
  syncStandardFitnessEntity,
} from './fitness-sync-runner';

export type FitnessUserId = string;
export type FitnessRemoteTable = string;

export interface FitnessSyncResult {
  domain: string;
  pushed: number;
  pulled: number;
  status: 'success' | 'partial_failure';
  errors: string[];
  durationMs: number;
}

export { clearFitnessMissingTableCache, mergeDailyLogWithRemote };

async function deduplicateProfiles(userId: FitnessUserId) {
  const profiles = await db.fitnessProfiles.where('userId').equals(userId).toArray();
  if (profiles.length <= 1) return;
  profiles.sort(compareFitnessRecency);
  const staleIds = profiles.slice(1).map((p) => p.id);
  if (staleIds.length > 0) await db.fitnessProfiles.bulkDelete(staleIds);
}

async function deduplicateDailyLogs(userId: FitnessUserId) {
  const logs = await db.fitnessDailyLogs.where('userId').equals(userId).toArray();
  const byDate = new Map<string, FitnessDailyLog[]>();
  for (const row of logs) {
    const list = byDate.get(row.date) || [];
    list.push(row);
    byDate.set(row.date, list);
  }

  const toDelete: string[] = [];
  for (const group of byDate.values()) {
    if (group.length <= 1) continue;
    group.sort(compareFitnessRecency);
    for (const dup of group.slice(1)) toDelete.push(dup.id);
  }
  if (toDelete.length > 0) await db.fitnessDailyLogs.bulkDelete(toDelete);
}

function groupActiveTemplatesByName(allTemplates: MealTemplate[]): Map<string, MealTemplate[]> {
  const activeByName = new Map<string, MealTemplate[]>();
  for (const row of allTemplates) {
    if (row.deletedAt) continue;
    const key = row.name.trim().toLowerCase();
    const list = activeByName.get(key) || [];
    list.push(row);
    activeByName.set(key, list);
  }
  return activeByName;
}

async function softDeleteDuplicateTemplateGroup(group: MealTemplate[], now: string) {
  if (group.length <= 1) return;
  group.sort((a, b) => {
    const recency = compareFitnessRecency(a, b);
    if (recency !== 0) return recency;
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });
  for (const dup of group.slice(1)) {
    await db.mealTemplates.update(dup.id, {
      deletedAt: now,
      isDirty: true,
      generationCounter: toNum(dup.generationCounter, 1) + 1,
      updatedAt: now,
    });
  }
}

async function deduplicateMealTemplates(userId: FitnessUserId) {
  const allTemplates = await db.mealTemplates.where('userId').equals(userId).toArray();
  const activeByName = groupActiveTemplatesByName(allTemplates);
  const now = new Date().toISOString();
  for (const group of activeByName.values()) {
    await softDeleteDuplicateTemplateGroup(group, now);
  }
}

async function saveReconciledDailyLog(
  oldId: string | undefined,
  nextLog: FitnessDailyLog,
  localByDate: Map<string, FitnessDailyLog>
) {
  if (oldId && oldId !== nextLog.id) {
    await db.fitnessDailyLogs.delete(oldId);
  }
  await db.fitnessDailyLogs.put(nextLog);
  localByDate.set(nextLog.date, nextLog);
}

async function reconcileRemoteDailyLog(
  r: any,
  localMatch: FitnessDailyLog | undefined,
  localByDate: Map<string, FitnessDailyLog>
): Promise<boolean> {
  if (!localMatch) {
    await saveReconciledDailyLog(undefined, mapDailyLogToLocal(r), localByDate);
    return true;
  }
  if (localMatch.isDirty) {
    const { merged } = mergeDailyLogWithRemote(localMatch, r);
    await saveReconciledDailyLog(localMatch.id, merged, localByDate);
    return true;
  }
  if (shouldApplyRemoteRecord(localMatch, r)) {
    await saveReconciledDailyLog(localMatch.id, mapDailyLogToLocal(r, localMatch.createdAt), localByDate);
    return true;
  }
  return false;
}

const STANDARD_FITNESS_SPECS = {
  meal_logs: () => ({
    remoteTable: 'meal_logs',
    table: db.mealLogs,
    toRemote: mapMealLogToRemote,
    toLocal: mapMealLogToLocal,
  }),
  workout_sessions: () => ({
    remoteTable: 'workout_sessions',
    table: db.workoutSessions,
    toRemote: mapWorkoutToRemote,
    toLocal: mapWorkoutToLocal,
  }),
  supplement_inventory: () => ({
    remoteTable: 'supplement_inventory',
    table: db.supplementInventory,
    toRemote: mapSupplementToRemote,
    toLocal: mapSupplementToLocal,
  }),
  supplement_logs: () => ({
    remoteTable: 'supplement_logs',
    table: db.supplementLogs,
    toRemote: mapSupplementLogToRemote,
    toLocal: mapSupplementLogToLocal,
  }),
} as const;

export class FitnessSyncEngine implements ISynchronizer {
  readonly domainName = 'Fitness';

  async syncProfiles(supabase: any, userId: FitnessUserId): Promise<{ pushed: number; pulled: number }> {
    let pulled = 0;
    await deduplicateProfiles(userId);

    const remoteRows = await pullFitnessTable(supabase, 'fitness_profiles', userId);
    if (remoteRows === null) return { pushed: 0, pulled: 0 };

    const localProfile = (await db.fitnessProfiles.where('userId').equals(userId).toArray())[0];
    for (const r of remoteRows) {
      if (!localProfile || shouldApplyRemoteRecord(localProfile, r)) {
        if (localProfile && localProfile.id !== r.id) await db.fitnessProfiles.delete(localProfile.id);
        await db.fitnessProfiles.put(mapProfileToLocal(r));
        pulled++;
      } else if (localProfile.id !== r.id) {
        await db.fitnessProfiles.delete(localProfile.id);
        await db.fitnessProfiles.put({ ...localProfile, id: r.id, isDirty: true });
      }
    }

    const pushed = await pushDirtyFitnessRows({
      supabase,
      userId,
      remoteTable: 'fitness_profiles',
      table: db.fitnessProfiles,
      toRemote: mapProfileToRemote,
      options: { onConflict: 'user_id' },
    });
    return { pushed, pulled };
  }

  async syncDailyLogs(supabase: any, userId: FitnessUserId): Promise<{ pushed: number; pulled: number }> {
    let pulled = 0;
    await deduplicateDailyLogs(userId);

    const remoteRows = await pullFitnessTable(supabase, 'fitness_daily_logs', userId);
    if (remoteRows === null) return { pushed: 0, pulled: 0 };

    const localLogs = await db.fitnessDailyLogs.where('userId').equals(userId).toArray();
    const localByDate = new Map(localLogs.map((row) => [row.date, row]));
    const localById = new Map(localLogs.map((row) => [row.id, row]));

    for (const r of remoteRows) {
      const localMatch = localByDate.get(r.date) || localById.get(r.id);
      if (await reconcileRemoteDailyLog(r, localMatch, localByDate)) pulled++;
    }

    await deduplicateDailyLogs(userId);
    const pushed = await pushDirtyFitnessRows({
      supabase,
      userId,
      remoteTable: 'fitness_daily_logs',
      table: db.fitnessDailyLogs,
      toRemote: mapDailyLogToRemote,
      options: { onConflict: 'user_id,date' },
    });
    return { pushed, pulled };
  }

  async syncMealTemplates(supabase: any, userId: FitnessUserId): Promise<{ pushed: number; pulled: number }> {
    const pulled = await pullStandardFitnessRows({
      supabase,
      userId,
      remoteTable: 'meal_templates',
      table: db.mealTemplates,
      toLocal: mapMealTemplateToLocal,
    });
    await deduplicateMealTemplates(userId);
    const pushed = await pushDirtyFitnessRows({
      supabase,
      userId,
      remoteTable: 'meal_templates',
      table: db.mealTemplates,
      toRemote: mapMealTemplateToRemote,
    });
    return { pushed, pulled };
  }

  private syncStandardDomain(
    key: keyof typeof STANDARD_FITNESS_SPECS,
    supabase: any,
    userId: FitnessUserId
  ) {
    const spec = STANDARD_FITNESS_SPECS[key]();
    return syncStandardFitnessEntity({ supabase, userId, ...(spec as any) });
  }

  syncMealLogs(supabase: any, userId: FitnessUserId) {
    return this.syncStandardDomain('meal_logs', supabase, userId);
  }

  syncWorkoutSessions(supabase: any, userId: FitnessUserId) {
    return this.syncStandardDomain('workout_sessions', supabase, userId);
  }

  syncSupplementInventory(supabase: any, userId: FitnessUserId) {
    return this.syncStandardDomain('supplement_inventory', supabase, userId);
  }

  syncSupplementLogs(supabase: any, userId: FitnessUserId) {
    return this.syncStandardDomain('supplement_logs', supabase, userId);
  }

  private async runStep(
    fn: () => Promise<{ pushed: number; pulled: number }>,
    errors: string[]
  ): Promise<{ pushed: number; pulled: number }> {
    try {
      return await fn();
    } catch (err: any) {
      logFitnessSync('error', 'Fitness sync step failed', err);
      errors.push(err?.message || String(err));
      return { pushed: 0, pulled: 0 };
    }
  }

  private async runAllTiers(supabase: any, userId: FitnessUserId, errors: string[]) {
    const tier1 = await Promise.all([
      this.runStep(() => this.syncProfiles(supabase, userId), errors),
      this.runStep(() => this.syncDailyLogs(supabase, userId), errors),
      this.runStep(() => this.syncMealTemplates(supabase, userId), errors),
      this.runStep(() => this.syncWorkoutSessions(supabase, userId), errors),
      this.runStep(() => this.syncSupplementInventory(supabase, userId), errors),
    ]);
    const tier2 = await Promise.all([
      this.runStep(() => this.syncMealLogs(supabase, userId), errors),
      this.runStep(() => this.syncSupplementLogs(supabase, userId), errors),
    ]);
    return [...tier1, ...tier2];
  }

  private buildSyncResult(
    startTime: number,
    pushed: number,
    pulled: number,
    errors: string[]
  ): FitnessSyncResult {
    return {
      domain: this.domainName,
      pushed,
      pulled,
      status: errors.length > 0 ? 'partial_failure' : 'success',
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  private async executeAuthenticatedSync(
    userId: FitnessUserId,
    errors: string[]
  ): Promise<{ pushed: number; pulled: number }> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { pushed: 0, pulled: 0 };

    await migrateOrphanedFitnessTables(userId);
    const results = await this.runAllTiers(supabase, userId, errors);
    return results.reduce(
      (acc, res) => ({ pushed: acc.pushed + res.pushed, pulled: acc.pulled + res.pulled }),
      { pushed: 0, pulled: 0 }
    );
  }

  async sync(userId: FitnessUserId): Promise<FitnessSyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    if (!userId || userId === 'local-demo-user') {
      return this.buildSyncResult(startTime, 0, 0, errors);
    }

    let totals = { pushed: 0, pulled: 0 };
    try {
      totals = await this.executeAuthenticatedSync(userId, errors);
    } catch (err: any) {
      logFitnessSync('error', 'Fitness sync failed', err);
      errors.push(err?.message || String(err));
    }

    return this.buildSyncResult(startTime, totals.pushed, totals.pulled, errors);
  }
}

export async function syncFitnessWithRetry(engine: any): Promise<FitnessSyncResult> {
  const userId = engine?.userId;
  if (!userId || userId === 'local-demo-user') {
    return { domain: 'Fitness', pushed: 0, pulled: 0, status: 'success', errors: [], durationMs: 0 };
  }

  const syncEngine = new FitnessSyncEngine();
  const report = await syncEngine.sync(userId);

  if (report.pulled > 0) {
    try {
      const { useFitnessStore } = await import('@/lib/stores/fitness');
      await useFitnessStore.getState().loadFitnessData(userId, true);
    } catch (e) {
      engine?.log?.('warn', 'Failed to refresh fitness store after sync', e);
    }
  }

  return report;
}
