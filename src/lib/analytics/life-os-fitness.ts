import { formatHumanDate } from '@/lib/date-format';
import {
  calculate7DayRollingWeight,
  calculateSupplementStockAndRoi,
  calculateWeeklyWaistTrend,
  getProgressiveOverloadHint,
} from '@/lib/fitness/shared-analytics';
import type { FitnessDailyLog, MealLog, ProgressiveOverloadHint, WorkoutSession } from '@/lib/types';
import {
  clampScore,
  shiftIsoDate,
  type AnalyticsRangeWindow,
  type FitnessAnalyticsSlice,
  type LifeOsAggregatorInput,
} from './life-os-types';

function aggregateMealsByDate(periodMeals: MealLog[]) {
  const mealsByDate = new Map<string, { calories: number; proteinG: number; junkCount: number }>();
  for (const meal of periodMeals) {
    const cur = mealsByDate.get(meal.date) ?? { calories: 0, proteinG: 0, junkCount: 0 };
    cur.calories += Number(meal.calories ?? 0);
    cur.proteinG += Number(meal.proteinG ?? 0);
    if (meal.isJunk) cur.junkCount += 1;
    mealsByDate.set(meal.date, cur);
  }
  return mealsByDate;
}

function computeJunkFreeStreakDays(allMealLogs: MealLog[], allDailyLogs: FitnessDailyLog[], todayDateStr: string): number {
  const junkDates = new Set(allMealLogs.filter((m) => m.isJunk).map((m) => m.date));
  const cleanDates = new Set([
    ...allMealLogs.filter((m) => !m.isJunk).map((m) => m.date),
    ...allDailyLogs.filter((l) => l.junkFreeOverride).map((l) => l.date),
  ]);
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = shiftIsoDate(todayDateStr, -i);
    if (junkDates.has(d)) break;
    if (cleanDates.has(d)) streak += 1;
    else if (i > 0) break;
  }
  return streak;
}

function sumExerciseVolume(ex: NonNullable<WorkoutSession['exercises']>[number]): number {
  let vol = 0;
  for (const s of ex.sets ?? []) {
    if (!s.isWarmup) vol += Number(s.weightKg ?? 0) * Number(s.reps ?? 0);
  }
  return vol;
}

function computeTotalWorkoutVolume(periodWorkouts: WorkoutSession[]): number {
  let volume = 0;
  for (const w of periodWorkouts) {
    for (const ex of w.exercises ?? []) {
      volume += sumExerciseVolume(ex);
    }
  }
  return Math.round(volume);
}

function computeWorkoutTypeBreakdown(periodWorkouts: WorkoutSession[]) {
  const map = new Map<string, { count: number; minutes: number }>();
  for (const w of periodWorkouts) {
    const t = w.workoutType ?? 'strength';
    const cur = map.get(t) ?? { count: 0, minutes: 0 };
    cur.count += 1;
    cur.minutes += Number(w.durationMinutes ?? 0);
    map.set(t, cur);
  }
  return Array.from(map.entries())
    .map(([type, stat]) => ({ type, count: stat.count, minutes: stat.minutes }))
    .sort((a, b) => b.count - a.count);
}

function collectTopOverloadHints(allWorkouts: WorkoutSession[], showFitness: boolean): ProgressiveOverloadHint[] {
  if (!showFitness) return [];
  const hints: ProgressiveOverloadHint[] = [];
  const seen = new Set<string>();
  const sorted = allWorkouts.slice().sort((a, b) => b.date.localeCompare(a.date));
  for (const w of sorted) {
    for (const ex of w.exercises ?? []) {
      const key = ex.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const hint = getProgressiveOverloadHint(allWorkouts, ex.name);
      if (hint) hints.push(hint);
      if (hints.length >= 4) return hints;
    }
  }
  return hints;
}

function avgNullableField(logs: FitnessDailyLog[], pick: (l: FitnessDailyLog) => number | null | undefined): number | null {
  const valid = logs.filter((l) => typeof pick(l) === 'number' && Number(pick(l)) > 0);
  if (valid.length === 0) return null;
  const total = valid.reduce((s, l) => s + Number(pick(l) ?? 0), 0);
  return Number((total / valid.length).toFixed(1));
}

function collectFitnessScoreComponents(params: {
  mealDatesCount: number;
  proteinAdherencePct: number;
  calorieAdherencePct: number;
  stepLogsCount: number;
  avgSteps: number;
  stepsTarget: number;
  workoutCount: number;
  dayCount: number;
}): number[] {
  const components: number[] = [];
  if (params.mealDatesCount > 0) components.push(params.proteinAdherencePct, params.calorieAdherencePct);
  if (params.stepLogsCount > 0 && params.stepsTarget > 0) {
    components.push(clampScore((params.avgSteps / params.stepsTarget) * 100));
  }
  if (params.workoutCount > 0) {
    const targetWorkouts = Math.max(1, Math.round((params.dayCount / 7) * 3));
    components.push(clampScore((params.workoutCount / targetWorkouts) * 100));
  }
  return components;
}

