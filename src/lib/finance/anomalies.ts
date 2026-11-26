import type {
  DebtRecord,
  EmiTracker,
  FinanceAccount,
  FinanceAnomalyAlert,
  FinanceCategory,
  FinanceRecurringBill,
  FinanceSipPlan,
  FinanceTransaction,
  FinancialObligationItem,
  FitnessDailyLog,
  FitnessProfile,
  Habit,
  HabitCompletion,
  MealLog,
  MoodLog,
  MonthlyFinanceSummary,
  NetWorthSummary,
  SupplementInventory,
  SupplementLog,
  WorkoutSession,
} from '@/lib/types';
import { addDays, normalizeIsoDate } from '@/lib/finance/credit-card-cycles';
import { calculate7DayRollingWeight } from '@/lib/fitness/shared-analytics';
import { computeCrossDomainInsights } from '@/lib/intelligence/cross-domain-insights';
import { getIstIsoDate } from '@/lib/mcp/config';

function shiftMonthKey(monthKey: string, delta: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const d = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysSinceIsoDate(isoDate: string): number {
  const parsed = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  if (isNaN(parsed.getTime())) return 0;
  const diffMs = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export interface AnomalyDetectionInput {
  selectedMonth: string;
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  debtRecords: DebtRecord[];
  recurringBills: FinanceRecurringBill[];
  upcomingObligations7d: FinancialObligationItem[];
}

/**
 * Pure deterministic engine surfacing actionable personal finance anomalies:
 * - Category spend spikes (>30% above trailing 3-month pace)
 * - Subscription/bill price hikes
 * - Unsettled friend debts older than 14 days
 * - Unreviewed transaction backlog (>= 3 items)
 * - Short-term liquid cash crunch (next 7d dues > liquid balance)
 */
function aggregateCategorySpends(selectedMonth: string, activeTxs: FinanceTransaction[]) {
  const prevMonths = [shiftMonthKey(selectedMonth, -1), shiftMonthKey(selectedMonth, -2), shiftMonthKey(selectedMonth, -3)];
  const currentByCat = new Map<string, number>();
  const trailingByCat = new Map<string, Map<string, number>>();

  for (const tx of activeTxs) {
    if (tx.type !== 'expense') continue;
    if (tx.monthKey === selectedMonth) {
      currentByCat.set(tx.categoryId, (currentByCat.get(tx.categoryId) || 0) + tx.amount);
    } else if (prevMonths.includes(tx.monthKey)) {
      const mMap = trailingByCat.get(tx.categoryId) || new Map<string, number>();
      mMap.set(tx.monthKey, (mMap.get(tx.monthKey) || 0) + tx.amount);
      trailingByCat.set(tx.categoryId, mMap);
    }
  }
  return { currentByCat, trailingByCat };
}

function getCurrentMonthElapsedFraction(selectedMonth: string): number {
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (selectedMonth !== currentMonthKey) return 1;
  const daysInMonth = new Date(parseInt(selectedMonth.slice(0, 4), 10), parseInt(selectedMonth.slice(5, 7), 10), 0).getDate();
  return Math.max(0.2, today.getDate() / daysInMonth);
}

interface SpikeCandidate {
  catName: string;
  pct: number;
  current: number;
  expected: number;
}

function evaluateCategorySpike(params: {
  catId: string;
  currentSpent: number;
  histMap: Map<string, number> | undefined;
  elapsedFraction: number;
  categories: FinanceCategory[];
}): SpikeCandidate | null {
  const { catId, currentSpent, histMap, elapsedFraction, categories } = params;
  if (currentSpent < 1000 || !histMap) return null;
  if (histMap.size === 0) return null;
  const histValues = Array.from(histMap.values());
  const expectedAtPace = (histValues.reduce((s, v) => s + v, 0) / histValues.length) * elapsedFraction;
  if (expectedAtPace < 500) return null;

  const pct = Math.round(((currentSpent - expectedAtPace) / expectedAtPace) * 100);
  if (pct < 30) return null;
  const cat = categories.find((c) => c.id === catId);
  return { catName: cat?.name || 'Category', pct, current: Math.round(currentSpent), expected: Math.round(expectedAtPace) };
}

function detectCategorySpikeAlert(
  selectedMonth: string,
  activeTxs: FinanceTransaction[],
  categories: FinanceCategory[]
): FinanceAnomalyAlert | null {
  const elapsedFraction = getCurrentMonthElapsedFraction(selectedMonth);
  const { currentByCat, trailingByCat } = aggregateCategorySpends(selectedMonth, activeTxs);
  let topSpike: SpikeCandidate | null = null;

  for (const [catId, currentSpent] of currentByCat.entries()) {
    const candidate = evaluateCategorySpike({
      catId,
      currentSpent,
      histMap: trailingByCat.get(catId),
      elapsedFraction,
      categories,
    });
    if (!candidate) continue;
    if (!topSpike || candidate.pct > topSpike.pct) topSpike = candidate;
  }

  if (!topSpike) return null;
  return {
    id: `spike-${topSpike.catName}`,
    severity: topSpike.pct >= 60 ? 'critical' : 'warning',
    kind: 'category_spike',
    title: `${topSpike.catName} up +${topSpike.pct}% vs pace`,
    description: `Spent ₹${topSpike.current.toLocaleString('en-IN')} so far vs typical ₹${topSpike.expected.toLocaleString('en-IN')} at this point in the month.`,
    amount: topSpike.current - topSpike.expected,
    actionLabel: 'Inspect Activity',
    actionTarget: 'activity',
  };
}

function detectCashCrunchAlert(accounts: FinanceAccount[], upcomingObligations7d: FinancialObligationItem[]): FinanceAnomalyAlert | null {
  const liquidTypes = new Set(['bank', 'upi', 'cash', 'wallet']);
  const liquidBalance = accounts
    .filter((a) => !a.archived && !a.deletedAt && liquidTypes.has(a.type))
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const pending7dTotal = upcomingObligations7d
    .filter((o) => o.status === 'pending')
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const hasLiquidityGap = pending7dTotal > 0 && liquidBalance > 0 && pending7dTotal > liquidBalance;
  if (!hasLiquidityGap) return null;

  return {
    id: 'cash-crunch-7d',
    severity: 'critical',
    kind: 'cash_crunch',
    title: 'Upcoming 7-day bills exceed liquid balance',
    description: `₹${Math.round(pending7dTotal).toLocaleString('en-IN')} due within 7 days against ₹${Math.round(liquidBalance).toLocaleString('en-IN')} across liquid accounts.`,
    amount: Math.round(pending7dTotal - liquidBalance),
    actionLabel: 'View Bills',
    actionTarget: 'trackers',
  };
}

function detectSubscriptionHikeAlert(recurringBills: FinanceRecurringBill[]): FinanceAnomalyAlert | null {
  const hikedBills = recurringBills.filter((b) => b.isActive && !b.deletedAt && b.previousAmount && b.amount > b.previousAmount);
  if (hikedBills.length === 0) return null;
  const first = hikedBills[0];
  const diff = Math.round(first.amount - (first.previousAmount || 0));
  return {
    id: `sub-hike-${first.id}`,
    severity: 'warning',
    kind: 'subscription_hike',
    title: `${first.name} increased by ₹${diff.toLocaleString('en-IN')}`,
    description:
      hikedBills.length > 1
        ? `${hikedBills.length} recurring bills increased in price compared to previous billing.`
        : `Moved from ₹${Math.round(first.previousAmount || 0).toLocaleString('en-IN')} to ₹${Math.round(first.amount).toLocaleString('en-IN')}.`,
    amount: diff,
    actionLabel: 'Audit Subscriptions',
    actionTarget: 'trackers',
  };
}

function detectIdleDebtAlert(debtRecords: DebtRecord[]): FinanceAnomalyAlert | null {
  const idleDebts = debtRecords.filter(
    (d) => !d.deletedAt && d.status === 'active' && d.remainingAmount > 0 && daysSinceIsoDate(d.updatedAt || d.startDate) >= 14
  );
  if (idleDebts.length === 0) return null;
  const totalIdle = Math.round(idleDebts.reduce((sum, d) => sum + Number(d.remainingAmount || 0), 0));
  const lentCount = idleDebts.filter((d) => d.direction === 'lent').length;
  return {
    id: 'idle-friend-balances',
    severity: 'info',
    kind: 'idle_friend_debt',
    title: `${idleDebts.length} friend ${idleDebts.length === 1 ? 'balance' : 'balances'} idle 14+ days`,
    description:
      lentCount > 0
        ? `₹${totalIdle.toLocaleString('en-IN')} still open (${lentCount} receivable). Consider sending a quick settle reminder.`
        : `₹${totalIdle.toLocaleString('en-IN')} in open friend repayments untouched for 2+ weeks.`,
    amount: totalIdle,
    actionLabel: 'Open Friends Ledger',
    actionTarget: 'trackers',
  };
}

export function detectSpendingAnomalies(input: AnomalyDetectionInput): FinanceAnomalyAlert[] {
  const activeTxs = input.transactions.filter((t) => !t.deletedAt);
  const needsReviewCount = activeTxs.filter((t) => t.needsReview).length;
  const reviewAlert: FinanceAnomalyAlert | null =
    needsReviewCount >= 3
      ? {
          id: 'needs-review-backlog',
          severity: 'info',
          kind: 'review_backlog',
          title: `${needsReviewCount} transactions waiting for review`,
          description: 'Approve auto-imported SMS or receipt entries to keep category analytics accurate.',
          amount: needsReviewCount,
          actionLabel: 'Triage Inbox',
          actionTarget: 'activity',
        }
      : null;

  return [
    detectCategorySpikeAlert(input.selectedMonth, activeTxs, input.categories),
    detectCashCrunchAlert(input.accounts, input.upcomingObligations7d),
    detectSubscriptionHikeAlert(input.recurringBills),
    detectIdleDebtAlert(input.debtRecords),
    reviewAlert,
  ]
    .filter((a): a is FinanceAnomalyAlert => a !== null)
    .slice(0, 4);
}

/**
 * Builds a privacy-safe aggregated snapshot of local Dexie finance state
 * for the server-side "Ask My Finances" AI Q&A route.
 */
export interface LifeOsQAContextInput {
  todayDate?: string;
  fitnessProfile?: FitnessProfile | null;
  fitnessDailyLogs?: FitnessDailyLog[];
  mealLogs?: MealLog[];
  workoutSessions?: WorkoutSession[];
  supplementInventory?: SupplementInventory[];
  supplementLogs?: SupplementLog[];
  habits?: Habit[];
  habitCompletions?: HabitCompletion[];
  moodLogs?: MoodLog[];
}

function avgNumericField(logs: FitnessDailyLog[], pick: (l: FitnessDailyLog) => number | undefined | null, decimals = 1): number | null {
  const valid = logs.map(pick).filter((v): v is number => typeof v === 'number' && v > 0);
  if (valid.length === 0) return null;
  const factor = Math.pow(10, decimals);
  return Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * factor) / factor;
}

function buildTopMerchantsAndTrailing(activeTxs: FinanceTransaction[], selectedMonth: string, categories: FinanceCategory[]) {
  const monthTxs = activeTxs.filter((t) => t.monthKey === selectedMonth);
  const merchantTotals = new Map<string, { spent: number; count: number; category: string }>();
  for (const tx of monthTxs) {
    if (tx.type !== 'expense') continue;
    const key = (tx.merchantName || tx.title || 'Unknown').trim();
    const catName = categories.find((c) => c.id === tx.categoryId)?.name || 'Other';
    const curr = merchantTotals.get(key) || { spent: 0, count: 0, category: catName };
    curr.spent += tx.amount;
    curr.count += 1;
    merchantTotals.set(key, curr);
  }
  const topMerchants = Array.from(merchantTotals.entries())
    .sort((a, b) => b[1].spent - a[1].spent)
    .slice(0, 12)
    .map(([merchant, stats]) => ({ merchant, spent: Math.round(stats.spent), count: stats.count, category: stats.category }));

  const trailingMonths = [0, -1, -2].map((delta) => {
    const mk = shiftMonthKey(selectedMonth, delta);
    const mTxs = activeTxs.filter((t) => t.monthKey === mk);
    const sumByType = (type: string) => Math.round(mTxs.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0));
    return { monthKey: mk, income: sumByType('income'), spent: sumByType('expense'), invested: sumByType('investment') };
  });

  return { topMerchants, trailingMonths };
}

