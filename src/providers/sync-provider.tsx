'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getSyncEngine, SyncStatus } from '@/lib/sync';
import { useAuth } from './auth-provider';

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

  // Update metadata periodically
  const updateMetadata = useCallback(() => {
    const syncEngine = getSyncEngine();
    const metadata = syncEngine.getSyncMetadata();
    setPendingChanges(metadata.pendingChanges);
    setLastSyncAt(metadata.lastSyncAt);
    setIsOnline(metadata.isOnline);
  }, []);

  // Background sync - syncs Supabase → IndexedDB silently.
  // Does NOT call store load functions or block rendering.
  // The dashboard handles its own store loading independently.
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      hasInitializedRef.current = false;
      lastUserIdRef.current = null;
      return;
    }

    if (hasInitializedRef.current && lastUserIdRef.current === userId) {
      return;
    }

    if (isInitializingRef.current) {
      return;
    }

    isInitializingRef.current = true;

    let active = true;
    let metadataInterval: NodeJS.Timeout | null = null;
    let unsubscribe: (() => void) | null = null;

    const backgroundSync = async () => {
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
        if (active) setSyncStatus({ type: 'syncing', message: 'Checking migrations...', progress: 10 });
        await syncEngine.checkAndRunMigrations();

        if (!active) return;

        // STEP 2: Sync from Supabase to IndexedDB (background only)
        if (active) setSyncStatus({ type: 'syncing', message: 'Syncing from cloud...', progress: 40 });
        await syncEngine.syncAll();

        if (!active) return;

        // NOTE: We intentionally do NOT call store load functions here.
        // Store loading (loadHabits, loadGoals, etc.) is handled by each
        // page component (e.g. DashboardContent) to avoid toggling
        // isLoading flags and causing UI blinks.

        hasInitializedRef.current = true;
        lastUserIdRef.current = userId;
        setSyncStatus({ type: 'success', message: 'Sync complete' });

        updateMetadata();

        metadataInterval = setInterval(() => {
          if (active) updateMetadata();
        }, 30000);

      } catch (error) {
        console.error('[SyncProvider] Background sync failed:', error);
        if (active) {
          setSyncStatus({ type: 'error', message: 'Sync failed' });
        }
      } finally {
        isInitializingRef.current = false;
      }
    };

    backgroundSync();

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

  // Always render children immediately — sync runs in background
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

