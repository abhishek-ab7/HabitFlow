/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EntityTable } from 'dexie';
import { logger } from '@/lib/logger';
import {
  type SyncStepResult,
  missingRemoteFinanceTables,
  isMissingRelationError,
  upsertWithColumnFallback,
  shouldApplyRemote,
} from './finance-sync-types';

export type FinanceSyncUserId = string;
export type FinanceRemoteTable = string;

export interface FinanceEntitySyncSpec<
  TLocal extends {
    id: string;
    deletedAt?: string | null;
    isDirty?: boolean;
    generationCounter?: number;
    updatedAt?: string;
  },
  TRemote extends { id: string; generation_counter?: number; updated_at?: string },
> {
  label: string;
  remoteTable: FinanceRemoteTable;
  table: EntityTable<TLocal, 'id'> | undefined;
  trackMissingTable?: boolean;
  reportPullError?: boolean;
  catchUnexpectedError?: boolean;
  onConflict?: string;
  deleteOnTombstone?: boolean;
  toRemotePayload: (item: TLocal, userId: string) => Record<string, any>;
  retryUpsert?: (
    supabase: any,
    payload: Record<string, any>,
    item: TLocal,
    error: any
  ) => Promise<{ error: any }>;
  onAfterUpsertSuccess?: (
    supabase: any,
    payload: Record<string, any>,
    item: TLocal
  ) => Promise<{ error: any }>;
  resolveLocalConflict?: (remote: TRemote, userId: string) => Promise<TLocal | undefined>;
  toLocalRecord: (remote: TRemote, local: TLocal | undefined) => TLocal;
}

function isTableSkipped(remoteTable: FinanceRemoteTable, trackMissingTable?: boolean): boolean {
  return Boolean(trackMissingTable && missingRemoteFinanceTables.has(remoteTable));
}

function markRemoteTableMissing(remoteTable: FinanceRemoteTable, logSkip = false): void {
  missingRemoteFinanceTables.add(remoteTable);
  if (logSkip) {
    logger.info(
      `[FinanceSyncEngine] Skipping unmigrated table ${remoteTable} for this session.`
    );
  }
}

async function handleTombstoneDelete<
  TLocal extends { id: string; deletedAt?: string | null },
  TRemote extends { id: string; generation_counter?: number; updated_at?: string },
>(
  supabase: any,
  userId: FinanceSyncUserId,
  item: TLocal,
  spec: FinanceEntitySyncSpec<TLocal, TRemote>
): Promise<'deleted' | 'missing_table' | 'error'> {
  const { error } = await (supabase.from(spec.remoteTable) as any)
    .delete()
    .eq('id', item.id)
    .eq('user_id', userId);

  if (!error) {
    await (spec.table as any).delete(item.id);
    return 'deleted';
  }
  if (spec.trackMissingTable && isMissingRelationError(error)) {
    markRemoteTableMissing(spec.remoteTable);
    return 'missing_table';
  }
  if (!spec.trackMissingTable) {
    logger.error(`[FinanceSyncEngine] ${spec.label} remote delete failed:`, error);
  }
  return 'error';
}

async function executeUpsertWithHooks<
  TLocal extends { id: string; deletedAt?: string | null; isDirty?: boolean },
  TRemote extends { id: string; generation_counter?: number; updated_at?: string },
>(
  supabase: any,
  userId: FinanceSyncUserId,
  item: TLocal,
  spec: FinanceEntitySyncSpec<TLocal, TRemote>
) {
  const payload = spec.toRemotePayload(item, userId);
  const options = spec.onConflict ? { onConflict: spec.onConflict } : undefined;
  let { error } = await upsertWithColumnFallback(supabase, spec.remoteTable, payload, options);

  if (error && spec.retryUpsert) {
    error = (await spec.retryUpsert(supabase, payload, item, error)).error;
  }
  if (!error && spec.onAfterUpsertSuccess) {
    error = (await spec.onAfterUpsertSuccess(supabase, payload, item)).error;
  }
  return error;
}

async function upsertSingleItem<
  TLocal extends { id: string; deletedAt?: string | null; isDirty?: boolean },
  TRemote extends { id: string; generation_counter?: number; updated_at?: string },
>(
  supabase: any,
  userId: FinanceSyncUserId,
  item: TLocal,
  spec: FinanceEntitySyncSpec<TLocal, TRemote>
): Promise<'pushed' | 'missing_table' | 'error'> {
  const error = await executeUpsertWithHooks(supabase, userId, item, spec);
  if (!error) {
    await (spec.table as any).update(item.id, { isDirty: false });
    return 'pushed';
  }
  if (spec.trackMissingTable && isMissingRelationError(error)) {
    markRemoteTableMissing(spec.remoteTable, true);
    return 'missing_table';
  }
  logger.error(`[FinanceSyncEngine] ${spec.label} upsert failed:`, error);
  return 'error';
}

async function pushSingleItem<
  TLocal extends { id: string; deletedAt?: string | null; isDirty?: boolean },
  TRemote extends { id: string; generation_counter?: number; updated_at?: string },
