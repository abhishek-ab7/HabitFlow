import { create } from 'zustand';
import { getSettings, updateSettings } from '../db';
import { syncSensoryPrefsFromSettings } from '../feedback/sensory-engine';
import { getSupabaseClient } from '../supabase/client';
import { getSyncEngine } from '../sync';
import type { UserSettings } from '../types';
export { isFitnessModuleEnabled } from '../workspace-modules';

interface GamificationState {
  streakShield: number;
  isLoading: boolean;
  settings: UserSettings | null;

  // Actions
  loadGamification: () => Promise<void>;
  useShield: () => Promise<boolean>;
  setStreakShields: (count: number) => Promise<void>;
  updateUserSettings: (updates: Partial<UserSettings>) => Promise<void>;
}

async function persistAndSyncUserSettings(
  userId: string,
  updates: Partial<UserSettings>
) {
  await updateSettings({
    userId,
    ...updates,
  });

  try {
    const currentSettings = await getSettings(userId);
    const syncEngine = getSyncEngine();
    syncEngine.pushUserSettings({
      userName: currentSettings?.userName,
      weekStartsOn: currentSettings?.weekStartsOn ?? 0,
      defaultCategory: currentSettings?.defaultCategory ?? 'health',
      xp: currentSettings?.xp ?? 0,
      level: currentSettings?.level ?? 1,
      gems: currentSettings?.gems ?? 0,
      streakShield: currentSettings?.streakShield ?? 0,
      stats: currentSettings?.stats,
      unlockedThemes: currentSettings?.unlockedThemes,
      motivation_text: (currentSettings as any)?.motivation_text ?? '',
      showFitness: currentSettings?.showFitness ?? true,
      showFinance: currentSettings?.showFinance ?? true,
      showTasks: currentSettings?.showTasks ?? true,
      showGoals: currentSettings?.showGoals ?? true,
      showMilestones: currentSettings?.showMilestones ?? true,
      habitOnlyMode: currentSettings?.habitOnlyMode ?? false,
      ...updates,
    });
  } catch (error) {
    console.error('Failed to sync user settings updates:', error);
  }
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
  streakShield: 0,
  isLoading: false,
  settings: null,

  loadGamification: async () => {
    set({ isLoading: true });
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id) {
        const settings = await getSettings(session.user.id);
        if (settings) {
          syncSensoryPrefsFromSettings(settings);
          set({
            streakShield: settings.streakShield ?? 0,
            settings,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load user settings:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  useShield: async () => {
    const { streakShield, settings } = get();
    if (streakShield <= 0) return false;

    const newShields = streakShield - 1;
    set({
      streakShield: newShields,
      settings: settings ? { ...settings, streakShield: newShields } : null,
    });

    const supabase = getSupabaseClient();
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (session?.user) {
      await persistAndSyncUserSettings(session.user.id, {
        streakShield: newShields,
      });
    }
    return true;
  },

  setStreakShields: async (count: number) => {
    const sanitizedCount = Math.max(0, Math.floor(count));
    const currentSettings = get().settings;
    set({
      streakShield: sanitizedCount,
      settings: currentSettings
        ? { ...currentSettings, streakShield: sanitizedCount }
        : null,
    });

    const supabase = getSupabaseClient();
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (session?.user) {
      await persistAndSyncUserSettings(session.user.id, {
        streakShield: sanitizedCount,
      });
    }
  },

  updateUserSettings: async (updates: Partial<UserSettings>) => {
    const currentSettings = get().settings;
    if (!currentSettings) return;

    const newSettings = { ...currentSettings, ...updates };
    syncSensoryPrefsFromSettings(newSettings);
    set({ settings: newSettings });

    if (updates.streakShield !== undefined) {
      set({ streakShield: updates.streakShield });
    }

    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      await persistAndSyncUserSettings(session.user.id, updates);
    }
  },
}));
