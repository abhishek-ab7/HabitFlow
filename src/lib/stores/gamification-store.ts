import { create } from 'zustand';
import { getSettings, updateSettings } from '../db';
import { getSupabaseClient } from '../supabase/client';
import { getSyncEngine } from '../sync';
import type { UserStats, Category, Habit, UserSettings } from '../types';
import { useHabitStore } from './habit-store';
import { calculateCurrentStreak, calculateBestStreak } from '../calculations';

export const XP_PER_TASK = 10;
export const XP_PER_HABIT = 15;
export const XP_PER_ROUTINE = 50;
export const GEMS_PER_LEVEL = 5;
export const SHIELD_COST = 20;

export function calculateLevelFromXp(cumulativeXp: number): {
  level: number;
  xpInCurrentLevel: number;
  xpRequiredForNextLevel: number;
} {
  const xp = Math.max(0, cumulativeXp);
  let level = 1;
  while (true) {
    const cumulativeXpNeededForNext = (level * (level + 1) / 2) * 100;
    if (xp < cumulativeXpNeededForNext) {
      break;
    }
    level++;
  }
  const cumulativeXpNeededForCurrent = ((level - 1) * level / 2) * 100;
  const xpInCurrentLevel = xp - cumulativeXpNeededForCurrent;
  const xpRequiredForNextLevel = level * 100;

  return {
    level,
    xpInCurrentLevel,
    xpRequiredForNextLevel,
  };
}

export function calculateTotalXp(level: number, levelProgressXp: number): number {
  const cumulativeXpNeededForCurrent = ((level - 1) * level / 2) * 100;
  return cumulativeXpNeededForCurrent + levelProgressXp;
}


interface GamificationState {
    totalXp: number;
    xp: number;
    level: number;
    gems: number;
    streakShield: number;
    isLoading: boolean;
    showLevelUp: boolean;

    // State for UI
    rulesModalOpen: boolean;
    activeRulesTab: 'xp' | 'gems' | 'levels';

    // Motivation & Gamification Features
    stats: UserStats;
    unlockedThemes: string[];
    motivationText: string;

    // Actions
    loadGamification: () => Promise<void>;
    closeLevelUp: () => void;
    openRules: (tab?: 'xp' | 'gems' | 'levels') => void;
    closeRules: () => void;
    setActiveRulesTab: (tab: 'xp' | 'gems' | 'levels') => void;
    updateMotivation: (text: string) => Promise<void>;
    addXp: (amount: number, category?: Category) => Promise<{ leveledUp: boolean; newLevel: number }>;
    spendGems: (amount: number) => Promise<boolean>;
    addGems: (amount: number) => Promise<void>;
    buyShield: () => Promise<boolean>;
    useShield: () => Promise<boolean>;
    getBufferProgress: () => number; // Returns 0-100% for the current level bar
    settings: UserSettings | null;
    updateUserSettings: (updates: Partial<UserSettings>) => Promise<void>;
}

async function persistAndSyncGamification(
  userId: string,
  updates: {
    xp?: number;
    level?: number;
    gems?: number;
    streakShield?: number;
    stats?: UserStats;
    unlockedThemes?: string[];
    motivation_text?: string;
  }
) {
  await updateSettings({
    userId,
    ...updates
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
      ...updates
    });
  } catch (error) {
    console.error('Failed to sync gamification updates:', error);
  }
}

function updateCategoryStat(stats: UserStats, category: Category, points: number) {
  switch (category) {
    case 'health':
      stats.vitality = Math.max(1, stats.vitality + points);
      break;
    case 'learning':
    case 'work':
      stats.intelligence = Math.max(1, stats.intelligence + points);
      break;
    case 'personal':
      stats.creativity = Math.max(1, stats.creativity + points);
      break;
    case 'finance':
      stats.wealth = Math.max(1, stats.wealth + points);
      break;
    case 'relationships':
      stats.charisma = Math.max(1, stats.charisma + points);
      break;
  }
}

function calculateUpdatedStats(stats: UserStats, amount: number, category?: Category): UserStats {
  const newStats = { ...stats };
  if (amount === 0) return newStats;

  const isPositive = amount > 0;
  const statPoints = Math.max(1, Math.floor(Math.abs(amount) / 10));

  if (isPositive) {
    newStats.discipline += statPoints;
    if (category) {
      updateCategoryStat(newStats, category, statPoints);
    }
  } else {
    newStats.discipline = Math.max(1, newStats.discipline - statPoints);
    if (category) {
      updateCategoryStat(newStats, category, -statPoints);
    }
  }

  return newStats;
}

