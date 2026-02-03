'use client';

import React from 'react';
import { useSyncStatusStore, SyncEntityStatus } from '@/lib/stores/sync-status-store';
import { Check, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useSync } from '@/providers/sync-provider';

export function SyncStatusPanel() {
    const { isSyncing, lastSyncTime, syncError, entityStatus, pendingChanges } = useSyncStatusStore();
    const { triggerSync } = useSync();

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
            routines: 'Routines',
            goals: 'Goals',
            tasks: 'Tasks',
            completions: 'Habit Completions',
            routineCompletions: 'Routine Completions',
        };
        return labels[entity] || entity;
    };

    const getStatusColor = () => {
        if (syncError) return 'bg-red-500 shadow-red-500/50';
        if (isSyncing) return 'bg-blue-500 shadow-blue-500/50 animate-pulse';
        if (pendingChanges > 0) return 'bg-amber-500 shadow-amber-500/50';
        return 'bg-emerald-500 shadow-emerald-500/50';
    };

    const getStatusText = () => {
        if (syncError) return 'Sync Error';
        if (isSyncing) return 'Syncing...';
        if (pendingChanges > 0) return 'Changes Pending';
        return 'All Synced';
    };

    return (
        <div className="flex items-center justify-between gap-4 h-full w-full px-2">
            {/* Left: Status Visuals */}
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 shrink-0 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.2)] ${getStatusColor()} transition-all duration-500 flex items-center justify-center ring-2 ring-white/10`}>
                    {isSyncing ? (
                        <RefreshCw className="w-5 h-5 text-white animate-spin" />
                    ) : syncError ? (
                        <AlertCircle className="w-5 h-5 text-white" />
                    ) : (
                        <Check className="w-5 h-5 text-white" />
                    )}
                </div>
                <div className="flex flex-col text-left">
                    <h3 className="text-sm font-bold dark:text-white text-gray-900 leading-none mb-1">{getStatusText()}</h3>
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap leading-none">
                        {lastSyncTime ? formatDistanceToNow(lastSyncTime, { addSuffix: true }) : 'Not synced'}
                    </p>
                </div>
            </div>

            {/* Error Message (Central/Hidden if small) */}
            {syncError && (
                <div className="hidden md:block text-red-500 text-[10px] text-center px-2">
                    {syncError}
                </div>
            )}

            {/* Right: Action Button */}
            <button
                onClick={() => triggerSync()}
                disabled={isSyncing}
                className="shrink-0 flex items-center justify-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-semibold rounded-lg shadow-md shadow-primary/20 transition-all text-xs border border-primary/20"
            >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
        </div>
    );
}
