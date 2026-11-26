'use client';

import React from 'react';
import { Task } from '@/lib/types';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface SubtaskListProps {
    tasks: Task[];
    parentId: string;
    allTasks: Task[];
    onToggle?: (taskId: string) => void;
    onEdit?: (task: Task) => void;
    onDelete?: (taskId: string) => void;
    expandedTasks?: Set<string>;
    onToggleExpand?: (taskId: string) => void;
}

const DEPTH_BG_CLASSES: Record<number, string> = {
    1: 'bg-gray-50 dark:bg-gray-800/50',
    2: 'bg-gray-100 dark:bg-gray-800',
    3: 'bg-gray-150 dark:bg-gray-750',
};

const PRIORITY_BADGE_CLASSES: Record<string, string> = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

function SubtaskActionButtons({
    subtask,
    onEdit,
    onDelete,
}: {
    subtask: Task;
    onEdit?: (task: Task) => void;
    onDelete?: (taskId: string) => void;
}) {
    return (
        <div className="flex gap-1">
            {onEdit && (
                <button
                    onClick={() => onEdit(subtask)}
                    className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                    aria-label="Edit"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
            )}
            {onDelete && (
                <button
                    onClick={() => onDelete(subtask.id)}
                    className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                    aria-label="Delete"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            )}
        </div>
    );
}

function SubtaskExpandToggle({
    hasChildren,
    isExpanded,
    onToggleExpand,
}: {
    hasChildren: boolean;
    isExpanded: boolean;
    onToggleExpand?: () => void;
}) {
    if (!hasChildren) return null;
    return (
        <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
    );
}

function SubtaskRow({
    subtask,
    tasks,
    allTasks,
    expandedTasks,
    onToggle,
    onEdit,
    onDelete,
    onToggleExpand,
}: {
    subtask: Task;
    tasks: Task[];
    allTasks: Task[];
    expandedTasks: Set<string>;
    onToggle?: (taskId: string) => void;
    onEdit?: (task: Task) => void;
    onDelete?: (taskId: string) => void;
    onToggleExpand?: (taskId: string) => void;
}) {
    const childCount = tasks.filter((t) => t.parentTaskId === subtask.id).length;
    const hasChildren = childCount > 0;
    const isExpanded = expandedTasks.has(subtask.id);
    const depthBg = DEPTH_BG_CLASSES[subtask.depth || 0] ?? '';

    return (
        <div className="relative">
            <div className={`flex items-center gap-2 p-3 rounded-lg ${depthBg} hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}>
                <SubtaskExpandToggle
                    hasChildren={hasChildren}
                    isExpanded={isExpanded}
                    onToggleExpand={() => onToggleExpand?.(subtask.id)}
                />

                <input
                    type="checkbox"
                    checked={subtask.status === 'done'}
                    onChange={() => onToggle?.(subtask.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />

                <span className={`flex-1 text-sm ${subtask.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                    {subtask.title}
                </span>

                {subtask.priority && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${PRIORITY_BADGE_CLASSES[subtask.priority] ?? ''}`}>
                        {subtask.priority}
                    </span>
                )}

                {hasChildren && (
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                        {childCount}
                    </span>
                )}

                <SubtaskActionButtons subtask={subtask} onEdit={onEdit} onDelete={onDelete} />
            </div>

            {hasChildren && isExpanded && (
                <SubtaskList
                    tasks={tasks}
                    parentId={subtask.id}
                    allTasks={allTasks}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    expandedTasks={expandedTasks}
                    onToggleExpand={onToggleExpand}
                />
            )}
        </div>
    );
}

export function SubtaskList({
    tasks,
    parentId,
    allTasks,
    onToggle,
    onEdit,
    onDelete,
    expandedTasks = new Set(),
    onToggleExpand,
}: SubtaskListProps) {
    const subtasks = tasks.filter((t) => t.parentTaskId === parentId);
    if (subtasks.length === 0) return null;

    return (
        <div className="ml-6 mt-2 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
            {subtasks.map((subtask) => (
                <SubtaskRow
                    key={subtask.id}
                    subtask={subtask}
                    tasks={tasks}
                    allTasks={allTasks}
                    expandedTasks={expandedTasks}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleExpand={onToggleExpand}
                />
            ))}
        </div>
    );
}
