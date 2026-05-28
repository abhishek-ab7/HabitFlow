import { db } from '@/lib/db';
import { resolveConflict, mergeGamificationFields } from '../conflict-resolution';
import { logger } from '@/lib/logger';
import type { MoodLog } from '@/lib/types';

const normalizeDashboardLayout = (layout?: any[]): any[] => {
  const defaultLayout = [
    { id: 'metrics', size: 'full', hidden: false, pinned: true },
    { id: 'today-tasks', size: 'full', hidden: false, pinned: false },
    { id: 'habit-overview', size: '1/2', hidden: false, pinned: false },
    { id: 'focus-goal', size: '1/2', hidden: false, pinned: false },
    { id: 'ai-quote', size: 'full', hidden: false, pinned: false },
    { id: 'ai-coach', size: '1/2', hidden: false, pinned: false },
    { id: 'weekly-review', size: '1/2', hidden: false, pinned: false }
  ];

  if (!layout || !Array.isArray(layout) || layout.length === 0) {
    return defaultLayout;
  }

  const normalized = layout.map(item => {
    if (typeof item === 'string') {
      const defaultMatch = defaultLayout.find(d => d.id === item);
      return {
        id: item,
        size: defaultMatch?.size || 'full',
        hidden: false,
        pinned: item === 'hero' || item === 'metrics'
      };
    }
    return {
      id: item.id,
      size: item.size || 'full',
      hidden: !!item.hidden,
      pinned: !!item.pinned
    };
  });

  const existingIds = new Set(normalized.map(n => n.id));
  const missing = defaultLayout.filter(d => !existingIds.has(d.id));

  return [...normalized, ...missing];
};

export async function syncUserSettingsWithRetry(engine: any) {
  return engine.withRetry(() => syncUserSettings(engine), 'User settings sync');
}

export async function syncUserSettings(engine: any) {
  if (!engine.userId) return;

  logger.info('[SyncEngine] 🔄 Starting user settings sync...');

  const { data: rawRemoteSettings, error } = await engine.supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', engine.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const remoteSettings = rawRemoteSettings as any;
  const localSettings = await db.userSettings.where('userId').equals(engine.userId).first();

  logger.info(`[SyncEngine] 📊 Settings: Local=${!!localSettings}, Remote=${!!remoteSettings}`);

  const mappedRemoteSettings = remoteSettings ? {
    id: localSettings?.id || remoteSettings.id || crypto.randomUUID(),
    userId: remoteSettings.user_id,
    userName: remoteSettings.user_name || undefined,
    avatarId: remoteSettings.avatar_id || 'avatar-1',
    weekStartsOn: (remoteSettings.week_start_day ?? 0) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    theme: (localSettings?.theme || 'system') as 'light' | 'dark' | 'system',
    showMotivationalQuotes: localSettings?.showMotivationalQuotes ?? true,
    defaultCategory: remoteSettings.default_category || 'health',
    xp: remoteSettings.xp || 0,
    level: remoteSettings.level || 1,
    gems: remoteSettings.gems || 0,
    streakShield: remoteSettings.streak_shield || 0,
    soundEnabled: localSettings?.soundEnabled ?? true,
    hapticsEnabled: localSettings?.hapticsEnabled ?? true,
    stats: remoteSettings.stats || {
      vitality: 1,
      intelligence: 1,
      discipline: 1,
      charisma: 1,
      wealth: 1,
      creativity: 1,
    },
    unlockedThemes: remoteSettings.unlocked_themes || [],
    motivation_text: remoteSettings.motivation_text || '',
    dashboardLayout: normalizeDashboardLayout(remoteSettings.dashboard_layout),
    createdAt: remoteSettings.created_at || new Date().toISOString(),
    updatedAt: remoteSettings.updated_at || undefined,
  } : null;

  if (!localSettings && !mappedRemoteSettings) {
    logger.info('[SyncEngine] Creating default user settings');
    await db.userSettings.add({
      id: crypto.randomUUID(),
      userId: engine.userId,
      theme: 'system',
      weekStartsOn: 0,
      showMotivationalQuotes: true,
      defaultCategory: 'health',
      createdAt: new Date().toISOString(),
      xp: 0,
      level: 1,
      gems: 0,
      streakShield: 0,
      avatarId: 'avatar-1',
      stats: {
        vitality: 1,
        intelligence: 1,
        discipline: 1,
        charisma: 1,
        wealth: 1,
        creativity: 1,
      },
      unlockedThemes: [],
      dashboardLayout: normalizeDashboardLayout([]),
    });
    return;
  }

  if (!mappedRemoteSettings && localSettings) {
    await pushUserSettingsToRemote(engine, localSettings);
  } else if (mappedRemoteSettings && !localSettings) {
    await updateLocalUserSettings(engine, mappedRemoteSettings);
  } else if (mappedRemoteSettings && localSettings) {
    logger.info('[SyncEngine] 🎮 Both settings exist, merging with conflict resolution...');

    const isRemoteReset = mappedRemoteSettings.level === 1 && mappedRemoteSettings.xp === 0 && mappedRemoteSettings.gems === 0;
    const isRemoteNewer = new Date(mappedRemoteSettings.updatedAt || 0) > new Date(localSettings.updatedAt || localSettings.createdAt || 0);

    const isLocalReset = localSettings.level === 1 && localSettings.xp === 0 && localSettings.gems === 0;
    const isLocalNewer = new Date(localSettings.updatedAt || localSettings.createdAt || 0) > new Date(mappedRemoteSettings.updatedAt || 0);

    const mergedGamification = (isRemoteReset && isRemoteNewer)
      ? mappedRemoteSettings
      : (isLocalReset && isLocalNewer)
      ? localSettings
      : mergeGamificationFields(
          localSettings,
          mappedRemoteSettings
        );

    const resolution = resolveConflict(
      { ...localSettings, updatedAt: localSettings.updatedAt || localSettings.createdAt },
      { ...mappedRemoteSettings },
      {}
    );

    const winner = resolution.winner === 'local' ? localSettings : mappedRemoteSettings;
    const finalSettings = {
      ...winner,
      xp: mergedGamification.xp,
      level: mergedGamification.level,
      gems: mergedGamification.gems,
      streakShield: mergedGamification.streakShield,
      stats: mergedGamification.stats,
      unlockedThemes: mergedGamification.unlockedThemes,
      motivation_text: (winner as any).motivation_text || '',
      dashboardLayout: normalizeDashboardLayout(winner.dashboardLayout || localSettings.dashboardLayout),
    };

    await pushUserSettingsToRemote(engine, finalSettings);
    await updateLocalUserSettings(engine, finalSettings);

    logger.info(`[SyncEngine] 🎮 Settings merged: XP=${finalSettings.xp}, Level=${finalSettings.level}, Gems=${finalSettings.gems}, Shield=${finalSettings.streakShield}`);
    logger.info(`[SyncEngine] 🔄 ${resolution.reason}`);
  }
}