function buildRecentTransactionsSnapshot(
  activeTxs: FinanceTransaction[],
  categories: FinanceCategory[],
  accounts: FinanceAccount[]
) {
  const categoriesById = new Map(categories.map((c) => [c.id, c.name]));
  const accountsById = new Map(accounts.map((a) => [a.id, a.name]));
  return [...activeTxs]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 25)
    .map((tx) => ({
      date: tx.date,
      title: tx.title,
      merchant: tx.merchantName || tx.title,
      amount: Math.round(tx.amount),
      type: tx.type,
      category: categoriesById.get(tx.categoryId) || 'Other',
      account: accountsById.get(tx.accountId) || 'Account',
      tags: Array.isArray(tx.tags) ? tx.tags : [],
    }));
}

function filterActiveLogs<T extends { deletedAt?: string | null }>(items?: T[]): T[] {
  return (items || []).filter((item) => !item.deletedAt);
}

function buildFitnessTelemetrySnapshot(
  logs14d: FitnessDailyLog[],
  fLogs: FitnessDailyLog[],
  workouts30dCount: number,
  profile?: FitnessProfile | null
) {
  const weightTrend = calculate7DayRollingWeight(fLogs);
  return {
    avgSleepHours14d: avgNumericField(logs14d, (l) => l.sleepHours, 1),
    avgEnergy14d: avgNumericField(logs14d, (l) => l.energyLevel, 1),
    avgSteps14d: avgNumericField(logs14d, (l) => l.steps, 0),
    workouts30dCount,
    rollingWeightKg: weightTrend.latestRollingAvgKg,
    weeklyWeightDeltaKg: weightTrend.weeklyDeltaKg,
    calorieTarget: profile?.calorieTarget ?? null,
    proteinTargetG: profile?.proteinTargetG ?? null,
  };
}

