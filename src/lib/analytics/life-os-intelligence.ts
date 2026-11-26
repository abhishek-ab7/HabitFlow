import { computeCrossDomainInsights, type CrossDomainAlert } from '@/lib/intelligence/cross-domain-insights';
import type { DailyStats, Habit, HabitCompletion, MoodLog } from '@/lib/types';
import type { prepareFinanceEntities } from './life-os-finance';
import type { prepareFitnessEntities } from './life-os-fitness';
import type { HabitSpendCorrelation } from './life-os-types';

const FITNESS_ONLY_ALERT_PILLARS = new Set(['wallet_waistline', 'gym_supplement_roi', 'social_spend_diet']);

function filterAlertsByModules(alerts: CrossDomainAlert[], showFinance: boolean, showFitness: boolean): CrossDomainAlert[] {
  if (!showFinance) return [];
  if (showFitness) return alerts;
  return alerts.filter((a) => !FITNESS_ONLY_ALERT_PILLARS.has(a.pillar));
}

function tallyHabitSpendDays(dailyStats: DailyStats[], cashflowByDateMap: Map<string, number>) {
  let highHabitDaysCount = 0;
  let lowHabitDaysCount = 0;
  let highHabitSpendSum = 0;
  let lowHabitSpendSum = 0;

  for (const day of dailyStats) {
    if (day.totalHabits <= 0) continue;
    const spend = cashflowByDateMap.get(day.date) ?? 0;
    if (day.completionRate >= 70) {
      highHabitDaysCount += 1;
      highHabitSpendSum += spend;
    } else {
      lowHabitDaysCount += 1;
      lowHabitSpendSum += spend;
    }
  }
  return { highHabitDaysCount, lowHabitDaysCount, highHabitSpendSum, lowHabitSpendSum };
}

function computeHabitSpendCorrelation(
  dailyStats: DailyStats[],
  dailyCashflow: Array<{ date: string; expense: number }>,
  showFinance: boolean
): HabitSpendCorrelation {
  const cashflowByDateMap = new Map(dailyCashflow.map((d) => [d.date, d.expense]));
  const tally = showFinance
    ? tallyHabitSpendDays(dailyStats, cashflowByDateMap)
    : { highHabitDaysCount: 0, lowHabitDaysCount: 0, highHabitSpendSum: 0, lowHabitSpendSum: 0 };

  const highHabitAvgSpendInr = tally.highHabitDaysCount > 0 ? Math.round(tally.highHabitSpendSum / tally.highHabitDaysCount) : 0;
  const lowHabitAvgSpendInr = tally.lowHabitDaysCount > 0 ? Math.round(tally.lowHabitSpendSum / tally.lowHabitDaysCount) : 0;
  const hasEnoughData = showFinance && tally.highHabitDaysCount >= 2 && tally.lowHabitDaysCount >= 2;
  return {
    hasEnoughData,
    highHabitDaysCount: tally.highHabitDaysCount,
    lowHabitDaysCount: tally.lowHabitDaysCount,
    highHabitAvgSpendInr,
    lowHabitAvgSpendInr,
    dailySavingsDeltaInr: hasEnoughData ? lowHabitAvgSpendInr - highHabitAvgSpendInr : 0,
  };
}

function buildFinanceInsightsSlice(fin: ReturnType<typeof prepareFinanceEntities> | null) {
  return {
    transactions: fin?.allTransactions ?? [],
    categories: fin?.categories ?? [],
    debtRecords: fin?.debtRecords ?? [],
  };
}

function buildFitnessInsightsSlice(fit: ReturnType<typeof prepareFitnessEntities> | null) {
  return {
    mealLogs: fit?.allMealLogs ?? [],
    workoutSessions: fit?.allWorkouts ?? [],
    fitnessDailyLogs: fit?.allDailyLogs ?? [],
    supplementInventory: fit?.supplementInventory ?? [],
    supplementLogs: fit?.supplementLogs ?? [],
  };
}

function buildInsightsInput(params: {
  todayDateStr: string;
  showFinance: boolean;
  showFitness: boolean;
  financeEntities: ReturnType<typeof prepareFinanceEntities>;
  fitnessEntities: ReturnType<typeof prepareFitnessEntities>;
  habits: Habit[];
  completions: HabitCompletion[];
  moodLogs: MoodLog[];
}) {
  return {
    todayDate: params.todayDateStr,
    ...buildFinanceInsightsSlice(params.showFinance ? params.financeEntities : null),
    ...buildFitnessInsightsSlice(params.showFitness ? params.fitnessEntities : null),
    habits: params.habits,
    habitCompletions: params.completions,
    moodLogs: params.moodLogs,
  };
}

export function computeLifeOsIntelligenceSlice(params: {
  todayDateStr: string;
  showFinance: boolean;
  showFitness: boolean;
  financeEntities: ReturnType<typeof prepareFinanceEntities>;
  fitnessEntities: ReturnType<typeof prepareFitnessEntities>;
  habits: Habit[];
  completions: HabitCompletion[];
  moodLogs: MoodLog[];
  dailyStats: DailyStats[];
  dailyCashflow: Array<{ date: string; expense: number }>;
}) {
  const report = computeCrossDomainInsights(buildInsightsInput(params));
  return {
    report,
    alerts: filterAlertsByModules(report.alerts, params.showFinance, params.showFitness),
    habitSpendCorrelation: computeHabitSpendCorrelation(params.dailyStats, params.dailyCashflow, params.showFinance),
  };
}
