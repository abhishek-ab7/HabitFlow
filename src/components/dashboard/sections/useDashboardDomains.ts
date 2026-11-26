'use client';

import { useMemo } from 'react';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useMoodStore } from '@/lib/stores/mood-store';
import { calculateDailyFuelSummary } from '@/lib/fitness/shared-analytics';
import { computeCrossDomainInsights } from '@/lib/intelligence/cross-domain-insights';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type { Habit, HabitCompletion } from '@/lib/types';

function useFinanceDomainMetrics(isFinanceEnabled: boolean) {
  const financeCategories = useFinanceStore((s) => s.categories);
  const financeTransactions = useFinanceStore((s) => s.transactions);
  const financeBudgets = useFinanceStore((s) => s.budgets);
  const financeDebtRecords = useFinanceStore((s) => s.debtRecords);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getNetWorthSummary = useFinanceStore((s) => s.getNetWorthSummary);
  const getDailySpendingPace = useFinanceStore((s) => s.getDailySpendingPace);
  const getSpendingAnomalies = useFinanceStore((s) => s.getSpendingAnomalies);
  const getUpcomingFinancialObligations = useFinanceStore((s) => s.getUpcomingFinancialObligations);

  const financeSummary = useMemo(
    () => getMonthlySummary(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getMonthlySummary, financeTransactions, financeCategories, financeBudgets]
  );
  const netWorthSummary = useMemo(
    () => getNetWorthSummary(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getNetWorthSummary, financeTransactions, financeCategories]
  );
  const dailyPacePoints = useMemo(
    () => getDailySpendingPace(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getDailySpendingPace, financeTransactions, financeBudgets]
  );
  const dueSoonObligations = useMemo(
    () => getUpcomingFinancialObligations(7),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getUpcomingFinancialObligations, financeTransactions]
  );
  const financeAnomalies = useMemo(
    () => (isFinanceEnabled ? getSpendingAnomalies().slice(0, 2) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isFinanceEnabled, getSpendingAnomalies, financeTransactions]
  );

  return {
    financeCategories, financeTransactions, financeDebtRecords,
    financeSummary, netWorthSummary, dailyPacePoints, dueSoonObligations, financeAnomalies,
  };
}

function selectFitnessItems<T>(isFitnessEnabled: boolean, items: T[]): T[] {
  return isFitnessEnabled ? items : [];
}

export function useDashboardFinanceAndFitness(params: {
  isFinanceEnabled: boolean;
  isFitnessEnabled: boolean;
  habitOnlyMode?: boolean;
  habits: Habit[];
  completions: HabitCompletion[];
}) {
  const { isFinanceEnabled, isFitnessEnabled, habitOnlyMode, habits, completions } = params;
  const fin = useFinanceDomainMetrics(isFinanceEnabled);

  const fitnessProfile = useFitnessStore((s) => s.profile);
  const fitnessDailyLogs = useFitnessStore((s) => s.dailyLogs);
  const fitnessMealLogs = useFitnessStore((s) => s.mealLogs);
  const fitnessWorkoutSessions = useFitnessStore((s) => s.workoutSessions);
  const fitnessSupplements = useFitnessStore((s) => s.supplementInventory);
  const fitnessSupplementLogs = useFitnessStore((s) => s.supplementLogs);
  const moodLogs = useMoodStore((s) => s.moodLogs);

  const todayIsoStr = getLocalIsoDate();
  const todayFitnessLog = useMemo(() => fitnessDailyLogs.find((d) => d.date === todayIsoStr && !d.deletedAt), [fitnessDailyLogs, todayIsoStr]);
  const todayFuelSummary = useMemo(
    () => calculateDailyFuelSummary(fitnessMealLogs, todayFitnessLog, fitnessProfile, todayIsoStr),
    [fitnessMealLogs, todayFitnessLog, fitnessProfile, todayIsoStr]
  );

  const crossDomainReport = useMemo(() => {
    const canCompute = !habitOnlyMode && (isFinanceEnabled || isFitnessEnabled);
    if (!canCompute) return null;
    const scopedHabits = isFitnessEnabled ? habits : habits.filter((h) => h.polarity !== 'quit' && h.category !== 'health');
    return computeCrossDomainInsights({
      todayDate: todayIsoStr,
      transactions: fin.financeTransactions,
      categories: fin.financeCategories,
      debtRecords: fin.financeDebtRecords,
      mealLogs: selectFitnessItems(isFitnessEnabled, fitnessMealLogs),
      workoutSessions: selectFitnessItems(isFitnessEnabled, fitnessWorkoutSessions),
      fitnessDailyLogs: selectFitnessItems(isFitnessEnabled, fitnessDailyLogs),
      supplementInventory: selectFitnessItems(isFitnessEnabled, fitnessSupplements),
      supplementLogs: selectFitnessItems(isFitnessEnabled, fitnessSupplementLogs),
      habits: scopedHabits,
      habitCompletions: completions,
      moodLogs,
    });
  }, [
    habitOnlyMode, isFinanceEnabled, isFitnessEnabled, todayIsoStr, fin.financeTransactions,
    fin.financeCategories, fin.financeDebtRecords, fitnessMealLogs, fitnessWorkoutSessions,
    fitnessDailyLogs, fitnessSupplements, fitnessSupplementLogs, habits, completions, moodLogs,
  ]);

  return {
    todayIsoStr, todayFuelSummary,
    financeSummary: fin.financeSummary,
    netWorthSummary: fin.netWorthSummary,
    dailyPacePoints: fin.dailyPacePoints,
    dueSoonObligations: fin.dueSoonObligations,
    financeAnomalies: fin.financeAnomalies,
    crossDomainReport,
  };
}
