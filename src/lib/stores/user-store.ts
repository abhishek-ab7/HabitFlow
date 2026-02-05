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

                // NEW: Try to fetch from remote first (latest data across devices)
                let displayNameLoaded = false;

                try {
                    const { data: remoteSettings, error } = await supabase
                        .from('user_settings')
                        .select('user_name')
                        .eq('user_id', session.user.id)
                        .single();

                    if (!error && remoteSettings && (remoteSettings as any).user_name) {
                        const userName = (remoteSettings as any).user_name as string;
                        console.log('[UserStore] Loaded display name from Supabase:', userName);
                        set({ displayName: userName });

                        // Also update local DB to keep in sync
                        await updateSettings({
                            userId: session.user.id,
                            userName: userName
                        });
                        displayNameLoaded = true;
                    }
                } catch (error) {
                    console.warn('[UserStore] Failed to fetch from remote, falling back to local:', error);
                }

                // Fallback to local DB if remote fetch failed or returned nothing
                if (!displayNameLoaded) {
                    const settings = await getSettings(session.user.id);
                    if (settings?.userName) {
                        console.log('[UserStore] Loaded display name from local DB:', settings.userName);
                        set({ displayName: settings.userName });
                    }
                }
            }
        } catch (error) {
            console.error('[UserStore] Failed to load user data:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    setDisplayName: async (name: string) => {
        console.log('[UserStore] Setting display name:', name);
        set({ displayName: name });

        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
            // 1. Update local DB
            console.log('[UserStore] Updating local DB with display name:', name);
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
                console.log('[UserStore] Pushing to Supabase:', { userName: currentSettings.userName });
                await syncEngine.pushUserSettings(currentSettings);
                console.log('[UserStore] ✅ Display name saved and synced successfully');
            } else {
                console.warn('[UserStore] ⚠️ No current settings found, cannot sync');
            }
        }
    }
}));
