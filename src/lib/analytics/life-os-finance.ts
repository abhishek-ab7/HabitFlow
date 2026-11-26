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
import type { DebtSummaryBreakdown, FinanceCategory, FinanceTransaction, MonthlyFinanceSummary } from '@/lib/types';
import {
  clampScore,
  shiftIsoDate,
  type AnalyticsRangeWindow,
  type FinanceAnalyticsSlice,
  type LifeOsAggregatorInput,
} from './life-os-types';

const DISCRETIONARY_KEYWORDS = [
  'food', 'dining', 'junk', 'coffee', 'entertainment', 'shopping', 'leisure', 'snack', 'alcohol',
];

function isDiscretionaryCategory(cat: FinanceCategory | undefined, tx: FinanceTransaction): boolean {
  const text = `${cat?.slug ?? ''} ${cat?.name ?? ''} ${tx.title ?? ''} ${tx.subcategory ?? ''}`.toLowerCase();
  return DISCRETIONARY_KEYWORDS.some((kw) => text.includes(kw));
}

function emptyNetWorth() {
  return {
    liquidAssets: 0, investmentAssets: 0, friendReceivables: 0, totalAssets: 0,
    creditCardLiabilities: 0, emiRemainingPrincipal: 0, friendPayables: 0, totalLiabilities: 0, netWorth: 0,
  };
}

function emptyMonthlySummary(monthKey: string): MonthlyFinanceSummary {
  return {
    monthKey, totalIncome: 0, totalSpent: 0, totalInvested: 0, monthlyBudget: 0, expectedIncome: 0,
    remainingUnpaidEmis: 0, remainingUnpaidCommitments: 0, plannedDebtInstallmentsDue: 0,
    remainingUnpaidBills: 0, remainingPlannedSips: 0, safeToSpendMonthly: 0, safeToSpendDaily: 0,
    remainingDaysInMonth: 0, dayOfMonthProgressPct: 0, netSavings: 0, savingsRate: 0, needsReviewCount: 0, categoryBreakdown: [],
  };
}

function emptyDebtSummary(): DebtSummaryBreakdown {
  return {
    totalBorrowedRemaining: 0, totalLentRemaining: 0, netPosition: 0, plannedInstallmentsThisMonth: 0,
    activeBorrowedCount: 0, activeLentCount: 0, everydayBorrowedRemaining: 0, everydayLentRemaining: 0,
    everydayNetPosition: 0, longTermBorrowedRemaining: 0, longTermLentRemaining: 0, longTermNetPosition: 0,
  };
}

function emptyForecast(): CashFlowForecastResult {
  return {
    points: [], startingLiquidBalance: 0, endingProjectedBalance: 0, lowestProjectedBalance: 0,
    lowestBalanceDate: null, crunchDate: null, dailyDiscretionaryBurn: 0, estimatedMonthlyIncome: 0,
    paydayOfMonth: 1, totalScheduledOutflows: 0,
  };
}

function recordExpenseBreakdown(
  tx: FinanceTransaction,
  amt: number,
  categoryMap: Map<string, FinanceCategory>,
  spendByCat: Map<string, { amount: number; count: number }>
): boolean {
  const cat = categoryMap.get(tx.categoryId);
  const catKey = tx.categoryId || 'uncategorized';
  const existing = spendByCat.get(catKey) ?? { amount: 0, count: 0 };
  spendByCat.set(catKey, { amount: existing.amount + amt, count: existing.count + 1 });
  return isDiscretionaryCategory(cat, tx);
}

interface CashflowAccumulator {
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  needsSpend: number;
  discretionarySpend: number;
  spendByCat: Map<string, { amount: number; count: number }>;
  cashflowByDate: Map<string, { income: number; expense: number }>;
}

function accumulateCashflowTx(
  tx: FinanceTransaction,
  acc: CashflowAccumulator,
  categoryMap: Map<string, FinanceCategory>
) {
  const amt = Number(tx.amount ?? 0);
  const dayEntry = acc.cashflowByDate.get(tx.date) ?? { income: 0, expense: 0 };
  if (tx.type === 'income') {
    acc.totalIncome += amt;
    dayEntry.income += amt;
  } else if (tx.type === 'expense') {
    acc.totalExpense += amt;
    dayEntry.expense += amt;
    if (recordExpenseBreakdown(tx, amt, categoryMap, acc.spendByCat)) acc.discretionarySpend += amt;
    else acc.needsSpend += amt;
  } else if (tx.type === 'investment') {
    acc.totalInvestment += amt;
  }
  acc.cashflowByDate.set(tx.date, dayEntry);
}

