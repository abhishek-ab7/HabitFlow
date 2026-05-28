import { create } from 'zustand';
import { getSettings, updateSettings } from '../db';
import { getSupabaseClient } from '../supabase/client';
import { getSyncEngine } from '../sync';
import type { UserStats, Category } from '../types';
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

    // Default Stats (Will be overridden by DB)
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

    loadGamification: async () => {
        set({ isLoading: true });
        try {
            const supabase = getSupabaseClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user?.id) {
                const settings = await getSettings(session.user.id);
                if (settings) {
                    // Fetch habits and completions to calculate real stats
                    const { habits, completions, getTodayProgress } = useHabitStore.getState();
                    let maxCurrentStreak = 0;
                    let maxBestStreak = 0;
                    let todayCompletionRate = 0;

                    if (habits && habits.length > 0) {
                        const currentStreaks = habits.map(h => {
                            const habitCompletions = completions.filter(c => c.habitId === h.id);
                            return calculateCurrentStreak(habitCompletions);
                        });
                        maxCurrentStreak = Math.max(...currentStreaks, 0);

                        const bestStreaks = habits.map(h => {
                            const habitCompletions = completions.filter(c => c.habitId === h.id);
                            return calculateBestStreak(habitCompletions);
                        });
                        maxBestStreak = Math.max(...bestStreaks, 0);

                        const todayProgress = getTodayProgress();
                        todayCompletionRate = todayProgress.total > 0 ? (todayProgress.completed / todayProgress.total) : 0;
                    }

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

                    let dbXp = settings.xp ?? 0;
                    let dbLevel = settings.level ?? 1;

                    // Migrate old format (progress-xp) to cumulative total XP
                    const minCumulativeXp = ((dbLevel - 1) * dbLevel / 2) * 100;
                    if (dbLevel > 1 && dbXp < minCumulativeXp) {
                        dbXp = minCumulativeXp + dbXp;
                        console.log(`[GamificationStore] Migrating settings.xp from progress-xp to cumulative-xp: ${dbXp}`);
                        // Persist immediately to local storage / IndexedDB
                        updateSettings({
                            userId: session.user.id,
                            xp: dbXp
                        });
                    }

                    const { level, xpInCurrentLevel } = calculateLevelFromXp(dbXp);

                    set({
                        totalXp: dbXp,
                        xp: xpInCurrentLevel,
                        level: level,
                        gems: settings.gems ?? 0,
                        streakShield: settings.streakShield ?? 0,
                        stats: calculatedStats,
                        unlockedThemes: settings.unlockedThemes || [],
                        // If DB doesn't have these fields yet, use defaults or mock
                        motivationText: (settings as any).motivation_text ?? '',
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
        // Persist to DB
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            try {
                await updateSettings({
                    userId: session.user.id,
                    motivation_text: text
                } as any);

                // Sync to Supabase via sync engine
                const currentSettings = await getSettings(session.user.id);
                const syncEngine = getSyncEngine();
                syncEngine.pushUserSettings({
                    userName: currentSettings?.userName,
                    weekStartsOn: currentSettings?.weekStartsOn ?? 0,
                    defaultCategory: currentSettings?.defaultCategory ?? 'health',
                    xp: get().totalXp || get().xp,
                    level: get().level,
                    gems: get().gems,
                    streakShield: get().streakShield,
                    stats: get().stats,
                    unlockedThemes: get().unlockedThemes,
                    motivation_text: text
                });
            } catch (e) {
                console.warn("Failed to persist motivation text", e);
            }
        }
    },

    addXp: async (amount: number, category?: Category) => {
        const { totalXp, gems, streakShield, stats, unlockedThemes } = get();
        const newTotalXp = Math.max(0, (totalXp || 0) + amount); // Prevent negative XP
        
        const { level: oldLevel } = calculateLevelFromXp(totalXp || 0);
        const { level: newLevel, xpInCurrentLevel } = calculateLevelFromXp(newTotalXp);
        
        let newGems = gems;
        let leveledUp = false;

        if (newLevel > oldLevel) {
            const levelsGained = newLevel - oldLevel;
            newGems += levelsGained * GEMS_PER_LEVEL;
            leveledUp = true;
        }

        // Calculate stat increments/reversions (1 point per 10 XP)
        const newStats = { ...stats };
        if (amount > 0) {
            const statPoints = Math.max(1, Math.floor(amount / 10));
            newStats.discipline += statPoints;
            if (category) {
                switch (category) {
                    case 'health': newStats.vitality += statPoints; break;
                    case 'learning':
                    case 'work': newStats.intelligence += statPoints; break;
                    case 'personal': newStats.creativity += statPoints; break;
                    case 'finance': newStats.wealth += statPoints; break;
                    case 'relationships': newStats.charisma += statPoints; break;
                }
            }
        } else if (amount < 0) {
            const absAmount = Math.abs(amount);
            const statPoints = Math.max(1, Math.floor(absAmount / 10));
            newStats.discipline = Math.max(1, newStats.discipline - statPoints);
            if (category) {
                switch (category) {
                    case 'health': newStats.vitality = Math.max(1, newStats.vitality - statPoints); break;
                    case 'learning':
                    case 'work': newStats.intelligence = Math.max(1, newStats.intelligence - statPoints); break;
                    case 'personal': newStats.creativity = Math.max(1, newStats.creativity - statPoints); break;
                    case 'finance': newStats.wealth = Math.max(1, newStats.wealth - statPoints); break;
                    case 'relationships': newStats.charisma = Math.max(1, newStats.charisma - statPoints); break;
                }
            }
        }

        set({ 
            totalXp: newTotalXp,
            xp: xpInCurrentLevel,
            level: newLevel,
            gems: newGems,
            showLevelUp: leveledUp,
            stats: newStats
        });

        // Persist to DB
        const supabase = getSupabaseClient();
        const { data: { session } = {} } = await supabase.auth.getSession();
        if (session?.user) {
            await updateSettings({
                userId: session.user.id,
                xp: newTotalXp, // Save total cumulative XP
                level: newLevel,
                gems: newGems,
                streakShield,
                stats: newStats,
                unlockedThemes
            });

            // Sync to Supabase via sync engine with COMPLETE settings
            const currentSettings = await getSettings(session.user.id);
            const syncEngine = getSyncEngine();
            syncEngine.pushUserSettings({
                userName: currentSettings?.userName,
                weekStartsOn: currentSettings?.weekStartsOn ?? 0,
                defaultCategory: currentSettings?.defaultCategory ?? 'health',
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
            const { totalXp, xp, level, streakShield } = get();
            await updateSettings({
                userId: session.user.id,
                gems: newGems
            });

            // Sync to Supabase with complete settings
            const currentSettings = await getSettings(session.user.id);
            const syncEngine = getSyncEngine();
            syncEngine.pushUserSettings({
                userName: currentSettings?.userName,
                weekStartsOn: currentSettings?.weekStartsOn ?? 0,
                defaultCategory: currentSettings?.defaultCategory ?? 'health',
                xp: totalXp || xp,
                level,
                gems: newGems,
                streakShield
            });
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
            const { totalXp, xp, level, streakShield } = get();
            await updateSettings({
                userId: session.user.id,
                gems: newGems
            });

            const currentSettings = await getSettings(session.user.id);
            const syncEngine = getSyncEngine();
            syncEngine.pushUserSettings({
                userName: currentSettings?.userName,
                weekStartsOn: currentSettings?.weekStartsOn ?? 0,
                defaultCategory: currentSettings?.defaultCategory ?? 'health',
                xp: totalXp || xp,
                level,
                gems: newGems,
                streakShield
            });
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
            const { totalXp, xp, level } = get();
            await updateSettings({
                userId: session.user.id,
                gems: newGems,
                streakShield: newShields
            });

            // Sync to Supabase with complete settings
            const currentSettings = await getSettings(session.user.id);
            const syncEngine = getSyncEngine();
            syncEngine.pushUserSettings({
                userName: currentSettings?.userName,
                weekStartsOn: currentSettings?.weekStartsOn ?? 0,
                defaultCategory: currentSettings?.defaultCategory ?? 'health',
                xp: totalXp || xp,
                level,
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
            const { totalXp, xp, level, gems } = get();
            await updateSettings({
                userId: session.user.id,
                streakShield: newShields
            });

            // Sync to Supabase with complete settings
            const currentSettings = await getSettings(session.user.id);
            const syncEngine = getSyncEngine();
            syncEngine.pushUserSettings({
                userName: currentSettings?.userName,
                weekStartsOn: currentSettings?.weekStartsOn ?? 0,
                defaultCategory: currentSettings?.defaultCategory ?? 'health',
                xp: totalXp || xp,
                level,
                gems,
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
    }
}));
