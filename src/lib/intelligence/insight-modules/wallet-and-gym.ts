import type {
  FinanceCategory,
  FinanceTransaction,
  MealLog,
  SupplementInventory,
  SupplementLog,
  WorkoutSession,
} from '@/lib/types';
import { calculateSupplementStockAndRoi } from '@/lib/fitness/shared-analytics';
import {
  classifyTransactionDomain,
  isDateInRange,
  roundTo,
  type GymSupplementRoiInsight,
  type SupplementRoiDetail,
  type WalletWaistlineInsight,
} from '../insight-types';

function dedupeJunkMeals(meals30d: MealLog[]): MealLog[] {
  const seenLinkedMealTxIds = new Set<string>();
  return meals30d.filter((meal) => {
    if (!meal.isJunk) return false;
    if (!meal.linkedTransactionId) return true;
    if (seenLinkedMealTxIds.has(meal.linkedTransactionId)) return false;
    seenLinkedMealTxIds.add(meal.linkedTransactionId);
    return true;
  });
}

function findTopJunkMerchant(junkTxs30d: FinanceTransaction[]): string | null {
  const merchantSpendMap = new Map<string, number>();
  for (const tx of junkTxs30d) {
    const label = (tx.merchantName || tx.title || 'Junk Food').trim();
    merchantSpendMap.set(label, (merchantSpendMap.get(label) || 0) + Number(tx.amount || 0));
  }
  let topMerchant: string | null = null;
  let topAmt = 0;
  for (const [label, amt] of merchantSpendMap.entries()) {
    if (amt > topAmt) {
      topMerchant = label;
      topAmt = amt;
    }
  }
  return topMerchant;
}

export function computeWalletWaistlineInsight(params: {
  expenses30d: FinanceTransaction[];
  meals30d: MealLog[];
  catMap: Map<string, FinanceCategory>;
  window14Start: string;
  todayDate: string;
}): WalletWaistlineInsight {
  const { expenses30d, meals30d, catMap, window14Start, todayDate } = params;
  const junkTxs30d = expenses30d.filter((tx) => classifyTransactionDomain(tx, catMap).isJunkTx);
  const junkTxs14d = junkTxs30d.filter((tx) => isDateInRange(tx.date, window14Start, todayDate));

  const dedupedJunkMeals30d = dedupeJunkMeals(meals30d);
  const dedupedJunkMeals14d = dedupedJunkMeals30d.filter((m) => isDateInRange(m.date, window14Start, todayDate));

  const sumTx = (txs: FinanceTransaction[]) =>
    roundTo(txs.reduce((sum, tx) => sum + Math.max(0, Number(tx.amount || 0)), 0), 2);
  const sumKcal = (meals: MealLog[]) =>
    Math.round(meals.reduce((sum, m) => sum + Math.max(0, Number(m.calories || 0)), 0));

  const spend14dInr = sumTx(junkTxs14d);
  const spend30dInr = sumTx(junkTxs30d);
  const emptyKcal14d = sumKcal(dedupedJunkMeals14d);
  const emptyKcal30d = sumKcal(dedupedJunkMeals30d);

  const junkTxIdSet14d = new Set(junkTxs14d.map((t) => t.id));
  const junkTxIdSet30d = new Set(junkTxs30d.map((t) => t.id));
  const unlinkedMeals14d = dedupedJunkMeals14d.filter((m) => !m.linkedTransactionId || !junkTxIdSet14d.has(m.linkedTransactionId));
  const unlinkedMeals30d = dedupedJunkMeals30d.filter((m) => !m.linkedTransactionId || !junkTxIdSet30d.has(m.linkedTransactionId));

  return {
    spend14dInr,
    spend30dInr,
    emptyKcal14d,
    emptyKcal30d,
    fatLossDragKg14d: roundTo(emptyKcal14d / 7700, 2),
    fatLossDragKg30d: roundTo(emptyKcal30d / 7700, 2),
    savings70PctMonthlyInr: Math.round(spend30dInr * 0.7),
    linkedIncidentCount14d: junkTxIdSet14d.size + unlinkedMeals14d.length,
    linkedIncidentCount30d: junkTxIdSet30d.size + unlinkedMeals30d.length,
    unlinkedJunkMealCount30d: unlinkedMeals30d.length,
    topJunkMerchant: findTopJunkMerchant(junkTxs30d),
  };
}

