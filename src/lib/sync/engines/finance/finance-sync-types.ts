import { logger } from '@/lib/logger';

export interface SyncStepResult {
  pushed: number;
  pulled: number;
  hasError: boolean;
}

export const missingRemoteFinanceTables = new Set<string>();
export const missingRemoteFinanceColumns = new Map<string, Set<string>>();

function hasMissingRelationMessage(msg: string): boolean {
  return (
    msg.includes('Could not find the table') ||
    msg.includes('in the schema cache') ||
    msg.includes('does not exist')
  );
}

function isMissingRelationCode(code: string): boolean {
  return code === 'PGRST205' || code === '42P01';
}

function isNotFoundHttpStatus(err: { status?: unknown; statusCode?: unknown }): boolean {
  return Number(err.status) === 404 || Number(err.statusCode) === 404;
}

function formatErrorText(err: { message?: unknown; details?: unknown; hint?: unknown }): string {
  return `${err.message || ''} ${err.details || ''} ${err.hint || ''}`;
}

export function isMissingRelationError(
  err: { code?: unknown; status?: unknown; statusCode?: unknown; message?: unknown; details?: unknown; hint?: unknown } | null | undefined
): boolean {
  if (!err) return false;
  if (isMissingRelationCode(String(err.code || ''))) return true;
  if (isNotFoundHttpStatus(err)) return true;
  return hasMissingRelationMessage(formatErrorText(err));
}

export function getMissingColumnName(
  err: { message?: unknown; details?: unknown; hint?: unknown } | null | undefined
): string | null {
  if (!err) return null;
  const msg = formatErrorText(err);
  const m =
    msg.match(/Could not find the ['"]([a-z0-9_]+)['"] column/i) ||
    msg.match(/column\s+["']?([a-z0-9_]+)["']?\s+(?:of|does not exist)/i) ||
    msg.match(/column\s+["']?([a-z0-9_]+)["']?\s+does not exist/i);
  return m ? m[1] : null;
}

export function stripKnownMissingColumns(
  table: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const cols = missingRemoteFinanceColumns.get(table);
  if (!cols || cols.size === 0) return payload;
  const copy = { ...payload };
  for (const col of cols) delete copy[col];
  return copy;
}

export function recordMissingColumn(table: string, col: string) {
  let set = missingRemoteFinanceColumns.get(table);
  if (!set) {
    set = new Set();
    missingRemoteFinanceColumns.set(table, set);
  }
  set.add(col);
  logger.info(
    `[FinanceSyncEngine] Detected missing remote column '${col}' on table '${table}'. Stripping for subsequent upserts.`
  );
}

function isRecoverableColumnError(error: { code?: unknown; message?: unknown } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  const msg = String(error.message || '');
  return msg.includes('Could not find') || msg.includes('does not exist');
}

async function runUpsert(
  supabase: { from: (t: string) => unknown },
  table: string,
  payload: Record<string, unknown>,
  options?: { onConflict?: string }
) {
  const query = supabase.from(table) as {
    upsert: (p: Record<string, unknown>, o?: { onConflict?: string }) => Promise<{ error: unknown }>;
  };
  return options?.onConflict ? query.upsert(payload, options) : query.upsert(payload);
}

function extractRetryableColumn(
  error: { code?: unknown; message?: unknown; details?: unknown; hint?: unknown } | null | undefined,
  payload: Record<string, unknown>
): string | null {
  if (!isRecoverableColumnError(error)) return null;
  const missingCol = getMissingColumnName(error);
  if (!missingCol || !Object.prototype.hasOwnProperty.call(payload, missingCol)) return null;
  return missingCol;
}

export async function upsertWithColumnFallback(
  supabase: { from: (t: string) => unknown },
  table: string,
  payload: Record<string, unknown>,
  options?: { onConflict?: string }
) {
  let currentPayload = stripKnownMissingColumns(table, payload);
  let { error } = await runUpsert(supabase, table, currentPayload, options);

  for (let attempts = 0; attempts < 8; attempts++) {
    const missingCol = extractRetryableColumn(
      error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown } | null,
      currentPayload
    );
    if (!missingCol) break;
    recordMissingColumn(table, missingCol);
    currentPayload = stripKnownMissingColumns(table, currentPayload);
    const retry = await runUpsert(supabase, table, currentPayload, options);
    error = retry.error;
  }

  return { error };
}

function hasBothTimestamps(localUpdatedAt?: string, remoteUpdatedAt?: string): boolean {
  return Boolean(localUpdatedAt && remoteUpdatedAt);
}

export function shouldApplyRemote(
  local: { generationCounter?: number; updatedAt?: string } | undefined,
  remote: { generation_counter?: number; updated_at?: string }
): boolean {
  if (!local) return true;
  const remoteGen = Number(remote.generation_counter || 0);
  const localGen = Number(local.generationCounter || 0);
  if (remoteGen !== localGen) return remoteGen > localGen;
  if (!hasBothTimestamps(local.updatedAt, remote.updated_at)) return false;
  return new Date(remote.updated_at!).getTime() > new Date(local.updatedAt!).getTime();
}

export { deduplicateFinanceRecordsInDexie } from './finance-dexie-dedup';
