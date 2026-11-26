'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useShallow } from 'zustand/react/shallow';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useMoodStore } from '@/lib/stores/mood-store';
import { calculateMomentum, calculateTodayMomentumScore, getHabitWeekProgress, isHabitAutoRestOnDate } from '@/lib/calculations';
import { useUIStore } from '@/lib/stores/ui-store';
import { useAuth } from '@/providers/auth-provider';
import { useSync } from '@/providers/sync-provider';
import { useUserStore } from '@/lib/stores/user-store';
import type { Habit, HabitCompletion } from '@/lib/types';
import type { NextUpHabitItem } from './DashboardMomentumHero';
import type { WorkspaceLens } from './DashboardHeaderBar';
import { useDashboardInitEffects } from './useDashboardInit';
import { useDashboardFinanceAndFitness } from './useDashboardDomains';

function isHabitRestOrQuotaMet(params: {
  habit: Habit;
  hComps: HabitCompletion[];
  todayRec?: HabitCompletion;
  todayStr: string;
  quotaMet: boolean;
}): boolean {
  const { habit, hComps, todayRec, todayStr, quotaMet } = params;
  if (todayRec?.status === 'rest' || todayRec?.skipped === true) return true;
  if (isHabitAutoRestOnDate(habit, hComps, todayStr)) return true;
  return !todayRec?.completed && quotaMet;
}

function computeNextUpHabits(habits: Habit[], completions: HabitCompletion[]) {
  const todayDate = new Date();
  const todayStr = format(todayDate, 'yyyy-MM-dd');
  let restingCount = 0;
  const upNext: NextUpHabitItem[] = [];

  for (const habit of habits.filter((item) => !item.archived)) {
    const hComps = completions.filter((c) => c.habitId === habit.id);
    const todayRec = hComps.find((c) => c.date === todayStr);
    const wp = getHabitWeekProgress(habit, hComps, todayDate);

    if (isHabitRestOrQuotaMet({ habit, hComps, todayRec, todayStr, quotaMet: wp.quotaMet })) {
      restingCount++;
      continue;
    }
    if (!todayRec?.completed) {
      upNext.push({ id: habit.id, name: habit.name, weekDone: wp.completedCount, weekTarget: wp.targetCount, restRemaining: wp.restRemainingCount });
    }
  }
  return { nextUpHabits: upNext.slice(0, 3), restingOrQuotaMetCount: restingCount };
}

function computeModuleFlags(settings: ReturnType<typeof useGamificationStore.getState>['settings']) {
  const fullMode = !settings?.habitOnlyMode;
  return {
    isGoalsEnabled: fullMode && settings?.showGoals !== false,
    isFinanceEnabled: fullMode && settings?.showFinance !== false,
    isFitnessEnabled: fullMode && settings?.showFitness !== false,
    isTasksEnabled: fullMode && settings?.showTasks !== false,
  };
}

function useHabitAndGoalMetrics(params: {
  habits: Habit[];
  completions: HabitCompletion[];
  getMonthlyProgress: () => { completed: number; total: number; percentage: number };
  getCurrentStreaks: () => Map<string, number>;
  getFocusGoals: () => ReturnType<ReturnType<typeof useGoalStore.getState>['getFocusGoals']>;
  getActiveGoalsCount: () => number;
  getUpcomingDeadlines: (days: number) => ReturnType<ReturnType<typeof useGoalStore.getState>['getUpcomingDeadlines']>;
  tasks: ReturnType<typeof useTaskStore.getState>['tasks'];
  todayIsoStr: string;
  isTasksEnabled: boolean;
}) {
  const { habits, completions, getMonthlyProgress, getCurrentStreaks, getFocusGoals, getActiveGoalsCount, getUpcomingDeadlines, tasks, todayIsoStr, isTasksEnabled } = params;
  const monthlyProgress = useMemo(() => getMonthlyProgress(), [getMonthlyProgress]);
  const streaks = useMemo(() => getCurrentStreaks(), [getCurrentStreaks]);
  const focusGoals = useMemo(() => getFocusGoals(), [getFocusGoals]);
  const activeGoalsCount = useMemo(() => getActiveGoalsCount(), [getActiveGoalsCount]);
  const upcomingDeadlines = useMemo(() => getUpcomingDeadlines(7), [getUpcomingDeadlines]);

  const streakValues = Array.from(streaks.values());
  const currentMaxStreak = streakValues.length > 0 ? Math.max(...streakValues) : 0;
  const monthlyTrend = useMemo(() => calculateMomentum(completions), [completions]);
  const { nextUpHabits, restingOrQuotaMetCount } = useMemo(() => computeNextUpHabits(habits, completions), [habits, completions]);
  const todayScore = useMemo(
    () => calculateTodayMomentumScore({ habits, completions, tasks, todayStr: todayIsoStr, isTasksEnabled }),
    [habits, completions, tasks, todayIsoStr, isTasksEnabled]
  );

  return { focusGoals, activeGoalsCount, upcomingDeadlines, monthlyProgress, currentMaxStreak, monthlyTrend, nextUpHabits, restingOrQuotaMetCount, todayScore };
}

