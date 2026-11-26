import type {
  DebtRecord,
  FinanceCategory,
  FinanceTransaction,
  FitnessDailyLog,
  Habit,
  HabitCompletion,
  MealLog,
  MoodLog,
  SupplementInventory,
  SupplementLog,
  SupplementRoiItem,
  WorkoutSession,
} from '@/lib/types';
import { normalizeIsoDate } from '@/lib/finance/credit-card-cycles';

export interface CrossDomainInsightsInput {
  todayDate?: string;
  transactions?: FinanceTransaction[];
  categories?: FinanceCategory[];
  debtRecords?: DebtRecord[];
  mealLogs?: MealLog[];
  workoutSessions?: WorkoutSession[];
  fitnessDailyLogs?: FitnessDailyLog[];
  supplementInventory?: SupplementInventory[];
  supplementLogs?: SupplementLog[];
  habits?: Habit[];
  habitCompletions?: HabitCompletion[];
  moodLogs?: MoodLog[];
}

export interface WalletWaistlineInsight {
  spend14dInr: number;
  spend30dInr: number;
  emptyKcal14d: number;
  emptyKcal30d: number;
  fatLossDragKg14d: number;
  fatLossDragKg30d: number;
  savings70PctMonthlyInr: number;
  linkedIncidentCount14d: number;
  linkedIncidentCount30d: number;
  unlinkedJunkMealCount30d: number;
  topJunkMerchant: string | null;
}

export interface SupplementRoiDetail {
  id: string;
  name: string;
  category: string;
  unitLabel: string;
  costPerScoopInr: number;
  proteinPerServingG: number | null;
  costPer25gProteinInr: number | null;
  proteinValueGrade: 'A+' | 'A' | 'B' | 'C' | 'N/A';
  adherence30dPct: number;
  daysRemaining: number | null;
  monthlyCostInr: number;
  roiStatus: SupplementRoiItem['roiStatus'];
}

export interface GymSupplementRoiInsight {
  gymSpend30dInr: number;
  supplementMonthlyAmortizedInr: number;
  combinedMonthlyFitnessSpendInr: number;
  workouts30dCount: number;
  targetWorkoutsAt4PerWeek: number;
  gymCostPerWorkoutInr: number | null;
  targetGymCostPerWorkoutInr: number | null;
  totalFitnessCostPerWorkoutInr: number | null;
  gymRoiGrade: 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A';
  primaryProteinName: string | null;
  primaryCostPerScoopInr: number | null;
  primaryCostPer25gProteinInr: number | null;
  primaryProteinGrade: 'A+' | 'A' | 'B' | 'C' | 'N/A';
  supplementBreakdown: SupplementRoiDetail[];
}

export interface TriggerBucketStat {
  key: 'low_sleep' | 'low_energy' | 'missed_workout' | 'negative_mood';
  label: string;
  triggerDaysCount: number;
  nonTriggerDaysCount: number;
  triggerAvgDailySpendInr: number;
  baselineAvgDailySpendInr: number;
  spendMultiplier: number | null;
  totalTriggerSpendInr: number;
}

export interface TriggerPatternInsight {
  observedDaysCount: number;
  triggerDaysCount: number;
  nonTriggerDaysCount: number;
  totalTriggerJunkIdkSpend30dInr: number;
  totalNonTriggerJunkIdkSpend30dInr: number;
  triggerAvgDailySpendInr: number;
  baselineAvgDailySpendInr: number;
  overallSpendMultiplier: number | null;
  topTrigger: TriggerBucketStat['key'] | null;
  topTriggerLabel: string | null;
  buckets: TriggerBucketStat[];
}

export interface SocialSpendDietInsight {
  socialFoodEventCount30d: number;
  socialFoodSpend30dInr: number;
  socialJunkCalories30d: number;
  socialTotalCalories30d: number;
  avgSocialHangoutSpendInr: number;
  avgBaselineFoodTxSpendInr: number;
  hangoutSpendMultiplier: number | null;
  avgSocialDayCalories: number;
  avgBaselineDayCalories: number;
  hangoutCalorieSpikeKcal: number;
  hasSpike: boolean;
  suggestedSwaps: string[];
}

