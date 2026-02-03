'use client';

import React from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { useSyncStatusStore } from '@/lib/stores/sync-status-store';
import { formatDistanceToNow } from 'date-fns';

export function SyncStatusBadge() {
    const { isSyncing, lastSyncTime, syncError, pendingChanges } = useSyncStatusStore();

    const getStatusIcon = () => {
        if (syncError) {
            return <AlertCircle className="w-4 h-4 text-red-500" />;
        }
        if (isSyncing) {
            return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
        }
        if (pendingChanges > 0) {
            return <CloudOff className="w-4 h-4 text-yellow-500" />;
        }
        return <Check className="w-4 h-4 text-green-500" />;
    };

    const getStatusText = () => {
        if (syncError) return 'Sync error';
        if (isSyncing) return 'Syncing...';
        if (pendingChanges > 0) return `${pendingChanges} pending`;
        if (lastSyncTime) {
            return `Synced ${formatDistanceToNow(lastSyncTime, { addSuffix: true })}`;
        }
        return 'Not synced';
    };

    const getStatusColor = () => {
        if (syncError) return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400';
        if (isSyncing) return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400';
        if (pendingChanges > 0) return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400';
        return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400';
    };

    return (
        <div
            className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
        ${getStatusColor()}
        transition-colors
      `}
            title={syncError || getStatusText()}
        >
            {getStatusIcon()}
            <span className="hidden sm:inline">{getStatusText()}</span>
        </div>
    );
}