function computeFitnessScore(params: {
  hasData: boolean;
  mealDatesCount: number;
  proteinAdherencePct: number;
  calorieAdherencePct: number;
  stepLogsCount: number;
  avgSteps: number;
  stepsTarget: number;
  workoutCount: number;
  dayCount: number;
}): number {
  if (!params.hasData) return 0;
  const components = collectFitnessScoreComponents(params);
  if (components.length === 0) return 50;
  return clampScore(components.reduce((sum, v) => sum + v, 0) / components.length);
}

export function prepareFitnessEntities(input: LifeOsAggregatorInput) {
  return {
    profile: input.fitnessProfile ?? null,
    allDailyLogs: (input.dailyLogs ?? []).filter((l) => !l.deletedAt),
    allMealLogs: (input.mealLogs ?? []).filter((m) => !m.deletedAt),
    allWorkouts: (input.workoutSessions ?? []).filter((w) => !w.deletedAt),
    supplementInventory: (input.supplementInventory ?? []).filter((s) => !s.deletedAt),
    supplementLogs: (input.supplementLogs ?? []).filter((s) => !s.deletedAt),
  };
}

function buildDailyFuelSeries(
  window: AnalyticsRangeWindow,
  mealsByDate: Map<string, { calories: number; proteinG: number; junkCount: number }>,
  dailyLogByDate: Map<string, FitnessDailyLog>
): FitnessAnalyticsSlice['dailyFuelSeries'] {
  const series: FitnessAnalyticsSlice['dailyFuelSeries'] = [];
  for (let i = 0; i < window.dayCount; i++) {
    const d = shiftIsoDate(window.startDateStr, i);
    const meal = mealsByDate.get(d);
    const log = dailyLogByDate.get(d);
    series.push({
      date: d,
      label: formatHumanDate(d),
      calories: Math.round(meal?.calories ?? 0),
      proteinG: Math.round(meal?.proteinG ?? 0),
      steps: Math.round(log?.steps ?? 0),
      sleepHours: log?.sleepHours ?? null,
    });
  }
  return series;
}

function computeNutritionAdherence(periodMeals: MealLog[], calorieTarget: number, proteinTargetG: number) {
  const mealsByDate = aggregateMealsByDate(periodMeals);
  const mealDatesCount = mealsByDate.size;
  const mealTotals = Array.from(mealsByDate.values());
  const avgCalories = mealDatesCount > 0 ? Math.round(mealTotals.reduce((s, d) => s + d.calories, 0) / mealDatesCount) : 0;
  const avgProteinG = mealDatesCount > 0 ? Math.round(mealTotals.reduce((s, d) => s + d.proteinG, 0) / mealDatesCount) : 0;
  const calorieAdherencePct =
    mealDatesCount > 0 && calorieTarget > 0 ? clampScore(100 - (Math.abs(avgCalories - calorieTarget) / calorieTarget) * 100) : 0;
  const proteinAdherencePct = mealDatesCount > 0 && proteinTargetG > 0 ? clampScore((avgProteinG / proteinTargetG) * 100) : 0;
  return {
    mealsByDate,
    mealDatesCount,
    avgCalories,
    avgProteinG,
    calorieAdherencePct,
    proteinAdherencePct,
    junkMealCount: mealTotals.reduce((s, d) => s + d.junkCount, 0),
  };
}

function computeFitnessAnalyticsModules(
  entities: ReturnType<typeof prepareFitnessEntities>,
  window: AnalyticsRangeWindow,
  showFitness: boolean
) {
  if (!showFitness) {
    return {
      rollingWeight: { points: [], latestWeightKg: null, latestRollingAvgKg: null, weeklyDeltaKg: null },
      waistTrend: { points: [], latestWaistInches: null, startingWaistInches: null, totalDeltaInches: null },
      supplementRoi: { items: [], lowStockItems: [], totalMonthlySpendInr: 0, proteinBenchmarks: [] },
    };
  }
  return {
    rollingWeight: calculate7DayRollingWeight(entities.allDailyLogs, Math.max(14, window.dayCount)),
    waistTrend: calculateWeeklyWaistTrend(entities.allDailyLogs, 12),
    supplementRoi: calculateSupplementStockAndRoi(entities.supplementInventory, entities.supplementLogs, window.todayDateStr),
  };
}

