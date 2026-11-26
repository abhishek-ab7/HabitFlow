import { isFinanceModuleEnabled, isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { computeFinanceAnalyticsSlice, prepareFinanceEntities } from './life-os-finance';
import { computeFitnessAnalyticsSlice, prepareFitnessEntities } from './life-os-fitness';
import { computeHabitsAnalyticsSlice } from './life-os-habits';
import { computeLifeOsIntelligenceSlice } from './life-os-intelligence';
import {
  ANALYTICS_RANGE_OPTIONS,
  clampScore,
  computeNormalizedPillarWeights,
  diffIsoDaysInclusive,
  getAnalyticsRangeWindow,
  parseIsoAsLocalNoon,
  shiftIsoDate,
  toAnalyticsRangeKey,
  toLegacyTimeRange,
  type AnalyticsRangeKey,
  type AnalyticsRangeWindow,
  type FinanceAnalyticsSlice,
  type FitnessAnalyticsSlice,
  type HabitsAnalyticsSlice,
  type HabitSpendCorrelation,
  type LifeOsAggregatorInput,
  type LifeOsAnalyticsSnapshot,
  type PillarWeightBreakdown,
} from './life-os-types';

export {
  ANALYTICS_RANGE_OPTIONS,
  computeNormalizedPillarWeights,
  diffIsoDaysInclusive,
  getAnalyticsRangeWindow,
  parseIsoAsLocalNoon,
  shiftIsoDate,
  toAnalyticsRangeKey,
  toLegacyTimeRange,
  type AnalyticsRangeKey,
  type AnalyticsRangeWindow,
  type FinanceAnalyticsSlice,
  type FitnessAnalyticsSlice,
  type HabitsAnalyticsSlice,
  type HabitSpendCorrelation,
  type LifeOsAggregatorInput,
  type LifeOsAnalyticsSnapshot,
  type PillarWeightBreakdown,
};

export function computeLifeOsAnalytics(input: LifeOsAggregatorInput): LifeOsAnalyticsSnapshot {
  const window = getAnalyticsRangeWindow(input.range, input.referenceDate ?? new Date());
  const habitOnlyMode = Boolean(input.settings?.habitOnlyMode);
  const showFinance = isFinanceModuleEnabled(input.settings);
  const showFitness = isFitnessModuleEnabled(input.settings);
  const weights = computeNormalizedPillarWeights(showFinance, showFitness);

  const habits = computeHabitsAnalyticsSlice(input, window);
  const financeEntities = prepareFinanceEntities(input);
  const finance = computeFinanceAnalyticsSlice(financeEntities, window, showFinance);
  const fitnessEntities = prepareFitnessEntities(input);
  const fitness = computeFitnessAnalyticsSlice(fitnessEntities, window, showFitness);

  const lifeOsScore = clampScore(
    (habits.score * weights.habitsPct + finance.score * weights.financePct + fitness.score * weights.fitnessPct) / 100
  );
  const previousLifeOsScore = clampScore(
    (habits.previousScore * weights.habitsPct + finance.score * weights.financePct + fitness.score * weights.fitnessPct) / 100
  );

  const intelligence = computeLifeOsIntelligenceSlice({
    todayDateStr: window.todayDateStr,
    showFinance,
    showFitness,
    financeEntities,
    fitnessEntities,
    habits: input.habits ?? [],
    completions: input.completions ?? [],
    moodLogs: input.moodLogs ?? [],
    dailyStats: habits.dailyStats,
    dailyCashflow: finance.dailyCashflow,
  });

  return {
    window,
    modules: { showHabits: true, showFinance, showFitness, habitOnlyMode },
    lifeOsScore,
    previousLifeOsScore,
    lifeOsScoreDelta: lifeOsScore - previousLifeOsScore,
    weights,
    habits,
    finance,
    fitness,
    intelligence,
  };
}