function computeCrossDomainForQA(params: {
  todayIso: string;
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  debtRecords: DebtRecord[];
  fLogs: FitnessDailyLog[];
  fitness?: LifeOsQAContextInput;
}) {
  const { todayIso, transactions, categories, debtRecords, fLogs, fitness } = params;
  return computeCrossDomainInsights({
    todayDate: todayIso,
    transactions,
    categories,
    debtRecords,
    mealLogs: filterActiveLogs(fitness?.mealLogs),
    workoutSessions: filterActiveLogs(fitness?.workoutSessions),
    fitnessDailyLogs: fLogs,
    supplementInventory: filterActiveLogs(fitness?.supplementInventory),
    supplementLogs: filterActiveLogs(fitness?.supplementLogs),
    habits: fitness?.habits || [],
    habitCompletions: fitness?.habitCompletions || [],
    moodLogs: fitness?.moodLogs || [],
  });
}

function buildLifeOsQAContext(
  transactions: FinanceTransaction[],
  categories: FinanceCategory[],
  debtRecords: DebtRecord[],
  fitness?: LifeOsQAContextInput
) {
  const todayIso = normalizeIsoDate(fitness?.todayDate || getIstIsoDate()) || getIstIsoDate();
  const window14Start = addDays(todayIso, -13);
  const fLogs = filterActiveLogs(fitness?.fitnessDailyLogs);
  const logs14d = fLogs.filter((l) => {
    const d = normalizeIsoDate(l.date);
    return d >= window14Start && d <= todayIso;
  });
  const crossDomain = computeCrossDomainForQA({ todayIso, transactions, categories, debtRecords, fLogs, fitness });

  return {
    todayDate: todayIso,
    fitnessTelemetry: buildFitnessTelemetrySnapshot(
      logs14d,
      fLogs,
      crossDomain.gymSupplementRoi.workouts30dCount,
      fitness?.fitnessProfile
    ),
    crossDomain: {
      walletWaistline: crossDomain.walletWaistline,
      gymSupplementRoi: crossDomain.gymSupplementRoi,
      triggers: crossDomain.triggers,
      socialSpendDiet: crossDomain.socialSpendDiet,
      alerts: crossDomain.alerts,
    },
  };
}

