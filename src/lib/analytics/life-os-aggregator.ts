import {
  calculateBestStreak,
  calculateCategoryBreakdown,
  calculateCurrentStreak,
  calculateDailyStats,
  calculateGoalStats,
  calculateMomentum,
  generateHeatmapData,
} from '@/lib/calculations';
import { formatHumanDate } from '@/lib/date-format';
import { detectSpendingAnomalies } from '@/lib/finance/anomalies';
import { computeCreditCardSummary } from '@/lib/finance/credit-card-cycles';
import { buildCashFlowForecast, type CashFlowForecastResult } from '@/lib/finance/forecast';
import {
  calculateDebtSummary,
  calculateMonthlySummary,
  calculateNetWorthSummary,
  calculateUpcomingFinancialObligations,
} from '@/lib/finance/shared-analytics';
import {
  calculate7DayRollingWeight,
  calculateSupplementStockAndRoi,
  calculateWeeklyWaistTrend,
  getProgressiveOverloadHint,
} from '@/lib/fitness/shared-analytics';
import {
  computeCrossDomainInsights,
  type CrossDomainAlert,
  type CrossDomainInsightsReport,
} from '@/lib/intelligence/cross-domain-insights';
import { getIstIsoDate, getIstMonthKey } from '@/lib/mcp/config';
import type {
  CategoryBreakdown,
  CreditCardCycleSummary,
  DailyStats,
  DebtInstallment,
  DebtRecord,
  DebtSummaryBreakdown,
  EmiTracker,
  FinanceAccount,
  FinanceAnomalyAlert,
  FinanceBudget,
  FinanceCategory,
  FinanceRecurringBill,
  FinanceSipPlan,
  FinanceTransaction,
  FinancialObligationItem,
  FitnessDailyLog,
  FitnessProfile,
  Goal,
  GoalStats,
  Habit,
  HabitCompletion,
  HeatmapData,
  MealLog,
  Milestone,
  MonthlyCommitment,
  MonthlyFinanceSummary,
  MoodLog,
  NetWorthSummary,
  ProgressiveOverloadHint,
  RollingWeightSummary,
  SupplementInventory,
  SupplementLog,
  SupplementStockAndRoiSummary,
  Task,
  TimeRange,
  Trend,
  UserSettings,
  WeeklyWaistTrendSummary,
  WorkoutSession,
} from '@/lib/types';
import { isFinanceModuleEnabled, isFitnessModuleEnabled } from '@/lib/workspace-modules';

export type AnalyticsRangeKey = '7d' | '30d' | '90d' | 'year';

export const ANALYTICS_RANGE_OPTIONS: Array<{
  key: AnalyticsRangeKey;
  legacy: TimeRange;
  label: string;
  shortLabel: string;
}> = [
  { key: '7d', legacy: 'week', label: 'Last 7 days', shortLabel: '7D' },
  { key: '30d', legacy: 'month', label: 'Last 30 days', shortLabel: '30D' },
  { key: '90d', legacy: 'quarter', label: 'Last 90 days', shortLabel: '90D' },
  { key: 'year', legacy: 'year', label: 'Year to date', shortLabel: 'Year' },
];

export function toAnalyticsRangeKey(value?: string | null): AnalyticsRangeKey {
  switch (value) {
    case '7d':
    case 'week':
      return '7d';
    case '90d':
    case 'quarter':
      return '90d';
    case 'year':
      return 'year';
    case '30d':
    case 'month':
    default:
      return '30d';
  }
}

export function toLegacyTimeRange(range: AnalyticsRangeKey): TimeRange {
  switch (range) {
    case '7d':
      return 'week';
    case '90d':
      return 'quarter';
    case 'year':
      return 'year';
    case '30d':
    default:
      return 'month';
  }
}

/**
 * Pure calendar shift on a YYYY-MM-DD string using UTC calendar arithmetic so
 * IST date windows never drift regardless of host timezone.
 */
export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [yStr, mStr, dStr] = isoDate.slice(0, 10).split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!y || !m || !d) return isoDate.slice(0, 10);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function parseIsoAsLocalNoon(isoDate: string): Date {
  const [yStr, mStr, dStr] = isoDate.slice(0, 10).split('-');
  return new Date(Number(yStr), Number(mStr) - 1, Number(dStr), 12, 0, 0, 0);
}

export function diffIsoDaysInclusive(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.slice(0, 10).split('-').map(Number);
  const [ey, em, ed] = endDate.slice(0, 10).split('-').map(Number);
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  return Math.max(1, Math.round((endUtc - startUtc) / 86_400_000) + 1);
}

export interface AnalyticsRangeWindow {
  range: AnalyticsRangeKey;
  todayDateStr: string;
  monthKey: string;
  startDateStr: string;
  endDateStr: string;
  prevStartDateStr: string;
  prevEndDateStr: string;
  dayCount: number;
  label: string;
  dateSpanLabel: string;
}

