import { create } from 'zustand';
import {
    getTasks,
    createTask,
    updateTask,
    deleteTask,
} from '../db';
import { getSupabaseClient } from '../supabase/client';
import type { Task, TaskFormData, TaskStatus } from '../types';
import { getSyncEngine } from '../sync';
import { useGamificationStore, XP_PER_TASK } from './gamification-store';

interface TaskState {
    tasks: Task[];
    isLoading: boolean;
    error: string | null;

    // Actions
    loadTasks: () => Promise<void>;
    addTask: (data: TaskFormData) => Promise<Task>;
    editTask: (id: string, data: Partial<Task>) => Promise<void>;
    removeTask: (id: string) => Promise<void>;
    toggleTaskComplete: (id: string) => Promise<void>;

    // Computed
    getActiveTasks: () => Task[];
    getCompletedTasks: () => Task[];
    getTasksByDate: (date: string) => Task[]; // date in YYYY-MM-DD
}

export const useTaskStore = create<TaskState>((set, get) => ({
    tasks: [],
    isLoading: false,
    error: null,

    loadTasks: async () => {
        set({ isLoading: true, error: null });
        try {
            const supabase = getSupabaseClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.user?.id) {
                set({ tasks: [], isLoading: false });
                return;
            }

            const tasks = await getTasks(session.user.id);
            set({ tasks, isLoading: false });
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    addTask: async (data: TaskFormData) => {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) throw new Error("User not authenticated");
        const userId = session.user.id;

        const task = await createTask({ ...data, userId });

        set(state => ({
            tasks: [task, ...state.tasks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        }));

        // Sync to cloud
        try {
            const syncEngine = getSyncEngine();
            await syncEngine.pushTask(task);
        } catch (error) {
            console.error('Failed to sync task:', error);
        }

        return task;
    },

    editTask: async (id: string, data: Partial<Task>) => {
        await updateTask(id, data);
        const updatedTask = get().tasks.find(t => t.id === id);

        set(state => ({
            tasks: state.tasks.map(t => t.id === id ? { ...t, ...data } : t),
        }));

        // Sync to cloud
        if (updatedTask) {
            try {
                const syncEngine = getSyncEngine();
                await syncEngine.pushTask({ ...updatedTask, ...data });
            } catch (error) {
                console.error('Failed to sync task:', error);
            }
        }
    },

    removeTask: async (id: string) => {
        await deleteTask(id);
        set(state => ({
            tasks: state.tasks.filter(t => t.id !== id),
        }));

        // Sync to cloud
        try {
            const syncEngine = getSyncEngine();
            await syncEngine.deleteTask(id);
        } catch (error) {
            console.error('Failed to sync task deletion:', error);
        }
    },

    toggleTaskComplete: async (id: string) => {
        const task = get().tasks.find(t => t.id === id);
        if (!task) return;

        const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';

        if (newStatus === 'done') {
            useGamificationStore.getState().addXp(XP_PER_TASK);
        }

        const updates = { status: newStatus };

        await updateTask(id, updates);

        set(state => ({
            tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t),
        }));

        // Sync to cloud
        try {
            const syncEngine = getSyncEngine();
            await syncEngine.pushTask({ ...task, ...updates });
        } catch (error) {
            console.error('Failed to sync task completion:', error);
        }
    },

    getActiveTasks: () => {
        return get().tasks.filter(t => t.status !== 'done' && t.status !== 'archived');
    },

    getCompletedTasks: () => {
        return get().tasks.filter(t => t.status === 'done');
    },

    getTasksByDate: (dateStr: string) => {
        // dateStr is YYYY-MM-DD
        // Compare with due_date (which might be ISO or YYYY-MM-DD)
        return get().tasks.filter(t => {
            if (!t.due_date) return false;
            return t.due_date.startsWith(dateStr);
        });
    }
}));
