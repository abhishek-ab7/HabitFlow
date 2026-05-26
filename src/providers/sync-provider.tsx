'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getSyncEngine, SyncStatus } from '@/lib/sync';
import { useAuth } from './auth-provider';
import { useGoalStore } from '@/lib/stores/goal-store';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useRoutineStore } from '@/lib/stores/routine-store';
import { useUserStore } from '@/lib/stores/user-store';

interface SyncContextType {
  syncStatus: SyncStatus;
  isSyncing: boolean;
  isOnline: boolean;
  pendingChanges: number;
  lastSyncAt: string | null;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const userId = user?.id || null;
  const lastUserIdRef = useRef<string | null>(null);
  const isInitializingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ type: 'idle' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Update metadata periodically
  const updateMetadata = useCallback(() => {
    const syncEngine = getSyncEngine();
    const metadata = syncEngine.getSyncMetadata();
    setPendingChanges(metadata.pendingChanges);
    setLastSyncAt(metadata.lastSyncAt);
    setIsOnline(metadata.isOnline);
  }, []);

  // Eager data load - sync from Supabase FIRST, then preload into Zustand
  useEffect(() => {
    console.log('[SyncProvider] useEffect triggered, isAuthenticated:', isAuthenticated, 'userId:', userId);

    if (!isAuthenticated || !userId) {
      console.log('[SyncProvider] Skipping sync - not authenticated');
      hasInitializedRef.current = false;
      lastUserIdRef.current = null;
      setIsDataLoaded(true); // Skip if not authenticated
      return;
    }

    // If we've already successfully initialized for this user, do not run the sync/load again.
    if (hasInitializedRef.current && lastUserIdRef.current === userId) {
      console.log('[SyncProvider] Already initialized for user:', userId);
      setIsDataLoaded(true);
      return;
    }

    // If we are already initializing (running), ignore duplicate triggers
    if (isInitializingRef.current) {
      console.log('[SyncProvider] Sync initialization is already in progress, ignoring duplicate run');
      return;
    }

    isInitializingRef.current = true;
    console.log('[SyncProvider] Starting data initialization for user:', userId);

    let active = true;
    let metadataInterval: NodeJS.Timeout | null = null;
    let unsubscribe: (() => void) | null = null;

    const initializeData = async () => {
      try {
        const syncEngine = getSyncEngine();

        // Subscribe to sync status for UI feedback
        unsubscribe = syncEngine.onSyncStatusChange((status) => {
          if (active) {
            setSyncStatus(status);
            setIsSyncing(status.type === 'syncing');
          }
        });

        // STEP 1: Check and run migrations if needed
        console.log('[SyncProvider] STEP 1: Checking for migrations...');
        if (active) setSyncStatus({ type: 'syncing', message: 'Checking migrations...', progress: 10 });
        await syncEngine.checkAndRunMigrations();
        console.log('[SyncProvider] STEP 1: Migration check complete');

        if (!active) return;

        // STEP 2: Sync from Supabase (pulls remote data into IndexedDB)
        console.log('[SyncProvider] STEP 2: Syncing from Supabase to IndexedDB...');
        if (active) setSyncStatus({ type: 'syncing', message: 'Syncing from cloud...', progress: 40 });
        await syncEngine.syncAll();
        console.log('[SyncProvider] STEP 2: Sync complete');

        if (!active) return;

        // STEP 3: Then preload from IndexedDB into Zustand stores
        console.log('[SyncProvider] STEP 3: Loading data into Zustand stores...');
        if (active) setSyncStatus({ type: 'syncing', message: 'Loading data...', progress: 80 });
        await Promise.all([
          useUserStore.getState().loadUser(),
          useGoalStore.getState().loadGoals(),
          useHabitStore.getState().loadHabits(),
          useTaskStore.getState().loadTasks(),
          useRoutineStore.getState().loadRoutines(),
        ]);
        console.log('[SyncProvider] STEP 3: Store loading complete');

        if (!active) return;

        hasInitializedRef.current = true;
        lastUserIdRef.current = userId;
        setIsDataLoaded(true);
        setSyncStatus({ type: 'success', message: 'All data loaded' });

        // Update metadata
        updateMetadata();

        // Setup periodic metadata updates
        metadataInterval = setInterval(() => {
          if (active) updateMetadata();
        }, 30000);

      } catch (error) {
        console.error('[SyncProvider] Initialization failed:', error);
        if (active) {
          setSyncStatus({ type: 'error', message: 'Failed to load data' });
          setIsDataLoaded(true); // Still render even if sync fails
        }
      } finally {
        isInitializingRef.current = false;
      }
    };

    initializeData();

    return () => {
      active = false;
      isInitializingRef.current = false;
      if (unsubscribe) unsubscribe();
      if (metadataInterval) clearInterval(metadataInterval);
    };
  }, [isAuthenticated, userId, updateMetadata]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isAuthenticated) return;
    const syncEngine = getSyncEngine();
    await syncEngine.syncAll();
    updateMetadata();
  }, [isAuthenticated, updateMetadata]);

  // Show loading state while data is being preloaded
  if (isAuthenticated && !isDataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <SyncContext.Provider value={{
      syncStatus,
      isSyncing,
      isOnline,
      pendingChanges,
      lastSyncAt,
      triggerSync
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