function aggregatePeriodCashflow(periodTxs: FinanceTransaction[], categoryMap: Map<string, FinanceCategory>): CashflowAccumulator {
  const acc: CashflowAccumulator = {
    totalIncome: 0,
    totalExpense: 0,
    totalInvestment: 0,
    needsSpend: 0,
    discretionarySpend: 0,
    spendByCat: new Map(),
    cashflowByDate: new Map(),
  };
  for (const tx of periodTxs) accumulateCashflowTx(tx, acc, categoryMap);
  return acc;
}

function buildDailyCashflowSeries(window: AnalyticsRangeWindow, cashflowByDate: Map<string, { income: number; expense: number }>) {
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
  return dailyCashflow;
}

function computeFinanceScore(params: {
  hasFinanceData: boolean;
  totalIncome: number;
  savingsRatePct: number;
  monthlySummary: MonthlyFinanceSummary;
  anomalies: FinanceAnalyticsSlice['anomalies'];
  creditCardSummaries: FinanceAnalyticsSlice['creditCardSummaries'];
  totalCardUtilizationPct: number;
  forecast30d: CashFlowForecastResult;
}): number {
  if (!params.hasFinanceData) return 0;
  let rawScore = 65;
  if (params.totalIncome > 0) {
    rawScore = params.savingsRatePct >= 20 ? 85 : 55 + params.savingsRatePct * 1.5;
  } else if (params.monthlySummary.monthlyBudget > 0) {
    const usedPct = (params.monthlySummary.totalSpent / params.monthlySummary.monthlyBudget) * 100;
    rawScore = usedPct > 100 ? Math.max(20, 80 - (usedPct - 100)) : 85;
  }
  const criticalAlerts = params.anomalies.filter((a) => a.severity === 'critical').length;
  const overdueCards = params.creditCardSummaries.filter((c) => c.summary.overdueStatements.length > 0).length;
  rawScore -= criticalAlerts * 12 + overdueCards * 15;
  if (params.totalCardUtilizationPct > 50) rawScore -= 10;
  if (params.forecast30d.crunchDate) rawScore -= 10;
  return clampScore(rawScore);
}

export function prepareFinanceEntities(input: LifeOsAggregatorInput) {
  return {
    accounts: (input.accounts ?? []).filter((a) => !a.deletedAt && !a.archived),
    allTransactions: (input.transactions ?? []).filter((t) => !t.deletedAt),
    categories: (input.categories ?? []).filter((c) => !c.deletedAt && !c.archived),
    budgets: (input.budgets ?? []).filter((b) => !b.deletedAt),
    commitments: (input.commitments ?? []).filter((c) => !c.deletedAt),
    debtRecords: (input.debtRecords ?? []).filter((d) => !d.deletedAt),
    debtInstallments: input.debtInstallments ?? [],
    emiTrackers: (input.emiTrackers ?? []).filter((e) => !e.deletedAt),
    sipPlans: (input.sipPlans ?? []).filter((s) => !s.deletedAt),
    recurringBills: (input.recurringBills ?? []).filter((b) => !b.deletedAt),
    creditCardStatements: (input.creditCardStatements ?? []).filter((s) => !s.deletedAt),
  };
}

