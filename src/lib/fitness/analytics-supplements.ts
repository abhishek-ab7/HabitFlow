import type {
  FitnessDailyLog,
  FitnessGoalLink,
  FitnessProfile,
  ProteinFoodBenchmark,
  SupplementInventory,
  SupplementLog,
  SupplementRoiItem,
  SupplementStockAndRoiSummary,
  WorkoutSession,
} from '@/lib/types';
import {
  calculate7DayRollingWeight,
  calculateWeeklyWaistTrend,
  formatUtcMsToYmd,
  parseYmdToUtcMs,
  roundTo,
} from './analytics-body';

type InrAmount = number;
type ProteinGrams = number;
type IsoDateStr = string;
type Percentage = number;

export const INDIAN_PROTEIN_BENCHMARKS: ProteinFoodBenchmark[] = [
  { id: 'bench_boiled_eggs', name: 'Boiled Eggs', servingLabel: '4 whole eggs', proteinPerServingG: 24, costPerServingInr: 30, costPer25gProteinInr: 31.25, isSupplement: false },
  { id: 'bench_chicken_breast', name: 'Chicken Breast', servingLabel: '100g raw', proteinPerServingG: 23, costPerServingInr: 32, costPer25gProteinInr: 34.78, isSupplement: false },
  { id: 'bench_paneer', name: 'Paneer', servingLabel: '100g', proteinPerServingG: 18, costPerServingInr: 47.5, costPer25gProteinInr: 65.97, isSupplement: false },
  { id: 'bench_dahi', name: 'Dahi', servingLabel: '400g bowl', proteinPerServingG: 14, costPerServingInr: 40, costPer25gProteinInr: 71.43, isSupplement: false },
];

export function calculateCostPer25gProtein(
  costPerServingInr: InrAmount,
  proteinPerServingG: ProteinGrams | null | undefined
): InrAmount | null {
  const cost = Number(costPerServingInr || 0);
  const pro = Number(proteinPerServingG || 0);
  if (cost <= 0 || pro <= 0) return null;
  return roundTo((cost / pro) * 25, 2);
}

export function deriveSupplementRemainingServings(
  supplement: SupplementInventory,
  logs: SupplementLog[]
): InrAmount {
  const totalServings = Math.max(0, Number(supplement.totalServings ?? 0));
  const manualAdjustment = Number(supplement.manualAdjustment ?? 0);
  const takenSum = logs
    .filter((l) => !l.deletedAt && l.supplementId === supplement.id)
    .reduce((sum, l) => sum + Math.max(0, Number(l.servingsTaken ?? 0)), 0);
  return Math.max(0, roundTo(totalServings - takenSum + manualAdjustment, 2));
}

function inferProteinPerServingG(sup: SupplementInventory): number | null {
  const raw =
    sup.proteinPerServingG !== undefined && sup.proteinPerServingG !== null
      ? Number(sup.proteinPerServingG)
      : sup.category === 'protein'
        ? 24
        : null;
  return raw !== null && raw > 0 ? roundTo(raw, 1) : null;
}

function resolveSupplementRoiStatus(
  logsIn30dCount: number,
  cost: number,
  adherence30dPct: number
): SupplementRoiItem['roiStatus'] {
  if (logsIn30dCount === 0 && cost <= 0) return 'untracked';
  if (adherence30dPct >= 70) return 'high';
  if (adherence30dPct >= 35) return 'moderate';
  return cost > 0 ? 'wasted' : 'untracked';
}

function computeSupplementUnitStats(sup: SupplementInventory, remainingServings: number) {
  const dailyDosage = Math.max(0, Number(sup.dailyDosage ?? 0));
  const total = Math.max(0, Number(sup.totalServings ?? 0));
  const cost = Math.max(0, Number(sup.costInr ?? 0));
  const threshold = Math.max(0, Number(sup.lowStockThresholdDays ?? 7));
  const daysRemaining = dailyDosage > 0 ? Math.floor(remainingServings / dailyDosage) : null;
  const costPerServingInr = total > 0 && cost > 0 ? roundTo(cost / total, 2) : 0;
  const monthlyCostInr = roundTo(costPerServingInr * dailyDosage * 30, 0);
  const proteinPerServingG = inferProteinPerServingG(sup);
  return {
    cost,
    daysRemaining,
    isLowStock: daysRemaining !== null && daysRemaining <= threshold,
    costPerServingInr,
    monthlyCostInr,
    proteinPerServingG,
    costPer25gProteinInr: calculateCostPer25gProtein(costPerServingInr, proteinPerServingG),
  };
}

