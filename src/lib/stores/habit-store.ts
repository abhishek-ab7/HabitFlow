import { create } from 'zustand';
import {
  db,
  getHabits,
  getArchivedHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  toggleCompletion,
  freezeCompletion,
  unfreezeCompletion,
  getAllCompletionsInRange,
  reorderHabits,
  seedDemoData,
  cleanupDuplicateCompletions,
  cleanupDuplicateHabits,
  getRoutinesForHabit,
  getRoutinesForHabits,
  linkHabitToRoutine,
  unlinkHabitFromRoutine,
  updateCompletionNote,
  updateCompletionValue,
} from '../db';
import { getSupabaseClient } from '../supabase/client';
import type { Habit, HabitCompletion, HabitFormData, Category, Routine } from '../types';
import { calculateHabitStats } from '../calculations';
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { getSyncEngine } from '../sync';
import { useGamificationStore, XP_PER_HABIT } from './gamification-store';

interface HabitState {
  habits: Habit[];
  completions: HabitCompletion[];
  isLoading: boolean;
  error: string | null;
  selectedMonth: Date;
  categoryFilter: Category[];
  loadedRange: { start: string; end: string } | null;

  // Actions
  loadHabits: () => Promise<void>;
  loadArchivedHabits: () => Promise<Habit[]>;
  loadCompletions: (startDate: string, endDate: string) => Promise<void>;
  loadAllCompletions: () => Promise<void>;
  addHabit: (data: HabitFormData) => Promise<Habit>;
  editHabit: (id: string, data: Partial<Habit>) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  toggle: (habitId: string, date: string) => Promise<void>;
  freezeHabit: (habitId: string, date: string) => Promise<void>;
  updateNote: (habitId: string, date: string, note: string) => Promise<void>;
  updateValue: (habitId: string, date: string, value: number) => Promise<void>;
  ensureComplete: (habitId: string, date: string) => Promise<void>;
  batchComplete: (habitIds: string[], date: string) => Promise<void>;
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

let cachedStreaks: Map<string, number> | null = null;
let lastHabitsRef: Habit[] | null = null;
let lastCompletionsRef: HabitCompletion[] | null = null;

function awardXpForCompletionDiff(
  habit: Habit | undefined,
  date: string,
  completed: boolean,
  wasCompleted: boolean
) {
  const today = new Date().toISOString().split('T')[0];
  if (date !== today) return;
  if (completed === wasCompleted) return;

  const difficulty = habit?.difficulty || 'medium';
  const base = difficulty === 'easy' ? 10 : difficulty === 'hard' ? 30 : 20;
  const xpAmount = completed ? base : -base;
  useGamificationStore.getState().addXp(xpAmount, habit?.category);
}

async function updateLocalAndSync(
  set: (fn: (state: HabitState) => Partial<HabitState> | HabitState) => void,
  result: HabitCompletion
) {
  set(state => ({
    completions: [
      ...state.completions.filter(c => !(c.habitId === result.habitId && c.date === result.date)),
      result
    ]
  }));
  try {
    const syncEngine = getSyncEngine();
    await syncEngine.pushCompletion(result);
  } catch (error) {
    console.error('Failed to sync completion:', error);
  }
}

async function handleWeeklyFreezeVerification(completions: HabitCompletion[], date: string) {
  const dateObj = parseISO(date);
  const startStr = format(startOfWeek(dateObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const endStr = format(endOfWeek(dateObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const hasWeeklyFreeze = completions.some(
    c => c.status === 'frozen' && c.date >= startStr && c.date <= endStr
  );

  if (hasWeeklyFreeze) {
    const success = await useGamificationStore.getState().useShield();
    if (!success) {
      throw new Error("No free weekly freezes or purchased streak shields left! Buy a shield in Settings.");
    }
  }
}

function awardXpForBatch(habits: Habit[], results: HabitCompletion[], date: string) {
  const today = new Date().toISOString().split('T')[0];
  if (date !== today) return;

  results.forEach(r => {
    const isNew = r.updatedAt === r.createdAt || 
      (new Date(r.updatedAt!).getTime() - new Date(r.createdAt!).getTime() < 1000);
    if (isNew) {
      const habit = habits.find(h => h.id === r.habitId);
      const difficulty = habit?.difficulty || 'medium';
      const xpAmount = difficulty === 'easy' ? 10 : difficulty === 'hard' ? 30 : 20;
      useGamificationStore.getState().addXp(xpAmount, habit?.category);
    }
  });
}

async function syncBatchCompletions(results: HabitCompletion[]) {
  try {
    const syncEngine = getSyncEngine();
    for (const result of results) {
      await syncEngine.pushCompletion(result);
    }
  } catch (error) {
    console.error('Failed to sync batch completions:', error);
  }
}

function isRangeAlreadyLoaded(
  loadedRange: { start: string; end: string } | null,
  start: string,
  end: string
): boolean {
  if (!loadedRange) return false;
  return start >= loadedRange.start && end <= loadedRange.end;
}

function calculateUnionRange(
  loadedRange: { start: string; end: string } | null,
  start: string,
  end: string
) {
  if (!loadedRange) {
    return { start, end };
  }
  return {
    start: start < loadedRange.start ? start : loadedRange.start,
    end: end > loadedRange.end ? end : loadedRange.end,
  };
}

function isCacheValid(
  habits: Habit[],
  completions: HabitCompletion[]
): boolean {
  return !!cachedStreaks && habits === lastHabitsRef && completions === lastCompletionsRef;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  completions: [],
  isLoading: false,
  error: null,
  selectedMonth: new Date(),
  categoryFilter: [],
  loadedRange: null,

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

  loadArchivedHabits: async () => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return [];
    try {
      return await getArchivedHabits(session.user.id);
    } catch (error) {
      console.error('Failed to load archived habits:', error);
      return [];
    }
  },

  loadCompletions: async (startDate: string, endDate: string) => {
    if (isRangeAlreadyLoaded(get().loadedRange, startDate, endDate)) {
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        set({ completions: [], loadedRange: null });
        return;
      }

      const completions = await getAllCompletionsInRange(startDate, endDate, session.user.id);
      
      const filteredExisting = get().completions.filter(
        c => c.date < startDate || c.date > endDate
      );
      
      const unionRange = calculateUnionRange(get().loadedRange, startDate, endDate);

      set({
        completions: [...filteredExisting, ...completions],
        loadedRange: unionRange
      });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadAllCompletions: async () => {
    try {
      const completions = await db.completions.toArray();
      set({ 
        completions,
        loadedRange: { start: '1970-01-01', end: '9999-12-31' }
      });
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
    const fullHabit = await db.habits.get(id);

    set(state => {
      let nextHabits = state.habits;
      if (data.archived === true) {
        nextHabits = state.habits.filter(h => h.id !== id);
      } else if (data.archived === false) {
        const exists = state.habits.some(h => h.id === id);
        if (!exists && fullHabit) {
          nextHabits = [...state.habits, fullHabit].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        } else {
          nextHabits = state.habits.map(h => h.id === id ? { ...h, ...data } : h);
        }
      } else {
        nextHabits = state.habits.map(h => h.id === id ? { ...h, ...data } : h);
      }
      return { habits: nextHabits };
    });

    // Sync to cloud
    if (fullHabit) {
      try {
        const syncEngine = getSyncEngine();
        await syncEngine.pushHabit(fullHabit);
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

    const habit = get().habits.find(h => h.id === habitId);
    awardXpForCompletionDiff(habit, date, result.completed, !result.completed);

    await updateLocalAndSync(set, result);
  },

  freezeHabit: async (habitId: string, date: string) => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("User not authenticated");

    const existing = get().completions.find(c => c.habitId === habitId && c.date === date);
    const isCurrentlyFrozen = existing?.status === 'frozen';

    if (isCurrentlyFrozen) {
      const result = await unfreezeCompletion(habitId, date, session.user.id);
      await updateLocalAndSync(set, result);
      return;
    }

    await handleWeeklyFreezeVerification(get().completions, date);

    const result = await freezeCompletion(habitId, date, session.user.id);
    await updateLocalAndSync(set, result);
  },

  updateNote: async (habitId: string, date: string, note: string) => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("User not authenticated");

    const result = await updateCompletionNote(habitId, date, note, session.user.id);
    await updateLocalAndSync(set, result);
  },

  updateValue: async (habitId: string, date: string, value: number) => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("User not authenticated");

    const prevComp = get().completions.find(c => c.habitId === habitId && c.date === date);
    const wasCompleted = prevComp?.completed && prevComp?.status !== 'frozen';

    const result = await updateCompletionValue(habitId, date, value, session.user.id);
    
    const habit = get().habits.find(h => h.id === habitId);
    awardXpForCompletionDiff(habit, date, result.completed, !!wasCompleted);

    await updateLocalAndSync(set, result);
  },

  ensureComplete: async (habitId: string, date: string) => {
    const { completions, toggle } = get();
    const isCompleted = completions.some(c => c.habitId === habitId && c.date === date && c.completed);

    if (!isCompleted) {
      await toggle(habitId, date);
    }
  },

  batchComplete: async (habitIds: string[], date: string) => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("User not authenticated");

    const { batchCompleteHabits } = await import('@/lib/db');
    const results = await batchCompleteHabits(habitIds, date, session.user.id);
    
    awardXpForBatch(get().habits, results, date);

    set(state => {
      const filtered = state.completions.filter(
        c => !(habitIds.includes(c.habitId) && c.date === date)
      );
      return { completions: [...filtered, ...results] };
    });

    await syncBatchCompletions(results);
  },

  reorder: async (orderedIds: string[]) => {
    await reorderHabits(orderedIds);
    set(state => {
      const reordered = orderedIds.map((id, index) => {
        const habit = state.habits.find(h => h.id === id);
        return habit ? { ...habit, order: index } : null;
      }).filter(Boolean) as Habit[];

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
    
    if (isCacheValid(habits, completions)) {
      return cachedStreaks!;
    }

    const streaks = new Map<string, number>();
    for (const habit of habits) {
      const stats = calculateHabitStats(habit, completions);
      streaks.set(habit.id, stats.currentStreak);
    }

    cachedStreaks = streaks;
    lastHabitsRef = habits;
    lastCompletionsRef = completions;
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