function formatSummaryAndNetWorth(summary: MonthlyFinanceSummary, netWorth: NetWorthSummary) {
  return {
    monthlySummary: {
      totalIncome: Math.round(summary.totalIncome),
      totalSpent: Math.round(summary.totalSpent),
      totalInvested: Math.round(summary.totalInvested),
      monthlyBudget: Math.round(summary.monthlyBudget),
      safeToSpendMonthly: Math.round(summary.safeToSpendMonthly),
      safeToSpendDaily: Math.round(summary.safeToSpendDaily),
      remainingDaysInMonth: summary.remainingDaysInMonth,
      savingsRatePct: Math.round(summary.savingsRate),
      remainingUnpaidBills: Math.round(summary.remainingUnpaidBills),
      remainingUnpaidEmis: Math.round(summary.remainingUnpaidEmis),
      remainingUnpaidCommitments: Math.round(summary.remainingUnpaidCommitments),
      needsReviewCount: summary.needsReviewCount,
    },
    netWorth: {
      netWorth: Math.round(netWorth.netWorth),
      liquidAssets: Math.round(netWorth.liquidAssets),
      investmentAssets: Math.round(netWorth.investmentAssets),
      totalLiabilities: Math.round(netWorth.totalLiabilities),
      creditCardLiabilities: Math.round(netWorth.creditCardLiabilities),
      emiRemainingPrincipal: Math.round(netWorth.emiRemainingPrincipal),
    },
  };
}