function buildSupplementRoiItem(
  sup: SupplementInventory,
  activeLogs: SupplementLog[],
  windowStartDate: IsoDateStr,
  windowEndDate: IsoDateStr
): SupplementRoiItem {
  const derivedRemainingServings = deriveSupplementRemainingServings(sup, activeLogs);
  const stats = computeSupplementUnitStats(sup, derivedRemainingServings);
  const supLogsIn30d = activeLogs.filter(
    (l) => l.supplementId === sup.id && l.date.slice(0, 10) >= windowStartDate && l.date.slice(0, 10) <= windowEndDate
  );
  const uniqueLoggedDays = new Set(supLogsIn30d.map((l) => l.date.slice(0, 10))).size;
  const adherence30dPct: Percentage = Math.min(100, Math.round((uniqueLoggedDays / 30) * 100));

  return {
    supplement: { ...sup, remainingServings: derivedRemainingServings },
    derivedRemainingServings,
    daysRemaining: stats.daysRemaining,
    isLowStock: stats.isLowStock,
    costPerServingInr: stats.costPerServingInr,
    proteinPerServingG: stats.proteinPerServingG,
    costPer25gProteinInr: stats.costPer25gProteinInr,
    monthlyCostInr: stats.monthlyCostInr,
    adherence30dPct,
    roiStatus: resolveSupplementRoiStatus(supLogsIn30d.length, stats.cost, adherence30dPct),
  };
}

function toSupplementBenchmarkRow(item: SupplementRoiItem): ProteinFoodBenchmark {
  return {
    id: item.supplement.id,
    name: item.supplement.name,
    servingLabel: `1 ${item.supplement.unitLabel}`,
    proteinPerServingG: item.proteinPerServingG!,
    costPerServingInr: item.costPerServingInr,
    costPer25gProteinInr: item.costPer25gProteinInr!,
    isSupplement: true,
  };
}

export function calculateSupplementStockAndRoi(
  inventory: SupplementInventory[],
  logs: SupplementLog[],
  referenceDate?: string
): SupplementStockAndRoiSummary {
  const refMs = referenceDate ? parseYmdToUtcMs(referenceDate) : Date.now();
  const safeRefMs = Number.isNaN(refMs) ? Date.now() : refMs;
  const windowStartDate = formatUtcMsToYmd(safeRefMs - 29 * 86_400_000);
  const windowEndDate = formatUtcMsToYmd(safeRefMs);

  const activeInventory = inventory.filter((s) => !s.deletedAt && s.isActive);
  const activeLogs = logs.filter((l) => !l.deletedAt);
  const items = activeInventory.map((sup) => buildSupplementRoiItem(sup, activeLogs, windowStartDate, windowEndDate));

  const supplementProteinRows = items
    .filter((item) => item.proteinPerServingG !== null && item.proteinPerServingG > 0 && item.costPer25gProteinInr !== null)
    .map(toSupplementBenchmarkRow);

  return {
    items,
    lowStockItems: items.filter((item) => item.isLowStock),
    totalMonthlySpendInr: roundTo(items.reduce((sum, item) => sum + item.monthlyCostInr, 0), 0),
    proteinBenchmarks: [...supplementProteinRows, ...INDIAN_PROTEIN_BENCHMARKS].sort(
      (a, b) => a.costPer25gProteinInr - b.costPer25gProteinInr
    ),
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

function computeDirectionalProgressPct(
  current: InrAmount,
  starting: InrAmount,
  targetValue: InrAmount,
  tolerance: InrAmount
): Percentage {
  if (Math.abs(targetValue - starting) < 0.05) {
    return Math.abs(current - targetValue) < tolerance ? 100 : 0;
  }
  const ratio = targetValue < starting ? (starting - current) / (starting - targetValue) : (current - starting) / (targetValue - starting);
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

function buildBodyMetricGoalProgress(params: {
  type: FitnessGoalLink['type'];
  label: string;
  current: number;
  starting: number;
  targetValue: number;
  tolerance: number;
  unit: string;
  reachedLabel: string;
}): FitnessGoalProgressSummary {
  const { type, label, current, starting, targetValue, tolerance, unit, reachedLabel } = params;
  const progressPct = computeDirectionalProgressPct(current, starting, targetValue, tolerance);
  const diff = roundTo(Math.abs(current - targetValue), 1);
  return {
    type,
    label,
    currentValue: roundTo(current, 1),
    startingValue: roundTo(starting, 1),
    targetValue: roundTo(targetValue, 1),
    unit,
    progressPct,
    remainingLabel: progressPct >= 100 ? reachedLabel : `${diff} ${unit} to go`,
  };
}

function buildWeightGoalProgress(
  link: FitnessGoalLink,
  dailyLogs: FitnessDailyLog[],
  profile: FitnessProfile | null | undefined,
  targetValue: number
): FitnessGoalProgressSummary {
  const rolling = calculate7DayRollingWeight(dailyLogs);
  const current = rolling.latestRollingAvgKg ?? rolling.latestWeightKg ?? profile?.currentWeightKg ?? link.startingValue ?? targetValue;
  const starting = link.startingValue ?? profile?.startingWeightKg ?? rolling.points[0]?.weightKg ?? current;
  return buildBodyMetricGoalProgress({
    type: link.type,
    label: 'Target Weight',
    current,
    starting,
    targetValue,
    tolerance: 0.25,
    unit: link.unit ?? 'kg',
    reachedLabel: 'Goal weight reached',
  });
}

function buildWaistGoalProgress(link: FitnessGoalLink, dailyLogs: FitnessDailyLog[], targetValue: number): FitnessGoalProgressSummary {
  const waist = calculateWeeklyWaistTrend(dailyLogs);
  const current = waist.latestWaistInches ?? link.startingValue ?? targetValue;
  const starting = link.startingValue ?? waist.startingWaistInches ?? current;
  return buildBodyMetricGoalProgress({
    type: link.type,
    label: 'Target Waist',
    current,
    starting,
    targetValue,
    tolerance: 0.2,
    unit: link.unit ?? 'in',
    reachedLabel: 'Target waist hit',
  });
}

function computeTargetPct(current: number, targetValue: number): Percentage {
  if (targetValue <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / targetValue) * 100)));
}

