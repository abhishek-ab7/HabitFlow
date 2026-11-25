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
  markRestCompletion,
  clearRestCompletion,
  getAllCompletionsInRange,
  reorderHabits,
  seedDemoData,
  cleanupDuplicateCompletions,
  cleanupDuplicateHabits,
  updateCompletionNote,
  updateCompletionValue,
} from '../db';
import { getSupabaseClient } from '../supabase/client';
import type { Habit, HabitCompletion, HabitFormData, Category } from '../types';
import { calculateCurrentStreak, calculateHabitStats, getHabitWeekProgress, type HabitWeekProgress } from '../calculations';
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, parseISO, differenceInCalendarDays } from 'date-fns';
import { getSyncEngine } from '../sync';
import { useGamificationStore } from './gamification-store';

interface HabitState {
  habits: Habit[];
  completions: HabitCompletion[];
  isLoading: boolean;
  hasLoadedHabits: boolean;
  loadedHabitsUserId: string | null;
  error: string | null;
  selectedMonth: Date;
  categoryFilter: Category[];
  loadedRange: { start: string; end: string } | null;

  // Actions
  loadHabits: (force?: boolean) => Promise<void>;
  loadArchivedHabits: () => Promise<Habit[]>;
  loadCompletions: (startDate: string, endDate: string) => Promise<void>;
  loadAllCompletions: () => Promise<void>;
  addHabit: (data: HabitFormData) => Promise<Habit>;
  editHabit: (id: string, data: Partial<Habit>) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  toggle: (habitId: string, date: string) => Promise<void>;
  freezeHabit: (habitId: string, date: string) => Promise<void>;
  markRestDay: (habitId: string, date: string, reason?: string) => Promise<void>;
  clearRestDay: (habitId: string, date: string) => Promise<void>;
  updateNote: (habitId: string, date: string, note: string) => Promise<void>;
  updateValue: (habitId: string, date: string, value: number) => Promise<void>;
  ensureComplete: (habitId: string, date: string) => Promise<void>;
  batchComplete: (habitIds: string[], date: string) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<void>;
  setSelectedMonth: (date: Date) => void;
  setCategoryFilter: (categories: Category[]) => void;
  initializeWithDemoData: () => Promise<void>;

  getHabitCompletions: (habitId: string) => HabitCompletion[];

  // Computed
  getHabitStats: (habitId: string) => ReturnType<typeof calculateHabitStats> | null;
  getHabitWeekStatus: (habitId: string, referenceDate?: Date) => HabitWeekProgress | null;
  getCompletionForDate: (habitId: string, date: string) => HabitCompletion | undefined;
  getTodayProgress: () => {
    completed: number;
    total: number;
    percentage: number;
    restingCount?: number;
    quotaMetCount?: number;
  };
  getMonthlyProgress: () => { completed: number; total: number; percentage: number };
  getCurrentStreaks: () => Map<string, number>;
}

