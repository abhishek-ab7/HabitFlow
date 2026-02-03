'use client';

import { create } from 'zustand';

export type SyncEntityStatus = 'synced' | 'syncing' | 'error' | 'conflict' | 'pending';

export interface SyncStatus {
    isSyncing: boolean;
    lastSyncTime: Date | null;
    syncError: string | null;
    entityStatus: {
        habits: SyncEntityStatus;
        routines: SyncEntityStatus;
        goals: SyncEntityStatus;
        tasks: SyncEntityStatus;
        completions: SyncEntityStatus;
        routineCompletions: SyncEntityStatus;
    };
    pendingChanges: number;
}

interface SyncStatusStore extends SyncStatus {
    setIsSyncing: (syncing: boolean) => void;
    setLastSyncTime: (time: Date) => void;
    setSyncError: (error: string | null) => void;
    setEntityStatus: (entity: keyof SyncStatus['entityStatus'], status: SyncEntityStatus) => void;
    setPendingChanges: (count: number) => void;
    reset: () => void;
}

const initialState: SyncStatus = {
    isSyncing: false,
    lastSyncTime: null,
    syncError: null,
    entityStatus: {
        habits: 'synced',
        routines: 'synced',
        goals: 'synced',
        tasks: 'synced',
        completions: 'synced',
        routineCompletions: 'synced',
    },
    pendingChanges: 0,
};

export const useSyncStatusStore = create<SyncStatusStore>((set) => ({
    ...initialState,

    setIsSyncing: (syncing) => set({ isSyncing: syncing }),

    setLastSyncTime: (time) => set({ lastSyncTime: time }),

    setSyncError: (error) => set({ syncError: error }),

    setEntityStatus: (entity, status) =>
        set((state) => ({
            entityStatus: {
                ...state.entityStatus,
                [entity]: status,
            },
        })),

    setPendingChanges: (count) => set({ pendingChanges: count }),

    reset: () => set(initialState),
}));