>(
  supabase: any,
  userId: FinanceSyncUserId,
  item: TLocal,
  spec: FinanceEntitySyncSpec<TLocal, TRemote>
): Promise<'pushed' | 'missing_table' | 'error'> {
  if (spec.deleteOnTombstone && item.deletedAt) {
    const outcome = await handleTombstoneDelete(supabase, userId, item, spec);
    if (outcome === 'deleted') return 'pushed';
    if (outcome === 'missing_table') return 'missing_table';
    return spec.trackMissingTable ? 'pushed' : 'error';
  }
  return upsertSingleItem(supabase, userId, item, spec);
}

async function pushDirtyEntities<
  TLocal extends { id: string; deletedAt?: string | null; isDirty?: boolean },
  TRemote extends { id: string; generation_counter?: number; updated_at?: string },
>(
  supabase: any,
  userId: FinanceSyncUserId,
  spec: FinanceEntitySyncSpec<TLocal, TRemote>
): Promise<{ pushed: number; hasError: boolean }> {
  let pushed = 0;
  let hasError = false;
  const dirtyItems = await spec.table!.where('userId').equals(userId).filter((i) => i.isDirty !== false).toArray();

  for (const item of dirtyItems) {
    if (isTableSkipped(spec.remoteTable, spec.trackMissingTable)) break;
    const outcome = await pushSingleItem(supabase, userId, item, spec);
    if (outcome === 'missing_table') break;
    if (outcome === 'pushed') pushed++;
    else hasError = true;
  }

  return { pushed, hasError };
}

async function fetchRemoteRows<
  TLocal extends { id: string; deletedAt?: string | null; isDirty?: boolean },
  TRemote extends { id: string; generation_counter?: number; updated_at?: string },
>(
  supabase: any,
  userId: FinanceSyncUserId,
  spec: FinanceEntitySyncSpec<TLocal, TRemote>
): Promise<{ rows: TRemote[] | null; hasError: boolean }> {
  const { data, error } = await (supabase.from(spec.remoteTable) as any)
    .select('*')
    .eq('user_id', userId);

  if (!error) {
    return { rows: Array.isArray(data) ? (data as TRemote[]) : null, hasError: false };
  }
  if (spec.trackMissingTable && isMissingRelationError(error)) {
    markRemoteTableMissing(spec.remoteTable);
    return { rows: null, hasError: false };
  }
  if (spec.reportPullError) {
    logger.error(`[FinanceSyncEngine] ${spec.label} pull failed:`, error);
    return { rows: null, hasError: true };
  }
  return { rows: null, hasError: false };
}

async function applyRemoteRow<
  TLocal extends {
    id: string;
    deletedAt?: string | null;
    isDirty?: boolean;
    generationCounter?: number;
    updatedAt?: string;
  },
  TRemote extends { id: string; generation_counter?: number; updated_at?: string },
>(
  remote: TRemote,
  userId: FinanceSyncUserId,
  spec: FinanceEntitySyncSpec<TLocal, TRemote>
): Promise<boolean> {
  let local = await (spec.table as any).get(remote.id);
  if (!local && spec.resolveLocalConflict) {
    local = await spec.resolveLocalConflict(remote, userId);
  }
  if (!shouldApplyRemote(local, remote)) return false;
  await (spec.table as any).put(spec.toLocalRecord(remote, local));
  return true;
}

async function pullRemoteEntities<
  TLocal extends {
    id: string;
    deletedAt?: string | null;
    isDirty?: boolean;
    generationCounter?: number;
    updatedAt?: string;
  },
  TRemote extends { id: string; generation_counter?: number; updated_at?: string },
>(
  supabase: any,
  userId: FinanceSyncUserId,
  spec: FinanceEntitySyncSpec<TLocal, TRemote>
): Promise<{ pulled: number; hasError: boolean }> {
  if (isTableSkipped(spec.remoteTable, spec.trackMissingTable)) {
    return { pulled: 0, hasError: false };
  }

  try {
    const { rows, hasError } = await fetchRemoteRows(supabase, userId, spec);
    if (!rows) return { pulled: 0, hasError };

    let pulled = 0;
    for (const remote of rows) {
      if (await applyRemoteRow(remote, userId, spec)) pulled++;
    }
    return { pulled, hasError: false };
  } catch {
    return { pulled: 0, hasError: false };
  }
}

function emptyStepResult(hasError = false): SyncStepResult {
  return { pushed: 0, pulled: 0, hasError };
}

export async function syncFinanceEntity<
  TLocal extends {
    id: string;
    deletedAt?: string | null;
    isDirty?: boolean;
    generationCounter?: number;
    updatedAt?: string;
  },
  TRemote extends { id: string; generation_counter?: number; updated_at?: string },
>(
  supabase: any,
  userId: FinanceSyncUserId,
  spec: FinanceEntitySyncSpec<TLocal, TRemote>
): Promise<SyncStepResult> {
  if (!spec.table || isTableSkipped(spec.remoteTable, spec.trackMissingTable)) {
    return emptyStepResult();
  }

  try {
    const pushRes = await pushDirtyEntities(supabase, userId, spec);
    const pullRes = await pullRemoteEntities(supabase, userId, spec);
    return {
      pushed: pushRes.pushed,
      pulled: pullRes.pulled,
      hasError: pushRes.hasError || pullRes.hasError,
    };
  } catch (err) {
    if (spec.catchUnexpectedError) {
      logger.error(`[FinanceSyncEngine] ${spec.label} unexpected error:`, err);
      return emptyStepResult(true);
    }
    return emptyStepResult();
  }
}
