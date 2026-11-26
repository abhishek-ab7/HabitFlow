import type {
  DailyFuelSummary,
  FitnessDailyLog,
  FitnessProfile,
  MealLog,
  ProgressiveOverloadHint,
  RollingWeightPoint,
  RollingWeightSummary,
  WaistTrendPoint,
  WeeklyWaistTrendSummary,
  WorkoutSession,
} from '@/lib/types';

type IsoDateStr = string;
type UtcTimestampMs = number;
type MetricValue = number;

export function roundTo(val: MetricValue, decimals = 2): MetricValue {
  const factor = Math.pow(10, decimals);
  const rounded = Math.round((Number(val) || 0) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function parseYmdToUtcMs(dateStr: IsoDateStr): UtcTimestampMs {
  const clean = (dateStr ?? '').slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return NaN;
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

export function formatUtcMsToYmd(ms: UtcTimestampMs): IsoDateStr {
  const d = new Date(ms);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

function getMondayWeekKey(dateStr: string): string {
  const ms = parseYmdToUtcMs(dateStr);
  if (Number.isNaN(ms)) return dateStr.slice(0, 10);
  const dow = new Date(ms).getUTCDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  return formatUtcMsToYmd(ms + diffToMon * 86_400_000);
}

function computeWindowRollingAvg(sorted: Array<{ date: string; weightKg: number; ms: number }>, idx: number): number {
  const curr = sorted[idx];
  const windowStartMs = curr.ms - 6 * 86_400_000;
  let sum = 0;
  let count = 0;
  for (let j = idx; j >= 0; j--) {
    if (sorted[j].ms < windowStartMs) break;
    sum += sorted[j].weightKg;
    count++;
  }
  return count > 0 ? roundTo(sum / count, 2) : curr.weightKg;
}

function findPriorPoint7DaysAgo(allPoints: RollingWeightPoint[], latestMs: number): RollingWeightPoint | null {
  const cutoff = latestMs - 6 * 86_400_000;
  for (let i = allPoints.length - 2; i >= 0; i--) {
    if (parseYmdToUtcMs(allPoints[i].date) <= cutoff) return allPoints[i];
  }
  return null;
}

function isPositiveNumber(val: unknown): val is number {
  return typeof val === 'number' && val > 0;
}

export function calculate7DayRollingWeight(dailyLogs: FitnessDailyLog[], maxPoints = 90): RollingWeightSummary {
  const validLogs = dailyLogs
    .filter((l) => !l.deletedAt && isPositiveNumber(l.weightKg) && Boolean(l.date))
    .map((l) => ({ date: l.date.slice(0, 10), weightKg: roundTo(Number(l.weightKg), 2), ms: parseYmdToUtcMs(l.date) }))
    .filter((l) => !Number.isNaN(l.ms))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (validLogs.length === 0) {
    return { points: [], latestWeightKg: null, latestRollingAvgKg: null, weeklyDeltaKg: null };
  }

  const byDate = new Map(validLogs.map((item) => [item.date, item]));
  const sorted = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  const allPoints: RollingWeightPoint[] = sorted.map((curr, idx) => ({
    date: curr.date,
    weightKg: curr.weightKg,
    rolling7DayAvg: computeWindowRollingAvg(sorted, idx),
  }));

  const points = maxPoints > 0 ? allPoints.slice(-maxPoints) : allPoints;
  const latest = points[points.length - 1];
  const priorPoint = findPriorPoint7DaysAgo(allPoints, parseYmdToUtcMs(latest.date));

  return {
    points,
    latestWeightKg: latest.weightKg,
    latestRollingAvgKg: latest.rolling7DayAvg,
    weeklyDeltaKg: priorPoint ? roundTo(latest.rolling7DayAvg - priorPoint.rolling7DayAvg, 2) : null,
  };
}

export function calculateWeeklyWaistTrend(dailyLogs: FitnessDailyLog[], maxWeeks = 24): WeeklyWaistTrendSummary {
  const validLogs = dailyLogs
    .filter((l) => !l.deletedAt && isPositiveNumber(l.waistInches) && Boolean(l.date))
    .map((l) => ({ date: l.date.slice(0, 10), waistInches: roundTo(Number(l.waistInches), 2) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (validLogs.length === 0) {
    return { points: [], latestWaistInches: null, startingWaistInches: null, totalDeltaInches: null };
  }

  const byWeek = new Map<string, { weekKey: string; date: string; waistInches: number }>();
  for (const item of validLogs) {
    const weekKey = getMondayWeekKey(item.date);
    byWeek.set(weekKey, { weekKey, date: item.date, waistInches: item.waistInches });
  }

  const allWeeks = Array.from(byWeek.values()).sort((a, b) => a.weekKey.localeCompare(b.weekKey));
  const startingWaistInches = allWeeks[0].waistInches;
  const allPoints: WaistTrendPoint[] = allWeeks.map((w) => ({
    weekKey: w.weekKey,
    date: w.date,
    waistInches: w.waistInches,
    deltaFromStart: roundTo(w.waistInches - startingWaistInches, 2),
  }));

  const points = maxWeeks > 0 ? allPoints.slice(-maxWeeks) : allPoints;
  const latest = points[points.length - 1];
  return { points, latestWaistInches: latest.waistInches, startingWaistInches, totalDeltaInches: latest.deltaFromStart };
}

function computeEffectiveCalorieTarget(baseCalorieTarget: MetricValue, profile: FitnessProfile | null, lowEnergyMode: boolean) {
  if (!lowEnergyMode) return baseCalorieTarget;
  return Math.max(baseCalorieTarget, Number(profile?.lowEnergyCalorieCeiling ?? baseCalorieTarget + 250));
}

function computeEffectiveStepsTarget(baseStepsTarget: MetricValue, profile: FitnessProfile | null, lowEnergyMode: boolean) {
  if (!lowEnergyMode) return baseStepsTarget;
  return Math.max(500, Math.min(baseStepsTarget, Number(profile?.lowEnergyStepsTarget ?? 3500)));
}

function resolveDailyFuelTargets(profile: FitnessProfile | null, lowEnergyMode: boolean) {
  const baseCalorieTarget = Math.max(1, Number(profile?.calorieTarget ?? 2000));
  const baseStepsTarget = Math.max(1, Number(profile?.stepsTarget ?? 8000));
  return {
    baseCalorieTarget,
    baseStepsTarget,
    calorieTarget: computeEffectiveCalorieTarget(baseCalorieTarget, profile, lowEnergyMode),
    stepsTarget: computeEffectiveStepsTarget(baseStepsTarget, profile, lowEnergyMode),
    proteinTargetG: Math.max(1, Number(profile?.proteinTargetG ?? 130)),
    waterTargetMl: Math.max(1, Number(profile?.waterTargetMl ?? 3000)),
    sleepTargetHours: Math.max(1, Number(profile?.sleepTargetHours ?? 7.5)),
  };
}

function aggregateDayMeals(dayMeals: MealLog[]) {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let junkMealCount = 0;
  let junkCalories = 0;

  for (const meal of dayMeals) {
    const cals = Math.max(0, Number(meal.calories || 0));
    calories += cals;
    protein += Math.max(0, Number(meal.proteinG || 0));
    carbs += Math.max(0, Number(meal.carbsG || 0));
    fat += Math.max(0, Number(meal.fatG || 0));
    if (meal.isJunk) {
      junkMealCount++;
      junkCalories += cals;
    }
  }
  return {
    caloriesConsumed: Math.round(calories),
    proteinConsumedG: roundTo(protein, 1),
    carbsConsumedG: roundTo(carbs, 1),
    fatConsumedG: roundTo(fat, 1),
    junkMealCount,
    junkCalories: Math.round(junkCalories),
  };
}

const cappedPct = (val: MetricValue, target: MetricValue): MetricValue => Math.min(200, Math.round((val / target) * 100));
const nullableNum = (val: MetricValue | null | undefined): MetricValue | null => (val !== null && val !== undefined ? Number(val) : null);

function buildFuelTelemetryMetrics(
  dailyLog: FitnessDailyLog | undefined,
  t: ReturnType<typeof resolveDailyFuelTargets>
) {
  const waterMl = Math.max(0, Number(dailyLog?.waterMl ?? 0));
  const steps = Math.max(0, Number(dailyLog?.steps ?? 0));
  return {
    waterMl,
    waterTargetMl: t.waterTargetMl,
    waterPct: cappedPct(waterMl, t.waterTargetMl),
    steps,
    stepsTarget: t.stepsTarget,
    stepsPct: cappedPct(steps, t.stepsTarget),
    sleepHours: nullableNum(dailyLog?.sleepHours),
    sleepTargetHours: t.sleepTargetHours,
    energyLevel: nullableNum(dailyLog?.energyLevel),
    junkFreeOverride: Boolean(dailyLog?.junkFreeOverride),
  };
}

export function calculateDailyFuelSummary(
  mealLogs: MealLog[],
  dailyLog: FitnessDailyLog | undefined,
  profile: FitnessProfile | null,
  dateStr: IsoDateStr
): DailyFuelSummary {
  const targetDate = (dateStr ?? '').slice(0, 10);
  const lowEnergyMode = Boolean(dailyLog?.lowEnergyMode);
  const t = resolveDailyFuelTargets(profile, lowEnergyMode);
  const dayMeals = mealLogs.filter((m) => !m.deletedAt && (m.date ?? '').slice(0, 10) === targetDate);
  const m = aggregateDayMeals(dayMeals);

  return {
    date: targetDate,
    caloriesConsumed: m.caloriesConsumed,
    calorieTarget: t.calorieTarget,
    caloriesRemaining: t.calorieTarget - m.caloriesConsumed,
    caloriePct: cappedPct(m.caloriesConsumed, t.calorieTarget),
    proteinConsumedG: m.proteinConsumedG,
    proteinTargetG: t.proteinTargetG,
    proteinRemainingG: roundTo(Math.max(0, t.proteinTargetG - m.proteinConsumedG), 1),
    proteinPct: cappedPct(m.proteinConsumedG, t.proteinTargetG),
    carbsConsumedG: m.carbsConsumedG,
    fatConsumedG: m.fatConsumedG,
    junkMealCount: m.junkMealCount,
    junkCalories: m.junkCalories,
    mealCount: dayMeals.length,
    lowEnergyMode,
    baseCalorieTarget: t.baseCalorieTarget,
    baseStepsTarget: t.baseStepsTarget,
    ...buildFuelTelemetryMetrics(dailyLog, t),
  };
}

function summarizeWorkingSets(sets: NonNullable<WorkoutSession['exercises']>[number]['sets']) {
  let topWeightKg = 0;
  let topReps = 0;
  let volume = 0;
  for (const st of sets) {
    const w = Math.max(0, Number(st.weightKg || 0));
    const r = Math.max(0, Number(st.reps || 0));
    volume += w * r;
    if (w > topWeightKg || (w === topWeightKg && r > topReps)) {
      topWeightKg = w;
      topReps = r;
    }
  }
  return { topWeightKg, topReps, volume };
}

function formatOverloadSuggestion(params: {
  topWeightKg: MetricValue;
  topReps: MetricValue;
  shouldIncrease: boolean;
  recWeight: MetricValue;
  recReps: MetricValue;
}): string {
  const { topWeightKg, topReps, shouldIncrease, recWeight, recReps } = params;
  if (topWeightKg <= 0) return `Last time: ${topReps} reps — aim for ${recReps} reps today`;
  if (shouldIncrease) return `Last time: ${topWeightKg} kg × ${topReps} — aim for ${topReps + 1} reps or ${recWeight} kg today`;
  return `Last time: ${topWeightKg} kg × ${topReps} — aim for ${recReps} reps today`;
}

function buildOverloadHintForExercise(
  matched: NonNullable<WorkoutSession['exercises']>[number],
  lastDate: IsoDateStr
): ProgressiveOverloadHint {
  const working = matched.sets.filter((st) => !st.isWarmup);
  const sets = working.length > 0 ? working : matched.sets;
  const { topWeightKg, topReps, volume } = summarizeWorkingSets(sets);
  const allHighReps = sets.every((st) => Number(st.reps ?? 0) >= 10);
  const shouldIncrease = topWeightKg > 0 && (allHighReps || topReps >= 12);
  const recommendedWeightKg = shouldIncrease ? roundTo(topWeightKg + 2.5, 2) : topWeightKg;
  const recommendedReps = shouldIncrease ? Math.max(6, Math.min(8, topReps - 2)) : topReps + 1;

  return {
    exerciseName: matched.name,
    lastDate,
    lastTopWeightKg: topWeightKg,
    lastTopReps: topReps,
    lastSetsCount: sets.length,
    lastVolumeKg: roundTo(volume, 1),
    recommendedWeightKg,
    recommendedReps,
    suggestionText: formatOverloadSuggestion({
      topWeightKg,
      topReps,
      shouldIncrease,
      recWeight: recommendedWeightKg,
      recReps: recommendedReps,
    }),
  };
}

export function getProgressiveOverloadHint(
  sessions: WorkoutSession[],
  exerciseName: string,
  currentSessionId?: string
): ProgressiveOverloadHint | null {
  const target = exerciseName.trim().toLowerCase();
  if (!target) return null;

  const sortedSessions = sessions
    .filter((s) => !s.deletedAt && s.id !== currentSessionId)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  for (const session of sortedSessions) {
    const matched = (session.exercises ?? []).find((ex) => ex.name.trim().toLowerCase() === target);
    if (matched?.sets?.length) return buildOverloadHintForExercise(matched, session.date.slice(0, 10));
  }
  return null;
}