let cachedStreaks: Map<string, number> | null = null;
let lastHabitsRef: Habit[] | null = null;
let lastCompletionsRef: HabitCompletion[] | null = null;

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
  const diffDays = differenceInCalendarDays(new Date(), parseISO(date));
  if (diffDays < 0 || diffDays > 7) {
    throw new Error("You can only freeze missed days within the past 7 days.");
  }

  const dateObj = parseISO(date);
  const startStr = format(startOfWeek(dateObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const endStr = format(endOfWeek(dateObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const hasWeeklyFreeze = completions.some(
    c => c.status === 'frozen' && c.date >= startStr && c.date <= endStr
  );

  if (hasWeeklyFreeze) {
    const gamification = useGamificationStore.getState();
    const success = await gamification.useShield();
    if (!success) {
      throw new Error("NO_SHIELDS_LEFT");
    }
  }
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
  hasLoadedHabits: false,
  loadedHabitsUserId: null,
  error: null,
  selectedMonth: new Date(),
  categoryFilter: [],
  loadedRange: null,

  loadHabits: async (force = false) => {
    const state = get();
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;

      if (!uid) {
        set({ habits: [], isLoading: false, hasLoadedHabits: false, loadedHabitsUserId: null });
        return;
      }

      if (!force && state.hasLoadedHabits && state.loadedHabitsUserId === uid) {
        return;
      }

      if (!state.hasLoadedHabits) {
        set({ isLoading: true, error: null });
      }

      const habits = await getHabits(uid);
      set({ habits, isLoading: false, hasLoadedHabits: true, loadedHabitsUserId: uid });
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

  markRestDay: async (habitId: string, date: string, reason?: string) => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || 'local-user';

    const habit = get().habits.find(h => h.id === habitId);
    if (!habit) throw new Error("Habit not found");

    const existing = get().completions.find(c => c.habitId === habitId && c.date === date);
    const isCurrentlyRest = existing?.status === 'rest' || existing?.skipped === true;

    if (isCurrentlyRest) {
      const cleared = await clearRestCompletion(habitId, date, userId);
      await updateLocalAndSync(set, cleared);
      return;
    }

    const weekStatus = getHabitWeekProgress(habit, get().completions, parseISO(date));
    if (weekStatus.restAllowedCount <= 0 && !weekStatus.isAutoRestDay) {
      throw new Error("This is a 7-days/week daily habit with 0 free rest days. Edit the habit schedule or use a Streak Shield.");
    }
    if (weekStatus.restRemainingCount <= 0 && !weekStatus.isAutoRestDay && !weekStatus.quotaMet) {
      throw new Error(`You've used all ${weekStatus.restAllowedCount} rest day(s) for this week. Use a Streak Shield to protect your streak.`);
    }

    const result = await markRestCompletion(habitId, date, userId, reason);
    await updateLocalAndSync(set, result);
  },

  clearRestDay: async (habitId: string, date: string) => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || 'local-user';

    const result = await clearRestCompletion(habitId, date, userId);
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

    const result = await updateCompletionValue(habitId, date, value, session.user.id);

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
      await get().loadHabits(true);

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

  getHabitWeekStatus: (habitId: string, referenceDate: Date = new Date()) => {
    const { habits, completions } = get();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return null;
    return getHabitWeekProgress(habit, completions, referenceDate);
  },

  getCompletionForDate: (habitId: string, date: string) => {
    return get().completions.find(c => c.habitId === habitId && c.date === date);
  },

  getTodayProgress: () => {
    const { habits, completions } = get();
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const activeHabits = habits.filter(h => !h.archived);

    let completed = 0;
    let totalDueToday = 0;
    let restingCount = 0;
    let quotaMetCount = 0;

    for (const habit of activeHabits) {
      const todayComp = completions.find(c => c.habitId === habit.id && c.date === today);
      const isDoneToday = !!(todayComp && todayComp.completed && todayComp.status !== 'rest' && !todayComp.skipped);
      const isRestToday = !!(todayComp && (todayComp.status === 'rest' || todayComp.skipped));
      const weekProg = getHabitWeekProgress(habit, completions, now);

      if (isDoneToday) {
        completed++;
        totalDueToday++;
      } else if (isRestToday || weekProg.isAutoRestDay) {
        restingCount++;
      } else if (weekProg.quotaMet && (habit.targetDaysPerWeek ?? 7) < 7) {
        quotaMetCount++;
      } else {
        totalDueToday++;
      }
    }

    // If all habits today are resting / quota met and 0 due, show 100% if at least one active habit is resting/quota-met
    const percentage =
      totalDueToday > 0
        ? Math.round((completed / totalDueToday) * 100)
        : activeHabits.length > 0 && (restingCount > 0 || quotaMetCount > 0)
        ? 100
        : 0;

    return {
      completed,
      total: totalDueToday,
      percentage,
      restingCount,
      quotaMetCount,
    };
  },

  getMonthlyProgress: () => {
    const { habits, completions, selectedMonth } = get();
    const start = startOfMonth(selectedMonth);
    const end = new Date() < endOfMonth(selectedMonth) ? new Date() : endOfMonth(selectedMonth);

    const activeHabits = habits.filter(h => !h.archived);
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const total = activeHabits.reduce((sum, h) => {
      const targetPerWeek = h.targetDaysPerWeek || 7;
      return sum + Math.max(1, Math.round((days / 7) * targetPerWeek));
    }, 0);

    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const monthCompletions = completions.filter(
      c => c.date >= startStr && c.date <= endStr && c.completed && c.status !== 'rest' && !c.skipped
    );

    const completed = monthCompletions.length;
    const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

    return { completed, total, percentage };
  },

  getCurrentStreaks: () => {
    const { habits, completions } = get();
    
    if (isCacheValid(habits, completions)) {
      return cachedStreaks!;
    }

    // Group completions by habitId in a single O(C) pass
    const byHabit = new Map<string, typeof completions>();
    for (let i = 0; i < completions.length; i++) {
      const c = completions[i];
      let arr = byHabit.get(c.habitId);
      if (!arr) {
        arr = [];
        byHabit.set(c.habitId, arr);
      }
      arr.push(c);
    }

    const today = new Date();
    const streaks = new Map<string, number>();
    for (const habit of habits) {
      const habitComps = byHabit.get(habit.id) || [];
      streaks.set(habit.id, calculateCurrentStreak(habitComps, today, habit));
    }

    cachedStreaks = streaks;
    lastHabitsRef = habits;
    lastCompletionsRef = completions;
    return streaks;
  },

  getHabitCompletions: (habitId: string) => {
    return get().completions.filter(c => c.habitId === habitId);
  },
}));