function useWorkspaceLensState(isFinanceEnabled: boolean, isFitnessEnabled: boolean) {
  const [workspaceLens, setWorkspaceLens] = useState<WorkspaceLens>('all');
  useEffect(() => {
    if (!isFinanceEnabled && workspaceLens === 'finance') setWorkspaceLens('all');
    if (!isFitnessEnabled && workspaceLens === 'fitness') setWorkspaceLens('all');
  }, [isFinanceEnabled, isFitnessEnabled, workspaceLens]);
  return { workspaceLens, setWorkspaceLens };
}

export function useDashboardViewModel() {
  const loadDashboardLayout = useUIStore((s) => s.loadDashboardLayout);
  const { user, isLoading: authLoading } = useAuth();
  const { isDataReady } = useSync();
  const { displayName } = useUserStore(useShallow((s) => ({ displayName: s.displayName })));

  const habitSlice = useHabitStore(useShallow((s) => ({
    habits: s.habits, completions: s.completions, loadCompletions: s.loadCompletions,
    initializeWithDemoData: s.initializeWithDemoData, getTodayProgress: s.getTodayProgress,
    getMonthlyProgress: s.getMonthlyProgress, getCurrentStreaks: s.getCurrentStreaks,
    toggle: s.toggle, markRestDay: s.markRestDay,
  })));
  const goalSlice = useGoalStore(useShallow((s) => ({
    goals: s.goals, loadAllMilestones: s.loadAllMilestones, getFocusGoals: s.getFocusGoals,
    getGoalStats: s.getGoalStats, getGoalMilestones: s.getGoalMilestones,
    getActiveGoalsCount: s.getActiveGoalsCount, getUpcomingDeadlines: s.getUpcomingDeadlines,
    toggleMilestoneComplete: s.toggleMilestoneComplete,
  })));
  const { settings, loadGamification } = useGamificationStore(useShallow((s) => ({ settings: s.settings, loadGamification: s.loadGamification })));
  const { tasks } = useTaskStore(useShallow((s) => ({ tasks: s.tasks })));
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const loadFitnessData = useFitnessStore((s) => s.loadFitnessData);
  const incrementFitnessWater = useFitnessStore((s) => s.incrementWater);
  const toggleLowEnergyMode = useFitnessStore((s) => s.toggleLowEnergyMode);
  const loadMoodLogs = useMoodStore((s) => s.loadMoodLogs);

  const flags = computeModuleFlags(settings);
  const { workspaceLens, setWorkspaceLens } = useWorkspaceLensState(flags.isFinanceEnabled, flags.isFitnessEnabled);
  const isEmpty = habitSlice.habits.length === 0 && (!flags.isGoalsEnabled || goalSlice.goals.length === 0);

  const initState = useDashboardInitEffects({
    userId: user?.id, authLoading, isDataReady, isFitnessEnabled: flags.isFitnessEnabled, isEmpty,
    habitCount: habitSlice.habits.length, goalCount: goalSlice.goals.length,
    loadDashboardLayout, loadAllMilestones: goalSlice.loadAllMilestones, loadCompletions: habitSlice.loadCompletions,
    loadGamification, loadFinanceData, loadFitnessData, loadMoodLogs,
  });

  const domainStats = useDashboardFinanceAndFitness({
    isFinanceEnabled: flags.isFinanceEnabled, isFitnessEnabled: flags.isFitnessEnabled,
    habitOnlyMode: settings?.habitOnlyMode, habits: habitSlice.habits, completions: habitSlice.completions,
  });

  const habitMetrics = useHabitAndGoalMetrics({
    habits: habitSlice.habits, completions: habitSlice.completions,
    getMonthlyProgress: habitSlice.getMonthlyProgress, getCurrentStreaks: habitSlice.getCurrentStreaks,
    getFocusGoals: goalSlice.getFocusGoals, getActiveGoalsCount: goalSlice.getActiveGoalsCount,
    getUpcomingDeadlines: goalSlice.getUpcomingDeadlines, tasks, todayIsoStr: domainStats.todayIsoStr,
    isTasksEnabled: flags.isTasksEnabled,
  });

  return {
    userId: user?.id, displayName, settings, ...initState, isEmpty: isEmpty && !initState.isInitializing,
    workspaceLens, setWorkspaceLens, ...flags, habitSlice, goalSlice, ...habitMetrics, ...domainStats,
    incrementFitnessWater, toggleLowEnergyMode,
  };
}
