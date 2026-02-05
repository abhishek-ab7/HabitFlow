import { create } from 'zustand';
import { getSettings, updateSettings } from '../db';
import { getSupabaseClient } from '../supabase/client';
import { getSyncEngine } from '../sync';

interface UserState {
    displayName: string;
    email: string | null;
    isLoading: boolean;

    // Actions
    loadUser: () => Promise<void>;
    setDisplayName: (name: string) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
    displayName: '',
    email: null,
    isLoading: false,

    loadUser: async () => {
        set({ isLoading: true });
        try {
            const supabase = getSupabaseClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
                set({ email: session.user.email ?? null });

                const settings = await getSettings(session.user.id);
                if (settings?.userName) {
                    set({ displayName: settings.userName });
                }
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    setDisplayName: async (name: string) => {
        set({ displayName: name });

        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
            // 1. Update local DB
            await updateSettings({
                userId: session.user.id,
                userName: name
            });

            // 2. Sync to Remote
            const currentSettings = await getSettings(session.user.id);
            const syncEngine = getSyncEngine();

            // Use existing settings to avoid overwriting gamification data with defaults/nulls
            // The pushUserSettings method in sync engine expects the full object logic or handles partials?
            // Looking at gamification-store, it constructs the full object.
            // We should probably do the same or rely on the sync engine reading from DB?
            // SyncEngine.pushUserSettings takes 'settings: any'.
            // If we look at sync-engine.ts, it calls pushUserSettingsToRemote(settings).
            // So we should pass the FULL settings object from DB.

            if (currentSettings) {
                await syncEngine.pushUserSettings(currentSettings);
            }
        }
    }
}));