export function getAnalyticsRangeWindow(
  rangeInput?: AnalyticsRangeKey | TimeRange | string | null,
  referenceDate: Date = new Date()
): AnalyticsRangeWindow {
  const range = toAnalyticsRangeKey(rangeInput);
  const todayDateStr = getIstIsoDate(referenceDate);
  const monthKey = getIstMonthKey(referenceDate);

  let startDateStr: string;
  if (range === '7d') {
    startDateStr = shiftIsoDate(todayDateStr, -6);
  } else if (range === '30d') {
    startDateStr = shiftIsoDate(todayDateStr, -29);
  } else if (range === '90d') {
    startDateStr = shiftIsoDate(todayDateStr, -89);
  } else {
    startDateStr = `${todayDateStr.slice(0, 4)}-01-01`;
  }

  const dayCount = diffIsoDaysInclusive(startDateStr, todayDateStr);
  const prevEndDateStr = shiftIsoDate(startDateStr, -1);
  const prevStartDateStr = shiftIsoDate(prevEndDateStr, -(dayCount - 1));
  const option = ANALYTICS_RANGE_OPTIONS.find((opt) => opt.key === range) ?? ANALYTICS_RANGE_OPTIONS[1];

  return {
    range,
    todayDateStr,
    monthKey,
    startDateStr,
    endDateStr: todayDateStr,
    prevStartDateStr,
    prevEndDateStr,
    dayCount,
    label: option.label,
    dateSpanLabel: `${formatHumanDate(startDateStr)} – ${formatHumanDate(todayDateStr)}`,
  };
}

export interface LifeOsAggregatorInput {
  range?: AnalyticsRangeKey | TimeRange | string | null;
  referenceDate?: Date;
  settings?: Pick<UserSettings, 'habitOnlyMode' | 'showFinance' | 'showFitness' | 'weekStartsOn'> | null;
  habits?: Habit[];
  completions?: HabitCompletion[];
  goals?: Goal[];
  milestones?: Milestone[];
  tasks?: Task[];
  moodLogs?: MoodLog[];
  // Finance
  accounts?: FinanceAccount[];
  transactions?: FinanceTransaction[];
  categories?: FinanceCategory[];
  budgets?: FinanceBudget[];
  commitments?: MonthlyCommitment[];
  debtRecords?: DebtRecord[];
  debtInstallments?: DebtInstallment[];
  emiTrackers?: EmiTracker[];
  sipPlans?: FinanceSipPlan[];
  recurringBills?: FinanceRecurringBill[];
  creditCardStatements?: import('@/lib/types').CreditCardStatement[];
  // Fitness
  fitnessProfile?: FitnessProfile | null;
  dailyLogs?: FitnessDailyLog[];
  mealLogs?: MealLog[];
  workoutSessions?: WorkoutSession[];
  supplementInventory?: SupplementInventory[];
  supplementLogs?: SupplementLog[];
}

export interface PillarWeightBreakdown {
  habitsPct: number;
  financePct: number;
  fitnessPct: number;
}

export interface HabitsAnalyticsSlice {
  hasData: boolean;
  score: number;
  previousScore: number;
  scoreDelta: number;
  activeHabitsCount: number;
  completionRatePct: number;
  prevCompletionRatePct: number;
  completionRateDeltaPct: number;
  periodCompletions: number;
  currentBestActiveStreak: number;
  allTimeBestStreak: number;
  momentum: Trend;
  activeGoalsCount: number;
  onTrackGoalsCount: number;
  completedTasksCount: number;
  openTasksCount: number;
  overdueTasksCount: number;
  avgMoodScore: number | null;
  dailyStats: DailyStats[];
  categoryBreakdown: CategoryBreakdown[];
  heatmapData: HeatmapData[];
  goalProgressList: Array<{ goal: Goal; stats: GoalStats }>;
}

export interface FinanceAnalyticsSlice {
  enabled: boolean;
  hasData: boolean;
  score: number;
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  netSavings: number;
  savingsRatePct: number;
  prevTotalExpense: number;
  expenseDeltaPct: number | null;
  dailyAvgBurn: number;
  needsSpend: number;
  discretionarySpend: number;
  categorySpend: Array<{
    categoryId: string;
    name: string;
    color: string;
    amount: number;
    sharePct: number;
    budgetLimit: number;
    transactionCount: number;
    category?: FinanceCategory;
  }>;
  dailyCashflow: Array<{
    date: string;
    label: string;
    income: number;
    expense: number;
    net: number;
  }>;
  netWorth: NetWorthSummary;
  monthlySummary: MonthlyFinanceSummary;
  debtSummary: DebtSummaryBreakdown;
  creditCardSummaries: Array<{ account: FinanceAccount; summary: CreditCardCycleSummary }>;
  totalCardUtilizationPct: number;
  upcomingObligations7d: FinancialObligationItem[];
  anomalies: FinanceAnomalyAlert[];
  forecast30d: CashFlowForecastResult;
}

export interface FitnessAnalyticsSlice {
  enabled: boolean;
  hasData: boolean;
  score: number;
  daysLogged: number;
  latestWeightKg: number | null;
  latestRollingAvgKg: number | null;
  weeklyWeightDeltaKg: number | null;
  latestWaistInches: number | null;
  totalWaistDeltaInches: number | null;
  avgCalories: number;
  calorieTarget: number;
  calorieAdherencePct: number;
  avgProteinG: number;
  proteinTargetG: number;
  proteinAdherencePct: number;
  avgSteps: number;
  stepsTarget: number;
  avgSleepHours: number | null;
  sleepTargetHours: number;
  workoutCount: number;
  totalWorkoutMinutes: number;
  totalVolumeKg: number;
  junkMealCount: number;
  junkFreeStreakDays: number;
  avgEnergyLevel: number | null;
  workoutTypeBreakdown: Array<{ type: string; count: number; minutes: number }>;
  overloadHints: ProgressiveOverloadHint[];
  rollingWeight: RollingWeightSummary;
  waistTrend: WeeklyWaistTrendSummary;
  dailyFuelSeries: Array<{
    date: string;
    label: string;
    calories: number;
    proteinG: number;
    steps: number;
    sleepHours: number | null;
  }>;
  supplementRoi: SupplementStockAndRoiSummary;
}

