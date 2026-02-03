'use client';

import React from 'react';
import { useSyncStatusStore, SyncEntityStatus } from '@/lib/stores/sync-status-store';
import { Check, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function SyncStatusPanel() {
    const { isSyncing, lastSyncTime, syncError, entityStatus, pendingChanges } = useSyncStatusStore();

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

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Sync Status
            </h3>

            {/* Overall Status */}
            <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Overall Status
                    </span>
                    <span className={`
            text-sm font-semibold
            ${syncError ? 'text-red-600 dark:text-red-400' : ''}
            ${isSyncing ? 'text-blue-600 dark:text-blue-400' : ''}
            ${!syncError && !isSyncing ? 'text-green-600 dark:text-green-400' : ''}
          `}>
                        {syncError ? 'Error' : isSyncing ? 'Syncing...' : 'Synced'}
                    </span>
                </div>

                {lastSyncTime && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Last synced {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
                    </p>
                )}

                {pendingChanges > 0 && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        {pendingChanges} pending change{pendingChanges !== 1 ? 's' : ''}
                    </p>
                )}

                {syncError && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                        {syncError}
                    </p>
                )}
            </div>

            {/* Entity Status */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Data Entities
                </h4>
                {Object.entries(entityStatus).map(([entity, status]) => (
                    <div
                        key={entity}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50"
                    >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            {getEntityLabel(entity)}
                        </span>
                        <div className="flex items-center gap-2">
                            {getEntityIcon(status)}
                            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                {status}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Manual Sync Button */}
            <button
                onClick={() => {
                    // Trigger manual sync
                    if (typeof window !== 'undefined') {
                        window.location.reload(); // Simple approach - reload to trigger sync
                    }
                }}
                disabled={isSyncing}
                className="
          mt-6 w-full flex items-center justify-center gap-2 px-4 py-2
          bg-blue-600 hover:bg-blue-700
          disabled:bg-gray-400 disabled:cursor-not-allowed
          text-white font-medium rounded-lg
          transition-colors
        "
            >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
        </div>
    );
}
