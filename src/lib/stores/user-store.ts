import { create } from 'zustand';
import { getSettings, updateSettings } from '../db';
import { getSupabaseClient } from '../supabase/client';
import { getSyncEngine } from '../sync';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UserState {
    displayName: string;
    email: string | null;
    isLoading: boolean;
    realtimeChannel: RealtimeChannel | null;

    // Actions
    loadUser: () => Promise<void>;
    setDisplayName: (name: string) => void; // LOCAL ONLY - synchronous
    saveDisplayNameToServer: () => Promise<void>; // EXPLICIT SAVE - async
    setupRealtimeSubscription: () => void;
    cleanupRealtimeSubscription: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
    displayName: '',
    email: null,
    isLoading: false,
    realtimeChannel: null,

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

                // NEW: Setup realtime subscription for cross-device sync
                get().setupRealtimeSubscription();
            }
        } catch (error) {
            console.error('[UserStore] Failed to load user data:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    setupRealtimeSubscription: () => {
        const supabase = getSupabaseClient();

        // Clean up existing subscription first
        get().cleanupRealtimeSubscription();

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session?.user) {
                console.log('[UserStore] No session, skipping realtime setup');
                return;
            }

            console.log('[UserStore] Setting up realtime subscription for user:', session.user.id);

            const channel = supabase
                .channel('user_settings_realtime')
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'user_settings',
                    filter: `user_id=eq.${session.user.id}`
                }, async (payload) => {
                    console.log('[UserStore] 🔔 Realtime update detected:', payload.new);
                    const newName = (payload.new as any).user_name;

                    if (newName && newName !== get().displayName) {
                        console.log('[UserStore] Updating display name from realtime:', newName);
                        set({ displayName: newName });

                        // Update local DB to keep in sync
                        try {
                            await updateSettings({
                                userId: session.user.id,
                                userName: newName
                            });
                            console.log('[UserStore] ✅ Display name synced via realtime');
                        } catch (error) {
                            console.error('[UserStore] Failed to update local DB:', error);
                        }
                    }
                })
                .subscribe((status) => {
                    console.log('[UserStore] Realtime subscription status:', status);
                });

            set({ realtimeChannel: channel });
        });
    },

    cleanupRealtimeSubscription: () => {
        const channel = get().realtimeChannel;
        if (channel) {
            console.log('[UserStore] Cleaning up realtime subscription');
            const supabase = getSupabaseClient();
            supabase.removeChannel(channel);
            set({ realtimeChannel: null });
        }
    },

    setDisplayName: (name: string) => {
        // LOCAL STATE UPDATE ONLY - NO ASYNC, NO SUPABASE PUSH
        console.log('[UserStore] Setting display name (local only):', name);

        // Warn if setting default value to track where it's being called from
        if (name === 'Habit Hero' || name === '') {
            console.warn('[UserStore] ⚠️ Setting empty/default value - caller:', new Error().stack?.split('\n')[2]);
        }

        set({ displayName: name });
    },

    saveDisplayNameToServer: async () => {
        const { displayName } = get();
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
            throw new Error('No active session');
        }

        console.log('[UserStore] 💾 Saving display name to server:', displayName);

        // 1. Update local DB
        await updateSettings({
            userId: session.user.id,
            userName: displayName
        });

        // 2. Push to Supabase
        const currentSettings = await getSettings(session.user.id);
        if (currentSettings) {
            const syncEngine = getSyncEngine();
            await syncEngine.pushUserSettings(currentSettings);
            console.log('[UserStore] ✅ Display name saved to Supabase');
        } else {
            console.warn('[UserStore] ⚠️ No current settings found in local DB');
        }
    }
}));
