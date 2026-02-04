import { create } from 'zustand';
import {
  db,
  getHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  toggleCompletion,
  getAllCompletionsInRange,
  reorderHabits,
  seedDemoData,
  cleanupDuplicateCompletions,
  getRoutinesForHabit,
  getRoutinesForHabits,
  linkHabitToRoutine,
  unlinkHabitFromRoutine,
} from '../db';
import { getSupabaseClient } from '../supabase/client';
import type { Habit, HabitCompletion, HabitFormData, Category, Routine } from '../types';
import { calculateHabitStats } from '../calculations';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { getSyncEngine } from '../sync';
import { useGamificationStore, XP_PER_HABIT } from './gamification-store';

interface HabitState {
  habits: Habit[];
  completions: HabitCompletion[];
  isLoading: boolean;
  error: string | null;
  selectedMonth: Date;
  categoryFilter: Category[];

  // Actions
  loadHabits: () => Promise<void>;
  loadCompletions: (startDate: string, endDate: string) => Promise<void>;
  loadAllCompletions: () => Promise<void>;
  addHabit: (data: HabitFormData) => Promise<Habit>;
  editHabit: (id: string, data: Partial<Habit>) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  toggle: (habitId: string, date: string) => Promise<void>;
  ensureComplete: (habitId: string, date: string) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<void>;
  setSelectedMonth: (date: Date) => void;
  setCategoryFilter: (categories: Category[]) => void;
  initializeWithDemoData: () => Promise<void>;

  // Routine management
  getHabitRoutines: (habitId: string) => Promise<Routine[]>;
  getRoutinesForMultipleHabits: (habitIds: string[]) => Promise<Map<string, Routine[]>>;
  getHabitCompletions: (habitId: string) => HabitCompletion[];
  linkToRoutine: (habitId: string, routineId: string) => Promise<void>;
  unlinkFromRoutine: (habitId: string, routineId: string) => Promise<void>;

  // Computed
  getHabitStats: (habitId: string) => ReturnType<typeof calculateHabitStats> | null;
  getCompletionForDate: (habitId: string, date: string) => HabitCompletion | undefined;
  getTodayProgress: () => { completed: number; total: number; percentage: number };
  getMonthlyProgress: () => { completed: number; total: number; percentage: number };
  getCurrentStreaks: () => Map<string, number>;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  completions: [],
  isLoading: false,
  error: null,
  selectedMonth: new Date(),
  categoryFilter: [],

  loadHabits: async () => {
    set({ isLoading: true, error: null });
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        set({ habits: [], isLoading: false });
        return;
      }

