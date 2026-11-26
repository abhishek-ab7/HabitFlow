import type { DebtRecord, FinanceCategory, FinanceTransaction, MealLog } from '@/lib/types';
import { normalizeIsoDate } from '@/lib/finance/credit-card-cycles';
import { classifyTransactionDomain, isDateInRange, roundTo, type SocialSpendDietInsight } from '../insight-types';

const DEFAULT_SOCIAL_SWAPS = [
  'Order Tandoori Paneer/Chicken Tikka + Zero/Lime Soda (~35g protein, ₹240) instead of heavy creamy combos + shakes.',
  'Have 1 scoop whey or 3 boiled eggs at home before meetups so you split 1 starter instead of ordering full plates.',
  'Swap Zomato/café dessert add-ons for sparkling water or black coffee to cut 400–600 empty kcal per hangout.',
];

const SOCIAL_FOOD_REGEX =
  /\b(food|junk|dinner|lunch|pizza|biryani|momos|swiggy|zomato|cafe|chai|drinks|party|outing|treat|hangout|restaurant)\b/i;

function titlesMatch(a: string, b: string): boolean {
  return Boolean(b && (a === b || a.includes(b) || b.includes(a)));
}

function isMirroredBySplitTx(debt: DebtRecord, socialFoodTxs: FinanceTransaction[]): boolean {
  const debtDate = normalizeIsoDate(debt.startDate);
  const normalizedDebtTitle = (debt.title ?? '').replace(/^everyday\s+split\s*:\s*/i, '').trim().toLowerCase();
  if (!normalizedDebtTitle) return false;
  return socialFoodTxs.some(
    (tx) =>
      Boolean(tx.splitGroupId) &&
      normalizeIsoDate(tx.date) === debtDate &&
      titlesMatch(normalizedDebtTitle, (tx.title ?? '').trim().toLowerCase())
  );
}

function buildDailyKcalMap(meals30d: MealLog[]): Map<string, { totalKcal: number; junkKcal: number }> {
  const dailyKcalMap = new Map<string, { totalKcal: number; junkKcal: number }>();
  for (const meal of meals30d) {
    const d = normalizeIsoDate(meal.date);
    const prev = dailyKcalMap.get(d) ?? { totalKcal: 0, junkKcal: 0 };
    const kcal = Math.max(0, Number(meal.calories ?? 0));
    prev.totalKcal += kcal;
    if (meal.isJunk) prev.junkKcal += kcal;
    dailyKcalMap.set(d, prev);
  }
  return dailyKcalMap;
}

function summarizeDailyKcalSplit(meals30d: MealLog[], socialDateSet: Set<string>) {
  const dailyKcalMap = buildDailyKcalMap(meals30d);
  let socialTotalCalories30d = 0;
  let socialJunkCalories30d = 0;
  let nonSocialDayKcalSum = 0;
  let nonSocialDayCount = 0;

  for (const [d, stats] of dailyKcalMap.entries()) {
    if (socialDateSet.has(d)) {
      socialTotalCalories30d += stats.totalKcal;
      socialJunkCalories30d += stats.junkKcal;
    } else if (stats.totalKcal > 0) {
      nonSocialDayKcalSum += stats.totalKcal;
      nonSocialDayCount += 1;
    }
  }
  return { socialTotalCalories30d, socialJunkCalories30d, nonSocialDayKcalSum, nonSocialDayCount };
}

function isSplitFoodTx(tx: FinanceTransaction, everydaySplitDebtIds: Set<string>): boolean {
  if (tx.splitGroupId) return true;
  if (tx.linkedDebtId && everydaySplitDebtIds.has(tx.linkedDebtId)) return true;
  return (tx.tags ?? []).some((t) => /\b(split|friend|hangout|outing)\b/i.test(t));
}

function partitionFoodTransactions(
  expenses30d: FinanceTransaction[],
  catMap: Map<string, FinanceCategory>,
  everydaySplitDebtIds: Set<string>
) {
  const foodTxs = expenses30d.filter((tx) => classifyTransactionDomain(tx, catMap).isFoodTx);
  const socialFoodTxs = foodTxs.filter((tx) => isSplitFoodTx(tx, everydaySplitDebtIds));
  const soloFoodTxs = foodTxs.filter((tx) => !isSplitFoodTx(tx, everydaySplitDebtIds));
  const linkedSocialDebtIds = new Set(socialFoodTxs.map((tx) => tx.linkedDebtId).filter(Boolean) as string[]);
  return { socialFoodTxs, soloFoodTxs, linkedSocialDebtIds };
}

