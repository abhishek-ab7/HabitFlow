'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { calculateDailyFuelSummary } from '@/lib/fitness/shared-analytics';
import { useFeedback } from '@/hooks/use-feedback';
import {
  isHabitDoneOnDate,
  isHabitRestOnDate,
  isQuitOrZeroJunkHabit,
  type STARTER_QUIT_TRACKERS,
} from '@/lib/fitness/routine-quit-helpers';
import type { Habit } from '@/lib/types';

async function toggleHabitWithFallback(params: {
  habit: Habit;
  selectedDate: string;
  done: boolean;
  toggleHabit: ReturnType<typeof useHabitStore.getState>['toggle'];
}) {
  const { habit, selectedDate, done, toggleHabit } = params;
  try {
    await toggleHabit(habit.id, selectedDate);
  } catch {
    const { CrossDomainActionMediator } = await import('@/lib/stores/mediator');
    await CrossDomainActionMediator.dispatch({
      type: done ? 'HABIT_UNCOMPLETED' : 'HABIT_COMPLETED',
      payload: { habitId: habit.id, date: selectedDate, category: habit.category, difficulty: habit.difficulty },
    });
  }
}

async function createStarterQuitHabit(params: {
  starter: (typeof STARTER_QUIT_TRACKERS)[number];
  userId: string;
  addHabit: ReturnType<typeof useHabitStore.getState>['addHabit'];
}) {
  const { starter, userId, addHabit } = params;
  try {
    await addHabit(starter.payload);
    toast.success(`Added Quit Tracker: ${starter.label}`);
  } catch {
    const { createHabit } = await import('@/lib/db');
    const created = await createHabit({ ...starter.payload, userId });
    useHabitStore.setState((s) => ({ habits: [...s.habits, created] }));
    toast.success(`Added Quit Tracker: ${starter.label}`);
  }
}
function useRoutineDerivedData(selectedDate: string) {
  const habits = useHabitStore((s) => s.habits);
  const completions = useHabitStore((s) => s.completions);
  const getCurrentStreaks = useHabitStore((s) => s.getCurrentStreaks);
  const profile = useFitnessStore((s) => s.profile);
  const dailyLogs = useFitnessStore((s) => s.dailyLogs);
  const mealLogs = useFitnessStore((s) => s.mealLogs);
  const supplementInventory = useFitnessStore((s) => s.supplementInventory);
  const supplementLogs = useFitnessStore((s) => s.supplementLogs);

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const streaks = useMemo(() => getCurrentStreaks(), [habits, completions, getCurrentStreaks]);
  const todayLog = useMemo(() => dailyLogs.find((d) => d.date === selectedDate && !d.deletedAt), [dailyLogs, selectedDate]);
  const fuelSummary = useMemo(() => calculateDailyFuelSummary(mealLogs, todayLog, profile, selectedDate), [mealLogs, todayLog, profile, selectedDate]);
  const quitHabits = useMemo(() => activeHabits.filter(isQuitOrZeroJunkHabit), [activeHabits]);
  const unassignedHabits = useMemo(() => activeHabits.filter((h) => !h.anchorBlock && h.polarity !== 'quit'), [activeHabits]);
  const activeSupps = useMemo(() => supplementInventory.filter((s) => !s.deletedAt && s.isActive), [supplementInventory]);

  const isCompletedOnDate = (habitId: string) => isHabitDoneOnDate(completions, habitId, selectedDate);
  const isRestOnDate = (habitId: string) => isHabitRestOnDate(completions, habitId, selectedDate);
  const isSupplementTakenToday = (suppId: string) =>
    supplementLogs.some((l) => !l.deletedAt && l.supplementId === suppId && l.date.slice(0, 10) === selectedDate);

  return {
    activeHabits,
    streaks,
    todayLog,
    fuelSummary,
    quitHabits,
    unassignedHabits,
    activeSupps,
    isCompletedOnDate,
    isRestOnDate,
    isSupplementTakenToday,
  };
}

export function useRoutineQuitController(selectedDate: string, userId: string) {
  const addHabit = useHabitStore((s) => s.addHabit);
  const editHabit = useHabitStore((s) => s.editHabit);
  const toggleHabit = useHabitStore((s) => s.toggle);
  const takeSupplementDose = useFitnessStore((s) => s.takeSupplementDose);
  const incrementWater = useFitnessStore((s) => s.incrementWater);
  const startUrgeTimer = usePomodoroStore((s) => s.startUrgeTimer);
  const startPresetTimer = usePomodoroStore((s) => s.startPresetTimer);
  const feedback = useFeedback();

  const derived = useRoutineDerivedData(selectedDate);

  const handleToggleHabit = async (habit: Habit) => {
    const done = derived.isCompletedOnDate(habit.id);
    if (done) feedback.uncheck();
    else feedback.complete();
    await toggleHabitWithFallback({ habit, selectedDate, done, toggleHabit });
  };

  const handleCreateStarterQuit = async (starter: (typeof STARTER_QUIT_TRACKERS)[number]) => {
    if (derived.activeHabits.some((h) => h.name.trim().toLowerCase() === starter.payload.name.toLowerCase())) {
      toast.info(`${starter.label} is already tracked`);
      return;
    }
    await createStarterQuitHabit({ starter, userId, addHabit });
  };

  return {
    ...derived,
    handleToggleHabit,
    handleCreateStarterQuit,
    editHabit,
    takeSupplementDose,
    incrementWater,
    startUrgeTimer,
    startPresetTimer,
    feedback,
  };
}