function gradeCostPer25gProtein(costPer25gProteinInr: number | null): 'A+' | 'A' | 'B' | 'C' | 'N/A' {
  if (costPer25gProteinInr === null || costPer25gProteinInr <= 0) return 'N/A';
  if (costPer25gProteinInr <= 45) return 'A+';
  if (costPer25gProteinInr <= 65) return 'A';
  if (costPer25gProteinInr <= 90) return 'B';
  return 'C';
}

function gradeGymRoi(gymSpend30dInr: number, workouts30dCount: number, target: number): GymSupplementRoiInsight['gymRoiGrade'] {
  if (gymSpend30dInr <= 0 && workouts30dCount <= 0) return 'N/A';
  if (gymSpend30dInr > 0 && workouts30dCount === 0) return 'F';
  const ratio = workouts30dCount / target;
  if (ratio >= 0.9) return 'A';
  if (ratio >= 0.65) return 'B';
  if (ratio >= 0.4) return 'C';
  return 'D';
}

function mapSupplementRoiItem(
  item: ReturnType<typeof calculateSupplementStockAndRoi>['items'][number]
): SupplementRoiDetail {
  return {
    id: item.supplement.id,
    name: item.supplement.name,
    category: item.supplement.category,
    unitLabel: item.supplement.unitLabel,
    costPerScoopInr: item.costPerServingInr,
    proteinPerServingG: item.proteinPerServingG,
    costPer25gProteinInr: item.costPer25gProteinInr,
    proteinValueGrade: gradeCostPer25gProtein(item.costPer25gProteinInr),
    adherence30dPct: item.adherence30dPct,
    daysRemaining: item.daysRemaining,
    monthlyCostInr: item.monthlyCostInr,
    roiStatus: item.roiStatus,
  };
}

function divideOrNull(total: number, count: number): number | null {
  if (total <= 0 || count <= 0) return null;
  return Math.round(total / count);
}

export function computeGymSupplementRoiInsight(params: {
  expenses30d: FinanceTransaction[];
  workouts30d: WorkoutSession[];
  supplementInventory: SupplementInventory[];
  supplementLogs: SupplementLog[];
  catMap: Map<string, FinanceCategory>;
  todayDate: string;
}): GymSupplementRoiInsight {
  const { expenses30d, workouts30d, supplementInventory, supplementLogs, catMap, todayDate } = params;
  const gymSpend30dInr = roundTo(
    expenses30d
      .filter((tx) => classifyTransactionDomain(tx, catMap).isGymExpense)
      .reduce((sum, tx) => sum + Math.max(0, Number(tx.amount ?? 0)), 0),
    2
  );

  const supSummary = calculateSupplementStockAndRoi(supplementInventory, supplementLogs, todayDate);
  const supplementMonthlyAmortizedInr = supSummary.totalMonthlySpendInr;
  const combinedMonthlyFitnessSpendInr = roundTo(gymSpend30dInr + supplementMonthlyAmortizedInr, 0);
  const workouts30dCount = workouts30d.length;
  const targetWorkoutsAt4PerWeek = 16;

  const supplementBreakdown = supSummary.items.map(mapSupplementRoiItem);
  const primaryProtein =
    supplementBreakdown.find((s) => s.category === 'protein' || s.costPer25gProteinInr !== null) ??
    supplementBreakdown[0] ??
    null;

  return {
    gymSpend30dInr,
    supplementMonthlyAmortizedInr,
    combinedMonthlyFitnessSpendInr,
    workouts30dCount,
    targetWorkoutsAt4PerWeek,
    gymCostPerWorkoutInr: divideOrNull(gymSpend30dInr, workouts30dCount),
    targetGymCostPerWorkoutInr: divideOrNull(gymSpend30dInr, targetWorkoutsAt4PerWeek),
    totalFitnessCostPerWorkoutInr: divideOrNull(combinedMonthlyFitnessSpendInr, workouts30dCount),
    gymRoiGrade: gradeGymRoi(gymSpend30dInr, workouts30dCount, targetWorkoutsAt4PerWeek),
    primaryProteinName: primaryProtein?.name ?? null,
    primaryCostPerScoopInr: primaryProtein?.costPerScoopInr ?? null,
    primaryCostPer25gProteinInr: primaryProtein?.costPer25gProteinInr ?? null,
    primaryProteinGrade: primaryProtein?.proteinValueGrade ?? 'N/A',
    supplementBreakdown,
  };
}
