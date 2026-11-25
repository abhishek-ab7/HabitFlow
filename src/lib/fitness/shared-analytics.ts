import type {
  DailyFuelSummary,
  FitnessDailyLog,
  FitnessGoalLink,
  FitnessProfile,
  MealLog,
  ProgressiveOverloadHint,
  ProteinFoodBenchmark,
  RollingWeightPoint,
  RollingWeightSummary,
  SupplementInventory,
  SupplementLog,
  SupplementRoiItem,
  SupplementStockAndRoiSummary,
  WaistTrendPoint,
  WeeklyWaistTrendSummary,
  WorkoutSession,
} from '@/lib/types';

function roundTo(val: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  const rounded = Math.round((Number(val) || 0) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function parseYmdToUtcMs(dateStr: string): number {
  const clean = (dateStr || '').slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return NaN;
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

function formatUtcMsToYmd(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMondayWeekKey(dateStr: string): string {
  const ms = parseYmdToUtcMs(dateStr);
  if (Number.isNaN(ms)) return dateStr.slice(0, 10);
  const d = new Date(ms);
  const dow = d.getUTCDay(); // 0 = Sun .. 6 = Sat
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  return formatUtcMsToYmd(ms + diffToMon * 86_400_000);
}

/**
 * Computes chronological daily weight points alongside a true calendar 7-day rolling average
 * (inclusive of [date - 6 days, date]). Ignores soft-deleted or non-positive weight entries.
 */
export function calculate7DayRollingWeight(
  dailyLogs: FitnessDailyLog[],
  maxPoints = 90
): RollingWeightSummary {
  const validLogs = dailyLogs
    .filter((l) => !l.deletedAt && typeof l.weightKg === 'number' && l.weightKg > 0 && l.date)
    .map((l) => ({
      date: l.date.slice(0, 10),
      weightKg: roundTo(Number(l.weightKg), 2),
      ms: parseYmdToUtcMs(l.date),
    }))
    .filter((l) => !Number.isNaN(l.ms))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (validLogs.length === 0) {
    return {
      points: [],
      latestWeightKg: null,
      latestRollingAvgKg: null,
      weeklyDeltaKg: null,
    };
  }

  // Deduplicate by date (keep latest in sort order if any)
  const byDate = new Map<string, { date: string; weightKg: number; ms: number }>();
  for (const item of validLogs) {
    byDate.set(item.date, item);
  }
  const sorted = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  const allPoints: RollingWeightPoint[] = sorted.map((curr, idx) => {
    const windowStartMs = curr.ms - 6 * 86_400_000;
    let sum = 0;
    let count = 0;
    for (let j = idx; j >= 0; j--) {
      const candidate = sorted[j];
      if (candidate.ms < windowStartMs) break;
      sum += candidate.weightKg;
      count++;
    }
    const rolling7DayAvg = count > 0 ? roundTo(sum / count, 2) : curr.weightKg;
    return {
      date: curr.date,
      weightKg: curr.weightKg,
      rolling7DayAvg,
    };
  });

  const points = maxPoints > 0 ? allPoints.slice(-maxPoints) : allPoints;
  const latest = points[points.length - 1];
  const latestMs = parseYmdToUtcMs(latest.date);
  const sevenDaysAgoCutoff = latestMs - 6 * 86_400_000;

  // Find nearest rolling avg point on or before 7 days ago for delta
  let priorPoint: RollingWeightPoint | null = null;
  for (let i = allPoints.length - 2; i >= 0; i--) {
    const pMs = parseYmdToUtcMs(allPoints[i].date);
    if (pMs <= sevenDaysAgoCutoff) {
      priorPoint = allPoints[i];
      break;
    }
  }

  const weeklyDeltaKg = priorPoint
    ? roundTo(latest.rolling7DayAvg - priorPoint.rolling7DayAvg, 2)
    : null;

  return {
    points,
    latestWeightKg: latest.weightKg,
    latestRollingAvgKg: latest.rolling7DayAvg,
    weeklyDeltaKg,
  };
}

/**
 * Aggregates waist circumference measurements into weekly points (Monday-anchored weeks),
 * preserving the latest measurement within each week and computing delta from start.
 */
export function calculateWeeklyWaistTrend(
  dailyLogs: FitnessDailyLog[],
  maxWeeks = 24
): WeeklyWaistTrendSummary {
  const validLogs = dailyLogs
    .filter((l) => !l.deletedAt && typeof l.waistInches === 'number' && l.waistInches > 0 && l.date)
    .map((l) => ({
      date: l.date.slice(0, 10),
      waistInches: roundTo(Number(l.waistInches), 2),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (validLogs.length === 0) {
    return {
      points: [],
      latestWaistInches: null,
      startingWaistInches: null,
      totalDeltaInches: null,
    };
  }

  const byWeek = new Map<string, { weekKey: string; date: string; waistInches: number }>();
  for (const item of validLogs) {
    const weekKey = getMondayWeekKey(item.date);
    byWeek.set(weekKey, {
      weekKey,
      date: item.date,
      waistInches: item.waistInches,
    });
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

  return {
    points,
    latestWaistInches: latest.waistInches,
    startingWaistInches,
    totalDeltaInches: latest.deltaFromStart,
  };
}

/**
 * Computes daily calorie/macro/hydration/NEAT/sleep summary for a target YYYY-MM-DD date.
 * Honors Low-Energy Mode (Minimum Viable Day) by adjusting effective steps & calorie targets
 * while keeping Protein and Zero-Junk accountability intact.
 */
export function calculateDailyFuelSummary(
  mealLogs: MealLog[],
  dailyLog: FitnessDailyLog | undefined,
  profile: FitnessProfile | null,
  dateStr: string
): DailyFuelSummary {
  const targetDate = (dateStr || '').slice(0, 10);
  const lowEnergyMode = Boolean(dailyLog?.lowEnergyMode);
  const baseCalorieTarget = Math.max(1, Number(profile?.calorieTarget || 2000));
  const baseStepsTarget = Math.max(1, Number(profile?.stepsTarget || 8000));

  const calorieTarget = lowEnergyMode
    ? Math.max(
        baseCalorieTarget,
        Number(profile?.lowEnergyCalorieCeiling ?? baseCalorieTarget + 250)
      )
    : baseCalorieTarget;

  const stepsTarget = lowEnergyMode
    ? Math.max(500, Math.min(baseStepsTarget, Number(profile?.lowEnergyStepsTarget ?? 3500)))
    : baseStepsTarget;

  const proteinTargetG = Math.max(1, Number(profile?.proteinTargetG || 130));
  const waterTargetMl = Math.max(1, Number(profile?.waterTargetMl || 3000));
  const sleepTargetHours = Math.max(1, Number(profile?.sleepTargetHours || 7.5));

  const dayMeals = mealLogs.filter(
    (m) => !m.deletedAt && (m.date || '').slice(0, 10) === targetDate
  );

  let caloriesConsumed = 0;
  let proteinConsumedG = 0;
  let carbsConsumedG = 0;
  let fatConsumedG = 0;
  let junkMealCount = 0;
  let junkCalories = 0;

  for (const meal of dayMeals) {
    const cals = Math.max(0, Number(meal.calories || 0));
    const pro = Math.max(0, Number(meal.proteinG || 0));
    const carbs = Math.max(0, Number(meal.carbsG || 0));
    const fat = Math.max(0, Number(meal.fatG || 0));

    caloriesConsumed += cals;
    proteinConsumedG += pro;
    carbsConsumedG += carbs;
    fatConsumedG += fat;

    if (meal.isJunk) {
      junkMealCount++;
      junkCalories += cals;
    }
  }

  const waterMl = Math.max(0, Number(dailyLog?.waterMl || 0));
  const steps = Math.max(0, Number(dailyLog?.steps || 0));
  const sleepHours =
    dailyLog?.sleepHours !== null && dailyLog?.sleepHours !== undefined
      ? Number(dailyLog.sleepHours)
      : null;
  const energyLevel =
    dailyLog?.energyLevel !== null && dailyLog?.energyLevel !== undefined
      ? Number(dailyLog.energyLevel)
      : null;

  caloriesConsumed = Math.round(caloriesConsumed);
  proteinConsumedG = roundTo(proteinConsumedG, 1);
  carbsConsumedG = roundTo(carbsConsumedG, 1);
  fatConsumedG = roundTo(fatConsumedG, 1);
  junkCalories = Math.round(junkCalories);

  return {
    date: targetDate,
    caloriesConsumed,
    calorieTarget,
    caloriesRemaining: calorieTarget - caloriesConsumed,
    caloriePct: Math.min(200, Math.round((caloriesConsumed / calorieTarget) * 100)),
    proteinConsumedG,
    proteinTargetG,
    proteinRemainingG: roundTo(Math.max(0, proteinTargetG - proteinConsumedG), 1),
    proteinPct: Math.min(200, Math.round((proteinConsumedG / proteinTargetG) * 100)),
    carbsConsumedG,
    fatConsumedG,
    waterMl,
    waterTargetMl,
    waterPct: Math.min(200, Math.round((waterMl / waterTargetMl) * 100)),
    steps,
    stepsTarget,
    stepsPct: Math.min(200, Math.round((steps / stepsTarget) * 100)),
    sleepHours,
    sleepTargetHours,
    energyLevel,
    junkMealCount,
    junkCalories,
    mealCount: dayMeals.length,
    lowEnergyMode,
    baseCalorieTarget,
    baseStepsTarget,
    junkFreeOverride: Boolean(dailyLog?.junkFreeOverride),
  };
}

/**
 * Finds the most recent workout session containing `exerciseName` and generates
 * a progressive overload target (+2.5kg if top working reps >= 10, else +1 rep).
 */
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
    const matchedExercise = (session.exercises || []).find(
      (ex) => ex.name.trim().toLowerCase() === target
    );
    if (!matchedExercise || !matchedExercise.sets || matchedExercise.sets.length === 0) {
      continue;
    }

    const workingSets = matchedExercise.sets.filter((st) => !st.isWarmup);
    const sets = workingSets.length > 0 ? workingSets : matchedExercise.sets;

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

    const allHighReps = sets.every((st) => Number(st.reps || 0) >= 10);
    const shouldIncreaseWeight = topWeightKg > 0 && (allHighReps || topReps >= 12);

    const recommendedWeightKg = shouldIncreaseWeight
      ? roundTo(topWeightKg + 2.5, 2)
      : topWeightKg;
    const recommendedReps = shouldIncreaseWeight
      ? Math.max(6, Math.min(8, topReps - 2))
      : topReps + 1;

    const suggestionText =
      topWeightKg > 0
        ? shouldIncreaseWeight
          ? `Last time: ${topWeightKg} kg × ${topReps} — aim for ${topReps + 1} reps or ${recommendedWeightKg} kg today`
          : `Last time: ${topWeightKg} kg × ${topReps} — aim for ${recommendedReps} reps today`
        : `Last time: ${topReps} reps — aim for ${recommendedReps} reps today`;

    return {
      exerciseName: matchedExercise.name,
      lastDate: session.date.slice(0, 10),
      lastTopWeightKg: topWeightKg,
      lastTopReps: topReps,
      lastSetsCount: sets.length,
      lastVolumeKg: roundTo(volume, 1),
      recommendedWeightKg,
      recommendedReps,
      suggestionText,
    };
  }

  return null;
}

export const INDIAN_PROTEIN_BENCHMARKS: ProteinFoodBenchmark[] = [
  {
    id: 'bench_boiled_eggs',
    name: 'Boiled Eggs',
    servingLabel: '4 whole eggs',
    proteinPerServingG: 24,
    costPerServingInr: 30,
    costPer25gProteinInr: 31.25,
    isSupplement: false,
  },
  {
    id: 'bench_chicken_breast',
    name: 'Chicken Breast',
    servingLabel: '100g raw',
    proteinPerServingG: 23,
    costPerServingInr: 32,
    costPer25gProteinInr: 34.78,
    isSupplement: false,
  },
  {
    id: 'bench_paneer',
    name: 'Paneer',
    servingLabel: '100g',
    proteinPerServingG: 18,
    costPerServingInr: 47.5,
    costPer25gProteinInr: 65.97,
    isSupplement: false,
  },
  {
    id: 'bench_dahi',
    name: 'Dahi',
    servingLabel: '400g bowl',
    proteinPerServingG: 14,
    costPerServingInr: 40,
    costPer25gProteinInr: 71.43,
    isSupplement: false,
  },
];

export function calculateCostPer25gProtein(
  costPerServingInr: number,
  proteinPerServingG: number | null | undefined
): number | null {
  const cost = Number(costPerServingInr || 0);
  const pro = Number(proteinPerServingG || 0);
  if (cost <= 0 || pro <= 0) return null;
  return roundTo((cost / pro) * 25, 2);
}

/**
 * Deterministically derives remaining servings from totalServings, active logs, and manualAdjustment:
 * Math.max(0, totalServings - sum(activeLogs.servingsTaken) + manualAdjustment)
 */
export function deriveSupplementRemainingServings(
  supplement: SupplementInventory,
  logs: SupplementLog[]
): number {
  const totalServings = Math.max(0, Number(supplement.totalServings || 0));
  const manualAdjustment = Number(supplement.manualAdjustment ?? 0);
  const takenSum = logs
    .filter((l) => !l.deletedAt && l.supplementId === supplement.id)
    .reduce((sum, l) => sum + Math.max(0, Number(l.servingsTaken || 0)), 0);

  return Math.max(0, roundTo(totalServings - takenSum + manualAdjustment, 2));
}

/**
 * Evaluates derived remaining servings, days of stock, low-stock alerts, cost/serving,
 * ₹/25g protein benchmark comparisons, monthly spend, and 30-day intake adherence ROI.
 */
export function calculateSupplementStockAndRoi(
  inventory: SupplementInventory[],
  logs: SupplementLog[],
  referenceDate?: string
): SupplementStockAndRoiSummary {
  const refMs = referenceDate ? parseYmdToUtcMs(referenceDate) : Date.now();
  const windowStartDate = formatUtcMsToYmd(
    (Number.isNaN(refMs) ? Date.now() : refMs) - 29 * 86_400_000
  );
  const windowEndDate = formatUtcMsToYmd(Number.isNaN(refMs) ? Date.now() : refMs);

  const activeInventory = inventory.filter((s) => !s.deletedAt && s.isActive);
  const activeLogs = logs.filter((l) => !l.deletedAt);

  const items: SupplementRoiItem[] = activeInventory.map((sup) => {
    const dailyDosage = Math.max(0, Number(sup.dailyDosage || 0));
    const derivedRemainingServings = deriveSupplementRemainingServings(sup, activeLogs);
    const total = Math.max(0, Number(sup.totalServings || 0));
    const cost = Math.max(0, Number(sup.costInr || 0));
    const threshold = Math.max(0, Number(sup.lowStockThresholdDays ?? 7));

    const daysRemaining =
      dailyDosage > 0 ? Math.floor(derivedRemainingServings / dailyDosage) : null;
    const isLowStock = daysRemaining !== null && daysRemaining <= threshold;
    const costPerServingInr = total > 0 && cost > 0 ? roundTo(cost / total, 2) : 0;
    const monthlyCostInr = roundTo(costPerServingInr * dailyDosage * 30, 0);

    const inferredProtein =
      sup.proteinPerServingG !== undefined && sup.proteinPerServingG !== null
        ? Number(sup.proteinPerServingG)
        : sup.category === 'protein'
          ? 24
          : null;
    const proteinPerServingG =
      inferredProtein !== null && inferredProtein > 0 ? roundTo(inferredProtein, 1) : null;
    const costPer25gProteinInr = calculateCostPer25gProtein(
      costPerServingInr,
      proteinPerServingG
    );

    const supLogsIn30d = activeLogs.filter(
      (l) =>
        l.supplementId === sup.id &&
        l.date.slice(0, 10) >= windowStartDate &&
        l.date.slice(0, 10) <= windowEndDate
    );

    const uniqueLoggedDays = new Set(supLogsIn30d.map((l) => l.date.slice(0, 10))).size;
    const adherence30dPct = Math.min(100, Math.round((uniqueLoggedDays / 30) * 100));

    let roiStatus: SupplementRoiItem['roiStatus'] = 'untracked';
    if (supLogsIn30d.length > 0 || cost > 0) {
      if (adherence30dPct >= 70) roiStatus = 'high';
      else if (adherence30dPct >= 35) roiStatus = 'moderate';
      else if (cost > 0) roiStatus = 'wasted';
    }

    return {
      supplement: {
        ...sup,
        remainingServings: derivedRemainingServings,
      },
      derivedRemainingServings,
      daysRemaining,
      isLowStock,
      costPerServingInr,
      proteinPerServingG,
      costPer25gProteinInr,
      monthlyCostInr,
      adherence30dPct,
      roiStatus,
    };
  });

  const lowStockItems = items.filter((item) => item.isLowStock);
  const totalMonthlySpendInr = roundTo(
    items.reduce((sum, item) => sum + item.monthlyCostInr, 0),
    0
  );

  const supplementProteinRows: ProteinFoodBenchmark[] = items
    .filter(
      (item) =>
        item.proteinPerServingG !== null &&
        item.proteinPerServingG > 0 &&
        item.costPer25gProteinInr !== null
    )
    .map((item) => ({
      id: item.supplement.id,
      name: item.supplement.name,
      servingLabel: `1 ${item.supplement.unitLabel}`,
      proteinPerServingG: item.proteinPerServingG!,
      costPerServingInr: item.costPerServingInr,
      costPer25gProteinInr: item.costPer25gProteinInr!,
      isSupplement: true,
    }));

  const proteinBenchmarks = [...supplementProteinRows, ...INDIAN_PROTEIN_BENCHMARKS].sort(
    (a, b) => a.costPer25gProteinInr - b.costPer25gProteinInr
  );

  return {
    items,
    lowStockItems,
    totalMonthlySpendInr,
    proteinBenchmarks,
  };
}

export interface FitnessGoalProgressSummary {
  type: FitnessGoalLink['type'];
  label: string;
  currentValue: number;
  startingValue: number;
  targetValue: number;
  unit: string;
  progressPct: number;
  remainingLabel: string;
}

export function calculateFitnessGoalProgress(
  link: FitnessGoalLink,
  params: {
    profile?: FitnessProfile | null;
    dailyLogs?: FitnessDailyLog[];
    workoutSessions?: WorkoutSession[];
    referenceDate?: string;
  }
): FitnessGoalProgressSummary {
  const refIso = (params.referenceDate || formatUtcMsToYmd(Date.now())).slice(0, 10);
  const dailyLogs = (params.dailyLogs || []).filter((l) => !l.deletedAt);
  const workouts = (params.workoutSessions || []).filter((w) => !w.deletedAt);
  const targetValue = Number(link.targetValue || 0);

  if (link.type === 'target_weight') {
    const rolling = calculate7DayRollingWeight(dailyLogs);
    const current =
      rolling.latestRollingAvgKg ??
      rolling.latestWeightKg ??
      params.profile?.currentWeightKg ??
      link.startingValue ??
      targetValue;
    const earliestWeight = rolling.points[0]?.weightKg;
    const starting =
      link.startingValue ??
      params.profile?.startingWeightKg ??
      earliestWeight ??
      current;

    let progressPct = 0;
    if (Math.abs(targetValue - starting) < 0.05) {
      progressPct = Math.abs(current - targetValue) < 0.25 ? 100 : 0;
    } else if (targetValue < starting) {
      progressPct = Math.min(
        100,
        Math.max(0, Math.round(((starting - current) / (starting - targetValue)) * 100))
      );
    } else {
      progressPct = Math.min(
        100,
        Math.max(0, Math.round(((current - starting) / (targetValue - starting)) * 100))
      );
    }

    const diff = roundTo(Math.abs(current - targetValue), 1);
    const unit = link.unit || 'kg';
    return {
      type: link.type,
      label: 'Target Weight',
      currentValue: roundTo(current, 1),
      startingValue: roundTo(starting, 1),
      targetValue: roundTo(targetValue, 1),
      unit,
      progressPct,
      remainingLabel: progressPct >= 100 ? 'Goal weight reached' : `${diff} ${unit} to go`,
    };
  }

  if (link.type === 'target_waist') {
    const waist = calculateWeeklyWaistTrend(dailyLogs);
    const current = waist.latestWaistInches ?? link.startingValue ?? targetValue;
    const starting = link.startingValue ?? waist.startingWaistInches ?? current;

    let progressPct = 0;
    if (Math.abs(targetValue - starting) < 0.05) {
      progressPct = Math.abs(current - targetValue) < 0.2 ? 100 : 0;
    } else if (targetValue < starting) {
      progressPct = Math.min(
        100,
        Math.max(0, Math.round(((starting - current) / (starting - targetValue)) * 100))
      );
    } else {
      progressPct = Math.min(
        100,
        Math.max(0, Math.round(((current - starting) / (targetValue - starting)) * 100))
      );
    }

    const diff = roundTo(Math.abs(current - targetValue), 1);
    const unit = link.unit || 'in';
    return {
      type: link.type,
      label: 'Target Waist',
      currentValue: roundTo(current, 1),
      startingValue: roundTo(starting, 1),
      targetValue: roundTo(targetValue, 1),
      unit,
      progressPct,
      remainingLabel: progressPct >= 100 ? 'Target waist hit' : `${diff} ${unit} to go`,
    };
  }

  if (link.type === 'daily_steps_avg') {
    const refMs = parseYmdToUtcMs(refIso);
    const start14 = formatUtcMsToYmd((Number.isNaN(refMs) ? Date.now() : refMs) - 13 * 86_400_000);
    const stepDays = dailyLogs.filter(
      (l) => l.date.slice(0, 10) >= start14 && l.date.slice(0, 10) <= refIso && l.steps > 0
    );
    const avgSteps =
      stepDays.length > 0
        ? Math.round(stepDays.reduce((s, l) => s + l.steps, 0) / stepDays.length)
        : 0;
    const progressPct =
      targetValue > 0 ? Math.min(100, Math.max(0, Math.round((avgSteps / targetValue) * 100))) : 0;
    const unit = link.unit || 'steps/day';
    return {
      type: link.type,
      label: 'Daily Steps Avg (14d)',
      currentValue: avgSteps,
      startingValue: link.startingValue ?? 0,
      targetValue,
      unit,
      progressPct,
      remainingLabel:
        progressPct >= 100
          ? 'Step average target met'
          : `${Math.max(0, targetValue - avgSteps).toLocaleString('en-IN')} ${unit} gap`,
    };
  }

  // monthly_workouts & legacy workout_consistency
  const currentMonthKey = refIso.slice(0, 7);
  const monthWorkouts = workouts.filter((w) => w.date.slice(0, 7) === currentMonthKey).length;
  const progressPct =
    targetValue > 0 ? Math.min(100, Math.max(0, Math.round((monthWorkouts / targetValue) * 100))) : 0;
  const unit = link.unit || 'workouts';
  return {
    type: link.type,
    label: 'Monthly Workouts',
    currentValue: monthWorkouts,
    startingValue: link.startingValue ?? 0,
    targetValue,
    unit,
    progressPct,
    remainingLabel:
      progressPct >= 100
        ? 'Monthly workout target reached'
        : `${Math.max(0, targetValue - monthWorkouts)} ${unit} remaining`,
  };
}
