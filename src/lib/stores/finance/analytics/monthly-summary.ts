import type { FinanceTransaction, MonthlyFinanceSummary } from '@/lib/types';
import { getPreviousMonthKey, type FinanceStore } from '../helpers';
import { buildCategoryBreakdown } from './monthly-category-breakdown';
import { computeUnpaidObligations, resolveBudgetTargets } from './monthly-summary-helpers';

function computeMonthProgress(targetMonth: string) {
  const now = new Date();
  const [yStr, mStr] = targetMonth.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const remainingDaysInMonth = isCurrentMonth
    ? Math.max(1, daysInMonth - now.getDate() + 1)
    : daysInMonth;
  const dayOfMonthProgressPct = isCurrentMonth
    ? Math.round((now.getDate() / daysInMonth) * 100)
    : 100;
  return { remainingDaysInMonth, dayOfMonthProgressPct };
}

function sumByType(txs: FinanceTransaction[], type: FinanceTransaction['type']): number {
  return txs.filter((t) => t.type === type).reduce((sum, t) => sum + t.amount, 0);
}

function computeSafeToSpendAndSavings(params: {
  monthlyBudget: number;
  expectedIncome: number;
  totalIncome: number;
  totalSpent: number;
  totalInvested: number;
  remainingPlannedSips: number;
  remainingDaysInMonth: number;
  unpaidTotal: number;
}) {
  const basePool = params.monthlyBudget > 0 ? params.monthlyBudget : params.expectedIncome;
  const extraInvest =
    params.monthlyBudget === 0 && params.expectedIncome > 0
      ? params.totalInvested + params.remainingPlannedSips
      : 0;
  const safeToSpendMonthly = basePool - (params.totalSpent + params.unpaidTotal + extraInvest);
  const incomeBase = params.totalIncome || params.expectedIncome;
  const netSavings = incomeBase - params.totalSpent;
  const savingsRate =
    incomeBase > 0 ? Math.round(((netSavings + params.totalInvested) / incomeBase) * 100) : 0;

  return {
    safeToSpendMonthly,
    safeToSpendDaily: Math.max(0, Math.round(safeToSpendMonthly / params.remainingDaysInMonth)),
    netSavings,
    savingsRate,
  };
}

export function computeMonthlySummary(
  state: FinanceStore,
  targetMonth: string
): MonthlyFinanceSummary {
  const prevMonth = getPreviousMonthKey(targetMonth);
  const monthTxs = state.transactions.filter((t) => t.monthKey === targetMonth && !t.deletedAt);
  const prevMonthExpenses = state.transactions.filter(
    (t) => t.monthKey === prevMonth && t.type === 'expense' && !t.deletedAt
  );

  const totalIncome = sumByType(monthTxs, 'income');
  const expenseTxs = monthTxs.filter((t) => t.type === 'expense');
  const totalSpent = expenseTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalInvested = sumByType(monthTxs, 'investment');
  const needsReviewCount = monthTxs.filter((t) => Boolean(t.needsReview)).length;

  const targets = resolveBudgetTargets(state, targetMonth, totalIncome, totalInvested);
  const unpaid = computeUnpaidObligations(state, targetMonth, expenseTxs);
  const progress = computeMonthProgress(targetMonth);
  const unpaidTotal =
    unpaid.remainingUnpaidEmis +
    unpaid.remainingUnpaidCommitments +
    unpaid.plannedDebtInstallmentsDue +
    unpaid.remainingUnpaidBills;

  const metrics = computeSafeToSpendAndSavings({
    monthlyBudget: targets.monthlyBudget,
    expectedIncome: targets.expectedIncome,
    totalIncome,
    totalSpent,
    totalInvested,
    remainingPlannedSips: targets.remainingPlannedSips,
    remainingDaysInMonth: progress.remainingDaysInMonth,
    unpaidTotal,
  });

  return {
    monthKey: targetMonth,
    totalIncome,
    totalSpent,
    totalInvested,
    ...targets,
    ...unpaid,
    ...metrics,
    ...progress,
    needsReviewCount,
    categoryBreakdown: buildCategoryBreakdown({
      categories: state.categories,
      expenseTxs,
      prevMonthExpenses,
      totalSpent,
      dayOfMonthProgressPct: progress.dayOfMonthProgressPct,
    }),
  };
}
