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

  // Offline-first Dexie hydration on mount (only in top-level orchestrator)
  useEffect(() => {
    if (!hydrate) return;
    const todayStr = getIstIsoDate();
    const startStr = shiftIsoDate(todayStr, -365);
    void loadHabits(false);
    void loadCompletions(startStr, todayStr);
    void loadGoals(false);
    void loadAllMilestones(false);
    void loadTasks(false);
    void loadMoodLogs(startStr, todayStr, false);
    if (showFinance) void financeSlice.loadFinanceData(user?.id, false);
    if (showFitness) void fitnessSlice.loadFitnessData(user?.id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrate, user?.id, showFinance, showFitness]);

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
        accounts: financeSlice.accounts,
        transactions: financeSlice.transactions,
        categories: financeSlice.categories,
        budgets: financeSlice.budgets,
        commitments: financeSlice.commitments,
        debtRecords: financeSlice.debtRecords,
        debtInstallments: financeSlice.debtInstallments,
        emiTrackers: financeSlice.emiTrackers,
        sipPlans: financeSlice.sipPlans,
        recurringBills: financeSlice.recurringBills,
        creditCardStatements: financeSlice.creditCardStatements,
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