function filterPeriodFitnessData(
  entities: ReturnType<typeof prepareFitnessEntities>,
  window: AnalyticsRangeWindow,
  showFitness: boolean
) {
  if (!showFitness) {
    return { periodDailyLogs: [], periodMeals: [], periodWorkouts: [] };
  }
  const inWindow = (d: string) => d >= window.startDateStr && d <= window.endDateStr;
  return {
    periodDailyLogs: entities.allDailyLogs.filter((l) => inWindow(l.date)),
    periodMeals: entities.allMealLogs.filter((m) => inWindow(m.date)),
    periodWorkouts: entities.allWorkouts.filter((w) => inWindow(w.date)),
  };
}

function computeStepSummary(periodDailyLogs: FitnessDailyLog[]) {
  const stepLogs = periodDailyLogs.filter((l) => l.steps > 0);
  const avgSteps = stepLogs.length > 0 ? Math.round(stepLogs.reduce((s, l) => s + l.steps, 0) / stepLogs.length) : 0;
  return { stepLogsCount: stepLogs.length, avgSteps };
}

export function computeFitnessAnalyticsSlice(
  entities: ReturnType<typeof prepareFitnessEntities>,
  window: AnalyticsRangeWindow,
  showFitness: boolean
): FitnessAnalyticsSlice {
  const { periodDailyLogs, periodMeals, periodWorkouts } = filterPeriodFitnessData(entities, window, showFitness);
  const mods = computeFitnessAnalyticsModules(entities, window, showFitness);
  const calorieTarget = entities.profile?.calorieTarget ?? 2000;
  const proteinTargetG = entities.profile?.proteinTargetG ?? 140;
  const stepsTarget = entities.profile?.stepsTarget ?? 8000;
  const sleepTargetHours = entities.profile?.sleepTargetHours ?? 7.5;

  const nut = computeNutritionAdherence(periodMeals, calorieTarget, proteinTargetG);
  const { stepLogsCount, avgSteps } = computeStepSummary(periodDailyLogs);
  const dailyLogByDate = new Map(periodDailyLogs.map((l) => [l.date, l]));

  const daysLogged = new Set([
    ...periodDailyLogs.map((l) => l.date),
    ...periodMeals.map((m) => m.date),
    ...periodWorkouts.map((w) => w.date),
  ]).size;
  const hasBodyLogs = entities.allDailyLogs.some((l) => typeof l.weightKg === 'number' || typeof l.waistInches === 'number');
  const hasData = showFitness && (daysLogged > 0 || hasBodyLogs);

  return {
    enabled: showFitness,
    hasData,
    score: computeFitnessScore({
      hasData,
      mealDatesCount: nut.mealDatesCount,
      proteinAdherencePct: nut.proteinAdherencePct,
      calorieAdherencePct: nut.calorieAdherencePct,
      stepLogsCount,
      avgSteps,
      stepsTarget,
      workoutCount: periodWorkouts.length,
      dayCount: window.dayCount,
    }),
    daysLogged,
    latestWeightKg: mods.rollingWeight.latestWeightKg,
    latestRollingAvgKg: mods.rollingWeight.latestRollingAvgKg,
    weeklyWeightDeltaKg: mods.rollingWeight.weeklyDeltaKg,
    latestWaistInches: mods.waistTrend.latestWaistInches,
    totalWaistDeltaInches: mods.waistTrend.totalDeltaInches,
    avgCalories: nut.avgCalories,
    calorieTarget,
    calorieAdherencePct: nut.calorieAdherencePct,
    avgProteinG: nut.avgProteinG,
    proteinTargetG,
    proteinAdherencePct: nut.proteinAdherencePct,
    avgSteps,
    stepsTarget,
    avgSleepHours: avgNullableField(periodDailyLogs, (l) => l.sleepHours),
    sleepTargetHours,
    workoutCount: periodWorkouts.length,
    totalWorkoutMinutes: periodWorkouts.reduce((s, w) => s + Number(w.durationMinutes ?? 0), 0),
    totalVolumeKg: computeTotalWorkoutVolume(periodWorkouts),
    junkMealCount: nut.junkMealCount,
    junkFreeStreakDays: computeJunkFreeStreakDays(entities.allMealLogs, entities.allDailyLogs, window.todayDateStr),
    avgEnergyLevel: avgNullableField(periodDailyLogs, (l) => l.energyLevel),
    workoutTypeBreakdown: computeWorkoutTypeBreakdown(periodWorkouts),
    overloadHints: collectTopOverloadHints(entities.allWorkouts, showFitness),
    rollingWeight: mods.rollingWeight,
    waistTrend: mods.waistTrend,
    dailyFuelSeries: buildDailyFuelSeries(window, nut.mealsByDate, dailyLogByDate),
    supplementRoi: mods.supplementRoi,
  };
}