export interface CrossDomainAlert {
  id: string;
  pillar: 'wallet_waistline' | 'gym_supplement_roi' | 'trigger_pattern' | 'social_spend_diet';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  metricBadge: string;
  actionHint: string;
}

export interface CrossDomainInsightsReport {
  todayDate: string;
  window14Start: string;
  window30Start: string;
  walletWaistline: WalletWaistlineInsight;
  gymSupplementRoi: GymSupplementRoiInsight;
  triggers: TriggerPatternInsight;
  socialSpendDiet: SocialSpendDietInsight;
  alerts: CrossDomainAlert[];
}

export function roundTo(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  const rounded = Math.round((Number(val) || 0) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

type IsoDate = string;
type CategorySlug = string;
type TransactionText = string;

export function isDateInRange(dateStr: IsoDate | undefined | null, start: IsoDate, end: IsoDate): boolean {
  if (!dateStr) return false;
  const d = normalizeIsoDate(dateStr);
  return d.length === 10 && d >= start && d <= end;
}

function isJunkTransaction(tx: FinanceTransaction, slug: CategorySlug, combinedCat: TransactionText): boolean {
  if (slug.includes('junk')) return true;
  if (/\bjunk\s*food\b/i.test(combinedCat)) return true;
  if (/\bjunk\b/i.test(tx.subcategory ?? '')) return true;
  return (tx.tags ?? []).some((t) => /\bjunk\b/i.test(t));
}

const FOOD_TEXT_REGEX =
  /\b(swiggy|zomato|dinner|lunch|breakfast|cafe|biryani|pizza|burger|momos|chai|coffee|dhaba|canteen)\b/i;

function isFoodTransaction(
  isJunkTx: boolean,
  slug: CategorySlug,
  combinedCat: TransactionText,
  combinedText: TransactionText
): boolean {
  if (isJunkTx) return true;
  if (slug.includes('food') || slug.includes('dining')) return true;
  if (/\b(food|dining|restaurant|cafe|meals?)\b/i.test(combinedCat)) return true;
  return FOOD_TEXT_REGEX.test(combinedText);
}

function isFriendShareTransaction(tx: FinanceTransaction): boolean {
  if ((tx.tags ?? []).some((t) => t.toLowerCase() === 'friend-share')) return true;
  return /^\s*friend\s+split\s*$/i.test(tx.subcategory ?? '');
}

const GYM_BRAND_REGEX = /\b(fitness\s*club|cult\.fit|gold'?s\s*gym|anytime\s*fitness|crossfit)\b/i;

function isGymTransaction(combinedCat: TransactionText, combinedText: TransactionText): boolean {
  if (/\bgym\b/i.test(combinedCat)) return true;
  if (/\bgym\b/i.test(combinedText)) return true;
  return GYM_BRAND_REGEX.test(combinedText);
}

export function classifyTransactionDomain(tx: FinanceTransaction, catMap: Map<string, FinanceCategory>) {
  if (isFriendShareTransaction(tx)) {
    return { isJunkTx: false, isFoodTx: false, isIdkSpend: false, isGymExpense: false };
  }

  const cat = catMap.get(tx.categoryId);
  const slug = (cat?.slug ?? '').toLowerCase();
  const combinedCat = `${slug} ${(cat?.name ?? '').toLowerCase()}`.trim();
  const combinedText = [tx.title, tx.merchantName, tx.rawMerchant, tx.subcategory, tx.notes, ...(tx.tags ?? [])]
    .filter(Boolean)
    .join(' ');

  const isJunkTx = isJunkTransaction(tx, slug, combinedCat);
  return {
    isJunkTx,
    isFoodTx: isFoodTransaction(isJunkTx, slug, combinedCat, combinedText),
    isIdkSpend: /\bidk\b/i.test(combinedText) || /\bidk\b/i.test(combinedCat),
    isGymExpense: isGymTransaction(combinedCat, combinedText),
  };
}