      const habits = await getHabits(session.user.id);
      set({ habits, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadCompletions: async (startDate: string, endDate: string) => {
    try {
      // Clean up any duplicate completions first
      await cleanupDuplicateCompletions();

      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        set({ completions: [] });
        return;
      }

      const completions = await getAllCompletionsInRange(startDate, endDate, session.user.id);
      set({ completions });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadAllCompletions: async () => {
    try {
      const completions = await db.completions.toArray();
      set({ completions });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  addHabit: async (data: HabitFormData) => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("User not authenticated");

    const habit = await createHabit({ ...data, userId: session.user.id });
    set(state => ({ habits: [...state.habits, habit] }));

    // Sync to cloud
    try {
      const syncEngine = getSyncEngine();
      await syncEngine.pushHabit(habit);
    } catch (error) {
      console.error('Failed to sync habit:', error);
    }

    return habit;
  },

  editHabit: async (id: string, data: Partial<Habit>) => {
    await updateHabit(id, data);
    const updatedHabit = get().habits.find(h => h.id === id);

    set(state => ({
      habits: state.habits.map(h => h.id === id ? { ...h, ...data } : h),
    }));

    // Sync to cloud
    if (updatedHabit) {
      try {
        const syncEngine = getSyncEngine();
        await syncEngine.pushHabit({ ...updatedHabit, ...data });
      } catch (error) {
        console.error('Failed to sync habit:', error);
      }
    }
  },

  removeHabit: async (id: string) => {
    await deleteHabit(id);
    set(state => ({
      habits: state.habits.filter(h => h.id !== id),
      completions: state.completions.filter(c => c.habitId !== id),
    }));

    // Sync to cloud
    try {
      const syncEngine = getSyncEngine();
      await syncEngine.deleteHabit(id);
    } catch (error) {
      console.error('Failed to sync habit deletion:', error);
    }
  },

  toggle: async (habitId: string, date: string) => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("User not authenticated");

    const result = await toggleCompletion(habitId, date, session.user.id);

    // If completed is true, add XP
    if (result.completed) {
      const today = new Date().toISOString().split('T')[0];
      if (date === today) {
        useGamificationStore.getState().addXp(XP_PER_HABIT);
      }
    }

    set(state => {
      // Remove existing for this habit/date
      const filtered = state.completions.filter(
        c => !(c.habitId === habitId && c.date === date)
      );

      // Add updated result (whether true or false)
      // We keep 'false' completions in store so UI knows they exist (and synced)
      // Filters in UI should check c.completed
      return { completions: [...filtered, result] };
    });

    // Sync to cloud
    try {
      const syncEngine = getSyncEngine();
      // Always push the update (whether true or false)
      await syncEngine.pushCompletion(result);
    } catch (error) {
      console.error('Failed to sync completion:', error);
    }
  },

  ensureComplete: async (habitId: string, date: string) => {
    const { completions, toggle } = get();
    // Check if truly completed (exists AND completed=true)
    const isCompleted = completions.some(c => c.habitId === habitId && c.date === date && c.completed);

    if (!isCompleted) {
      await toggle(habitId, date);
    }
  },

  reorder: async (orderedIds: string[]) => {
    await reorderHabits(orderedIds);
    set(state => {
      const reordered = orderedIds.map((id, index) => {
        const habit = state.habits.find(h => h.id === id);
        return habit ? { ...habit, order: index } : null;
      }).filter(Boolean) as Habit[];

      // Sync all reordered habits to cloud
      try {
        const syncEngine = getSyncEngine();
        reordered.forEach(habit => syncEngine.pushHabit(habit));
      } catch (error) {
        console.error('Failed to sync habit reorder:', error);
      }

      return { habits: reordered };
    });
  },

  setSelectedMonth: (date: Date) => {
    set({ selectedMonth: date });
  },

  setCategoryFilter: (categories: Category[]) => {
    set({ categoryFilter: categories });
  },

  initializeWithDemoData: async () => {
    set({ isLoading: true });

    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user?.id) {
      await seedDemoData(session.user.id);
      await get().loadHabits();

      // Load completions for current and previous month
      const today = new Date();
      const start = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
      const end = format(endOfMonth(today), 'yyyy-MM-dd');
      await get().loadCompletions(start, end);
    }

    set({ isLoading: false });
  },

  getHabitStats: (habitId: string) => {
    const { habits, completions } = get();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return null;
    return calculateHabitStats(habit, completions);
  },

  getCompletionForDate: (habitId: string, date: string) => {
    return get().completions.find(c => c.habitId === habitId && c.date === date);
  },

  getTodayProgress: () => {
    const { habits, completions } = get();
    const today = format(new Date(), 'yyyy-MM-dd');
    const activeHabits = habits.filter(h => !h.archived);
    const todayCompletions = completions.filter(
      c => c.date === today && c.completed && activeHabits.some(h => h.id === c.habitId)
    );

    // Deduplicate by habitId - only count each habit once
    const uniqueHabitIds = new Set(todayCompletions.map(c => c.habitId));
    const completed = uniqueHabitIds.size;
    const total = activeHabits.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  },

  getMonthlyProgress: () => {
    const { habits, completions, selectedMonth } = get();
    const start = startOfMonth(selectedMonth);
    const end = new Date() < endOfMonth(selectedMonth) ? new Date() : endOfMonth(selectedMonth);

    const activeHabits = habits.filter(h => !h.archived);
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const total = activeHabits.length * days;

    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const monthCompletions = completions.filter(
      c => c.date >= startStr && c.date <= endStr && c.completed
    );

    const completed = monthCompletions.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  },

  getCurrentStreaks: () => {
    const { habits, completions } = get();
    const streaks = new Map<string, number>();

    for (const habit of habits) {
      const stats = calculateHabitStats(habit, completions);
      streaks.set(habit.id, stats.currentStreak);
    }

    return streaks;
  },

  getHabitRoutines: async (habitId: string) => {
    return getRoutinesForHabit(habitId);
  },

  getRoutinesForMultipleHabits: async (habitIds: string[]) => {
    return getRoutinesForHabits(habitIds);
  },

  getHabitCompletions: (habitId: string) => {
    return get().completions.filter(c => c.habitId === habitId);
  },

  linkToRoutine: async (habitId: string, routineId: string) => {
    await linkHabitToRoutine(habitId, routineId);
  },

  unlinkFromRoutine: async (habitId: string, routineId: string) => {
    await unlinkHabitFromRoutine(habitId, routineId);
  },
}));
