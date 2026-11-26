'use client';

import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  type AnalyticsRangeKey,
  computeLifeOsAnalytics,
  type LifeOsAnalyticsSnapshot,
  shiftIsoDate,
} from '@/lib/analytics/life-os-aggregator';
import { getIstIsoDate } from '@/lib/mcp/config';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useMoodStore } from '@/lib/stores/mood-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { isFinanceModuleEnabled, isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useAuth } from '@/providers/auth-provider';

function useLifeOsHydration(params: {
  hydrate: boolean;
  userId?: string;
  showFinance: boolean;
  showFitness: boolean;
  loadHabits: (force?: boolean) => Promise<void>;
  loadCompletions: (start: string, end: string) => Promise<void>;
  loadGoals: (force?: boolean) => Promise<void>;
  loadAllMilestones: (force?: boolean) => Promise<void>;
  loadTasks: (force?: boolean) => Promise<void>;
  loadMoodLogs: (start: string, end: string, force?: boolean) => Promise<void>;
  loadFinanceData: (userId?: string, force?: boolean) => Promise<void>;
  loadFitnessData: (userId?: string, force?: boolean) => Promise<void>;
}) {
  const { hydrate, userId, showFinance, showFitness } = params;
  useEffect(() => {
    if (!hydrate) return;
    const todayStr = getIstIsoDate();
    const startStr = shiftIsoDate(todayStr, -365);
    void params.loadHabits(false);
    void params.loadCompletions(startStr, todayStr);
    void params.loadGoals(false);
    void params.loadAllMilestones(false);
    void params.loadTasks(false);
    void params.loadMoodLogs(startStr, todayStr, false);
    if (showFinance) void params.loadFinanceData(userId, false);
    if (showFitness) void params.loadFitnessData(userId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrate, userId, showFinance, showFitness]);
}

export function useLifeOsAnalytics(
  range: AnalyticsRangeKey,
  options: { hydrate?: boolean } = {}
): {
  snapshot: LifeOsAnalyticsSnapshot;
  showFinance: boolean;
  showFitness: boolean;
} {
  const { hydrate = true } = options;
  const { user } = useAuth();
  const settings = useGamificationStore((s) => s.settings);
  const showFinance = isFinanceModuleEnabled(settings);
  const showFitness = isFitnessModuleEnabled(settings);

  const { habits, completions, loadHabits, loadCompletions } = useHabitStore(
    useShallow((s) => ({
      habits: s.habits,
      completions: s.completions,
      loadHabits: s.loadHabits,
      loadCompletions: s.loadCompletions,
    }))
  );
  const { goals, milestones, loadGoals, loadAllMilestones } = useGoalStore(
    useShallow((s) => ({
      goals: s.goals,
      milestones: s.milestones,
      loadGoals: s.loadGoals,
      loadAllMilestones: s.loadAllMilestones,
    }))
  );
  const { tasks, loadTasks } = useTaskStore(
    useShallow((s) => ({ tasks: s.tasks, loadTasks: s.loadTasks }))
  );
  const { moodLogs, loadMoodLogs } = useMoodStore(
    useShallow((s) => ({ moodLogs: s.moodLogs, loadMoodLogs: s.loadMoodLogs }))
  );
  const financeSlice = useFinanceStore(
    useShallow((s) => ({
      accounts: s.accounts,
      transactions: s.transactions,
      categories: s.categories,
      budgets: s.budgets,
      commitments: s.commitments,
      debtRecords: s.debtRecords,
      debtInstallments: s.debtInstallments,
      emiTrackers: s.emiTrackers,
      sipPlans: s.sipPlans,
      recurringBills: s.recurringBills,
      creditCardStatements: s.creditCardStatements,
      loadFinanceData: s.loadFinanceData,
    }))
  );
  const fitnessSlice = useFitnessStore(
    useShallow((s) => ({
      profile: s.profile,
      dailyLogs: s.dailyLogs,
      mealLogs: s.mealLogs,
      workoutSessions: s.workoutSessions,
      supplementInventory: s.supplementInventory,
      supplementLogs: s.supplementLogs,
      loadFitnessData: s.loadFitnessData,
    }))
  );

  useLifeOsHydration({
    hydrate,
    userId: user?.id,
    showFinance,
    showFitness,
    loadHabits,
    loadCompletions,
    loadGoals,
    loadAllMilestones,
    loadTasks,
    loadMoodLogs,
    loadFinanceData: financeSlice.loadFinanceData,
    loadFitnessData: fitnessSlice.loadFitnessData,
  });

  const snapshot = useMemo(
    () =>
      computeLifeOsAnalytics({
        range,
        settings,
        habits,
        completions,
        goals,
        milestones,
        tasks,
        moodLogs,
        ...financeSlice,
        fitnessProfile: fitnessSlice.profile,
        dailyLogs: fitnessSlice.dailyLogs,
        mealLogs: fitnessSlice.mealLogs,
        workoutSessions: fitnessSlice.workoutSessions,
        supplementInventory: fitnessSlice.supplementInventory,
        supplementLogs: fitnessSlice.supplementLogs,
      }),
    [range, settings, habits, completions, goals, milestones, tasks, moodLogs, financeSlice, fitnessSlice]
  );

  return { snapshot, showFinance, showFitness };
}
