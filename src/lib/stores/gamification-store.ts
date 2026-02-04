import { create } from 'zustand';
import { getSettings, updateSettings } from '../db';
import { getSupabaseClient } from '../supabase/client';
import { getSyncEngine } from '../sync';

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

    // Motivation Features
    stats: {
        discipline: number;
        focus: number;
        resilience: number;
    };
    motivationText: string;

    // Actions
    loadGamification: () => Promise<void>;
    closeLevelUp: () => void;
    openRules: (tab?: 'xp' | 'gems' | 'levels') => void;
    closeRules: () => void;
    setActiveRulesTab: (tab: 'xp' | 'gems' | 'levels') => void;
    updateMotivation: (text: string) => Promise<void>;
    addXp: (amount: number) => Promise<{ leveledUp: boolean; newLevel: number }>;
    spendGems: (amount: number) => Promise<boolean>;
    buyShield: () => Promise<boolean>;
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

    // Default Stats (Mock Data for now, could be calculated later)
    stats: {
        discipline: 65,
        focus: 42,
        resilience: 80
    },
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
                    // @ts-ignore - dynamic property
                    motivation_text: text
                });
            } catch (e) {
                console.warn("Failed to persist motivation text (column might be missing)", e);
            }
        }
    },

    addXp: async (amount: number) => {
        const { xp, level, gems, streakShield } = get();
        let newXp = xp + amount;
        let newLevel = level;
        let newGems = gems;
        let leveledUp = false;

        // Formula: XP required for next level = Level * 100
        // e.g. Level 1 -> 100 XP to reach Level 2
        // Level 2 -> 200 XP to reach Level 3
        const xpRequired = level * 100;

        if (newXp >= xpRequired) {
            newLevel += 1;
            newXp = newXp - xpRequired; // Carry over excess XP
            newGems += GEMS_PER_LEVEL;
            leveledUp = true;
        }

        set({ xp: newXp, level: newLevel, gems: newGems, showLevelUp: leveledUp });

        // Persist to DB
        const supabase = getSupabaseClient();
        const { data: { session } = {} } = await supabase.auth.getSession();
        if (session?.user) {
            await updateSettings({
                userId: session.user.id,
                xp: newXp,
                level: newLevel,
                gems: newGems,
                streakShield // Ensure this is preserved
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
                streakShield
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

    closeLevelUp: () => set({ showLevelUp: false }),

    getBufferProgress: () => {
        const { xp, level } = get();
        const xpRequired = level * 100;
        return Math.min(100, (xp / xpRequired) * 100);
    }
}));
