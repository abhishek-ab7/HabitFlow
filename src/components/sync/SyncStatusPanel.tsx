'use client';

import React from 'react';
import { useSyncStatusStore, SyncEntityStatus } from '@/lib/stores/sync-status-store';
import { Check, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useSync } from '@/providers/sync-provider';

export function SyncStatusPanel() {
    const { isSyncing, lastSyncTime, syncError, entityStatus, pendingChanges } = useSyncStatusStore();
    const { triggerSync } = useSync();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const getEntityIcon = (status: SyncEntityStatus) => {
        switch (status) {
            case 'synced':
                return <Check className="w-4 h-4 text-green-500" />;
            case 'syncing':
                return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'error':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'conflict':
                return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case 'pending':
                return <Clock className="w-4 h-4 text-gray-500" />;
        }
    };

    const getEntityLabel = (entity: string) => {
        const labels: Record<string, string> = {
            habits: 'Habits',
            goals: 'Goals',
            tasks: 'Tasks',
            completions: 'Habit Completions',
        };
        return labels[entity] || entity;
    };

    const getStatusBg = () => {
        if (syncError) return 'bg-destructive/15 text-destructive';
        if (isSyncing) return 'bg-info/15 text-info';
        if (pendingChanges > 0) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
        return 'bg-success/15 text-success';
    };

    const getStatusText = () => {
        if (syncError) return 'Sync Error';
        if (isSyncing) return 'Syncing...';
        if (pendingChanges > 0) return 'Changes Pending';
        return 'All Synced';
    };

    return (
        <div className="space-y-2 w-full">
            <div className="flex items-center justify-between gap-3 w-full">
                {/* Left: Status Visuals */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 shrink-0 rounded-xl ${getStatusBg()} flex items-center justify-center`}>
                        {isSyncing ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : syncError ? (
                            <AlertCircle className="w-4 h-4" />
                        ) : (
                            <Check className="w-4 h-4 stroke-[2.5]" />
                        )}
                    </div>
                    <div className="flex flex-col text-left min-w-0">
                        <h3 className="text-sm font-semibold text-foreground leading-tight truncate">{getStatusText()}</h3>
                        <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                            {mounted && lastSyncTime ? formatDistanceToNow(lastSyncTime, { addSuffix: true }) : 'Not synced'}
                        </p>
                    </div>
                </div>

                {/* Right: Action Button */}
                <button
                    type="button"
                    onClick={() => triggerSync()}
                    disabled={isSyncing}
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 h-9 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-semibold rounded-lg transition-colors text-xs whitespace-nowrap"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing' : 'Sync'}
                </button>
            </div>

            {syncError && (
                <p className="text-xs text-destructive leading-snug break-words">
                    {syncError}
                </p>
            )}
        </div>
    );
}