function mapBillsForQA(recurringBills: FinanceRecurringBill[]) {
  return recurringBills
    .filter((b) => b.isActive && !b.deletedAt)
    .map((b) => ({
      name: b.name,
      amount: Math.round(b.amount),
      cadence: b.cadence,
      dueDay: b.dueDayOfMonth,
      annualized: Math.round(b.cadence === 'yearly' ? b.amount : b.cadence === 'quarterly' ? b.amount * 4 : b.amount * 12),
    }));
}

function mapEmisAndSipsForQA(emiTrackers: EmiTracker[], sipPlans: FinanceSipPlan[]) {
  return {
    activeEmis: emiTrackers
      .filter((e) => e.status === 'active' && !e.deletedAt)
      .map((e) => ({ name: e.loanName, emiAmount: Math.round(e.emiAmount), remainingMonths: Math.max(0, e.tenureMonths - e.paidMonths), interestRate: e.interestRateAnnual })),
    activeSips: sipPlans
      .filter((s) => s.isActive && !s.deletedAt)
      .map((s) => ({ name: s.name, monthlyAmount: Math.round(s.monthlyAmount), totalInvested: Math.round(s.totalInvested), currentValue: Math.round(s.currentValue) })),
  };
}

function mapAccountsAndObligationsForQA(params: {
  accounts: FinanceAccount[];
  recurringBills: FinanceRecurringBill[];
  emiTrackers: EmiTracker[];
  sipPlans: FinanceSipPlan[];
  debtRecords: DebtRecord[];
}) {
  const { accounts, recurringBills, emiTrackers, sipPlans, debtRecords } = params;
  return {
    accounts: accounts
      .filter((a) => !a.archived && !a.deletedAt)
      .map((a) => ({ name: a.name, type: a.type, balance: Math.round(a.balance), creditLimit: a.creditLimit || null, isDefault: Boolean(a.isDefault) })),
    recurringBills: mapBillsForQA(recurringBills),
    ...mapEmisAndSipsForQA(emiTrackers, sipPlans),
    openFriendDebts: debtRecords
      .filter((d) => d.status === 'active' && !d.deletedAt && d.remainingAmount > 0)
      .map((d) => ({ person: d.personName, direction: d.direction, remaining: Math.round(d.remainingAmount) })),
  };
}

export function buildFinanceQAContext(params: {
  selectedMonth: string;
  summary: MonthlyFinanceSummary;
  netWorth: NetWorthSummary;
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  recurringBills: FinanceRecurringBill[];
  emiTrackers: EmiTracker[];
  sipPlans: FinanceSipPlan[];
  debtRecords: DebtRecord[];
  anomalies: FinanceAnomalyAlert[];
  fitness?: LifeOsQAContextInput;
}) {
  const { selectedMonth, summary, netWorth, transactions, categories, accounts, recurringBills, emiTrackers, sipPlans, debtRecords, anomalies, fitness } = params;
  const activeTxs = transactions.filter((t) => !t.deletedAt);
  const { topMerchants, trailingMonths } = buildTopMerchantsAndTrailing(activeTxs, selectedMonth, categories);

  return {
    currency: 'INR',
    selectedMonth,
    ...formatSummaryAndNetWorth(summary, netWorth),
    categories: summary.categoryBreakdown.map((item) => ({
      name: item.category.name,
      spent: Math.round(item.spent),
      budgetLimit: Math.round(item.budgetLimit),
      transactionCount: item.transactionCount,
      status: item.status,
    })),
    ...mapAccountsAndObligationsForQA({ accounts, recurringBills, emiTrackers, sipPlans, debtRecords }),
    topMerchants,
    recentTransactions: buildRecentTransactionsSnapshot(activeTxs, categories, accounts),
    trailingMonths,
    anomalies: anomalies.map((a) => ({ severity: a.severity, title: a.title, description: a.description })),
    lifeOs: buildLifeOsQAContext(transactions, categories, debtRecords, fitness),
  };
}
