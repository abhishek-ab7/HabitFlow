'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Task } from '@/lib/types';

interface AddSubtaskButtonProps {
    parentTask: Task;
    onAdd: (subtaskData: Partial<Task>) => void;
    disabled?: boolean;
}

export function AddSubtaskButton({ parentTask, onAdd, disabled }: AddSubtaskButtonProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [title, setTitle] = useState('');

    const currentDepth = parentTask.depth || 0;
    const maxDepthReached = currentDepth >= 3;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        onAdd({
            title: title.trim(),
            parentTaskId: parentTask.id,
            depth: currentDepth + 1,
            status: 'todo',
            priority: parentTask.priority, // Inherit priority
        });

        setTitle('');
        setIsAdding(false);
    };

    if (maxDepthReached) {
        return (
            <div className="text-xs text-gray-500 dark:text-gray-400 italic ml-6 mt-2">
                Maximum nesting depth reached (3 levels)
            </div>
        );
    }

    if (!isAdding) {
        return (
            <button
                onClick={() => setIsAdding(true)}
                disabled={disabled}
                className="
          ml-6 mt-2 flex items-center gap-2 px-3 py-1.5 
          text-sm text-gray-600 dark:text-gray-400
          hover:text-blue-600 dark:hover:text-blue-400
          hover:bg-blue-50 dark:hover:bg-blue-900/20
          rounded-lg transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
        "
            >
                <Plus className="w-4 h-4" />
                Add subtask
            </button>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="ml-6 mt-2 flex gap-2">
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Subtask title..."
                autoFocus
                className="
          flex-1 px-3 py-1.5 text-sm
          border border-gray-300 dark:border-gray-600
          rounded-lg
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-gray-100
          placeholder-gray-400 dark:placeholder-gray-500
          focus:ring-2 focus:ring-blue-500 focus:border-transparent
        "
            />
            <button
                type="submit"
                disabled={!title.trim()}
                className="
          px-3 py-1.5 text-sm font-medium
          bg-blue-600 hover:bg-blue-700
          text-white rounded-lg
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
        "
            >
                Add
            </button>
            <button
                type="button"
                onClick={() => {
                    setTitle('');
                    setIsAdding(false);
                }}
                className="
          px-3 py-1.5 text-sm font-medium
          bg-gray-200 hover:bg-gray-300
          dark:bg-gray-700 dark:hover:bg-gray-600
          text-gray-700 dark:text-gray-300
          rounded-lg transition-colors
        "
            >
                Cancel
            </button>
        </form>
    );
}
