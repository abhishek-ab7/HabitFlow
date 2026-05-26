import { create } from 'zustand';
import { getSettings, updateSettings } from '../db';
import { getSupabaseClient } from '../supabase/client';
import { getSyncEngine } from '../sync';
import type { UserStats, Category } from '../types';

export const XP_PER_TASK = 10;
export const XP_PER_HABIT = 15;
export const XP_PER_ROUTINE = 50;
export const GEMS_PER_LEVEL = 5;
export const SHIELD_COST = 20;

interface GamificationState {
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
                    set({
                        xp: settings.xp ?? 0,
                        level: settings.level ?? 1,
                        gems: settings.gems ?? 0,
                        streakShield: settings.streakShield ?? 0,
                        stats: settings.stats || get().stats,
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
            // Note: 'motivation_text' needs to be added to DB schema if not present.
            // For now, we'll try to save it if the column exists, or rely on local state/mock.
            // In a real scenario, we'd add a migration.
            try {
                await updateSettings({
                    userId: session.user.id,
                    motivation_text: text
                } as any);
            } catch (e) {
                console.warn("Failed to persist motivation text (column might be missing)", e);
            }
        }
    },

    addXp: async (amount: number, category?: Category) => {
        const { xp, level, gems, streakShield, stats, unlockedThemes } = get();
        let newXp = xp + amount;
        let newLevel = level;
        let newGems = gems;
        let leveledUp = false;

        // Calculate stat increments (1 point per 10 XP)
        const statPoints = Math.max(1, Math.floor(amount / 10));
        const newStats = { ...stats };
        newStats.discipline += statPoints; // Always give discipline

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

        // Formula: XP required for next level = Level * 100
        const xpRequired = level * 100;

        if (newXp >= xpRequired) {
            newLevel += 1;
            newXp = newXp - xpRequired; // Carry over excess XP
            newGems += GEMS_PER_LEVEL;
            leveledUp = true;
        }

        set({ xp: newXp, level: newLevel, gems: newGems, showLevelUp: leveledUp, stats: newStats });

        // Persist to DB
        const supabase = getSupabaseClient();
        const { data: { session } = {} } = await supabase.auth.getSession();
        if (session?.user) {
            await updateSettings({
                userId: session.user.id,
                xp: newXp,
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
                xp: newXp,
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
            const { xp, level, streakShield } = get();
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
                xp,
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
            const { xp, level, streakShield } = get();
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
                xp,
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
            const { xp, level } = get();
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
                xp,
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
            const { xp, level, gems } = get();
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
                xp,
                level,
                gems,
                streakShield: newShields
            });
        }
        return true;
    },

    closeLevelUp: () => set({ showLevelUp: false }),

    getBufferProgress: () => {
        const { xp, level } = get();
        const xpRequired = level * 100;
        return Math.min(100, (xp / xpRequired) * 100);
    }
}));
