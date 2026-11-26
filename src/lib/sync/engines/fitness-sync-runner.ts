/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  isMissingRelationError,
  shouldApplyRemoteRecord,
  upsertRowsWithColumnFallback,
} from './column-fallback';
import { toNum } from './fitness-daily-merge';

export const missingRemoteFitnessTables = new Set<string>();

export function clearFitnessMissingTableCache(table?: string) {
  if (table) {
    missingRemoteFitnessTables.delete(table);
  } else {
    missingRemoteFitnessTables.clear();
  }
}

export function logFitnessSync(
  level: 'info' | 'warn' | 'error',
  message: string,
  data?: unknown
) {
  if (level === 'error') logger.error(`[FitnessSync] ${message}`, data);
  else if (level === 'warn') logger.warn(`[FitnessSync] ${message}`, data);
  else logger.info(`[FitnessSync] ${message}`, data);
}

export async function pullFitnessTable(
  supabase: any,
  remoteTable: string,
  userId: string
): Promise<any[] | null> {
  if (missingRemoteFitnessTables.has(remoteTable)) return null;

  const { data, error } = await supabase
    .from(remoteTable)
    .select('*')
    .eq('user_id', userId);

  if (error) {
    if (isMissingRelationError(error)) {
      missingRemoteFitnessTables.add(remoteTable);
      logFitnessSync(
        'warn',
        `Remote table '${remoteTable}' does not exist yet; skipping until migration is applied.`
      );
      return null;
    }
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function pushFitnessBatched(params: {
  supabase: any;
  remoteTable: string;
  payloads: Record<string, any>[];
  options?: { onConflict?: string };
}): Promise<boolean> {
  const { supabase, remoteTable, payloads, options } = params;
  if (payloads.length === 0 || missingRemoteFitnessTables.has(remoteTable)) {
    return true;
  }

  const CHUNK = 50;
  for (let i = 0; i < payloads.length; i += CHUNK) {
    const batch = payloads.slice(i, i + CHUNK);
    const { error } = await upsertRowsWithColumnFallback(supabase, remoteTable, batch, options);
    if (error) {
      if (isMissingRelationError(error)) {
        missingRemoteFitnessTables.add(remoteTable);
        logFitnessSync('warn', `Remote table '${remoteTable}' missing on push; skipping.`);
        return false;
      }
      throw error;
    }
  }

  return true;
}

export async function pushDirtyFitnessRows<T extends { id: string; isDirty?: boolean }>(params: {
  supabase: any;
  userId: string;
  remoteTable: string;
  table: any;
  toRemote: (item: T, userId: string) => Record<string, any>;
  options?: { onConflict?: string };
}): Promise<number> {
  const rows: T[] = (await params.table.where('userId').equals(params.userId).toArray()).filter(
    (row: T) => row.isDirty
  );
  if (rows.length === 0) return 0;

  const payloads = rows.map((row) => params.toRemote(row, params.userId));
  const ok = await pushFitnessBatched({
    supabase: params.supabase,
    remoteTable: params.remoteTable,
    payloads,
    options: params.options,
  });
  if (!ok) return 0;

  for (const row of rows) {
    await params.table.update(row.id, { isDirty: false });
  }
  return rows.length;
}

function shouldApplyStandardRow(
  local: { isDirty?: boolean } | undefined,
  remote: Record<string, unknown>
): boolean {
  if (!local) return true;
  if (local.isDirty) return false;
  return shouldApplyRemoteRecord(local as any, remote);
}

export async function pullStandardFitnessRows<T extends { id: string; isDirty?: boolean }>(params: {
  supabase: any;
  userId: string;
  remoteTable: string;
  table: any;
  toLocal: (remote: any) => T;
}): Promise<number> {
  const remoteRows = await pullFitnessTable(params.supabase, params.remoteTable, params.userId);
  if (remoteRows === null) return 0;

  const localRows: T[] = await params.table.where('userId').equals(params.userId).toArray();
  const localMap = new Map(localRows.map((x) => [x.id, x]));
  let pulled = 0;

  for (const r of remoteRows) {
    if (shouldApplyStandardRow(localMap.get(r.id), r)) {
      await params.table.put(params.toLocal(r));
      pulled++;
    }
  }
  return pulled;
}

export async function syncStandardFitnessEntity<T extends { id: string; isDirty?: boolean }>(params: {
  supabase: any;
  userId: string;
  remoteTable: string;
  table: any;
  toRemote: (item: T, userId: string) => Record<string, any>;
  toLocal: (remote: any) => T;
}): Promise<{ pushed: number; pulled: number }> {
  const pushed = await pushDirtyFitnessRows(params);
  const pulled = await pullStandardFitnessRows(params);
  return { pushed, pulled };
}

export function compareFitnessRecency(
  a: { deletedAt?: string | null; generationCounter?: number; updatedAt?: string },
  b: { deletedAt?: string | null; generationCounter?: number; updatedAt?: string }
): number {
  if (Boolean(a.deletedAt) !== Boolean(b.deletedAt)) {
    return a.deletedAt ? 1 : -1;
  }
  const genDiff = toNum(b.generationCounter, 0) - toNum(a.generationCounter, 0);
  if (genDiff !== 0) return genDiff;
  return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
}

export async function migrateOrphanedFitnessTables(userId: string): Promise<void> {
  if (!userId || userId === 'local-demo-user') return;
  try {
    const tables = [
      'fitnessProfiles',
      'fitnessDailyLogs',
      'mealTemplates',
      'mealLogs',
      'workoutSessions',
      'supplementInventory',
      'supplementLogs',
    ] as const;

    await Promise.all(
      tables.map(async (tbl) => {
        const table = db.table(tbl);
        const orphans = await table.where('userId').equals('local-demo-user').toArray();
        if (orphans.length === 0) return;
        logFitnessSync('info', `Migrating ${orphans.length} orphaned ${tbl} records to ${userId}`);
        await db.transaction('rw', table, async () => {
          await Promise.all(
            orphans.map((orphan: { id: string }) => table.update(orphan.id, { userId, isDirty: true }))
          );
        });
      })
    );
  } catch (e) {
    logFitnessSync('error', 'Failed to migrate orphaned fitness records', e);
  }
}
