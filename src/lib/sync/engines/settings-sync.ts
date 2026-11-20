import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { MoodLog } from '@/lib/types';
import type { ISynchronizer } from '../types';

const OPTIONAL_SETTINGS_COLUMNS = [
  'accent',
  'dashboard_layout',
  'motivation_text',
  'stats',
  'unlocked_themes',
  'generation_counter',
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

async function upsertUserSettingsSafely(
  supabase: any,
  rawPayload: Record<string, any>
): Promise<{ error: any }> {
  const payload = { ...rawPayload };
  for (const col of unsupportedSettingsColumns) {
    delete payload[col];
  }

  let { error } = await (supabase.from('user_settings') as any).upsert(payload as any, {
    onConflict: 'user_id',
  });

  let attempts = 0;
  while (error && attempts < OPTIONAL_SETTINGS_COLUMNS.length) {
    const code = String((error as any).code || '');
    const missingCol = extractMissingColumn(error);
    if (missingCol && Object.prototype.hasOwnProperty.call(payload, missingCol) && missingCol !== 'user_id') {
      unsupportedSettingsColumns.add(missingCol);
      delete payload[missingCol];
      attempts++;
      const retry = await (supabase.from('user_settings') as any).upsert(payload as any, {
        onConflict: 'user_id',
      });
      error = retry.error;
      continue;
    }

    // Fallback when PostgREST returns generic 400/PGRST204 without clear column name
    if (code === 'PGRST204' || String(error.message || '').toLowerCase().includes('schema cache')) {
      const nextOptional = OPTIONAL_SETTINGS_COLUMNS.find((c) => c in payload);
      if (nextOptional) {
        unsupportedSettingsColumns.add(nextOptional);
        delete payload[nextOptional];
        attempts++;
        const retry = await (supabase.from('user_settings') as any).upsert(payload as any, {
          onConflict: 'user_id',
        });
        error = retry.error;
        continue;
      }
    }
    break;
  }

  return { error };
}

export class UserSettingsSyncEngine implements ISynchronizer {
  public domainName = 'user_settings';
  private supabase = getSupabaseClient();

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    // 1. Bulk push dirty user settings
    const dirtyLocalSettings = await db.userSettings
      .where('userId')
      .equals(userId)
      .filter((s: any) => s.isDirty === true || s.isDirty === 1)
      .toArray();

    let pushedCount = 0;

    for (const settings of dirtyLocalSettings) {
      const payload = {
        user_id: userId,
        user_name: settings.userName || null,
        avatar_id: settings.avatarId || 'avatar-1',
        week_start_day: Number(settings.weekStartsOn ?? 0),
        default_category: settings.defaultCategory || 'health',
        xp: settings.xp || 0,
        level: settings.level || 1,
        gems: settings.gems || 0,
        streak_shield: settings.streakShield || 0,
        stats: settings.stats || null,
        unlocked_themes: Array.isArray(settings.unlockedThemes) ? settings.unlockedThemes : [],
        motivation_text: settings.motivation_text || null,
        dashboard_layout: settings.dashboardLayout || null,
        generation_counter: settings.generationCounter || 1,
        accent: settings.accent || 'mint',
        updated_at: new Date().toISOString(),
      };

      const { error } = await upsertUserSettingsSafely(this.supabase, payload);

      if (error) {
        logger.warn('[UserSettingsSyncEngine Push Failure]:', error.message);
        throw new Error(`[UserSettingsSyncEngine Push Failure]: ${error.message}`);
      }

      await db.userSettings.update(settings.id, { isDirty: false });
      pushedCount++;
    }

    // 2. Pull remote updates
    const { data: remoteData, error: pullError } = await (this.supabase
      .from('user_settings') as any)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (pullError) throw new Error(`[UserSettingsSyncEngine Pull Failure]: ${pullError.message}`);

    let pulledCount = 0;
    if (remoteData) {
      const local = await db.userSettings.where('userId').equals(userId).first();
      
      if (!local || (remoteData.generation_counter || 0) > (local.generationCounter || 0)) {
        const validAccents = ['mint', 'cobalt', 'forest', 'ink'];
        const remoteAccent = validAccents.includes(remoteData.accent) ? remoteData.accent : undefined;
        const localSettings = {
          id: local?.id || crypto.randomUUID(),
          userId: userId,
          theme: local?.theme || 'system',
          accent: remoteAccent || local?.accent || 'mint',
          userName: remoteData.user_name || undefined,
          weekStartsOn: (remoteData.week_start_day ?? 0) as any,
          showMotivationalQuotes: remoteData.show_motivational_quotes ?? true,
          defaultCategory: remoteData.default_category || 'health',
          xp: remoteData.xp || 0,
          level: remoteData.level || 1,
          gems: remoteData.gems || 0,
          streakShield: remoteData.streak_shield || 0,
          avatarId: remoteData.avatar_id || 'avatar-1',
          stats: remoteData.stats || undefined,
          unlockedThemes: remoteData.unlocked_themes || [],
          motivation_text: remoteData.motivation_text || '',
          dashboardLayout: remoteData.dashboard_layout || undefined,
          generationCounter: remoteData.generation_counter || 1,
          createdAt: remoteData.created_at || new Date().toISOString(),
          updatedAt: remoteData.updated_at || new Date().toISOString(),
          isDirty: false
        };

        if (local) {
          await db.userSettings.update(local.id, localSettings);
        } else {
          await db.userSettings.add(localSettings);
        }
        pulledCount++;
      }
    }

    return { pushed: pushedCount, pulled: pulledCount, status: 'success' };
  }
}

