import { create } from 'zustand';
import { db, getHabitsForRoutine, linkHabitToRoutine, unlinkHabitFromRoutine } from '../db';
import { getSupabaseClient } from '../supabase/client';
import type { Routine, Habit } from '../types';
import { getSyncEngine } from '../sync';
import { v4 as uuidv4 } from 'uuid';

interface RoutineState {
    routines: Routine[];
    isLoading: boolean;
    error: string | null;

    // Actions
    loadRoutines: () => Promise<void>;
    addRoutine: (data: Partial<Routine>) => Promise<Routine>;
    updateRoutine: (id: string, data: Partial<Routine>) => Promise<void>;
    deleteRoutine: (id: string) => Promise<void>;
    reorderRoutines: (orderedIds: string[]) => Promise<void>;
    toggleActive: (id: string) => Promise<void>;
    
    // Junction table methods
    getRoutineHabits: (routineId: string) => Promise<Habit[]>;
    linkHabit: (habitId: string, routineId: string) => Promise<void>;
    unlinkHabit: (habitId: string, routineId: string) => Promise<void>;
}

export const useRoutineStore = create<RoutineState>((set, get) => ({
    routines: [],
    isLoading: false,
    error: null,

    loadRoutines: async () => {
        set({ isLoading: true, error: null });
        try {
            const supabase = getSupabaseClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.user?.id) {
                set({ routines: [], isLoading: false });
                return;
            }

            // Load from local DB
            const routines = await db.routines
                .where('userId')
                .equals(session.user.id)
                .sortBy('orderIndex');

            set({ routines, isLoading: false });
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    addRoutine: async (data: Partial<Routine>) => {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) throw new Error("User not authenticated");

        const newRoutine: Routine = {
            id: uuidv4(),
            userId: session.user.id,
            title: data.title || 'New Routine',
            description: data.description,
            triggerType: data.triggerType || 'manual',
            triggerValue: data.triggerValue,
            isActive: true,
            orderIndex: get().routines.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...data
        } as Routine;

        await db.routines.add(newRoutine);

        set(state => ({
            routines: [...state.routines, newRoutine]
        }));

        return newRoutine;
    },

    updateRoutine: async (id: string, data: Partial<Routine>) => {
        const updates = {
            ...data,
            updatedAt: new Date().toISOString()
        };

        await db.routines.update(id, updates);

        set(state => ({
            routines: state.routines.map(r => r.id === id ? { ...r, ...updates } : r)
        }));
    },

    deleteRoutine: async (id: string) => {
        await db.routines.delete(id);

        // Unlink all habits from this routine
        const links = await db.habitRoutines.where('routineId').equals(id).toArray();
        const linkIds = links.map(link => link.id);
        await db.habitRoutines.bulkDelete(linkIds);

        set(state => ({
            routines: state.routines.filter(r => r.id !== id)
        }));
    },

    reorderRoutines: async (orderedIds: string[]) => {
        // Optimistic update
        set(state => {
            const reordered = orderedIds.map((id, index) => {
                const routine = state.routines.find(r => r.id === id);
                return routine ? { ...routine, orderIndex: index } : null;
            }).filter(Boolean) as Routine[];
            return { routines: reordered };
        });

        // DB update
        for (let i = 0; i < orderedIds.length; i++) {
            await db.routines.update(orderedIds[i], { orderIndex: i });
        }
    },

    toggleActive: async (id: string) => {
        const routine = get().routines.find(r => r.id === id);
        if (routine) {
            await get().updateRoutine(id, { isActive: !routine.isActive });
        }
    },

    getRoutineHabits: async (routineId: string) => {
        return getHabitsForRoutine(routineId);
    },

    linkHabit: async (habitId: string, routineId: string) => {
        await linkHabitToRoutine(habitId, routineId);
    },

    unlinkHabit: async (habitId: string, routineId: string) => {
        await unlinkHabitFromRoutine(habitId, routineId);
    }
}));
