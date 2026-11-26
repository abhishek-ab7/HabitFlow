/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@/lib/logger';

const missingColumnsByTable = new Map<string, Set<string>>();

const MISSING_RELATION_CODES = new Set(['PGRST205', '42P01']);
const MISSING_RELATION_PHRASES = ['Could not find the table', 'in the schema cache', 'does not exist'];

export function isMissingRelationError(err: any): boolean {
  if (!err) return false;
  if (MISSING_RELATION_CODES.has(String(err.code || ''))) return true;
  if (Number(err.status) === 404 || Number(err.statusCode) === 404) return true;
  const msg = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`;
  return MISSING_RELATION_PHRASES.some((phrase) => msg.includes(phrase));
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

function isTimestampNewer(local: any, remote: any): boolean {
  const remoteUpdated = remote.updated_at || remote.updatedAt;
  const localUpdated = local.updatedAt || local.updated_at;
  if (!remoteUpdated || !localUpdated) return false;
  return new Date(remoteUpdated).getTime() > new Date(localUpdated).getTime();
}

export function shouldApplyRemoteRecord(local: any | undefined, remote: any): boolean {
  if (!local) return true;
  const remoteGen = Number(remote.generation_counter || 0);
  const localGen = Number(local.generationCounter || 0);
  if (remoteGen > localGen) return true;
  if (remoteGen !== localGen) return false;
  return isTimestampNewer(local, remote);
}

function isMissingColumnError(error: any): boolean {
  if (!error) return false;
  const code = (error as any).code;
  if (code === 'PGRST204' || code === '42703') return true;
  const msg = String(error.message || '');
  return msg.includes('Could not find') || msg.includes('does not exist');
}

function stripPayload(
  table: string,
  input: Record<string, any> | Array<Record<string, any>>
) {
  return Array.isArray(input)
    ? input.map((row) => stripKnownMissingColumnsFromRow(table, row))
    : stripKnownMissingColumnsFromRow(table, input);
}

function hasPayloadProperty(
  input: Record<string, any> | Array<Record<string, any>>,
  col: string
): boolean {
  return Array.isArray(input)
    ? input.some((row) => Object.prototype.hasOwnProperty.call(row, col))
    : Object.prototype.hasOwnProperty.call(input, col);
}

async function executeUpsert(
  supabase: any,
  table: string,
  payload: any,
  options?: { onConflict?: string }
) {
  const tableRef = supabase.from(table) as any;
  return options?.onConflict ? tableRef.upsert(payload, options) : tableRef.upsert(payload);
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
  let currentPayload = stripPayload(table, payload);
  if (Array.isArray(currentPayload) && currentPayload.length === 0) {
    return { error: null };
  }

  let { error } = await executeUpsert(supabase, table, currentPayload, options);
  let attempts = 0;

  while (attempts < 12 && isMissingColumnError(error)) {
    const missingCol = extractMissingColumnName(error);
    if (!missingCol || !hasPayloadProperty(currentPayload, missingCol)) break;

    recordMissingColumnForTable(table, missingCol);
    currentPayload = stripPayload(table, currentPayload);
    attempts++;
    ({ error } = await executeUpsert(supabase, table, currentPayload, options));
  }

  return { error };
}