export async function pushUserSettingsToRemote(engine: any, settings: any) {
  if (!engine.userId) return;

  let motivation_text = settings.motivation_text;
  if (motivation_text === undefined) {
    const localSet = await db.userSettings.where('userId').equals(engine.userId).first();
    motivation_text = localSet?.motivation_text || null;
  }

  const { error } = await engine.supabase.from('user_settings').upsert({
    user_id: engine.userId,
    user_name: settings.userName || null,
    avatar_id: settings.avatarId || 'avatar-1',
    week_start_day: settings.weekStartsOn || 0,
    default_category: settings.defaultCategory || 'health',
    xp: settings.xp || 0,
    level: settings.level || 1,
    gems: settings.gems || 0,
    streak_shield: settings.streakShield || 0,
    stats: settings.stats || null,
    unlocked_themes: settings.unlockedThemes || [],
    motivation_text: motivation_text || null,
    dashboard_layout: normalizeDashboardLayout(settings.dashboardLayout),
    updated_at: new Date().toISOString(),
  } as any, {
    onConflict: 'user_id',
  });

  if (error) {
    logger.error('[SyncEngine] ❌ Failed to push user settings to remote', error);
    throw error;
  }
  logger.info('[SyncEngine] ✅ User settings pushed to remote');
}

export async function updateLocalUserSettings(engine: any, settings: any) {
  const localSettings = {
    id: settings.id || crypto.randomUUID(),
    userId: engine.userId!,
    theme: settings.theme || 'system',
    userName: settings.userName,
    weekStartsOn: settings.weekStartsOn ?? 0,
    showMotivationalQuotes: settings.showMotivationalQuotes ?? true,
    defaultCategory: settings.defaultCategory || 'health',
    createdAt: settings.createdAt || new Date().toISOString(),
    updatedAt: settings.updatedAt || new Date().toISOString(),
    xp: settings.xp ?? 0,
    level: settings.level ?? 1,
    gems: settings.gems ?? 0,
    streakShield: settings.streakShield ?? 0,
    avatarId: settings.avatarId || 'avatar-1',
    stats: settings.stats || {
      vitality: 1,
      intelligence: 1,
      discipline: 1,
      charisma: 1,
      wealth: 1,
      creativity: 1,
    },
    unlockedThemes: settings.unlockedThemes || [],
    motivation_text: settings.motivation_text || '',
    dashboardLayout: normalizeDashboardLayout(settings.dashboardLayout),
  };

  const existing = await db.userSettings.where('userId').equals(engine.userId!).first();

  if (existing) {
    await db.userSettings.update(existing.id, localSettings);
  } else {
    await db.userSettings.add(localSettings);
  }

  try {
    const { useGamificationStore } = await import('@/lib/stores/gamification-store');
    const store = useGamificationStore.getState();

    if (store.xp !== localSettings.xp ||
      store.level !== localSettings.level ||
      store.gems !== localSettings.gems ||
      store.streakShield !== localSettings.streakShield) {

      store.loadGamification();
      logger.info(`[SyncEngine] 🎮 UI updated: XP=${localSettings.xp}, Level=${localSettings.level}, Gems=${localSettings.gems}`);
    }
  } catch (error) {
    logger.warn('[SyncEngine] Failed to update gamification UI, but data is synced', error);
  }

  try {
    const { useUserStore } = await import('@/lib/stores/user-store');
    const userStore = useUserStore.getState();

    if (userStore.displayName !== localSettings.userName && localSettings.userName) {
      userStore.loadUser();
      logger.info(`[SyncEngine] 👤 Display name updated in UI: ${localSettings.userName}`);
    }
  } catch (error) {
    logger.warn('[SyncEngine] Failed to update user store UI, but data is synced', error);
  }

  logger.info('[SyncEngine] ✅ User settings pulled from remote');
}