function computeSocialSpendMetrics(socialFoodTxs: FinanceTransaction[], unlinkedSocialFoodDebts: DebtRecord[], soloFoodTxs: FinanceTransaction[]) {
  const socialFoodEventCount30d = socialFoodTxs.length + unlinkedSocialFoodDebts.length;
  const socialFoodSpend30dInr = roundTo(
    socialFoodTxs.reduce((s, t) => s + Math.max(0, Number(t.amount ?? 0)), 0) +
      unlinkedSocialFoodDebts.reduce((s, d) => s + Math.max(0, Number(d.principalAmount ?? 0)), 0),
    0
  );
  const avgSocialHangoutSpendInr = socialFoodEventCount30d > 0 ? Math.round(socialFoodSpend30dInr / socialFoodEventCount30d) : 0;
  const avgBaselineFoodTxSpendInr =
    soloFoodTxs.length > 0
      ? Math.round(soloFoodTxs.reduce((s, t) => s + Math.max(0, Number(t.amount ?? 0)), 0) / soloFoodTxs.length)
      : 0;
  const hangoutSpendMultiplier =
    avgSocialHangoutSpendInr > 0 && avgBaselineFoodTxSpendInr > 0
      ? roundTo(avgSocialHangoutSpendInr / avgBaselineFoodTxSpendInr, 2)
      : null;

  return { socialFoodEventCount30d, socialFoodSpend30dInr, avgSocialHangoutSpendInr, avgBaselineFoodTxSpendInr, hangoutSpendMultiplier };
}

function computeCalorieSpikeMetrics(meals30d: MealLog[], socialDateSet: Set<string>) {
  const kcal = summarizeDailyKcalSplit(meals30d, socialDateSet);
  const avgSocialDayCalories =
    socialDateSet.size > 0 && kcal.socialTotalCalories30d > 0 ? Math.round(kcal.socialTotalCalories30d / socialDateSet.size) : 0;
  const avgBaselineDayCalories = kcal.nonSocialDayCount > 0 ? Math.round(kcal.nonSocialDayKcalSum / kcal.nonSocialDayCount) : 0;
  const hangoutCalorieSpikeKcal =
    avgSocialDayCalories > 0 && avgBaselineDayCalories > 0
      ? Math.max(0, avgSocialDayCalories - avgBaselineDayCalories)
      : Math.round(kcal.socialJunkCalories30d / Math.max(1, socialDateSet.size));

  return { kcal, avgSocialDayCalories, avgBaselineDayCalories, hangoutCalorieSpikeKcal };
}

function findUnlinkedSocialFoodDebts(params: {
  debtRecords: DebtRecord[];
  linkedSocialDebtIds: Set<string>;
  socialFoodTxs: FinanceTransaction[];
  window30Start: string;
  todayDate: string;
}): DebtRecord[] {
  return params.debtRecords.filter(
    (d) =>
      d.bucketType === 'everyday_split' &&
      !params.linkedSocialDebtIds.has(d.id) &&
      isDateInRange(d.startDate, params.window30Start, params.todayDate) &&
      SOCIAL_FOOD_REGEX.test(`${d.title ?? ''} ${d.notes ?? ''}`) &&
      !isMirroredBySplitTx(d, params.socialFoodTxs)
  );
}

function hasSocialHangoutSpike(
  spend: ReturnType<typeof computeSocialSpendMetrics>,
  cal: ReturnType<typeof computeCalorieSpikeMetrics>
): boolean {
  if (spend.socialFoodEventCount30d <= 0) return false;
  if (spend.socialFoodSpend30dInr >= 400) return true;
  if (cal.kcal.socialJunkCalories30d >= 500) return true;
  if (cal.hangoutCalorieSpikeKcal >= 300) return true;
  return spend.hangoutSpendMultiplier !== null && spend.hangoutSpendMultiplier >= 1.4;
}

export function computeSocialSpendDietInsight(params: {
  expenses30d: FinanceTransaction[];
  debtRecords: DebtRecord[];
  meals30d: MealLog[];
  catMap: Map<string, FinanceCategory>;
  window30Start: string;
  todayDate: string;
}): SocialSpendDietInsight {
  const everydaySplitDebtIds = new Set(
    params.debtRecords.filter((d) => d.bucketType === 'everyday_split').map((d) => d.id)
  );
  const { socialFoodTxs, soloFoodTxs, linkedSocialDebtIds } = partitionFoodTransactions(
    params.expenses30d,
    params.catMap,
    everydaySplitDebtIds
  );

  const unlinkedSocialFoodDebts = findUnlinkedSocialFoodDebts({
    debtRecords: params.debtRecords,
    linkedSocialDebtIds,
    socialFoodTxs,
    window30Start: params.window30Start,
    todayDate: params.todayDate,
  });

  const spend = computeSocialSpendMetrics(socialFoodTxs, unlinkedSocialFoodDebts, soloFoodTxs);
  const socialDateSet = new Set<string>([
    ...socialFoodTxs.map((t) => normalizeIsoDate(t.date)),
    ...unlinkedSocialFoodDebts.map((d) => normalizeIsoDate(d.startDate)),
  ]);
  const cal = computeCalorieSpikeMetrics(params.meals30d, socialDateSet);
  const hasSpike = hasSocialHangoutSpike(spend, cal);

  return {
    ...spend,
    socialJunkCalories30d: Math.round(cal.kcal.socialJunkCalories30d),
    socialTotalCalories30d: Math.round(cal.kcal.socialTotalCalories30d),
    avgSocialDayCalories: cal.avgSocialDayCalories,
    avgBaselineDayCalories: cal.avgBaselineDayCalories,
    hangoutCalorieSpikeKcal: cal.hangoutCalorieSpikeKcal,
    hasSpike,
    suggestedSwaps: hasSpike ? DEFAULT_SOCIAL_SWAPS : DEFAULT_SOCIAL_SWAPS.slice(0, 2),
  };
}
