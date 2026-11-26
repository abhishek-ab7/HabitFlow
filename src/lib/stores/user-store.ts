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
    loadUser: (force?: boolean) => Promise<void>;
    setDisplayName: (name: string) => void; // LOCAL ONLY - synchronous
    saveDisplayNameToServer: () => Promise<void>; // EXPLICIT SAVE - async
    setupRealtimeSubscription: () => void;
    cleanupRealtimeSubscription: () => void;
}

let loadedUserStoreId: string | null = null;

async function resolveInitialDisplayName(opts: {
    userId: string;
    metaName: string | undefined;
}): Promise<string | undefined> {
    const localSettings = await getSettings(opts.userId);
    if (localSettings?.userName) return localSettings.userName;
    if (!opts.metaName) return undefined;
    await updateSettings({ userId: opts.userId, userName: opts.metaName });
    return opts.metaName;
}

async function revalidateRemoteDisplayName(opts: {
    userId: string;
    getDisplayName: () => string;
    setDisplayName: (name: string) => void;
}) {
    try {
        const supabase = getSupabaseClient();
        const { data: remoteSettings, error } = await supabase
            .from('user_settings')
            .select('user_name')
            .eq('user_id', opts.userId)
            .single();

        const remoteName = (remoteSettings as { user_name?: string } | null)?.user_name;
        const hasRemoteChange = !error && Boolean(remoteName) && remoteName !== opts.getDisplayName();
        if (!hasRemoteChange || !remoteName) return;

        opts.setDisplayName(remoteName);
        const { db } = await import('../db');
        const existing = await db.userSettings.where('userId').equals(opts.userId).first();
        if (existing) {
            await db.userSettings.update(existing.id, { userName: remoteName, isDirty: false });
        }
    } catch {
        // Offline or transient network error
    }
}

async function getAuthenticatedUser() {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user ?? null;
}

function shouldSkipUserLoad(opts: { force: boolean; userId: string; currentName: string }): boolean {
    if (opts.force || !opts.currentName) return false;
    return loadedUserStoreId === opts.userId;
}

export const useUserStore = create<UserState>((set, get) => ({
    displayName: '',
    email: null,
    isLoading: false,
    realtimeChannel: null,

    loadUser: async (force = false) => {
        try {
            const user = await getAuthenticatedUser();
            if (!user) {
                loadedUserStoreId = null;
                set({ displayName: '', email: null, isLoading: false });
                return;
            }
            if (shouldSkipUserLoad({ force, userId: user.id, currentName: get().displayName })) return;

            set({ isLoading: true, email: user.email ?? null });
            const resolvedName = await resolveInitialDisplayName({
                userId: user.id,
                metaName: user.user_metadata?.full_name as string | undefined,
            });
            if (resolvedName) set({ displayName: resolvedName });

            loadedUserStoreId = user.id;
            set({ isLoading: false });
            void revalidateRemoteDisplayName({
                userId: user.id,
                getDisplayName: () => get().displayName,
                setDisplayName: (displayName) => set({ displayName }),
            });
        } catch (error) {
            console.error('[UserStore] Failed to load user data:', error);
            set({ isLoading: false });
        }
    },

    setupRealtimeSubscription: () => {
        // Consolidated under SyncEngine global realtime channel
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

        // Warn if setting empty value to track where it's being called from
        if (name === '') {
            console.warn('[UserStore] ⚠️ Setting empty name - caller:', new Error().stack?.split('\n')[2]);
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