// ===================
// MOOD LOGS SYNC
// ===================

export async function syncMoodLogsWithRetry(engine: any) {
  return engine.withRetry(() => syncMoodLogs(engine), 'Mood logs sync');
}

export async function syncMoodLogs(engine: any) {
  if (!engine.userId) return;

  logger.info('[SyncEngine] 🔄 Starting mood logs sync...');

  const startDate = engine.getStartDate();

  const { data: remoteMoods, error } = await engine.supabase
    .from('mood_logs')
    .select('*')
    .eq('user_id', engine.userId)
    .gte('date', startDate);

  if (error) throw error;

  const localMoods = (await db.moodLogs
    .where('userId')
    .equals(engine.userId)
    .toArray())
    .filter(m => m.date >= startDate);

  logger.info(`[SyncEngine] 📊 Mood logs count: Local=${localMoods.length}, Remote=${remoteMoods?.length || 0}`);

  const remoteMap = new Map((remoteMoods || []).map((m: any) => [m.date, m]));
  const localMap = new Map(localMoods.map(m => [m.date, m]));

  const processedDates = new Set<string>();

  const toInsertRemote: any[] = [];
  const toUpdateRemote: any[] = [];
  const toUpsertLocal: MoodLog[] = [];

  for (const local of localMoods) {
    const key = local.date;
    const remote = remoteMap.get(key) as any;
    processedDates.add(key);

    if (!remote) {
      const isNewLocal = !engine.lastSyncAt || new Date(local.updatedAt || local.createdAt || 0) >= engine.lastSyncAt;
      if (!isNewLocal) {
        logger.info(`[SyncEngine] Mood log on date ${local.date} was deleted on remote, deleting locally.`);
        await db.moodLogs.delete(local.id);
      } else {
        toInsertRemote.push({
          id: local.id,
          user_id: engine.userId,
          date: local.date,
          mood: local.mood,
          created_at: local.createdAt || new Date().toISOString(),
          updated_at: local.updatedAt || new Date().toISOString(),
        });
      }
    } else if (local.mood !== remote.mood) {
      const localUpdated = local.updatedAt || local.createdAt || '';
      const remoteUpdated = remote.updated_at || remote.created_at || '';

      if (localUpdated >= remoteUpdated) {
        toUpdateRemote.push({
          id: remote.id,
          user_id: engine.userId,
          date: local.date,
          mood: local.mood,
          updated_at: new Date().toISOString(),
        });
      } else {
        toUpsertLocal.push({
          id: remote.id,
          userId: engine.userId,
          date: remote.date,
          mood: remote.mood as any,
          createdAt: remote.created_at,
          updatedAt: remote.updated_at,
        });
      }
    }
  }

  for (const remote of (remoteMoods || []) as any[]) {
    const key = remote.date;
    if (!processedDates.has(key) && !localMap.has(key)) {
      toUpsertLocal.push({
        id: remote.id,
        userId: engine.userId,
        date: remote.date,
        mood: remote.mood as any,
        createdAt: remote.created_at,
        updatedAt: remote.updated_at,
      });
    }
  }

  if (toInsertRemote.length > 0) {
    await engine.batchUpsert('mood_logs', toInsertRemote);
    logger.info(`[SyncEngine] ✅ Pushed ${toInsertRemote.length} new mood logs to remote`);
  }
  if (toUpdateRemote.length > 0) {
    await engine.batchUpsert('mood_logs', toUpdateRemote);
    logger.info(`[SyncEngine] ✅ Updated ${toUpdateRemote.length} mood logs on remote`);
  }

  if (toUpsertLocal.length > 0) {
    await db.transaction('rw', db.moodLogs, async () => {
      for (const log of toUpsertLocal) {
        await db.moodLogs.put(log);
      }
    });
    logger.info(`[SyncEngine] ✅ Pulled ${toUpsertLocal.length} mood logs from remote`);
  }
}
