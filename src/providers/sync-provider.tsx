'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  const { isAuthenticated } = useAuth();
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

  useEffect(() => {
    if (!isAuthenticated) {
      setSyncStatus({ type: 'idle', message: 'Offline mode' });
      return;
    }

    const syncEngine = getSyncEngine();
    
    // Subscribe to sync status changes
    const unsubscribe = syncEngine.onSyncStatusChange((status) => {
      setSyncStatus(status);
      setIsSyncing(status.type === 'syncing');
      updateMetadata();
    });

    // Initial sync
    syncEngine.syncAll();
    updateMetadata();

    // Update metadata every 30 seconds
    const metadataInterval = setInterval(updateMetadata, 30000);

    return () => {
      unsubscribe();
      clearInterval(metadataInterval);
    };
  }, [isAuthenticated, updateMetadata]);

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
