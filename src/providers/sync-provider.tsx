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
  /** True once SyncProvider has finished syncing + loading stores */
  isDataReady: boolean;
  isStoragePersistent: boolean;
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
  const [isDataReady, setIsDataReady] = useState(false);
  const [isStoragePersistent, setIsStoragePersistent] = useState(false);

  // Request WebKit storage persistence on client mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then((persistent) => {
        setIsStoragePersistent(persistent);
        if (!persistent) {
          navigator.storage.persist().then((granted) => {
            setIsStoragePersistent(granted);
            if (granted) {
              console.log('[SyncProvider] Storage persistence granted successfully');
            } else {
              console.warn('[SyncProvider] Storage persistence could not be granted');
            }
          }).catch((err) => {
            console.error('[SyncProvider] Error requesting storage persistence:', err);
          });
        }
      }).catch((err) => {
        console.error('[SyncProvider] Error checking storage persistence:', err);
      });
    }
  }, []);

  // Update metadata periodically
  const updateMetadata = useCallback(() => {
    const syncEngine = getSyncEngine();
    const metadata = syncEngine.getSyncMetadata();
    setPendingChanges(metadata.pendingChanges);
    setLastSyncAt(metadata.lastSyncAt);
    setIsOnline(metadata.isOnline);
  }, []);

  // Background sync: Supabase → IndexedDB → Zustand stores
  // Always renders children immediately — never blocks UI.
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      hasInitializedRef.current = false;
      lastUserIdRef.current = null;
      setIsDataReady(true); // Not authenticated — nothing to load
      return;
    }

    if (hasInitializedRef.current && lastUserIdRef.current === userId) {
      setIsDataReady(true);
      return;
    }

    if (isInitializingRef.current) {
      return;
    }

    isInitializingRef.current = true;

    let active = true;
    let metadataInterval: NodeJS.Timeout | null = null;
    let unsubscribe: (() => void) | null = null;

    const initializeData = async () => {
      try {
        const syncEngine = getSyncEngine();

        unsubscribe = syncEngine.onSyncStatusChange((status) => {
          if (active) {
            setSyncStatus(status);
            setIsSyncing(status.type === 'syncing');
          }
        });

        // STEP 1: Migrations
        if (active) setSyncStatus({ type: 'syncing', message: 'Checking migrations...', progress: 10 });
        await syncEngine.checkAndRunMigrations();

        if (!active) return;

        // STEP 2: Sync Supabase → IndexedDB
        if (active) setSyncStatus({ type: 'syncing', message: 'Syncing from cloud...', progress: 40 });
        await syncEngine.syncAll();

        if (!active) return;

        // STEP 3: Load IndexedDB → Zustand stores
        if (active) setSyncStatus({ type: 'syncing', message: 'Loading data...', progress: 80 });
        await Promise.all([
          useUserStore.getState().loadUser(),
          useGoalStore.getState().loadGoals(),
          useHabitStore.getState().loadHabits(),
          useTaskStore.getState().loadTasks(),
          useRoutineStore.getState().loadRoutines(),
        ]);

        if (!active) return;

        hasInitializedRef.current = true;
        lastUserIdRef.current = userId;
        setIsDataReady(true);
        setSyncStatus({ type: 'success', message: 'All data loaded' });

        updateMetadata();

        metadataInterval = setInterval(() => {
          if (active) updateMetadata();
        }, 30000);

      } catch (error) {
        console.error('[SyncProvider] Initialization failed:', error);
        if (active) {
          setSyncStatus({ type: 'error', message: 'Failed to load data' });
          setIsDataReady(true); // Still render even if sync fails
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

  // Always render children immediately — NO blocking render
  return (
    <SyncContext.Provider value={{
      syncStatus,
      isSyncing,
      isOnline,
      pendingChanges,
      lastSyncAt,
      isDataReady,
      isStoragePersistent,
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