function calculateStreakAndCompletionRates(
  habits: Habit[],
  completions: any[],
  getTodayProgress: () => { completed: number; total: number; percentage: number }
) {
  if (!habits || habits.length === 0) {
    return { maxCurrentStreak: 0, maxBestStreak: 0, todayCompletionRate: 0 };
  }

  const currentStreaks = habits.map(h => {
    const habitCompletions = completions.filter(c => c.habitId === h.id);
    return calculateCurrentStreak(habitCompletions);
  });
  const maxCurrentStreak = Math.max(...currentStreaks, 0);

  const bestStreaks = habits.map(h => {
    const habitCompletions = completions.filter(c => c.habitId === h.id);
    return calculateBestStreak(habitCompletions);
  });
  const maxBestStreak = Math.max(...bestStreaks, 0);

  const todayProgress = getTodayProgress();
  const todayCompletionRate = todayProgress.total > 0 ? (todayProgress.completed / todayProgress.total) : 0;

  return { maxCurrentStreak, maxBestStreak, todayCompletionRate };
}

function handleXpMigrationIfNeeded(userId: string, level: number, xp: number): number {
  const minCumulativeXp = ((level - 1) * level / 2) * 100;
  if (level > 1 && xp < minCumulativeXp) {
    const migratedXp = minCumulativeXp + xp;
    console.log(`[GamificationStore] Migrating settings.xp from progress-xp to cumulative-xp: ${migratedXp}`);
    updateSettings({
      userId,
      xp: migratedXp
    });
    return migratedXp;
  }
  return xp;
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
    totalXp: 0,
    xp: 0,
    level: 1,
    gems: 0,
    streakShield: 0,
    isLoading: false,
    showLevelUp: false,
    rulesModalOpen: false,
    activeRulesTab: 'xp',

    stats: {
        vitality: 1,
        intelligence: 1,
        discipline: 1,
        charisma: 1,
        wealth: 1,
        creativity: 1,
    },
    unlockedThemes: [],
    motivationText: '',
    settings: null,

    loadGamification: async () => {
        set({ isLoading: true });
        try {
            const supabase = getSupabaseClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user?.id) {
                const settings = await getSettings(session.user.id);
                if (settings) {
                    const { habits, completions, getTodayProgress } = useHabitStore.getState();
                    const { maxCurrentStreak, maxBestStreak, todayCompletionRate } =
                        calculateStreakAndCompletionRates(habits, completions, getTodayProgress);

                    const disciplineVal = Math.round(Math.min(100, (maxCurrentStreak / 30) * 100));
                    const focusVal = Math.round(Math.min(100, todayCompletionRate * 100));
                    const resilienceVal = Math.round(Math.min(100, (maxBestStreak / 60) * 100));

                    const dbStats = settings.stats || get().stats;
                    const calculatedStats: UserStats = {
                        ...dbStats,
                        discipline: disciplineVal || dbStats.discipline || 1,
                        focus: focusVal,
                        resilience: resilienceVal,
                    };

                    const dbLevel = settings.level ?? 1;
                    const dbXp = handleXpMigrationIfNeeded(session.user.id, dbLevel, settings.xp ?? 0);

                    const { level, xpInCurrentLevel } = calculateLevelFromXp(dbXp);

                    set({
                        totalXp: dbXp,
                        xp: xpInCurrentLevel,
                        level: level,
                        gems: settings.gems ?? 0,
                        streakShield: settings.streakShield ?? 0,
                        stats: calculatedStats,
                        unlockedThemes: settings.unlockedThemes || [],
                        motivationText: (settings as any).motivation_text ?? '',
                        settings: settings,
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load gamification data:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    openRules: (tab = 'xp') => set({ rulesModalOpen: true, activeRulesTab: tab }),
    closeRules: () => set({ rulesModalOpen: false }),
    setActiveRulesTab: (tab: 'xp' | 'gems' | 'levels') => set({ activeRulesTab: tab }),

    updateMotivation: async (text: string) => {
        set({ motivationText: text });
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            await persistAndSyncGamification(session.user.id, { motivation_text: text });
        }
    },

    addXp: async (amount: number, category?: Category) => {
        const { totalXp, gems, streakShield, stats, unlockedThemes } = get();
        const newTotalXp = Math.max(0, (totalXp || 0) + amount);
        
        const { level: oldLevel } = calculateLevelFromXp(totalXp || 0);
        const { level: newLevel, xpInCurrentLevel } = calculateLevelFromXp(newTotalXp);
        
        let newGems = gems;
        let leveledUp = false;

        if (newLevel > oldLevel) {
            const levelsGained = newLevel - oldLevel;
            newGems += levelsGained * GEMS_PER_LEVEL;
            leveledUp = true;
        }

        const newStats = calculateUpdatedStats(stats, amount, category);

        set({ 
            totalXp: newTotalXp,
            xp: xpInCurrentLevel,
            level: newLevel,
            gems: newGems,
            showLevelUp: leveledUp,
            stats: newStats
        });

        const supabase = getSupabaseClient();
        const { data: { session } = {} } = await supabase.auth.getSession();
        if (session?.user) {
            await persistAndSyncGamification(session.user.id, {
                xp: newTotalXp,
                level: newLevel,
                gems: newGems,
                streakShield,
                stats: newStats,
                unlockedThemes
            });
        }

        return { leveledUp, newLevel };
    },

    spendGems: async (amount: number) => {
        const { gems } = get();
        if (gems < amount) return false;

        const newGems = gems - amount;
        set({ gems: newGems });

        const supabase = getSupabaseClient();
        const { data: { session } = {} } = await supabase.auth.getSession();
        if (session?.user) {
            await persistAndSyncGamification(session.user.id, { gems: newGems });
        }
        return true;
    },

    addGems: async (amount: number) => {
        const { gems } = get();
        const newGems = gems + amount;
        set({ gems: newGems });

        const supabase = getSupabaseClient();
        const { data: { session } = {} } = await supabase.auth.getSession();
        if (session?.user) {
            await persistAndSyncGamification(session.user.id, { gems: newGems });
        }
    },

    buyShield: async () => {
        const { gems, streakShield } = get();
        if (gems < SHIELD_COST) return false;

        const newGems = gems - SHIELD_COST;
        const newShields = streakShield + 1;

        set({ gems: newGems, streakShield: newShields });

        const supabase = getSupabaseClient();
        const { data: { session } = {} } = await supabase.auth.getSession();
        if (session?.user) {
            await persistAndSyncGamification(session.user.id, {
                gems: newGems,
                streakShield: newShields
            });
        }
        return true;
    },

    useShield: async () => {
        const { streakShield } = get();
        if (streakShield <= 0) return false;

        const newShields = streakShield - 1;
        set({ streakShield: newShields });

        const supabase = getSupabaseClient();
        const { data: { session } = {} } = await supabase.auth.getSession();
        if (session?.user) {
            await persistAndSyncGamification(session.user.id, {
                streakShield: newShields
            });
        }
        return true;
    },

    closeLevelUp: () => set({ showLevelUp: false }),

    getBufferProgress: () => {
        const { totalXp, xp, level } = get();
        if (totalXp && totalXp > 0) {
            const { xpInCurrentLevel, xpRequiredForNextLevel } = calculateLevelFromXp(totalXp);
            return Math.min(100, (xpInCurrentLevel / xpRequiredForNextLevel) * 100);
        }
        const xpRequired = level * 100;
        return Math.min(100, (xp / xpRequired) * 100);
    },

    updateUserSettings: async (updates: Partial<UserSettings>) => {
        const currentSettings = get().settings;
        if (!currentSettings) return;

        const newSettings = { ...currentSettings, ...updates };
        set({ settings: newSettings });

        // Update other relevant top-level gamification fields if they are modified
        if (updates.gems !== undefined) set({ gems: updates.gems });
        if (updates.xp !== undefined) {
            const { level, xpInCurrentLevel } = calculateLevelFromXp(updates.xp);
            set({ totalXp: updates.xp, xp: xpInCurrentLevel, level });
        }
        if (updates.streakShield !== undefined) set({ streakShield: updates.streakShield });
        if (updates.stats !== undefined) set({ stats: updates.stats });

        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            await persistAndSyncGamification(session.user.id, updates);
        }
    }
}));