export interface HabitSpendCorrelation {
  hasEnoughData: boolean;
  highHabitDaysCount: number;
  lowHabitDaysCount: number;
  highHabitAvgSpendInr: number;
  lowHabitAvgSpendInr: number;
  dailySavingsDeltaInr: number;
}

export interface LifeOsAnalyticsSnapshot {
  window: AnalyticsRangeWindow;
  modules: {
    showHabits: true;
    showFinance: boolean;
    showFitness: boolean;
    habitOnlyMode: boolean;
  };
  lifeOsScore: number;
  previousLifeOsScore: number;
  lifeOsScoreDelta: number;
  weights: PillarWeightBreakdown;
  habits: HabitsAnalyticsSlice;
  finance: FinanceAnalyticsSlice;
  fitness: FitnessAnalyticsSlice;
  intelligence: {
    report: CrossDomainInsightsReport;
    alerts: CrossDomainAlert[];
    habitSpendCorrelation: HabitSpendCorrelation;
  };
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeNormalizedPillarWeights(
  showFinance: boolean,
  showFitness: boolean
): PillarWeightBreakdown {
  const baseHabits = 0.35;
  const baseFinance = showFinance ? 0.35 : 0;
  const baseFitness = showFitness ? 0.30 : 0;
  const total = baseHabits + baseFinance + baseFitness;

  const habitsPct = Math.round((baseHabits / total) * 100);
  const financePct = showFinance ? Math.round((baseFinance / total) * 100) : 0;
  const fitnessPct = showFitness ? Math.max(0, 100 - habitsPct - financePct) : 0;

  return {
    habitsPct,
    financePct,
    fitnessPct,
  };
}

function isDiscretionaryCategory(cat: FinanceCategory | undefined, tx: FinanceTransaction): boolean {
  const slugOrName = `${cat?.slug || ''} ${cat?.name || ''} ${tx.title || ''} ${tx.subcategory || ''}`.toLowerCase();
  return (
    slugOrName.includes('food') ||
    slugOrName.includes('dining') ||
    slugOrName.includes('junk') ||
    slugOrName.includes('coffee') ||
    slugOrName.includes('entertainment') ||
    slugOrName.includes('shopping') ||
    slugOrName.includes('leisure') ||
    slugOrName.includes('snack') ||
    slugOrName.includes('alcohol')
  );
}

export function computeLifeOsAnalytics(input: LifeOsAggregatorInput): LifeOsAnalyticsSnapshot {
  const referenceDate = input.referenceDate ?? new Date();
  const window = getAnalyticsRangeWindow(input.range, referenceDate);

  const habitOnlyMode = Boolean(input.settings?.habitOnlyMode);
  const showFinance = isFinanceModuleEnabled(input.settings);
  const showFitness = isFitnessModuleEnabled(input.settings);
  const weights = computeNormalizedPillarWeights(showFinance, showFitness);

  // ============================================
  // 1. HABITS, TASKS, GOALS & MOOD
  // ============================================
  const habits = input.habits ?? [];
  const completions = input.completions ?? [];
  const goals = input.goals ?? [];
  const milestones = input.milestones ?? [];
  const tasks = input.tasks ?? [];
  const moodLogs = input.moodLogs ?? [];

  const activeHabits = habits.filter((h) => !h.archived);
  const startLocal = parseIsoAsLocalNoon(window.startDateStr);
  const endLocal = parseIsoAsLocalNoon(window.endDateStr);
  const prevStartLocal = parseIsoAsLocalNoon(window.prevStartDateStr);
  const prevEndLocal = parseIsoAsLocalNoon(window.prevEndDateStr);

  const dailyStats = calculateDailyStats(habits, completions, startLocal, endLocal);
  const prevDailyStats = calculateDailyStats(habits, completions, prevStartLocal, prevEndLocal);

  const totalCompletedInPeriod = dailyStats.reduce((sum, d) => sum + d.completedHabits, 0);
  const totalPossibleInPeriod = dailyStats.reduce((sum, d) => sum + d.totalHabits, 0);
  const completionRatePct =
    totalPossibleInPeriod > 0
      ? clampScore((totalCompletedInPeriod / totalPossibleInPeriod) * 100)
      : 0;

  const prevCompleted = prevDailyStats.reduce((sum, d) => sum + d.completedHabits, 0);
  const prevPossible = prevDailyStats.reduce((sum, d) => sum + d.totalHabits, 0);
  const prevCompletionRatePct =
    prevPossible > 0 ? clampScore((prevCompleted / prevPossible) * 100) : 0;

  const habitStreaks = activeHabits.map((h) => {
    const hComps = completions.filter((c) => c.habitId === h.id);
    return {
      current: calculateCurrentStreak(hComps, endLocal, h),
      best: calculateBestStreak(hComps, h),
    };
  });

  const currentBestActiveStreak =
    habitStreaks.length > 0 ? Math.max(0, ...habitStreaks.map((s) => s.current)) : 0;
  const allTimeBestStreak =
    habitStreaks.length > 0 ? Math.max(0, ...habitStreaks.map((s) => s.best)) : 0;

  const activeGoals = goals.filter((g) => g.status === 'in_progress' || g.status === 'not_started');
  const goalProgressList = activeGoals.map((goal) => ({
    goal,
    stats: calculateGoalStats(goal, milestones, endLocal),
  }));
  const onTrackGoalsCount = goalProgressList.filter((item) => item.stats.isOnTrack).length;

  const activeTasks = tasks.filter((t) => t.status !== 'archived');
  const completedTasksCount = activeTasks.filter((t) => t.status === 'done').length;
  const openTasksCount = activeTasks.filter((t) => t.status !== 'done').length;
  const overdueTasksCount = activeTasks.filter(
    (t) => t.status !== 'done' && t.due_date && t.due_date.slice(0, 10) < window.todayDateStr
  ).length;

  const moodScoreMap: Record<MoodLog['mood'], number> = {
    happy: 5,
    calm: 4,
    neutral: 3,
    sad: 2,
    stressed: 1,
  };
  const periodMoods = moodLogs.filter(
    (m) => m.date >= window.startDateStr && m.date <= window.endDateStr && m.mood in moodScoreMap
  );
  const avgMoodScore =
    periodMoods.length > 0
      ? Number(
          (
            periodMoods.reduce((s, m) => s + moodScoreMap[m.mood], 0) /
            periodMoods.length
          ).toFixed(1)
        )
      : null;

  const categoryBreakdown = calculateCategoryBreakdown(habits, completions);
  const heatmapData = generateHeatmapData(completions, habits, Math.min(365, Math.max(30, window.dayCount)));
  const momentum = calculateMomentum(completions, endLocal);

  const hasHabitData = activeHabits.length > 0 || totalCompletedInPeriod > 0 || activeTasks.length > 0;
  const taskCompletionPct =
    activeTasks.length > 0 ? (completedTasksCount / activeTasks.length) * 100 : completionRatePct;
  const habitsScore = hasHabitData
    ? clampScore(activeTasks.length > 0 ? completionRatePct * 0.8 + taskCompletionPct * 0.2 : completionRatePct)
    : 0;
  const prevHabitsScore = prevPossible > 0 ? prevCompletionRatePct : 0;

  // ============================================
  // 2. FINANCE
  // ============================================
  const accounts = (input.accounts ?? []).filter((a) => !a.deletedAt && !a.archived);
  const allTransactions = (input.transactions ?? []).filter((t) => !t.deletedAt);
  const categories = (input.categories ?? []).filter((c) => !c.deletedAt && !c.archived);
  const budgets = (input.budgets ?? []).filter((b) => !b.deletedAt);
  const commitments = (input.commitments ?? []).filter((c) => !c.deletedAt);
  const debtRecords = (input.debtRecords ?? []).filter((d) => !d.deletedAt);
  const debtInstallments = input.debtInstallments ?? [];
  const emiTrackers = (input.emiTrackers ?? []).filter((e) => !e.deletedAt);
  const sipPlans = (input.sipPlans ?? []).filter((s) => !s.deletedAt);
  const recurringBills = (input.recurringBills ?? []).filter((b) => !b.deletedAt);
  const creditCardStatements = (input.creditCardStatements ?? []).filter((s) => !s.deletedAt);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const periodTxs = showFinance
    ? allTransactions.filter((t) => t.date >= window.startDateStr && t.date <= window.endDateStr)
    : [];
  const prevPeriodTxs = showFinance
    ? allTransactions.filter((t) => t.date >= window.prevStartDateStr && t.date <= window.prevEndDateStr)
    : [];

  let totalIncome = 0;
  let totalExpense = 0;
  let totalInvestment = 0;
  let needsSpend = 0;
  let discretionarySpend = 0;
  const spendByCat = new Map<string, { amount: number; count: number }>();
  const cashflowByDate = new Map<string, { income: number; expense: number }>();

  for (const tx of periodTxs) {
    const amt = Number(tx.amount || 0);
    const dayEntry = cashflowByDate.get(tx.date) ?? { income: 0, expense: 0 };

    if (tx.type === 'income') {
      totalIncome += amt;
      dayEntry.income += amt;
    } else if (tx.type === 'expense') {
      totalExpense += amt;
      dayEntry.expense += amt;
      const cat = categoryMap.get(tx.categoryId);
      const catKey = tx.categoryId || 'uncategorized';
      const existing = spendByCat.get(catKey) ?? { amount: 0, count: 0 };
      spendByCat.set(catKey, { amount: existing.amount + amt, count: existing.count + 1 });
      if (isDiscretionaryCategory(cat, tx)) {
        discretionarySpend += amt;
      } else {
        needsSpend += amt;
      }
    } else if (tx.type === 'investment') {
      totalInvestment += amt;
    }

    cashflowByDate.set(tx.date, dayEntry);
  }

  const prevTotalExpense = prevPeriodTxs
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const expenseDeltaPct =
    prevTotalExpense > 0
      ? Math.round(((totalExpense - prevTotalExpense) / prevTotalExpense) * 100)
      : null;

  const netSavings = Math.round(totalIncome - totalExpense);
  const savingsRatePct =
    totalIncome > 0 ? clampScore(((totalIncome - totalExpense) / totalIncome) * 100) : 0;
  const dailyAvgBurn = Math.round(totalExpense / window.dayCount);

  const categorySpend = Array.from(spendByCat.entries())
    .map(([categoryId, stats]) => {
      const cat = categoryMap.get(categoryId);
      return {
        categoryId,
        name: cat?.name || 'Other',
        color: cat?.color || '#64748b',
        amount: Math.round(stats.amount),
        sharePct: totalExpense > 0 ? Math.round((stats.amount / totalExpense) * 100) : 0,
        budgetLimit: cat?.monthlyBudgetLimit ?? 0,
        transactionCount: stats.count,
        category: cat,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const dailyCashflow: FinanceAnalyticsSlice['dailyCashflow'] = [];
  for (let i = 0; i < window.dayCount; i++) {
    const d = shiftIsoDate(window.startDateStr, i);
    const entry = cashflowByDate.get(d) ?? { income: 0, expense: 0 };
    dailyCashflow.push({
      date: d,
      label: formatHumanDate(d),
      income: Math.round(entry.income),
      expense: Math.round(entry.expense),
      net: Math.round(entry.income - entry.expense),
    });
  }

  const netWorth = showFinance
    ? calculateNetWorthSummary({ accounts, sipPlans, debtRecords, emiTrackers })
    : {
        liquidAssets: 0,
        investmentAssets: 0,
        friendReceivables: 0,
        totalAssets: 0,
        creditCardLiabilities: 0,
        emiRemainingPrincipal: 0,
        friendPayables: 0,
        totalLiabilities: 0,
        netWorth: 0,
      };

  const monthlySummary: MonthlyFinanceSummary = showFinance
    ? calculateMonthlySummary({
        monthKey: window.monthKey,
        transactions: allTransactions,
        categories,
        budgets,
        commitments,
        emiTrackers,
        debtRecords,
        debtInstallments,
        recurringBills,
        sipPlans,
        referenceDate: window.todayDateStr,
      })
    : {
        monthKey: window.monthKey,
        totalIncome: 0,
        totalSpent: 0,
        totalInvested: 0,
        monthlyBudget: 0,
        expectedIncome: 0,
        remainingUnpaidEmis: 0,
        remainingUnpaidCommitments: 0,
        plannedDebtInstallmentsDue: 0,
        remainingUnpaidBills: 0,
        remainingPlannedSips: 0,
        safeToSpendMonthly: 0,
        safeToSpendDaily: 0,
        remainingDaysInMonth: 0,
        dayOfMonthProgressPct: 0,
        netSavings: 0,
        savingsRate: 0,
        needsReviewCount: 0,
        categoryBreakdown: [],
      };

  const debtSummary: DebtSummaryBreakdown = showFinance
    ? calculateDebtSummary(debtRecords)
    : {
        totalBorrowedRemaining: 0,
        totalLentRemaining: 0,
        netPosition: 0,
        plannedInstallmentsThisMonth: 0,
        activeBorrowedCount: 0,
        activeLentCount: 0,
        everydayBorrowedRemaining: 0,
        everydayLentRemaining: 0,
        everydayNetPosition: 0,
        longTermBorrowedRemaining: 0,
        longTermLentRemaining: 0,
        longTermNetPosition: 0,
      };

  const creditCards = showFinance
    ? accounts.filter((a) => a.type === 'credit_card')
    : [];
  const creditCardSummaries = creditCards.map((account) => ({
    account,
    summary: computeCreditCardSummary({
      account,
      transactions: allTransactions,
      persistedStatements: creditCardStatements,
      referenceDate: window.todayDateStr,
    }),
  }));

  const totalCardLimit = creditCardSummaries.reduce((sum, c) => sum + c.summary.creditLimit, 0);
  const totalCardOutstanding = creditCardSummaries.reduce((sum, c) => sum + c.summary.totalOutstanding, 0);
  const totalCardUtilizationPct =
    totalCardLimit > 0 ? clampScore((totalCardOutstanding / totalCardLimit) * 100) : 0;

  const upcomingObligations7d = showFinance
    ? calculateUpcomingFinancialObligations({
        emiTrackers,
        commitments,
        debtRecords,
        debtInstallments,
        recurringBills,
        sipPlans,
        transactions: allTransactions,
        currentDate: window.todayDateStr,
        withinDays: 7,
      })
    : [];

  const anomalies = showFinance
    ? detectSpendingAnomalies({
        selectedMonth: window.monthKey,
        transactions: allTransactions,
        categories,
        accounts,
        debtRecords,
        recurringBills,
        upcomingObligations7d,
      })
    : [];

  const forecast30d = showFinance
    ? buildCashFlowForecast({
        accounts,
        transactions: allTransactions,
        budgets,
        recurringBills,
        emiTrackers,
        sipPlans,
        commitments,
        creditCardStatements,
        horizonDays: 30,
        referenceDate: window.todayDateStr,
      })
    : {
        points: [],
        startingLiquidBalance: 0,
        endingProjectedBalance: 0,
        lowestProjectedBalance: 0,
        lowestBalanceDate: null,
        crunchDate: null,
        dailyDiscretionaryBurn: 0,
        estimatedMonthlyIncome: 0,
        paydayOfMonth: 1,
        totalScheduledOutflows: 0,
      };

  const hasFinanceData =
    showFinance && (periodTxs.length > 0 || accounts.length > 0 || budgets.length > 0);

  let financeScore = 0;
  if (hasFinanceData) {
    let rawScore = 65;
    if (totalIncome > 0) {
      rawScore = savingsRatePct >= 20 ? 85 : 55 + savingsRatePct * 1.5;
    } else if (monthlySummary.monthlyBudget > 0) {
      const usedPct = (monthlySummary.totalSpent / monthlySummary.monthlyBudget) * 100;
      rawScore = usedPct > 100 ? Math.max(20, 80 - (usedPct - 100)) : 85;
    }
    const criticalAlerts = anomalies.filter((a) => a.severity === 'critical').length;
    const overdueCards = creditCardSummaries.filter((c) => c.summary.overdueStatements.length > 0).length;
    rawScore -= criticalAlerts * 12 + overdueCards * 15;
    if (totalCardUtilizationPct > 50) rawScore -= 10;
    if (forecast30d.crunchDate) rawScore -= 10;
    financeScore = clampScore(rawScore);
  }

  // ============================================
  // 3. FITNESS
  // ============================================
  const profile = input.fitnessProfile ?? null;
  const allDailyLogs = (input.dailyLogs ?? []).filter((l) => !l.deletedAt);
  const allMealLogs = (input.mealLogs ?? []).filter((m) => !m.deletedAt);
  const allWorkouts = (input.workoutSessions ?? []).filter((w) => !w.deletedAt);
  const supplementInventory = (input.supplementInventory ?? []).filter((s) => !s.deletedAt);
  const supplementLogs = (input.supplementLogs ?? []).filter((s) => !s.deletedAt);

  const calorieTarget = profile?.calorieTarget ?? 2000;
  const proteinTargetG = profile?.proteinTargetG ?? 140;
  const stepsTarget = profile?.stepsTarget ?? 8000;
  const sleepTargetHours = profile?.sleepTargetHours ?? 7.5;

  const periodDailyLogs = showFitness
    ? allDailyLogs.filter((l) => l.date >= window.startDateStr && l.date <= window.endDateStr)
    : [];
  const periodMeals = showFitness
    ? allMealLogs.filter((m) => m.date >= window.startDateStr && m.date <= window.endDateStr)
    : [];
  const periodWorkouts = showFitness
    ? allWorkouts.filter((w) => w.date >= window.startDateStr && w.date <= window.endDateStr)
    : [];

  const rollingWeight = showFitness
    ? calculate7DayRollingWeight(allDailyLogs, Math.max(14, window.dayCount))
    : { points: [], latestWeightKg: null, latestRollingAvgKg: null, weeklyDeltaKg: null };

  const waistTrend = showFitness
    ? calculateWeeklyWaistTrend(allDailyLogs, 12)
    : { points: [], latestWaistInches: null, startingWaistInches: null, totalDeltaInches: null };

  const supplementRoi = showFitness
    ? calculateSupplementStockAndRoi(supplementInventory, supplementLogs, window.todayDateStr)
    : { items: [], lowStockItems: [], totalMonthlySpendInr: 0, proteinBenchmarks: [] };

  const mealsByDate = new Map<string, { calories: number; proteinG: number; junkCount: number }>();
  for (const meal of periodMeals) {
    const cur = mealsByDate.get(meal.date) ?? { calories: 0, proteinG: 0, junkCount: 0 };
    cur.calories += Number(meal.calories || 0);
    cur.proteinG += Number(meal.proteinG || 0);
    if (meal.isJunk) cur.junkCount += 1;
    mealsByDate.set(meal.date, cur);
  }

  const dailyLogByDate = new Map(periodDailyLogs.map((l) => [l.date, l]));
  const mealDatesCount = mealsByDate.size;
  const totalPeriodCalories = Array.from(mealsByDate.values()).reduce((s, d) => s + d.calories, 0);
  const totalPeriodProtein = Array.from(mealsByDate.values()).reduce((s, d) => s + d.proteinG, 0);
  const junkMealCount = Array.from(mealsByDate.values()).reduce((s, d) => s + d.junkCount, 0);

  const avgCalories = mealDatesCount > 0 ? Math.round(totalPeriodCalories / mealDatesCount) : 0;
  const avgProteinG = mealDatesCount > 0 ? Math.round(totalPeriodProtein / mealDatesCount) : 0;

  const calorieAdherencePct =
    mealDatesCount > 0 && calorieTarget > 0
      ? clampScore(100 - (Math.abs(avgCalories - calorieTarget) / calorieTarget) * 100)
      : 0;
  const proteinAdherencePct =
    mealDatesCount > 0 && proteinTargetG > 0
      ? clampScore((avgProteinG / proteinTargetG) * 100)
      : 0;

  const stepLogs = periodDailyLogs.filter((l) => l.steps > 0);
  const avgSteps =
    stepLogs.length > 0
      ? Math.round(stepLogs.reduce((s, l) => s + l.steps, 0) / stepLogs.length)
      : 0;

  const sleepLogs = periodDailyLogs.filter((l) => typeof l.sleepHours === 'number' && (l.sleepHours ?? 0) > 0);
  const avgSleepHours =
    sleepLogs.length > 0
      ? Number(
          (sleepLogs.reduce((s, l) => s + Number(l.sleepHours || 0), 0) / sleepLogs.length).toFixed(1)
        )
      : null;

  const totalWorkoutMinutes = periodWorkouts.reduce((s, w) => s + Number(w.durationMinutes || 0), 0);
  const totalVolumeKg = Math.round(
    periodWorkouts.reduce(
      (sum, w) =>
        sum +
        (w.exercises || []).reduce(
          (exSum, ex) =>
            exSum +
            (ex.sets || [])
              .filter((s) => !s.isWarmup)
              .reduce((sSum, s) => sSum + Number(s.weightKg || 0) * Number(s.reps || 0), 0),
          0
        ),
      0
    )
  );

  // Avg energy across period daily logs
  const energyLogs = periodDailyLogs.filter(
    (l) => typeof l.energyLevel === 'number' && (l.energyLevel ?? 0) > 0
  );
  const avgEnergyLevel =
    energyLogs.length > 0
      ? Number(
          (energyLogs.reduce((s, l) => s + Number(l.energyLevel || 0), 0) / energyLogs.length).toFixed(1)
        )
      : null;

  // Consecutive junk-free days ending at todayDateStr (requires meal log OR junkFreeOverride)
  const junkDates = new Set(allMealLogs.filter((m) => m.isJunk).map((m) => m.date));
  const loggedCleanDates = new Set([
    ...allMealLogs.filter((m) => !m.isJunk).map((m) => m.date),
    ...allDailyLogs.filter((l) => l.junkFreeOverride).map((l) => l.date),
  ]);
  let junkFreeStreakDays = 0;
  for (let i = 0; i < 60; i++) {
    const d = shiftIsoDate(window.todayDateStr, -i);
    if (junkDates.has(d)) break;
    if (loggedCleanDates.has(d)) {
      junkFreeStreakDays += 1;
    } else if (i === 0) {
      // Allow today to not be logged yet if yesterday was clean
      continue;
    } else {
      break;
    }
  }

  // Workout type split
  const workoutTypeMap = new Map<string, { count: number; minutes: number }>();
  for (const w of periodWorkouts) {
    const t = w.workoutType || 'strength';
    const cur = workoutTypeMap.get(t) ?? { count: 0, minutes: 0 };
    cur.count += 1;
    cur.minutes += Number(w.durationMinutes || 0);
    workoutTypeMap.set(t, cur);
  }
  const workoutTypeBreakdown = Array.from(workoutTypeMap.entries())
    .map(([type, stat]) => ({ type, count: stat.count, minutes: stat.minutes }))
    .sort((a, b) => b.count - a.count);

  // Top 4 progressive overload hints from recent sessions
  const overloadHints: ProgressiveOverloadHint[] = [];
  if (showFitness) {
    const seenExercises = new Set<string>();
    const recentWorkouts = allWorkouts
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
    for (const w of recentWorkouts) {
      for (const ex of w.exercises || []) {
        const key = ex.name.trim().toLowerCase();
        if (!key || seenExercises.has(key)) continue;
        seenExercises.add(key);
        const hint = getProgressiveOverloadHint(allWorkouts, ex.name);
        if (hint) overloadHints.push(hint);
        if (overloadHints.length >= 4) break;
      }
      if (overloadHints.length >= 4) break;
    }
  }

  const activeFitnessDates = new Set<string>([
    ...periodDailyLogs.map((l) => l.date),
    ...periodMeals.map((m) => m.date),
    ...periodWorkouts.map((w) => w.date),
  ]);
  const daysLogged = activeFitnessDates.size;

  const dailyFuelSeries: FitnessAnalyticsSlice['dailyFuelSeries'] = [];
  for (let i = 0; i < window.dayCount; i++) {
    const d = shiftIsoDate(window.startDateStr, i);
    const meal = mealsByDate.get(d);
    const log = dailyLogByDate.get(d);
    dailyFuelSeries.push({
      date: d,
      label: formatHumanDate(d),
      calories: Math.round(meal?.calories ?? 0),
      proteinG: Math.round(meal?.proteinG ?? 0),
      steps: Math.round(log?.steps ?? 0),
      sleepHours: log?.sleepHours ?? null,
    });
  }

  const hasFitnessData =
    showFitness &&
    (daysLogged > 0 || allDailyLogs.some((l) => typeof l.weightKg === 'number' || typeof l.waistInches === 'number'));

  let fitnessScore = 0;
  if (hasFitnessData) {
    const components: number[] = [];
    if (mealDatesCount > 0) {
      components.push(proteinAdherencePct);
      components.push(calorieAdherencePct);
    }
    if (stepLogs.length > 0 && stepsTarget > 0) {
      components.push(clampScore((avgSteps / stepsTarget) * 100));
    }
    if (periodWorkouts.length > 0) {
      const targetWorkouts = Math.max(1, Math.round((window.dayCount / 7) * 3));
      components.push(clampScore((periodWorkouts.length / targetWorkouts) * 100));
    }
    fitnessScore =
      components.length > 0
        ? clampScore(components.reduce((sum, v) => sum + v, 0) / components.length)
        : 50;
  }

  // ============================================
  // 4. COMPOSITE LIFE OS SCORE & CROSS-DOMAIN
  // ============================================
  const lifeOsScore = clampScore(
    (habitsScore * weights.habitsPct +
      financeScore * weights.financePct +
      fitnessScore * weights.fitnessPct) /
      100
  );

  const previousLifeOsScore = clampScore(
    (prevHabitsScore * weights.habitsPct +
      financeScore * weights.financePct +
      fitnessScore * weights.fitnessPct) /
      100
  );

  const report = computeCrossDomainInsights({
    todayDate: window.todayDateStr,
    transactions: showFinance ? allTransactions : [],
    categories: showFinance ? categories : [],
    debtRecords: showFinance ? debtRecords : [],
    mealLogs: showFitness ? allMealLogs : [],
    workoutSessions: showFitness ? allWorkouts : [],
    fitnessDailyLogs: showFitness ? allDailyLogs : [],
    supplementInventory: showFitness ? supplementInventory : [],
    supplementLogs: showFitness ? supplementLogs : [],
    habits,
    habitCompletions: completions,
    moodLogs,
  });

  const alerts = report.alerts.filter((alert) => {
    if (!showFinance) {
      return false;
    }
    if (
      !showFitness &&
      (alert.pillar === 'wallet_waistline' ||
        alert.pillar === 'gym_supplement_roi' ||
        alert.pillar === 'social_spend_diet')
    ) {
      return false;
    }
    return true;
  });

  // Compute Habit Consistency vs Daily Outflow correlation over the selected window
  const cashflowByDateMap = new Map(dailyCashflow.map((d) => [d.date, d.expense]));
  let highHabitDaysCount = 0;
  let lowHabitDaysCount = 0;
  let highHabitSpendSum = 0;
  let lowHabitSpendSum = 0;

  if (showFinance) {
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
  }

  const highHabitAvgSpendInr =
    highHabitDaysCount > 0 ? Math.round(highHabitSpendSum / highHabitDaysCount) : 0;
  const lowHabitAvgSpendInr =
    lowHabitDaysCount > 0 ? Math.round(lowHabitSpendSum / lowHabitDaysCount) : 0;
  const hasEnoughHabitSpendData =
    showFinance && highHabitDaysCount >= 2 && lowHabitDaysCount >= 2;
  const habitSpendCorrelation: HabitSpendCorrelation = {
    hasEnoughData: hasEnoughHabitSpendData,
    highHabitDaysCount,
    lowHabitDaysCount,
    highHabitAvgSpendInr,
    lowHabitAvgSpendInr,
    dailySavingsDeltaInr: hasEnoughHabitSpendData
      ? lowHabitAvgSpendInr - highHabitAvgSpendInr
      : 0,
  };

  return {
    window,
    modules: {
      showHabits: true,
      showFinance,
      showFitness,
      habitOnlyMode,
    },
    lifeOsScore,
    previousLifeOsScore,
    lifeOsScoreDelta: lifeOsScore - previousLifeOsScore,
    weights,
    habits: {
      hasData: hasHabitData,
      score: habitsScore,
      previousScore: prevHabitsScore,
      scoreDelta: habitsScore - prevHabitsScore,
      activeHabitsCount: activeHabits.length,
      completionRatePct,
      prevCompletionRatePct,
      completionRateDeltaPct: completionRatePct - prevCompletionRatePct,
      periodCompletions: totalCompletedInPeriod,
      currentBestActiveStreak,
      allTimeBestStreak,
      momentum,
      activeGoalsCount: activeGoals.length,
      onTrackGoalsCount,
      completedTasksCount,
      openTasksCount,
      overdueTasksCount,
      avgMoodScore,
      dailyStats,
      categoryBreakdown,
      heatmapData,
      goalProgressList,
    },
    finance: {
      enabled: showFinance,
      hasData: hasFinanceData,
      score: financeScore,
      totalIncome: Math.round(totalIncome),
      totalExpense: Math.round(totalExpense),
      totalInvestment: Math.round(totalInvestment),
      netSavings,
      savingsRatePct,
      prevTotalExpense: Math.round(prevTotalExpense),
      expenseDeltaPct,
      dailyAvgBurn,
      needsSpend: Math.round(needsSpend),
      discretionarySpend: Math.round(discretionarySpend),
      categorySpend,
      dailyCashflow,
      netWorth,
      monthlySummary,
      debtSummary,
      creditCardSummaries,
      totalCardUtilizationPct,
      upcomingObligations7d,
      anomalies,
      forecast30d,
    },
    fitness: {
      enabled: showFitness,
      hasData: hasFitnessData,
      score: fitnessScore,
      daysLogged,
      latestWeightKg: rollingWeight.latestWeightKg,
      latestRollingAvgKg: rollingWeight.latestRollingAvgKg,
      weeklyWeightDeltaKg: rollingWeight.weeklyDeltaKg,
      latestWaistInches: waistTrend.latestWaistInches,
      totalWaistDeltaInches: waistTrend.totalDeltaInches,
      avgCalories,
      calorieTarget,
      calorieAdherencePct,
      avgProteinG,
      proteinTargetG,
      proteinAdherencePct,
      avgSteps,
      stepsTarget,
      avgSleepHours,
      sleepTargetHours,
      workoutCount: periodWorkouts.length,
      totalWorkoutMinutes,
      totalVolumeKg,
      junkMealCount,
      junkFreeStreakDays,
      avgEnergyLevel,
      workoutTypeBreakdown,
      overloadHints,
      rollingWeight,
      waistTrend,
      dailyFuelSeries,
      supplementRoi,
    },
    intelligence: {
      report,
      alerts,
      habitSpendCorrelation,
    },
  };
}
