'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getSyncEngine, SyncStatus } from '@/lib/sync';
import { useAuth } from './auth-provider';
import { useGoalStore } from '@/lib/stores/goal-store';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useUserStore } from '@/lib/stores/user-store';
import { useFinanceStore } from '@/lib/stores/finance-store';

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

function scheduleIdleTask(task: () => void, timeoutMs: number): void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(
      task,
      { timeout: timeoutMs }
    );
    return;
  }
  setTimeout(task, Math.min(timeoutMs, 300));
}

async function hydrateStoresForRoute(
  currentPath: string,
  userId: string,
  forceRefresh: boolean,
  isActive: () => boolean
): Promise<void> {
  const { useFitnessStore } = await import('@/lib/stores/fitness');
  if (currentPath.startsWith('/finance')) {
    await Promise.all([
      useUserStore.getState().loadUser(forceRefresh),
      useFinanceStore.getState().loadFinanceData(userId, forceRefresh),
      useFitnessStore.getState().loadFitnessData(userId, forceRefresh),
      useHabitStore.getState().loadHabits(forceRefresh),
      useGoalStore.getState().loadGoals(forceRefresh),
      useTaskStore.getState().loadTasks(forceRefresh),
    ]);
    return;
  }
  if (currentPath.startsWith('/fitness')) {
    await Promise.all([
      useUserStore.getState().loadUser(forceRefresh),
      useFitnessStore.getState().loadFitnessData(userId, forceRefresh),
      useHabitStore.getState().loadHabits(forceRefresh),
      useFinanceStore.getState().loadFinanceData(userId, forceRefresh),
    ]);
    return;
  }
  await Promise.all([
    useUserStore.getState().loadUser(forceRefresh),
    useGoalStore.getState().loadGoals(forceRefresh),
    useHabitStore.getState().loadHabits(forceRefresh),
    useTaskStore.getState().loadTasks(forceRefresh),
  ]);
  const loadSecondary = () =>
    Promise.all([
      useFinanceStore.getState().loadFinanceData(userId, forceRefresh),
      useFitnessStore.getState().loadFitnessData(userId, forceRefresh),
    ]).catch(() => {});

  if (currentPath.startsWith('/dashboard') || currentPath.startsWith('/analytics')) {
    void loadSecondary();
  } else {
    scheduleIdleTask(() => {
      if (isActive()) void loadSecondary();
    }, 500);
  }
}

async function requestBrowserStoragePersistence(onResult: (granted: boolean) => void): Promise<void> {
  if (typeof navigator === 'undefined') return;
  const persistFn = navigator.storage?.persist;
  if (!persistFn) return;
  try {
    const persistent = await navigator.storage.persisted();
    onResult(persistent);
    if (persistent) return;
    const granted = await navigator.storage.persist();
    onResult(granted);
    if (granted) console.log('[SyncProvider] Storage persistence granted successfully');
    else console.warn('[SyncProvider] Storage persistence could not be granted');
  } catch (err) {
    console.error('[SyncProvider] Error checking storage persistence:', err);
  }
}

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

  useEffect(() => {
    void requestBrowserStoragePersistence(setIsStoragePersistent);
  }, []);

  const updateMetadata = useCallback(() => {
    const metadata = getSyncEngine().getSyncMetadata();
    setPendingChanges(metadata.pendingChanges);
    setLastSyncAt(metadata.lastSyncAt);
    setIsOnline(metadata.isOnline);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      hasInitializedRef.current = false;
      lastUserIdRef.current = null;
      setIsDataReady(true);
      return;
    }
    if (hasInitializedRef.current && lastUserIdRef.current === userId) {
      setIsDataReady(true);
      return;
    }
    if (isInitializingRef.current) return;

    isInitializingRef.current = true;
    let active = true;
    let metadataInterval: NodeJS.Timeout | null = null;
    let unsubscribe: (() => void) | null = null;

    const runIdleBackgroundSync = (syncEngine: ReturnType<typeof getSyncEngine>) => {
      scheduleIdleTask(async () => {
        if (!active) return;
        try {
          await syncEngine.syncAll();
        } catch (syncErr) {
          console.warn('[SyncProvider] Background initial sync failed:', syncErr);
        }
      }, 1500);
    };

    const initializeData = async () => {
      try {
        const syncEngine = getSyncEngine();
        unsubscribe = syncEngine.onSyncStatusChange((status) => {
          if (!active) return;
          setSyncStatus(status);
          setIsSyncing(status.type === 'syncing');
        });

        setSyncStatus({ type: 'syncing', message: 'Loading local data...', progress: 30 });
        await syncEngine.checkAndRunMigrations();
        if (!active) return;

        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/dashboard';
        await hydrateStoresForRoute(currentPath, userId, false, () => active);
        if (!active) return;

        hasInitializedRef.current = true;
        lastUserIdRef.current = userId;
        setIsDataReady(true);
        setSyncStatus({ type: 'success', message: 'Ready (offline-first)' });
        updateMetadata();

        metadataInterval = setInterval(() => {
          if (active) updateMetadata();
        }, 30000);

        runIdleBackgroundSync(syncEngine);
      } catch (error) {
        console.error('[SyncProvider] Initialization failed:', error);
        if (active) {
          setSyncStatus({ type: 'error', message: 'Failed to load data' });
          setIsDataReady(true);
        }
      } finally {
        isInitializingRef.current = false;
      }
    };

    void initializeData();

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

  const contextValue = useMemo<SyncContextType>(
    () => ({
      syncStatus,
      isSyncing,
      isOnline,
      pendingChanges,
      lastSyncAt,
      isDataReady,
      isStoragePersistent,
      triggerSync,
    }),
    [
      syncStatus,
      isSyncing,
      isOnline,
      pendingChanges,
      lastSyncAt,
      isDataReady,
      isStoragePersistent,
      triggerSync,
    ]
  );

  // Always render children immediately — NO blocking render
  return (
    <SyncContext.Provider value={contextValue}>
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