export class MoodLogsSyncEngine implements ISynchronizer {
  public domainName = 'mood_logs';
  private supabase = getSupabaseClient();

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    // 1. Bulk push dirty mood logs
    const dirtyLocalMoods = await db.moodLogs
      .where('userId')
      .equals(userId)
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
        updated_at: new Date().toISOString()
      }));

      const { error } = await (this.supabase
        .from('mood_logs') as any)
        .upsert(payload, { onConflict: 'id' });

      if (error) throw new Error(`[MoodLogsSyncEngine Bulk Push Failure]: ${error.message}`);

      await db.transaction('rw', db.moodLogs, async () => {
        const ids = batch.map((b) => b.id);
        await Promise.all(ids.map(id => db.moodLogs.update(id, { isDirty: false })));
      });
      pushedCount += batch.length;
    }

    // 2. Pull remote updates
    const latestLocalMood = await db.moodLogs.where('userId').equals(userId).sortBy('updatedAt');
    let lastPushedTimestamp = latestLocalMood.length > 0 
      ? latestLocalMood[latestLocalMood.length - 1].updatedAt 
      : null;
    if (!lastPushedTimestamp || lastPushedTimestamp === 'undefined') {
      lastPushedTimestamp = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: remoteData, error: pullError } = await (this.supabase
      .from('mood_logs') as any)
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastPushedTimestamp);

    if (pullError) throw new Error(`[MoodLogsSyncEngine Pull Failure]: ${pullError.message}`);

    let pulledCount = 0;
    if (remoteData && remoteData.length > 0) {
      await db.transaction('rw', db.moodLogs, async () => {
        for (const remote of remoteData) {
          const local = await db.moodLogs.get(remote.id);
          
          if (!local || (remote.generation_counter || 0) > (local.generationCounter || 0)) {
            await db.moodLogs.put({
              id: remote.id,
              userId: remote.user_id,
              date: remote.date,
              mood: remote.mood,
              generationCounter: remote.generation_counter || 1,
              createdAt: remote.created_at,
              updatedAt: remote.updated_at,
              isDirty: false
            });
            pulledCount++;
          }
        }
      });
    }

    return { pushed: pushedCount, pulled: pulledCount, status: 'success' };
  }
}

// Keep legacy wrappers for backward compatibility
export async function syncUserSettingsWithRetry(engine: any) {
  const settingsSync = new UserSettingsSyncEngine();
  return settingsSync.sync(engine.userId);
}

export async function syncMoodLogsWithRetry(engine: any) {
  const moodLogsSync = new MoodLogsSyncEngine();
  return moodLogsSync.sync(engine.userId);
}

export async function pushUserSettingsToRemote(engine: any, settings: any) {
  const supabase = getSupabaseClient();
  const payload = {
    user_id: engine.userId,
    user_name: settings.userName || null,
    avatar_id: settings.avatarId || 'avatar-1',
    week_start_day: Number(settings.weekStartsOn ?? 0),
    default_category: settings.defaultCategory || 'health',
    xp: settings.xp || 0,
    level: settings.level || 1,
    gems: settings.gems || 0,
    streak_shield: settings.streakShield || 0,
    stats: settings.stats || null,
    unlocked_themes: Array.isArray(settings.unlockedThemes) ? settings.unlockedThemes : [],
    motivation_text: settings.motivation_text || null,
    dashboard_layout: settings.dashboardLayout || null,
    generation_counter: settings.generationCounter || 1,
    accent: settings.accent || 'mint',
    updated_at: new Date().toISOString(),
  };

  await upsertUserSettingsSafely(supabase, payload);
}
