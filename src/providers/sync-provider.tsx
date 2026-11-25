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

        // STEP 1: Fast local schema/data migrations
        if (active) setSyncStatus({ type: 'syncing', message: 'Loading local data...', progress: 30 });
        await syncEngine.checkAndRunMigrations();

        if (!active) return;

        // STEP 2: Hydrate route-critical stores from local IndexedDB immediately (<50ms)
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/dashboard';
        const hydrateAllLocalStores = async (forceRefresh = false) => {
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
          } else if (currentPath.startsWith('/fitness')) {
            await Promise.all([
              useUserStore.getState().loadUser(forceRefresh),
              useFitnessStore.getState().loadFitnessData(userId, forceRefresh),
              useHabitStore.getState().loadHabits(forceRefresh),
              useFinanceStore.getState().loadFinanceData(userId, forceRefresh),
            ]);
          } else {
            await Promise.all([
              useUserStore.getState().loadUser(forceRefresh),
              useGoalStore.getState().loadGoals(forceRefresh),
              useHabitStore.getState().loadHabits(forceRefresh),
              useTaskStore.getState().loadTasks(forceRefresh),
            ]);
            // Hydrate heavy domain stores right after critical paint unless already needed on /dashboard
            const loadSecondary = () => Promise.all([
              useFinanceStore.getState().loadFinanceData(userId, forceRefresh),
              useFitnessStore.getState().loadFitnessData(userId, forceRefresh),
            ]).catch(() => {});
            if (currentPath.startsWith('/dashboard') || currentPath.startsWith('/analytics')) {
              void loadSecondary();
            } else if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
              (window as any).requestIdleCallback(() => { if (active) void loadSecondary(); }, { timeout: 500 });
            } else {
              setTimeout(() => { if (active) void loadSecondary(); }, 50);
            }
          }
        };

        await hydrateAllLocalStores(false);

        if (!active) return;

        hasInitializedRef.current = true;
        lastUserIdRef.current = userId;
        setIsDataReady(true);
        setSyncStatus({ type: 'success', message: 'Ready (offline-first)' });
        updateMetadata();

        metadataInterval = setInterval(() => {
          if (active) updateMetadata();
        }, 30000);

        // STEP 3: Defer cloud Supabase two-way sync to post-paint idle time so Frame 1 & touch never block
        const runDeferredCloudSync = async () => {
          if (!active) return;
          try {
            await syncEngine.syncAll();
          } catch (syncErr) {
            console.warn('[SyncProvider] Background initial sync failed:', syncErr);
          }
        };

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => {
            void runDeferredCloudSync();
          }, { timeout: 1500 });
        } else {
          setTimeout(() => {
            void runDeferredCloudSync();
          }, 300);
        }

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