function buildCategorySpendList(
  spendByCat: Map<string, { amount: number; count: number }>,
  categoryMap: Map<string, FinanceCategory>,
  totalExpense: number
) {
  return Array.from(spendByCat.entries())
    .map(([categoryId, stats]) => {
      const cat = categoryMap.get(categoryId);
      return {
        categoryId,
        name: cat?.name ?? 'Other',
        color: cat?.color ?? '#64748b',
        amount: Math.round(stats.amount),
        sharePct: totalExpense > 0 ? Math.round((stats.amount / totalExpense) * 100) : 0,
        budgetLimit: cat?.monthlyBudgetLimit ?? 0,
        transactionCount: stats.count,
        category: cat,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

function computeCreditCardSlice(
  entities: ReturnType<typeof prepareFinanceEntities>,
  todayDateStr: string,
  showFinance: boolean
) {
  if (!showFinance) return { creditCardSummaries: [], totalCardUtilizationPct: 0 };
  const creditCardSummaries = entities.accounts
    .filter((a) => a.type === 'credit_card')
    .map((account) => ({
      account,
      summary: computeCreditCardSummary({
        account,
        transactions: entities.allTransactions,
        persistedStatements: entities.creditCardStatements,
        referenceDate: todayDateStr,
      }),
    }));
  const totalCardLimit = creditCardSummaries.reduce((sum, c) => sum + c.summary.creditLimit, 0);
  const totalCardOutstanding = creditCardSummaries.reduce((sum, c) => sum + c.summary.totalOutstanding, 0);
  const totalCardUtilizationPct = totalCardLimit > 0 ? clampScore((totalCardOutstanding / totalCardLimit) * 100) : 0;
  return { creditCardSummaries, totalCardUtilizationPct };
}

function computeFinanceAnalyticsModules(
  entities: ReturnType<typeof prepareFinanceEntities>,
  window: AnalyticsRangeWindow,
  showFinance: boolean
) {
  if (!showFinance) {
    return {
      netWorth: emptyNetWorth(),
      monthlySummary: emptyMonthlySummary(window.monthKey),
      debtSummary: emptyDebtSummary(),
      upcomingObligations7d: [],
      anomalies: [],
      forecast30d: emptyForecast(),
    };
  }
  const upcomingObligations7d = calculateUpcomingFinancialObligations({
    ...entities,
    transactions: entities.allTransactions,
    currentDate: window.todayDateStr,
    withinDays: 7,
  });
  return {
    netWorth: calculateNetWorthSummary(entities),
    monthlySummary: calculateMonthlySummary({
      monthKey: window.monthKey,
      transactions: entities.allTransactions,
      ...entities,
      referenceDate: window.todayDateStr,
    }),
    debtSummary: calculateDebtSummary(entities.debtRecords),
    upcomingObligations7d,
    anomalies: detectSpendingAnomalies({
      selectedMonth: window.monthKey,
      transactions: entities.allTransactions,
      ...entities,
      upcomingObligations7d,
    }),
    forecast30d: buildCashFlowForecast({
      ...entities,
      transactions: entities.allTransactions,
      horizonDays: 30,
      referenceDate: window.todayDateStr,
    }),
  };
}

function computePeriodTxsForFinance(
  allTransactions: FinanceTransaction[],
  window: AnalyticsRangeWindow,
  showFinance: boolean
) {
  if (!showFinance) return { periodTxs: [], prevTotalExpense: 0 };
  const periodTxs = allTransactions.filter((t) => t.date >= window.startDateStr && t.date <= window.endDateStr);
  const prevTotalExpense = allTransactions
    .filter((t) => t.date >= window.prevStartDateStr && t.date <= window.prevEndDateStr && t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount ?? 0), 0);
  return { periodTxs, prevTotalExpense };
}

export function computeFinanceAnalyticsSlice(
  entities: ReturnType<typeof prepareFinanceEntities>,
  window: AnalyticsRangeWindow,
  showFinance: boolean
): FinanceAnalyticsSlice {
  const categoryMap = new Map(entities.categories.map((c) => [c.id, c]));
  const { periodTxs, prevTotalExpense } = computePeriodTxsForFinance(entities.allTransactions, window, showFinance);
  const agg = aggregatePeriodCashflow(periodTxs, categoryMap);

  const expenseDeltaPct = prevTotalExpense > 0 ? Math.round(((agg.totalExpense - prevTotalExpense) / prevTotalExpense) * 100) : null;
  const savingsRatePct = agg.totalIncome > 0 ? clampScore(((agg.totalIncome - agg.totalExpense) / agg.totalIncome) * 100) : 0;

  const { creditCardSummaries, totalCardUtilizationPct } = computeCreditCardSlice(entities, window.todayDateStr, showFinance);
  const mods = computeFinanceAnalyticsModules(entities, window, showFinance);
  const hasData = showFinance && (periodTxs.length > 0 || entities.accounts.length > 0 || entities.budgets.length > 0);
  const score = computeFinanceScore({
    hasFinanceData: hasData,
    totalIncome: agg.totalIncome,
    savingsRatePct,
    monthlySummary: mods.monthlySummary,
    anomalies: mods.anomalies,
    creditCardSummaries,
    totalCardUtilizationPct,
    forecast30d: mods.forecast30d,
  });

  return {
    enabled: showFinance,
    hasData,
    score,
    totalIncome: Math.round(agg.totalIncome),
    totalExpense: Math.round(agg.totalExpense),
    totalInvestment: Math.round(agg.totalInvestment),
    netSavings: Math.round(agg.totalIncome - agg.totalExpense),
    savingsRatePct,
    prevTotalExpense: Math.round(prevTotalExpense),
    expenseDeltaPct,
    dailyAvgBurn: Math.round(agg.totalExpense / window.dayCount),
    needsSpend: Math.round(agg.needsSpend),
    discretionarySpend: Math.round(agg.discretionarySpend),
    categorySpend: buildCategorySpendList(agg.spendByCat, categoryMap, agg.totalExpense),
    dailyCashflow: buildDailyCashflowSeries(window, agg.cashflowByDate),
    ...mods,
    creditCardSummaries,
    totalCardUtilizationPct,
  };
}
