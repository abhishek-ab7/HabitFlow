/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@/lib/logger';

const missingColumnsByTable = new Map<string, Set<string>>();

export function isMissingRelationError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`;
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('Could not find the table') ||
    msg.includes('in the schema cache') ||
    msg.includes('does not exist') ||
    Number(err.status) === 404 ||
    Number(err.statusCode) === 404
  );
}

export function extractMissingColumnName(err: any): string | null {
  if (!err) return null;
  const msg = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`;
  const match =
    msg.match(/Could not find the ['"]([a-z0-9_]+)['"] column/i) ||
    msg.match(/column\s+["']?([a-z0-9_]+)["']?\s+(?:of|does not exist)/i) ||
    msg.match(/column\s+["']?([a-z0-9_]+)["']?\s+does not exist/i);
  return match ? match[1] : null;
}

export function stripKnownMissingColumnsFromRow(
  table: string,
  row: Record<string, any>
): Record<string, any> {
  const cols = missingColumnsByTable.get(table);
  if (!cols || cols.size === 0) return row;
  const copy = { ...row };
  for (const col of cols) {
    delete copy[col];
  }
  return copy;
}

export function recordMissingColumnForTable(table: string, col: string) {
  let set = missingColumnsByTable.get(table);
  if (!set) {
    set = new Set();
    missingColumnsByTable.set(table, set);
  }
  set.add(col);
  logger.info(
    `[SyncFallback] Detected missing remote column '${col}' on table '${table}'. Stripping for subsequent upserts.`
  );
}

/**
 * Resets cached missing columns (useful in isolated tests).
 */
export function clearMissingColumnCache(table?: string) {
  if (table) {
    missingColumnsByTable.delete(table);
  } else {
    missingColumnsByTable.clear();
  }
}

export function shouldApplyRemoteRecord(local: any | undefined, remote: any): boolean {
  if (!local) return true;
  const remoteGen = Number(remote.generation_counter || 0);
  const localGen = Number(local.generationCounter || 0);
  if (remoteGen > localGen) return true;
  const remoteUpdated = remote.updated_at || remote.updatedAt;
  const localUpdated = local.updatedAt || local.updated_at;
  if (remoteGen === localGen && remoteUpdated && localUpdated) {
    return new Date(remoteUpdated).getTime() > new Date(localUpdated).getTime();
  }
  return false;
}

/**
 * Upserts a single row or batch of rows to Supabase, automatically stripping
 * any individual columns missing in PostgREST / PostgreSQL schema cache (PGRST204 / 42703).
 */
export async function upsertRowsWithColumnFallback(
  supabase: any,
  table: string,
  payload: Record<string, any> | Array<Record<string, any>>,
  options?: { onConflict?: string }
): Promise<{ error: any }> {
  const isArray = Array.isArray(payload);
  const stripPayload = (input: Record<string, any> | Array<Record<string, any>>) =>
    Array.isArray(input)
      ? input.map((row) => stripKnownMissingColumnsFromRow(table, row))
      : stripKnownMissingColumnsFromRow(table, input);

  const hasProperty = (input: Record<string, any> | Array<Record<string, any>>, col: string) =>
    Array.isArray(input)
      ? input.some((row) => Object.prototype.hasOwnProperty.call(row, col))
      : Object.prototype.hasOwnProperty.call(input, col);

  let currentPayload = stripPayload(payload);
  if (isArray && (currentPayload as Array<any>).length === 0) {
    return { error: null };
  }

  let result = options?.onConflict
    ? await (supabase.from(table) as any).upsert(currentPayload, options)
    : await (supabase.from(table) as any).upsert(currentPayload);
  let error = result.error;
  let attempts = 0;

  while (
    error &&
    attempts < 12 &&
    ((error as any).code === 'PGRST204' ||
      (error as any).code === '42703' ||
      String(error.message || '').includes('Could not find') ||
      String(error.message || '').includes('does not exist'))
  ) {
    const missingCol = extractMissingColumnName(error);
    if (missingCol && hasProperty(currentPayload, missingCol)) {
      recordMissingColumnForTable(table, missingCol);
      currentPayload = stripPayload(currentPayload);
      attempts++;
      result = options?.onConflict
        ? await (supabase.from(table) as any).upsert(currentPayload, options)
        : await (supabase.from(table) as any).upsert(currentPayload);
      error = result.error;
    } else {
      break;
    }
  }

  return { error };
}
