'use client';

import React from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { useSyncStatusStore } from '@/lib/stores/sync-status-store';
import { formatDistanceToNow } from 'date-fns';

const RECENT_SYNC_UNIT_RE = /less than a minute|minute|second/;

function formatRelativeSyncText(lastSyncTime: Date): string {
    const distance = formatDistanceToNow(lastSyncTime);
    if (RECENT_SYNC_UNIT_RE.test(distance)) {
        return 'Just now';
    }
    return `${distance} ago`;
}

function resolveSyncBadgeState(params: {
    syncError: string | null;
    isSyncing: boolean;
    pendingChanges: number;
    mounted: boolean;
    lastSyncTime: Date | null;
}) {
    if (params.syncError) {
        return {
            icon: <AlertCircle className="w-4 h-4 text-red-500" />,
            text: 'Sync error',
            tooltip: `Sync error: ${params.syncError}`,
            colorClass: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
        };
    }
    if (params.isSyncing) {
        return {
            icon: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
            text: 'Syncing...',
            tooltip: 'Syncing your data with the cloud...',
            colorClass: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
        };
    }
    if (params.pendingChanges > 0) {
        return {
            icon: <CloudOff className="w-4 h-4 text-yellow-500" />,
            text: `${params.pendingChanges} pending`,
            tooltip: `${params.pendingChanges} local changes pending cloud sync`,
            colorClass: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
        };
    }
    const hasTime = params.mounted && params.lastSyncTime;
    return {
        icon: <Check className="w-4 h-4 text-green-500" />,
        text: hasTime ? formatRelativeSyncText(params.lastSyncTime!) : 'Just now',
        tooltip: hasTime
            ? `Successfully synced. Last sync: ${params.lastSyncTime!.toLocaleDateString()} at ${params.lastSyncTime!.toLocaleTimeString()}`
            : 'Synced',
        colorClass: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
    };
}

export function SyncStatusBadge() {
    const { isSyncing, lastSyncTime, syncError, pendingChanges } = useSyncStatusStore();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const badge = resolveSyncBadgeState({ syncError, isSyncing, pendingChanges, mounted, lastSyncTime });

    return (
        <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${badge.colorClass} transition-colors`}
            title={badge.tooltip}
        >
            {badge.icon}
            <span className="inline-block">{badge.text}</span>
        </div>
    );
}
