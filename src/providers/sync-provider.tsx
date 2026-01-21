'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getSyncEngine, SyncStatus } from '@/lib/sync';
import { useAuth } from './auth-provider';

interface SyncContextType {
  syncStatus: SyncStatus;
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ type: 'idle' });
  const [isSyncing, setIsSyncing] = useState(false);

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
    });

    // Initial sync
    syncEngine.syncAll();

    return unsubscribe;
  }, [isAuthenticated]);

  const triggerSync = async () => {
    if (!isAuthenticated) return;
    const syncEngine = getSyncEngine();
    await syncEngine.syncAll();
  };

  return (
    <SyncContext.Provider value={{ syncStatus, isSyncing, triggerSync }}>
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
