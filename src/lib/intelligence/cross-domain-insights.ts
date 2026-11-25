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
import {
  calculateSupplementStockAndRoi,
} from '@/lib/fitness/shared-analytics';
import { addDays, normalizeIsoDate } from '@/lib/finance/credit-card-cycles';
import { getIstIsoDate } from '@/lib/mcp/config';

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

function roundTo(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  const rounded = Math.round((Number(val) || 0) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function isDateInRange(dateStr: string | undefined | null, start: string, end: string): boolean {
  if (!dateStr) return false;
  const d = normalizeIsoDate(dateStr);
  return d.length === 10 && d >= start && d <= end;
}

function gradeCostPer25gProtein(
  costPer25gProteinInr: number | null
): 'A+' | 'A' | 'B' | 'C' | 'N/A' {
  if (costPer25gProteinInr === null || costPer25gProteinInr <= 0) return 'N/A';
  if (costPer25gProteinInr <= 45) return 'A+';
  if (costPer25gProteinInr <= 65) return 'A';
  if (costPer25gProteinInr <= 90) return 'B';
  return 'C';
}

function classifyTransactionDomain(
  tx: FinanceTransaction,
  catMap: Map<string, FinanceCategory>
) {
  const cat = catMap.get(tx.categoryId);
  const slug = (cat?.slug || '').toLowerCase();
  const catName = (cat?.name || '').toLowerCase();
  const combinedCat = `${slug} ${catName}`.trim();
  const tagText = (tx.tags || []).join(' ');
  const combinedText = `${tx.title || ''} ${tx.merchantName || ''} ${tx.rawMerchant || ''} ${
    tx.subcategory || ''
  } ${tx.notes || ''} ${tagText}`.trim();

  const isFriendShareLeg =
    (tx.tags || []).some((t) => t.toLowerCase() === 'friend-share') ||
    /^\s*friend\s+split\s*$/i.test(tx.subcategory || '');

  const isJunkTx =
    !isFriendShareLeg &&
    (slug === 'junk-food' ||
      slug.includes('junk') ||
      /\bjunk\s*food\b/i.test(combinedCat) ||
      /\bjunk\b/i.test(tx.subcategory || '') ||
      (tx.tags || []).some((t) => /\bjunk\b/i.test(t)));

  const isFoodTx =
    !isFriendShareLeg &&
    (isJunkTx ||
      slug.includes('food') ||
      slug.includes('dining') ||
      /\b(food|dining|restaurant|cafe|meals?)\b/i.test(combinedCat) ||
      /\b(swiggy|zomato|dinner|lunch|breakfast|cafe|biryani|pizza|burger|momos|chai|coffee|dhaba|canteen)\b/i.test(
        combinedText
      ));

  const isIdkSpend =
    !isFriendShareLeg && (/\bidk\b/i.test(combinedText) || /\bidk\b/i.test(combinedCat));

  const isGymExpense =
    !isFriendShareLeg &&
    (/\bgym\b/i.test(combinedCat) ||
      /\bgym\b/i.test(combinedText) ||
      /\b(fitness\s*club|cult\.fit|gold'?s\s*gym|anytime\s*fitness|crossfit)\b/i.test(combinedText));

  return {
    isJunkTx,
    isFoodTx,
    isIdkSpend,
    isGymExpense,
  };
}

function isWorkoutHabit(habit: Habit): boolean {
  const metaText = `${habit.name || ''} ${habit.category || ''}`;
  return (
    !habit.archived &&
    /\b(workout|gym|exercise|lift|lifting|strength|cardio|run|training|pushups?|walk)\b/i.test(
      metaText
    )
  );
}

function isHabitScheduledOnDate(habit: Habit, dateIso: string): boolean {
  const created = habit.createdAt ? normalizeIsoDate(habit.createdAt) : '';
  if (created && dateIso < created) return false;

  if (habit.frequencyType === 'specific_days' && Array.isArray(habit.scheduledDays) && habit.scheduledDays.length > 0) {
    const dt = new Date(`${dateIso}T00:00:00Z`);
    const dayOfWeek = dt.getUTCDay();
    return habit.scheduledDays.includes(dayOfWeek);
  }
  if ((habit.targetDaysPerWeek ?? 7) >= 7) {
    return true;
  }
  return false;
}

const DEFAULT_SOCIAL_SWAPS = [
  'Order Tandoori Paneer/Chicken Tikka + Zero/Lime Soda (~35g protein, ₹240) instead of heavy creamy combos + shakes.',
  'Have 1 scoop whey or 3 boiled eggs at home before meetups so you split 1 starter instead of ordering full plates.',
  'Swap Zomato/café dessert add-ons for sparkling water or black coffee to cut 400–600 empty kcal per hangout.',
];

export function computeCrossDomainInsights(
  input: CrossDomainInsightsInput
): CrossDomainInsightsReport {
  const todayDate = normalizeIsoDate(input.todayDate || getIstIsoDate()) || getIstIsoDate();
  const window14Start = addDays(todayDate, -13);
  const window30Start = addDays(todayDate, -29);

  const transactions = (input.transactions || []).filter((t) => !t.deletedAt);
  const categories = (input.categories || []).filter((c) => !c.deletedAt);
  const debtRecords = (input.debtRecords || []).filter((d) => !d.deletedAt);
  const mealLogs = (input.mealLogs || []).filter((m) => !m.deletedAt);
  const workoutSessions = (input.workoutSessions || []).filter((w) => !w.deletedAt);
  const fitnessDailyLogs = (input.fitnessDailyLogs || []).filter((l) => !l.deletedAt);
  const supplementInventory = (input.supplementInventory || []).filter((s) => !s.deletedAt);
  const supplementLogs = (input.supplementLogs || []).filter((l) => !l.deletedAt);
  const habits = (input.habits || []).filter((h) => !h.archived);
  const habitCompletions = input.habitCompletions || [];
  const moodLogs = input.moodLogs || [];

  const catMap = new Map<string, FinanceCategory>();
  for (const cat of categories) {
    catMap.set(cat.id, cat);
  }

  const expenses30d = transactions.filter(
    (t) => t.type === 'expense' && isDateInRange(t.date, window30Start, todayDate)
  );
  const meals30d = mealLogs.filter((m) => isDateInRange(m.date, window30Start, todayDate));
  const workouts30d = workoutSessions.filter((w) =>
    isDateInRange(w.date, window30Start, todayDate)
  );
  const fitnessLogs30d = fitnessDailyLogs.filter((l) =>
    isDateInRange(l.date, window30Start, todayDate)
  );
  const moodLogs30d = moodLogs.filter((m) => isDateInRange(m.date, window30Start, todayDate));

  // ------------------------------------------------------------------
  // 1. WALLET <-> WAISTLINE (14d & 30d Junk Spend + Empty Kcal Deduped)
  // ------------------------------------------------------------------
  const junkTxs30d = expenses30d.filter(
    (tx) => classifyTransactionDomain(tx, catMap).isJunkTx
  );
  const junkTxs14d = junkTxs30d.filter((tx) =>
    isDateInRange(tx.date, window14Start, todayDate)
  );

  // Dedupe junk meals by linkedTransactionId so duplicate bridge rows don't double-count kcal
  const seenLinkedMealTxIds = new Set<string>();
  const dedupedJunkMeals30d: MealLog[] = [];
  for (const meal of meals30d) {
    if (!meal.isJunk) continue;
    if (meal.linkedTransactionId) {
      if (seenLinkedMealTxIds.has(meal.linkedTransactionId)) continue;
      seenLinkedMealTxIds.add(meal.linkedTransactionId);
    }
    dedupedJunkMeals30d.push(meal);
  }
  const dedupedJunkMeals14d = dedupedJunkMeals30d.filter((m) =>
    isDateInRange(m.date, window14Start, todayDate)
  );

  const spend14dInr = roundTo(
    junkTxs14d.reduce((sum, tx) => sum + Math.max(0, Number(tx.amount || 0)), 0),
    2
  );
  const spend30dInr = roundTo(
    junkTxs30d.reduce((sum, tx) => sum + Math.max(0, Number(tx.amount || 0)), 0),
    2
  );
  const emptyKcal14d = Math.round(
    dedupedJunkMeals14d.reduce((sum, m) => sum + Math.max(0, Number(m.calories || 0)), 0)
  );
  const emptyKcal30d = Math.round(
    dedupedJunkMeals30d.reduce((sum, m) => sum + Math.max(0, Number(m.calories || 0)), 0)
  );
  const fatLossDragKg14d = roundTo(emptyKcal14d / 7700, 2);
  const fatLossDragKg30d = roundTo(emptyKcal30d / 7700, 2);
  const savings70PctMonthlyInr = Math.round(spend30dInr * 0.7);

  // Deduplicated incident count: unique junk tx IDs + unlinked junk meal IDs
  const junkTxIdSet14d = new Set(junkTxs14d.map((t) => t.id));
  const junkTxIdSet30d = new Set(junkTxs30d.map((t) => t.id));
  const unlinkedMeals14d = dedupedJunkMeals14d.filter(
    (m) => !m.linkedTransactionId || !junkTxIdSet14d.has(m.linkedTransactionId)
  );
  const unlinkedMeals30d = dedupedJunkMeals30d.filter(
    (m) => !m.linkedTransactionId || !junkTxIdSet30d.has(m.linkedTransactionId)
  );

  const linkedIncidentCount14d = junkTxIdSet14d.size + unlinkedMeals14d.length;
  const linkedIncidentCount30d = junkTxIdSet30d.size + unlinkedMeals30d.length;
  const unlinkedJunkMealCount30d = unlinkedMeals30d.length;

  const merchantSpendMap = new Map<string, number>();
  for (const tx of junkTxs30d) {
    const label = (tx.merchantName || tx.title || 'Junk Food').trim();
    merchantSpendMap.set(label, (merchantSpendMap.get(label) || 0) + Number(tx.amount || 0));
  }
  let topJunkMerchant: string | null = null;
  let topJunkMerchantAmt = 0;
  for (const [label, amt] of merchantSpendMap.entries()) {
    if (amt > topJunkMerchantAmt) {
      topJunkMerchant = label;
      topJunkMerchantAmt = amt;
    }
  }

  const walletWaistline: WalletWaistlineInsight = {
    spend14dInr,
    spend30dInr,
    emptyKcal14d,
    emptyKcal30d,
    fatLossDragKg14d,
    fatLossDragKg30d,
    savings70PctMonthlyInr,
    linkedIncidentCount14d,
    linkedIncidentCount30d,
    unlinkedJunkMealCount30d,
    topJunkMerchant,
  };

  // ------------------------------------------------------------------
  // 2. GYM & SUPPLEMENT ROI AUDIT
  // ------------------------------------------------------------------
  const gymSpend30dInr = roundTo(
    expenses30d
      .filter((tx) => classifyTransactionDomain(tx, catMap).isGymExpense)
      .reduce((sum, tx) => sum + Math.max(0, Number(tx.amount || 0)), 0),
    2
  );

  const supSummary = calculateSupplementStockAndRoi(
    supplementInventory,
    supplementLogs,
    todayDate
  );

  const supplementMonthlyAmortizedInr = supSummary.totalMonthlySpendInr;
  const combinedMonthlyFitnessSpendInr = roundTo(
    gymSpend30dInr + supplementMonthlyAmortizedInr,
    0
  );
  const workouts30dCount = workouts30d.length;
  const targetWorkoutsAt4PerWeek = 16; // 4 workouts/wk × 4 weeks

  const gymCostPerWorkoutInr =
    gymSpend30dInr > 0 && workouts30dCount > 0
      ? Math.round(gymSpend30dInr / workouts30dCount)
      : null;
  const targetGymCostPerWorkoutInr =
    gymSpend30dInr > 0 ? Math.round(gymSpend30dInr / targetWorkoutsAt4PerWeek) : null;
  const totalFitnessCostPerWorkoutInr =
    combinedMonthlyFitnessSpendInr > 0 && workouts30dCount > 0
      ? Math.round(combinedMonthlyFitnessSpendInr / workouts30dCount)
      : null;

  let gymRoiGrade: GymSupplementRoiInsight['gymRoiGrade'] = 'N/A';
  if (gymSpend30dInr > 0 || workouts30dCount > 0) {
    if (gymSpend30dInr > 0 && workouts30dCount === 0) {
      gymRoiGrade = 'F';
    } else {
      const ratio = workouts30dCount / targetWorkoutsAt4PerWeek;
      if (ratio >= 0.9) gymRoiGrade = 'A';
      else if (ratio >= 0.65) gymRoiGrade = 'B';
      else if (ratio >= 0.4) gymRoiGrade = 'C';
      else gymRoiGrade = 'D';
    }
  }

  const supplementBreakdown: SupplementRoiDetail[] = supSummary.items.map((item) => ({
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
  }));

  const primaryProtein =
    supplementBreakdown.find(
      (s) => s.category === 'protein' || s.costPer25gProteinInr !== null
    ) ||
    supplementBreakdown[0] ||
    null;

  const gymSupplementRoi: GymSupplementRoiInsight = {
    gymSpend30dInr,
    supplementMonthlyAmortizedInr,
    combinedMonthlyFitnessSpendInr,
    workouts30dCount,
    targetWorkoutsAt4PerWeek,
    gymCostPerWorkoutInr,
    targetGymCostPerWorkoutInr,
    totalFitnessCostPerWorkoutInr,
    gymRoiGrade,
    primaryProteinName: primaryProtein?.name ?? null,
    primaryCostPerScoopInr: primaryProtein?.costPerScoopInr ?? null,
    primaryCostPer25gProteinInr: primaryProtein?.costPer25gProteinInr ?? null,
    primaryProteinGrade: primaryProtein?.proteinValueGrade ?? 'N/A',
    supplementBreakdown,
  };

  // ------------------------------------------------------------------
  // 3. TRIGGER PATTERN DETECTION (Sleep / Energy / Missed Workout / Mood vs Junk & 'idk')
  // ------------------------------------------------------------------
  const observedDates = new Set<string>();
  const lowSleepDates = new Set<string>();
  const lowEnergyDates = new Set<string>();
  const negativeMoodDates = new Set<string>();
  const missedWorkoutDates = new Set<string>();
  const restedHabitsByDate = new Map<string, Set<string>>();

  for (const log of fitnessLogs30d) {
    const d = normalizeIsoDate(log.date);
    if (!d) continue;
    observedDates.add(d);
    if (Array.isArray(log.restedHabitIds) && log.restedHabitIds.length > 0) {
      restedHabitsByDate.set(d, new Set(log.restedHabitIds));
    }
    if (typeof log.sleepHours === 'number' && log.sleepHours > 0 && log.sleepHours < 6.5) {
      lowSleepDates.add(d);
    }
    if (typeof log.energyLevel === 'number' && log.energyLevel > 0 && log.energyLevel <= 2) {
      lowEnergyDates.add(d);
    }
  }

  for (const m of moodLogs30d) {
    const d = normalizeIsoDate(m.date);
    if (!d) continue;
    observedDates.add(d);
    if (m.mood === 'stressed' || m.mood === 'sad') {
      negativeMoodDates.add(d);
    }
  }

  for (const meal of meals30d) {
    observedDates.add(normalizeIsoDate(meal.date));
  }
  for (const w of workouts30d) {
    observedDates.add(normalizeIsoDate(w.date));
  }

  // Workout habit misses: explicit status==='missed' OR scheduled habit lacking completion on an observed day
  const workoutHabits = habits.filter(isWorkoutHabit);
  const workoutHabitIdSet = new Set(workoutHabits.map((h) => h.id));
  const completionsByHabitDate = new Map<string, HabitCompletion>();
  for (const c of habitCompletions) {
    if (!isDateInRange(c.date, window30Start, todayDate)) continue;
    const d = normalizeIsoDate(c.date);
    observedDates.add(d);
    completionsByHabitDate.set(`${c.habitId}|${d}`, c);
    if (workoutHabitIdSet.has(c.habitId) && c.status === 'missed') {
      missedWorkoutDates.add(d);
    }
  }

  // Compute daily Junk + 'idk' spend across 30d
  const triggerSpendByDate = new Map<string, number>();
  for (const tx of expenses30d) {
    const d = normalizeIsoDate(tx.date);
    observedDates.add(d);
    const domain = classifyTransactionDomain(tx, catMap);
    if (domain.isJunkTx || domain.isIdkSpend) {
      triggerSpendByDate.set(
        d,
        (triggerSpendByDate.get(d) || 0) + Math.max(0, Number(tx.amount || 0))
      );
    }
  }

  // Check completed-day scheduled workout habits missing completions across observed dates (excluding rest/frozen/skipped/workout sessions on same day)
  const workoutSessionDates = new Set(workouts30d.map((w) => normalizeIsoDate(w.date)));
  for (const d of observedDates) {
    if (d >= todayDate || workoutSessionDates.has(d)) continue;
    for (const habit of workoutHabits) {
      if (!isHabitScheduledOnDate(habit, d)) continue;
      if (restedHabitsByDate.get(d)?.has(habit.id)) continue;
      const comp = completionsByHabitDate.get(`${habit.id}|${d}`);
      if (
        !comp ||
        comp.status === 'missed' ||
        (!comp.completed && !comp.skipped && comp.status !== 'rest' && comp.status !== 'frozen')
      ) {
        missedWorkoutDates.add(d);
      }
    }
  }

  const anyTriggerDates = new Set<string>([
    ...lowSleepDates,
    ...lowEnergyDates,
    ...missedWorkoutDates,
    ...negativeMoodDates,
  ]);

  const computeBucketStat = (
    key: TriggerBucketStat['key'],
    label: string,
    dateSet: Set<string>
  ): TriggerBucketStat => {
    const triggerDaysCount = dateSet.size;
    let nonTriggerDaysCount = 0;
    let triggerTotal = 0;
    let nonTriggerTotal = 0;

    for (const d of observedDates) {
      const spend = triggerSpendByDate.get(d) || 0;
      if (dateSet.has(d)) {
        triggerTotal += spend;
      } else {
        nonTriggerDaysCount += 1;
        nonTriggerTotal += spend;
      }
    }

    const triggerAvgDailySpendInr =
      triggerDaysCount > 0 ? roundTo(triggerTotal / triggerDaysCount, 0) : 0;
    const baselineAvgDailySpendInr =
      nonTriggerDaysCount > 0 ? roundTo(nonTriggerTotal / nonTriggerDaysCount, 0) : 0;
    const spendMultiplier =
      triggerDaysCount > 0 && baselineAvgDailySpendInr > 0
        ? roundTo(triggerAvgDailySpendInr / baselineAvgDailySpendInr, 2)
        : null;

    return {
      key,
      label,
      triggerDaysCount,
      nonTriggerDaysCount,
      triggerAvgDailySpendInr,
      baselineAvgDailySpendInr,
      spendMultiplier,
      totalTriggerSpendInr: roundTo(triggerTotal, 0),
    };
  };

  const buckets: TriggerBucketStat[] = [
    computeBucketStat('low_sleep', 'Short Sleep (<6.5h)', lowSleepDates),
    computeBucketStat('low_energy', 'Low Energy (<=2/5)', lowEnergyDates),
    computeBucketStat('missed_workout', 'Missed Workout Habit', missedWorkoutDates),
    computeBucketStat('negative_mood', 'Stressed / Sad Mood', negativeMoodDates),
  ];

  let totalTriggerJunkIdkSpend30dInr = 0;
  let totalNonTriggerJunkIdkSpend30dInr = 0;
  let nonTriggerObservedCount = 0;
  for (const d of observedDates) {
    const spend = triggerSpendByDate.get(d) || 0;
    if (anyTriggerDates.has(d)) {
      totalTriggerJunkIdkSpend30dInr += spend;
    } else {
      nonTriggerObservedCount += 1;
      totalNonTriggerJunkIdkSpend30dInr += spend;
    }
  }

  const triggerAvgDailySpendInr =
    anyTriggerDates.size > 0
      ? roundTo(totalTriggerJunkIdkSpend30dInr / anyTriggerDates.size, 0)
      : 0;
  const baselineAvgDailySpendInr =
    nonTriggerObservedCount > 0
      ? roundTo(totalNonTriggerJunkIdkSpend30dInr / nonTriggerObservedCount, 0)
      : 0;
  const overallSpendMultiplier =
    anyTriggerDates.size > 0 && baselineAvgDailySpendInr > 0
      ? roundTo(triggerAvgDailySpendInr / baselineAvgDailySpendInr, 2)
      : null;

  const rankedBuckets = [...buckets]
    .filter((b) => b.triggerDaysCount > 0 && b.totalTriggerSpendInr > 0)
    .sort((a, b) => {
      const mA = a.spendMultiplier ?? a.triggerAvgDailySpendInr;
      const mB = b.spendMultiplier ?? b.triggerAvgDailySpendInr;
      return mB - mA;
    });
  const topBucket = rankedBuckets[0] || null;

  const triggers: TriggerPatternInsight = {
    observedDaysCount: observedDates.size,
    triggerDaysCount: anyTriggerDates.size,
    nonTriggerDaysCount: nonTriggerObservedCount,
    totalTriggerJunkIdkSpend30dInr: roundTo(totalTriggerJunkIdkSpend30dInr, 0),
    totalNonTriggerJunkIdkSpend30dInr: roundTo(totalNonTriggerJunkIdkSpend30dInr, 0),
    triggerAvgDailySpendInr,
    baselineAvgDailySpendInr,
    overallSpendMultiplier,
    topTrigger: topBucket?.key ?? null,
    topTriggerLabel: topBucket?.label ?? null,
    buckets,
  };

  // ------------------------------------------------------------------
  // 4. SOCIAL SPEND VS. DIET BALANCE
  // ------------------------------------------------------------------
  const everydaySplitDebtIds = new Set(
    debtRecords
      .filter((d) => d.bucketType === 'everyday_split')
      .map((d) => d.id)
  );

  const socialFoodTxs: FinanceTransaction[] = [];
  const soloFoodTxs: FinanceTransaction[] = [];
  const linkedSocialDebtIds = new Set<string>();

  for (const tx of expenses30d) {
    const dom = classifyTransactionDomain(tx, catMap);
    if (!dom.isFoodTx) continue;

    const isSplit =
      Boolean(tx.splitGroupId) ||
      Boolean(tx.linkedDebtId && everydaySplitDebtIds.has(tx.linkedDebtId)) ||
      (tx.tags || []).some((t) => /\b(split|friend|hangout|outing)\b/i.test(t));

    if (isSplit) {
      socialFoodTxs.push(tx);
      if (tx.linkedDebtId) linkedSocialDebtIds.add(tx.linkedDebtId);
    } else {
      soloFoodTxs.push(tx);
    }
  }

  // Include unlinked everyday_split friend debt records on food/hangout topics in 30d
  // Exclude records that mirror an already-counted splitGroupId food transaction on the same date.
  const unlinkedSocialFoodDebts = debtRecords.filter((d) => {
    if (d.bucketType !== 'everyday_split') return false;
    if (linkedSocialDebtIds.has(d.id)) return false;
    if (!isDateInRange(d.startDate, window30Start, todayDate)) return false;
    if (
      !/\b(food|junk|dinner|lunch|pizza|biryani|momos|swiggy|zomato|cafe|chai|drinks|party|outing|treat|hangout|restaurant)\b/i.test(
        `${d.title || ''} ${d.notes || ''}`
      )
    ) {
      return false;
    }
    const debtDate = normalizeIsoDate(d.startDate);
    const normalizedDebtTitle = (d.title || '')
      .replace(/^everyday\s+split\s*:\s*/i, '')
      .trim()
      .toLowerCase();
    const alreadyCountedViaSplitTx = socialFoodTxs.some((tx) => {
      if (!tx.splitGroupId) return false;
      if (normalizeIsoDate(tx.date) !== debtDate) return false;
      const normalizedTxTitle = (tx.title || '').trim().toLowerCase();
      if (!normalizedTxTitle || !normalizedDebtTitle) return false;
      return (
        normalizedDebtTitle === normalizedTxTitle ||
        normalizedDebtTitle.includes(normalizedTxTitle) ||
        normalizedTxTitle.includes(normalizedDebtTitle)
      );
    });
    return !alreadyCountedViaSplitTx;
  });

  const socialFoodEventCount30d = socialFoodTxs.length + unlinkedSocialFoodDebts.length;
  const socialFoodSpend30dInr = roundTo(
    socialFoodTxs.reduce((s, t) => s + Math.max(0, Number(t.amount || 0)), 0) +
      unlinkedSocialFoodDebts.reduce((s, d) => s + Math.max(0, Number(d.principalAmount || 0)), 0),
    0
  );

  const socialDateSet = new Set<string>([
    ...socialFoodTxs.map((t) => normalizeIsoDate(t.date)),
    ...unlinkedSocialFoodDebts.map((d) => normalizeIsoDate(d.startDate)),
  ]);

  const dailyKcalMap = new Map<string, { totalKcal: number; junkKcal: number }>();
  for (const meal of meals30d) {
    const d = normalizeIsoDate(meal.date);
    const prev = dailyKcalMap.get(d) || { totalKcal: 0, junkKcal: 0 };
    prev.totalKcal += Math.max(0, Number(meal.calories || 0));
    if (meal.isJunk) {
      prev.junkKcal += Math.max(0, Number(meal.calories || 0));
    }
    dailyKcalMap.set(d, prev);
  }

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

  const avgSocialHangoutSpendInr =
    socialFoodEventCount30d > 0
      ? Math.round(socialFoodSpend30dInr / socialFoodEventCount30d)
      : 0;
  const avgBaselineFoodTxSpendInr =
    soloFoodTxs.length > 0
      ? Math.round(
          soloFoodTxs.reduce((s, t) => s + Math.max(0, Number(t.amount || 0)), 0) /
            soloFoodTxs.length
        )
      : 0;
  const hangoutSpendMultiplier =
    avgSocialHangoutSpendInr > 0 && avgBaselineFoodTxSpendInr > 0
      ? roundTo(avgSocialHangoutSpendInr / avgBaselineFoodTxSpendInr, 2)
      : null;

  const avgSocialDayCalories =
    socialDateSet.size > 0 && socialTotalCalories30d > 0
      ? Math.round(socialTotalCalories30d / socialDateSet.size)
      : 0;
  const avgBaselineDayCalories =
    nonSocialDayCount > 0 ? Math.round(nonSocialDayKcalSum / nonSocialDayCount) : 0;

  const hangoutCalorieSpikeKcal =
    avgSocialDayCalories > 0 && avgBaselineDayCalories > 0
      ? Math.max(0, avgSocialDayCalories - avgBaselineDayCalories)
      : Math.round(socialJunkCalories30d / Math.max(1, socialDateSet.size));

  const hasSpike =
    socialFoodEventCount30d > 0 &&
    (socialFoodSpend30dInr >= 400 ||
      socialJunkCalories30d >= 500 ||
      hangoutCalorieSpikeKcal >= 300 ||
      (hangoutSpendMultiplier !== null && hangoutSpendMultiplier >= 1.4));

  const socialSpendDiet: SocialSpendDietInsight = {
    socialFoodEventCount30d,
    socialFoodSpend30dInr,
    socialJunkCalories30d: Math.round(socialJunkCalories30d),
    socialTotalCalories30d: Math.round(socialTotalCalories30d),
    avgSocialHangoutSpendInr,
    avgBaselineFoodTxSpendInr,
    hangoutSpendMultiplier,
    avgSocialDayCalories,
    avgBaselineDayCalories,
    hangoutCalorieSpikeKcal,
    hasSpike,
    suggestedSwaps: hasSpike ? DEFAULT_SOCIAL_SWAPS : DEFAULT_SOCIAL_SWAPS.slice(0, 2),
  };

  // ------------------------------------------------------------------
  // 5. UNIFIED ALERTS GENERATION
  // ------------------------------------------------------------------
  const alerts: CrossDomainAlert[] = [];

  if (spend14dInr > 0 || emptyKcal14d > 0 || spend30dInr > 0) {
    const severity: CrossDomainAlert['severity'] =
      spend14dInr >= 1500 || emptyKcal14d >= 3500
        ? 'critical'
        : spend14dInr >= 500 || emptyKcal14d >= 1500
          ? 'warning'
          : 'info';

    alerts.push({
      id: 'wallet-waistline-junk',
      pillar: 'wallet_waistline',
      severity,
      title: `Wallet <-> Waistline: ₹${spend14dInr.toLocaleString('en-IN')} junk spend & ${emptyKcal14d.toLocaleString('en-IN')} empty kcal (14d)`,
      description: `30d total is ₹${spend30dInr.toLocaleString('en-IN')} (${emptyKcal30d.toLocaleString('en-IN')} kcal, ~${fatLossDragKg30d} kg fat-loss drag). Cutting junk by 70% frees ₹${savings70PctMonthlyInr.toLocaleString('en-IN')}/mo.`,
      metricBadge: `${fatLossDragKg30d} kg drag · Save ₹${savings70PctMonthlyInr.toLocaleString('en-IN')}/mo`,
      actionHint: topJunkMerchant
        ? `Watch ${topJunkMerchant} orders; pre-log a high-protein meal before cravings hit.`
        : 'Cut 70% of junk orders to recover monthly cash & accelerate fat loss.',
    });
  }

  if (gymSpend30dInr > 0 || supplementBreakdown.length > 0) {
    const isGymUnderused =
      gymSpend30dInr > 0 && (workouts30dCount === 0 || gymRoiGrade === 'D' || gymRoiGrade === 'F');
    const wastedSup = supplementBreakdown.find((s) => s.roiStatus === 'wasted');
    const severity: CrossDomainAlert['severity'] =
      gymSpend30dInr > 0 && workouts30dCount === 0
        ? 'critical'
        : isGymUnderused || wastedSup
          ? 'warning'
          : 'info';

    const gymPart =
      gymSpend30dInr > 0
        ? workouts30dCount > 0
          ? `Gym ROI: ₹${gymCostPerWorkoutInr}/workout (${workouts30dCount} sessions vs target ₹${targetGymCostPerWorkoutInr} @ 4x/wk)`
          : `Gym ROI Grade F: ₹${gymSpend30dInr.toLocaleString('en-IN')} spent with 0 workouts in 30d`
        : `${workouts30dCount} workouts logged (30d)`;

    const supPart = primaryProtein
      ? ` · ${primaryProtein.name}: ₹${primaryProtein.costPerScoopInr}/scoop${
          primaryProtein.costPer25gProteinInr !== null
            ? ` (₹${primaryProtein.costPer25gProteinInr}/25g protein, Grade ${primaryProtein.proteinValueGrade})`
            : ''
        }`
      : '';

    alerts.push({
      id: 'gym-supplement-roi',
      pillar: 'gym_supplement_roi',
      severity,
      title: `${gymPart}`,
      description: `${supPart ? supPart.slice(3) + '. ' : ''}Total monthly fitness commitment: ₹${combinedMonthlyFitnessSpendInr.toLocaleString('en-IN')}/mo.${wastedSup ? ` Low adherence on ${wastedSup.name} (${wastedSup.adherence30dPct}%).` : ''}`,
      metricBadge:
        gymCostPerWorkoutInr !== null
          ? `₹${gymCostPerWorkoutInr}/workout · Grade ${gymRoiGrade}`
          : primaryProtein?.costPer25gProteinInr !== null && primaryProtein?.costPer25gProteinInr !== undefined
            ? `₹${primaryProtein.costPer25gProteinInr}/25g Pro (${primaryProtein.proteinValueGrade})`
            : `${workouts30dCount} workouts`,
      actionHint: isGymUnderused
        ? 'Hit 4x/week sessions (16/mo) to drop your cost per workout immediately.'
        : 'Keep protein scoop cost benchmarked against eggs/paneer/soya.',
    });
  }

  if (
    triggers.triggerDaysCount > 0 &&
    triggers.totalTriggerJunkIdkSpend30dInr > 0 &&
    (triggers.overallSpendMultiplier === null || triggers.overallSpendMultiplier >= 1.25)
  ) {
    const multText =
      triggers.overallSpendMultiplier !== null
        ? `${triggers.overallSpendMultiplier}x higher`
        : 'concentrated';
    const severity: CrossDomainAlert['severity'] =
      (triggers.overallSpendMultiplier ?? 3) >= 2.0 ? 'warning' : 'info';

    alerts.push({
      id: 'trigger-sleep-mood-spend',
      pillar: 'trigger_pattern',
      severity,
      title: `Trigger Alert: Junk/'idk' spend is ${multText} on ${triggers.topTriggerLabel || 'low-recovery'} days`,
      description: `Avg ₹${triggers.triggerAvgDailySpendInr}/day on trigger days (${triggers.triggerDaysCount}d) vs ₹${triggers.baselineAvgDailySpendInr}/day baseline (₹${triggers.totalTriggerJunkIdkSpend30dInr.toLocaleString('en-IN')} total triggered).`,
      metricBadge:
        triggers.overallSpendMultiplier !== null
          ? `${triggers.overallSpendMultiplier}x Spend Trigger`
          : `${triggers.triggerDaysCount} Trigger Days`,
      actionHint:
        'Enable Low-Energy Survival Mode on <6.5h sleep or stressed days instead of ordering comfort junk.',
    });
  }

  if (socialSpendDiet.hasSpike) {
    alerts.push({
      id: 'social-hangout-diet-spike',
      pillar: 'social_spend_diet',
      severity: socialSpendDiet.socialJunkCalories30d >= 1200 ? 'warning' : 'info',
      title: `Social Hangout Spike: ${socialSpendDiet.socialFoodEventCount30d} split outings (₹${socialSpendDiet.socialFoodSpend30dInr.toLocaleString('en-IN')})`,
      description: `Friend splits on food added ~${socialSpendDiet.hangoutCalorieSpikeKcal} extra kcal/day${
        socialSpendDiet.hangoutSpendMultiplier
          ? ` (${socialSpendDiet.hangoutSpendMultiplier}x solo meal ticket)`
          : ''
      }. Swap: ${socialSpendDiet.suggestedSwaps[0]}`,
      metricBadge: `+${socialSpendDiet.hangoutCalorieSpikeKcal} kcal/hangout`,
      actionHint: socialSpendDiet.suggestedSwaps[0],
    });
  }

  const severityRank: Record<CrossDomainAlert['severity'], number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return {
    todayDate,
    window14Start,
    window30Start,
    walletWaistline,
    gymSupplementRoi,
    triggers,
    socialSpendDiet,
    alerts,
  };
}