function buildStepsGoalProgress(
  link: FitnessGoalLink,
  dailyLogs: FitnessDailyLog[],
  refIso: IsoDateStr,
  targetValue: number
): FitnessGoalProgressSummary {
  const refMs = parseYmdToUtcMs(refIso);
  const start14 = formatUtcMsToYmd((Number.isNaN(refMs) ? Date.now() : refMs) - 13 * 86_400_000);
  const stepDays = dailyLogs.filter((l) => l.date.slice(0, 10) >= start14 && l.date.slice(0, 10) <= refIso && l.steps > 0);
  const avgSteps = stepDays.length > 0 ? Math.round(stepDays.reduce((s, l) => s + l.steps, 0) / stepDays.length) : 0;
  const progressPct = computeTargetPct(avgSteps, targetValue);
  const unit = link.unit ?? 'steps/day';
  return {
    type: link.type,
    label: 'Daily Steps Avg (14d)',
    currentValue: avgSteps,
    startingValue: link.startingValue ?? 0,
    targetValue,
    unit,
    progressPct,
    remainingLabel: progressPct >= 100 ? 'Step average target met' : `${Math.max(0, targetValue - avgSteps).toLocaleString('en-IN')} ${unit} gap`,
  };
}

export function calculateFitnessGoalProgress(
  link: FitnessGoalLink,
  params: {
    profile?: FitnessProfile | null;
    dailyLogs?: FitnessDailyLog[];
    workoutSessions?: WorkoutSession[];
    referenceDate?: IsoDateStr;
  }
): FitnessGoalProgressSummary {
  const refIso = (params.referenceDate ?? formatUtcMsToYmd(Date.now())).slice(0, 10);
  const dailyLogs = (params.dailyLogs ?? []).filter((l) => !l.deletedAt);
  const workouts = (params.workoutSessions ?? []).filter((w) => !w.deletedAt);
  const targetValue = Number(link.targetValue || 0);

  if (link.type === 'target_weight') return buildWeightGoalProgress(link, dailyLogs, params.profile, targetValue);
  if (link.type === 'target_waist') return buildWaistGoalProgress(link, dailyLogs, targetValue);
  if (link.type === 'daily_steps_avg') return buildStepsGoalProgress(link, dailyLogs, refIso, targetValue);

  const currentMonthKey = refIso.slice(0, 7);
  const monthWorkouts = workouts.filter((w) => w.date.slice(0, 7) === currentMonthKey).length;
  const progressPct = computeTargetPct(monthWorkouts, targetValue);
  const unit = link.unit ?? 'workouts';
  return {
    type: link.type,
    label: 'Monthly Workouts',
    currentValue: monthWorkouts,
    startingValue: link.startingValue ?? 0,
    targetValue,
    unit,
    progressPct,
    remainingLabel: progressPct >= 100 ? 'Monthly workout target reached' : `${Math.max(0, targetValue - monthWorkouts)} ${unit} remaining`,
  };
}
