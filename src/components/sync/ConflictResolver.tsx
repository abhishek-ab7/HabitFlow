'use client';

import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

interface ConflictResolutionProps {
    localData: any;
    remoteData: any;
    onResolve: (resolution: 'local' | 'remote') => void;
    entityName: string;
}

export function ConflictResolver({ localData, remoteData, onResolve, entityName }: ConflictResolutionProps) {
    return (
        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                    Sync Conflict: {entityName}
                </h3>
            </div>

            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                This item was modified on both this device and the server. Which version would you like to keep?
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Local Version */}
                <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        This Device (Local)
                    </div>
                    <div className="text-sm mb-3 font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                        {JSON.stringify(localData, null, 2)}
                    </div>
                    <button
                        onClick={() => onResolve('local')}
                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                    >
                        <Check className="w-4 h-4" /> Keep Local
                    </button>
                </div>

                {/* Remote Version */}
                <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Server (Remote)
                    </div>
                    <div className="text-sm mb-3 font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                        {JSON.stringify(remoteData, null, 2)}
                    </div>
                    <button
                        onClick={() => onResolve('remote')}
                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded text-sm transition-colors"
                    >
                        <X className="w-4 h-4" /> Keep Server
                    </button>
                </div>
            </div>
        </div>
    );
}
