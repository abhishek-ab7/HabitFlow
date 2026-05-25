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
    // Get subtasks for this parent
    const subtasks = tasks.filter(t => t.parentTaskId === parentId);

    if (subtasks.length === 0) return null;

    return (
        <div className="ml-6 mt-2 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
            {subtasks.map(subtask => {
                const hasChildren = tasks.some(t => t.parentTaskId === subtask.id);
                const isExpanded = expandedTasks.has(subtask.id);
                const depth = subtask.depth || 0;

                return (
                    <div key={subtask.id} className="relative">
                        {/* Subtask Item */}
                        <div
                            className={`
                flex items-center gap-2 p-3 rounded-lg
                ${depth === 1 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}
                ${depth === 2 ? 'bg-gray-100 dark:bg-gray-800' : ''}
                ${depth === 3 ? 'bg-gray-150 dark:bg-gray-750' : ''}
                hover:bg-gray-100 dark:hover:bg-gray-700
                transition-colors
              `}
                        >
                            {/* Expand/Collapse Button */}
                            {hasChildren && (
                                <button
                                    onClick={() => onToggleExpand?.(subtask.id)}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="w-4 h-4" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4" />
                                    )}
                                </button>
                            )}

                            {/* Checkbox */}
                            <input
                                type="checkbox"
                                checked={subtask.status === 'done'}
                                onChange={() => onToggle?.(subtask.id)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />

                            {/* Task Title */}
                            <span
                                className={`
                  flex-1 text-sm
                  ${subtask.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900 dark:text-gray-100'}
                `}
                            >
                                {subtask.title}
                            </span>

                            {/* Priority Badge */}
                            {subtask.priority && (
                                <span
                                    className={`
                    px-2 py-0.5 text-xs rounded-full
                    ${subtask.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : ''}
                    ${subtask.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : ''}
                    ${subtask.priority === 'low' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                  `}
                                >
                                    {subtask.priority}
                                </span>
                            )}

                            {/* Subtask Count Badge */}
                            {hasChildren && (
                                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                                    {tasks.filter(t => t.parentTaskId === subtask.id).length}
                                </span>
                            )}

                            {/* Actions */}
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
                        </div>

                        {/* Recursive Subtasks */}
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
            })}
        </div>
    );
}
