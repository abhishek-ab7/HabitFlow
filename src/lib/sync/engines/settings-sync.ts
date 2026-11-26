import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { ISynchronizer } from '../types';
import {
  buildRemoteSettingsPayload,
  mapRemoteSettingsToLocal,
} from './settings-sync-mappers';

const OPTIONAL_SETTINGS_COLUMNS = [
  'accent',
  'dashboard_layout',
  'motivation_text',
  'stats',
  'unlocked_themes',
  'generation_counter',
  'show_fitness',
  'show_finance',
  'show_tasks',
  'show_goals',
  'show_milestones',
  'habit_only_mode',
  'xp',
  'level',
  'gems',
  'streak_shield',
  'avatar_id',
  'default_category',
  'week_start_day',
  'user_name',
] as const;

const unsupportedSettingsColumns = new Set<string>();

function extractMissingColumn(error: { message?: string; details?: string } | null | undefined): string | null {
  if (!error) return null;
  const text = `${error.message || ''} ${error.details || ''}`;
  const match =
    text.match(/Could not find the ['"]([a-z0-9_]+)['"] column/i) ||
    text.match(/column\s+["']?([a-z0-9_]+)["']?\s+(?:of|does not exist)/i);
  return match ? match[1] : null;
}

function isSchemaCacheError(error: { code?: string; message?: string }): boolean {
  const code = String(error.code || '');
  return code === 'PGRST204' || String(error.message || '').toLowerCase().includes('schema cache');
}

function isDeletableColumn(payload: Record<string, unknown>, col: string | null): col is string {
  if (!col || col === 'user_id') return false;
  return Object.prototype.hasOwnProperty.call(payload, col);
}

function dropUnsupportedColumn(
  payload: Record<string, unknown>,
  error: { code?: string; message?: string; details?: string }
): boolean {
  const missingCol = extractMissingColumn(error);
  if (isDeletableColumn(payload, missingCol)) {
    unsupportedSettingsColumns.add(missingCol);
    delete payload[missingCol];
    return true;
  }
  if (!isSchemaCacheError(error)) return false;
  const nextOptional = OPTIONAL_SETTINGS_COLUMNS.find((c) => c in payload);
  if (!nextOptional) return false;
  unsupportedSettingsColumns.add(nextOptional);
  delete payload[nextOptional];
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runSettingsUpsert(supabase: any, payload: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from('user_settings') as any).upsert(payload, { onConflict: 'user_id' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertUserSettingsSafely(supabase: any, rawPayload: Record<string, unknown>) {
  const payload = { ...rawPayload };
  for (const col of unsupportedSettingsColumns) {
    delete payload[col];
  }

  let { error } = await runSettingsUpsert(supabase, payload);
  for (let attempts = 0; error && attempts < OPTIONAL_SETTINGS_COLUMNS.length; attempts++) {
    if (!dropUnsupportedColumn(payload, error)) break;
    const retry = await runSettingsUpsert(supabase, payload);
    error = retry.error;
  }

  return { error };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pushDirtyUserSettings(supabase: any, userId: string): Promise<number> {
  const dirtyLocalSettings = await db.userSettings
    .where('userId')
    .equals(userId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((s: any) => s.isDirty === true || s.isDirty === 1)
    .toArray();

  let pushedCount = 0;
  for (const settings of dirtyLocalSettings) {
    const payload = buildRemoteSettingsPayload(userId, settings as unknown as Record<string, unknown>);
    const { error } = await upsertUserSettingsSafely(supabase, payload);
    if (error) {
      logger.warn('[UserSettingsSyncEngine Push Failure]:', error.message);
      throw new Error(`[UserSettingsSyncEngine Push Failure]: ${error.message}`);
    }
    await db.userSettings.update(settings.id, { isDirty: false });
    pushedCount++;
  }
  return pushedCount;
}

function shouldApplyRemoteSettings(
  local: { generationCounter?: number } | undefined,
  remoteData: { generation_counter?: number }
): boolean {
  if (!local) return true;
  return (remoteData.generation_counter || 0) > (local.generationCounter || 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pullRemoteUserSettings(supabase: any, userId: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: remoteData, error: pullError } = await (supabase.from('user_settings') as any)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (pullError) throw new Error(`[UserSettingsSyncEngine Pull Failure]: ${pullError.message}`);
  if (!remoteData) return 0;

  const local = await db.userSettings.where('userId').equals(userId).first();
  if (!shouldApplyRemoteSettings(local, remoteData)) return 0;

  const localSettings = mapRemoteSettingsToLocal(
    remoteData,
    local as unknown as Record<string, unknown> | undefined,
    userId
  );
  if (local) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.userSettings.update(local.id, localSettings as any);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.userSettings.add(localSettings as any);
  }
  return 1;
}

export class UserSettingsSyncEngine implements ISynchronizer {
  public domainName = 'user_settings';
  private supabase = getSupabaseClient();

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    const pushed = await pushDirtyUserSettings(this.supabase, userId);
    const pulled = await pullRemoteUserSettings(this.supabase, userId);
    return { pushed, pulled, status: 'success' };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pushDirtyMoodLogs(supabase: any, userId: string): Promise<number> {
  const dirtyLocalMoods = await db.moodLogs
    .where('userId')
    .equals(userId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((m: any) => m.isDirty === true || m.isDirty === 1)
    .toArray();

  let pushedCount = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < dirtyLocalMoods.length; i += BATCH_SIZE) {
    const batch = dirtyLocalMoods.slice(i, i + BATCH_SIZE);
    const payload = batch.map((m) => ({
      id: m.id,
      user_id: userId,
      date: m.date,
      mood: m.mood,
      generation_counter: m.generationCounter || 1,
      created_at: m.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('mood_logs') as any).upsert(payload, {
      onConflict: 'user_id,date',
    });
    if (error) throw new Error(`[MoodLogsSyncEngine Bulk Push Failure]: ${error.message}`);

    await db.transaction('rw', db.moodLogs, async () => {
      await Promise.all(batch.map((b) => db.moodLogs.update(b.id, { isDirty: false })));
    });
    pushedCount += batch.length;
  }

  return pushedCount;
}

function isRemoteMoodPreferred(
  remote: { generation_counter?: number; updated_at?: string },
  sameDate: { generationCounter?: number; updatedAt?: string }
): boolean {
  const remoteGen = Number(remote.generation_counter || 0);
  const localGen = Number(sameDate.generationCounter || 0);
  if (remoteGen !== localGen) return remoteGen > localGen;
  const remoteTime = new Date(remote.updated_at || 0).getTime();
  const localTime = new Date(sameDate.updatedAt || 0).getTime();
  return remoteTime >= localTime;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveSameDateMoodConflict(remote: any): Promise<any> {
  if (!remote.date) return undefined;
  const sameDate = await db.moodLogs
    .where('[userId+date]')
    .equals([remote.user_id, remote.date])
    .first();
  if (!sameDate || sameDate.id === remote.id) return undefined;

  if (isRemoteMoodPreferred(remote, sameDate)) {
    await db.moodLogs.delete(sameDate.id);
    return undefined;
  }
  return sameDate;
}

function isNewerMoodRecord(
  local: { generationCounter?: number } | undefined,
  remote: { generation_counter?: number }
): boolean {
  if (!local) return true;
  return (remote.generation_counter || 0) > (local.generationCounter || 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyRemoteMoodLog(remote: any): Promise<boolean> {
  let local = await db.moodLogs.get(remote.id);
  if (!local) {
    local = await resolveSameDateMoodConflict(remote);
  }
  if (!isNewerMoodRecord(local, remote)) return false;

  await db.moodLogs.put({
    id: remote.id,
    userId: remote.user_id,
    date: remote.date,
    mood: remote.mood,
    generationCounter: remote.generation_counter || 1,
    createdAt: remote.created_at,
    updatedAt: remote.updated_at,
    isDirty: false,
  });
  return true;
}

async function getLastMoodSyncTimestamp(userId: string): Promise<string> {
  const latestLocalMood = await db.moodLogs.where('userId').equals(userId).sortBy('updatedAt');
  const lastUpdated =
    latestLocalMood.length > 0 ? latestLocalMood[latestLocalMood.length - 1].updatedAt : null;
  if (!lastUpdated || lastUpdated === 'undefined') {
    return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  }
  return lastUpdated;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pullRemoteMoodLogs(supabase: any, userId: string): Promise<number> {
  const lastPushedTimestamp = await getLastMoodSyncTimestamp(userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: remoteData, error: pullError } = await (supabase.from('mood_logs') as any)
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', lastPushedTimestamp);

  if (pullError) throw new Error(`[MoodLogsSyncEngine Pull Failure]: ${pullError.message}`);
  if (!remoteData || remoteData.length === 0) return 0;

  let pulledCount = 0;
  await db.transaction('rw', db.moodLogs, async () => {
    for (const remote of remoteData) {
      if (await applyRemoteMoodLog(remote)) pulledCount++;
    }
  });
  return pulledCount;
}

export class MoodLogsSyncEngine implements ISynchronizer {
  public domainName = 'mood_logs';
  private supabase = getSupabaseClient();

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    const pushed = await pushDirtyMoodLogs(this.supabase, userId);
    const pulled = await pullRemoteMoodLogs(this.supabase, userId);
    return { pushed, pulled, status: 'success' };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncUserSettingsWithRetry(engine: any) {
  const settingsSync = new UserSettingsSyncEngine();
  return settingsSync.sync(engine.userId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncMoodLogsWithRetry(engine: any) {
  const moodLogsSync = new MoodLogsSyncEngine();
  return moodLogsSync.sync(engine.userId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pushUserSettingsToRemote(engine: any, settings: any) {
  const supabase = getSupabaseClient();
  const payload = buildRemoteSettingsPayload(engine.userId, settings);
  await upsertUserSettingsSafely(supabase, payload);
}
