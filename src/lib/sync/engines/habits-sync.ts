import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { upsertRowsWithColumnFallback } from './column-fallback';
import {
  mapCompletionToRemoteRow,
  mapHabitToLegacyRow,
  mapHabitToRemoteRow,
  mapRemoteToLocalCompletion,
  mapRemoteToLocalHabit,
} from './habits-sync-mappers';
import type { Habit } from '@/lib/types';
import type { ISynchronizer } from '../types';

function resolveSinceTimestamp(latestTs: string | null | undefined): string {
  if (latestTs && latestTs !== 'undefined') return latestTs;
  return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
}

function isRemoteNewer(local: { generationCounter?: number } | undefined, remote: any): boolean {
  if (!local) return true;
  return (remote.generation_counter || 0) > (local.generationCounter || 0);
}

async function applyRemoteRecords<T extends { id: string; generationCounter?: number }>(
  dexieTable: any,
  remoteData: any[],
  mapRemote: (remote: any, local: T | undefined) => T
): Promise<number> {
  let pulledCount = 0;
  await db.transaction('rw', dexieTable, async () => {
    for (const remote of remoteData) {
      const local = await dexieTable.get(remote.id);
      if (!isRemoteNewer(local, remote)) continue;
      await dexieTable.put(mapRemote(remote, local));
      pulledCount++;
    }
  });
  return pulledCount;
}

async function pullRemoteRecords<T extends { id: string; generationCounter?: number; updatedAt?: string }>(params: {
  supabase: any;
  remoteTable: string;
  dexieTable: any;
  userId: string;
  label: string;
  mapRemote: (remote: any, local: T | undefined) => T;
}): Promise<number> {
  const latestLocal: T[] = await params.dexieTable.where('userId').equals(params.userId).sortBy('updatedAt');
  const since = resolveSinceTimestamp(latestLocal.at(-1)?.updatedAt);

  const { data: remoteData, error: pullError } = await (params.supabase.from(params.remoteTable) as any)
    .select('*')
    .eq('user_id', params.userId)
    .gt('updated_at', since);

  if (pullError) throw new Error(`[${params.label} Pull Failure]: ${pullError.message}`);
  if (!remoteData?.length) return 0;
  return applyRemoteRecords(params.dexieTable, remoteData, params.mapRemote);
}

async function runDomainSync<T extends { id: string; generationCounter?: number; updatedAt?: string }>(params: {
  push: () => Promise<number>;
  supabase: any;
  remoteTable: string;
  dexieTable: any;
  userId: string;
  label: string;
  mapRemote: (remote: any, local: T | undefined) => T;
}): Promise<{ pushed: number; pulled: number; status: 'success' }> {
  const pushed = await params.push();
  const pulled = await pullRemoteRecords(params);
  return { pushed, pulled, status: 'success' };
}

abstract class BaseHabitSyncEngine<T extends { id: string; generationCounter?: number; updatedAt?: string }> implements ISynchronizer {
  public abstract domainName: string;
  protected supabase = getSupabaseClient();
  protected abstract remoteTable: string;
  protected abstract dexieTable: any;
  protected abstract label: string;
  protected abstract pushDirty(userId: string): Promise<number>;
  protected abstract mapRemote(remote: any, local: T | undefined): T;

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    return runDomainSync({
      push: () => this.pushDirty(userId),
      supabase: this.supabase,
      remoteTable: this.remoteTable,
      dexieTable: this.dexieTable,
      userId,
      label: this.label,
      mapRemote: (r, l) => this.mapRemote(r, l),
    });
  }
}

export class HabitsSyncEngine extends BaseHabitSyncEngine<Habit> {
  public domainName = 'habits';
  protected remoteTable = 'habits';
  protected dexieTable = db.habits;
  protected label = 'HabitsSyncEngine';

  protected mapRemote(remote: any, local: Habit | undefined) {
    return mapRemoteToLocalHabit(remote, local);
  }

  protected async pushDirty(userId: string): Promise<number> {
    const dirtyLocalHabits = await db.habits
      .where('userId')
      .equals(userId)
      .filter((habit: any) => habit.isDirty === true || habit.isDirty === 1)
      .toArray();

    let pushedCount = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < dirtyLocalHabits.length; i += BATCH_SIZE) {
      const batch = dirtyLocalHabits.slice(i, i + BATCH_SIZE);
      const payload = batch.map((h) => mapHabitToRemoteRow(userId, h));
      const { error } = await upsertRowsWithColumnFallback(this.supabase, 'habits', payload, {
        onConflict: 'id',
      });

      if (error) {
        const legacyPayload = batch.map((h) => mapHabitToLegacyRow(userId, h));
        const { error: fallbackError } = await (this.supabase.from('habits') as any).upsert(
          legacyPayload,
          { onConflict: 'id' }
        );
        if (fallbackError) {
          throw new Error(`[HabitsSyncEngine Bulk Push Failure]: ${fallbackError.message}`);
        }
      }

      await db.transaction('rw', db.habits, async () => {
        await Promise.all(batch.map((b) => db.habits.update(b.id, { isDirty: false })));
      });
      pushedCount += batch.length;
    }
    return pushedCount;
  }
}

export class CompletionsSyncEngine extends BaseHabitSyncEngine<import('@/lib/types').HabitCompletion> {
  public domainName = 'completions';
  protected remoteTable = 'completions';
  protected dexieTable = db.completions;
  protected label = 'CompletionsSyncEngine';

  protected mapRemote(remote: any, local: import('@/lib/types').HabitCompletion | undefined) {
    return mapRemoteToLocalCompletion(remote, local);
  }

  protected async pushDirty(userId: string): Promise<number> {
    const dirtyLocalCompletions = await db.completions
      .where('userId')
      .equals(userId)
      .filter((c: any) => c.isDirty === true || c.isDirty === 1)
      .toArray();

    let pushedCount = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < dirtyLocalCompletions.length; i += BATCH_SIZE) {
      const batch = dirtyLocalCompletions.slice(i, i + BATCH_SIZE);
      const payload = batch.map((c) => mapCompletionToRemoteRow(userId, c));
      const { error } = await upsertRowsWithColumnFallback(this.supabase, 'completions', payload, {
        onConflict: 'habit_id,date',
      });
      if (error) {
        throw new Error(`[CompletionsSyncEngine Bulk Push Failure]: ${error.message}`);
      }

      await db.transaction('rw', db.completions, async () => {
        await Promise.all(batch.map((b) => db.completions.update(b.id, { isDirty: false })));
      });
      pushedCount += batch.length;
    }
    return pushedCount;
  }
}

export async function syncHabitsWithRetry(engine: any) {
  return new HabitsSyncEngine().sync(engine.userId);
}

export async function syncCompletionsWithRetry(engine: any) {
  return new CompletionsSyncEngine().sync(engine.userId);
}

export async function pushHabitToRemote(engine: any, habit: Habit) {
  const supabase = getSupabaseClient();
  const payload = mapHabitToRemoteRow(engine.userId, habit);
  const { error } = await upsertRowsWithColumnFallback(supabase, 'habits', payload, {
    onConflict: 'id',
  });
  if (error) {
    logger.warn('[HabitsSyncEngine] pushHabitToRemote fallback:', error.message);
    await (supabase.from('habits') as any).upsert(mapHabitToLegacyRow(engine.userId, habit));
  }
}
