import type {
  CategorySpendItem,
  CommitmentLedgerSummary,
  DebtInstallment,
  DebtRecord,
  EmiTracker,
  FinanceBudget,
  FinanceCategory,
  FinanceRecurringBill,
  FinanceSipPlan,
  FinanceTransaction,
  MonthlyCommitment,
} from '@/lib/types';
import { getPreviousMonthKey } from '@/lib/stores/finance/helpers';

const sumSignedCommitmentAmount = (txs: FinanceTransaction[]): number =>
  txs.reduce((sum, t) => sum + (t.type === 'income' ? -Number(t.amount || 0) : Number(t.amount || 0)), 0);

function resolveCommitmentStatus(
  overpaidAmount: number,
  remainingBalance: number,
  totalFulfilledAmount: number,
  effectiveTargetAmount: number
): CommitmentLedgerSummary['status'] {
  if (overpaidAmount > 0) return 'overpaid';
  if (remainingBalance === 0 && totalFulfilledAmount >= effectiveTargetAmount) return 'settled';
  return totalFulfilledAmount > 0 ? 'in_progress' : 'unpaid';
}

function computeCommitmentRollover(
  commitment: MonthlyCommitment,
  targetMonth: string,
  transactions: FinanceTransaction[]
): number {
  if (!commitment.autoRolloverOverpayment) return 0;
  const prevMonth = getPreviousMonthKey(targetMonth);
  const prevTx = transactions.filter(
    (t) => t.linkedCommitmentId === commitment.id && t.monthKey === prevMonth && !t.deletedAt
  );
  const prevFulfilled = Math.max(0, sumSignedCommitmentAmount(prevTx));
  return prevFulfilled > commitment.monthlyTargetAmount ? prevFulfilled - commitment.monthlyTargetAmount : 0;
}

export function calculateCommitmentLedger(
  commitment: MonthlyCommitment,
  targetMonth: string,
  transactions: FinanceTransaction[]
): CommitmentLedgerSummary {
  const rolloverFromPreviousMonth = computeCommitmentRollover(commitment, targetMonth, transactions);
  const baseTargetAmount = commitment.monthlyTargetAmount;
  const effectiveTargetAmount = Math.max(0, baseTargetAmount - rolloverFromPreviousMonth);

  const monthTransactions = transactions.filter(
    (t) => t.linkedCommitmentId === commitment.id && t.monthKey === targetMonth && !t.deletedAt
  );
  const directTransactions = monthTransactions.filter(
    (t) => t.commitmentContributionType === 'direct_payment' && t.type !== 'income'
  );
  const offsetTransactions = monthTransactions.filter(
    (t) => t.commitmentContributionType !== 'direct_payment' && t.type !== 'income'
  );
  const reimbursementTransactions = monthTransactions.filter((t) => t.type === 'income');

  const directPaidAmount = sumTxAmounts(directTransactions);
  const offsetExpensesAmount = sumTxAmounts(offsetTransactions);
  const reimbursedAmount = sumTxAmounts(reimbursementTransactions);
  const totalFulfilledAmount = Math.max(0, directPaidAmount + offsetExpensesAmount - reimbursedAmount);

  const remainingBalance = Math.max(0, effectiveTargetAmount - totalFulfilledAmount);
  const overpaidAmount = Math.max(0, totalFulfilledAmount - effectiveTargetAmount);
  const progressPercentage =
    effectiveTargetAmount > 0 ? Math.min(100, Math.round((totalFulfilledAmount / effectiveTargetAmount) * 100)) : 100;

  return {
    commitment,
    monthKey: targetMonth,
    baseTargetAmount,
    rolloverFromPreviousMonth,
    effectiveTargetAmount,
    directPaidAmount,
    offsetExpensesAmount,
    totalFulfilledAmount,
    remainingBalance,
    overpaidAmount,
    progressPercentage,
    status: resolveCommitmentStatus(overpaidAmount, remainingBalance, totalFulfilledAmount, effectiveTargetAmount),
    transactions: monthTransactions,
    directTransactions,
    offsetTransactions,
  };
}

export interface MonthlySummaryInput {
  monthKey: string;
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  budgets: FinanceBudget[];
  commitments: MonthlyCommitment[];
  emiTrackers: EmiTracker[];
  debtRecords: DebtRecord[];
  debtInstallments: DebtInstallment[];
  recurringBills: FinanceRecurringBill[];
  sipPlans: FinanceSipPlan[];
  referenceDate?: string;
}

function computePlannedDebtInstallmentsDue(
  debtRecords: DebtRecord[],
  debtInstallments: DebtInstallment[],
  targetMonth: string
): number {
  return debtRecords
    .filter(
      (d) =>
        d.direction === 'borrowed' &&
        d.status === 'active' &&
        !d.deletedAt &&
        d.remainingAmount > 0 &&
        d.repaymentSchedule === 'monthly_partial'
    )
    .reduce((total, debt) => {
      const planned = Math.min(debt.remainingAmount, debt.plannedMonthlyInstallment || debt.remainingAmount);
      const paidThisMonth = debtInstallments
        .filter((i) => i.debtId === debt.id && i.monthKey === targetMonth && !i.deletedAt)
        .reduce((sum, i) => sum + i.amount, 0);
      return total + Math.max(0, planned - paidThisMonth);
    }, 0);
}

function computeMonthDateMetrics(targetMonth: string, referenceDate?: string) {
  const now = referenceDate ? new Date(`${referenceDate}T00:00:00`) : new Date();
  const [yStr, mStr] = targetMonth.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const remainingDaysInMonth = isCurrentMonth ? Math.max(1, daysInMonth - now.getDate() + 1) : daysInMonth;
  const dayOfMonthProgressPct = isCurrentMonth ? Math.round((now.getDate() / daysInMonth) * 100) : 100;
  return { remainingDaysInMonth, dayOfMonthProgressPct };
}

function computeCategoryRollover(
  category: FinanceCategory,
  baseBudgetLimit: number,
  prevMonthExpenses: FinanceTransaction[]
): number {
  const canRollover = category.rolloverEnabled && baseBudgetLimit > 0 && prevMonthExpenses.length > 0;
  if (!canRollover) return 0;
  const prevCatSpent = prevMonthExpenses
    .filter((t) => t.categoryId === category.id)
    .reduce((sum, t) => sum + t.amount, 0);
  return prevCatSpent < baseBudgetLimit ? baseBudgetLimit - prevCatSpent : 0;
}

function resolveCategorySpendStatus(budgetLimit: number, pct: number): CategorySpendItem['status'] {
  if (budgetLimit <= 0) return 'safe';
  if (pct >= 100) return 'exceeded';
  return pct >= 80 ? 'warning' : 'safe';
}

type MonthKey = string;
type InrAmount = number;

function roundedPct(numerator: InrAmount, denominator: InrAmount): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function sumTxAmounts(txs: FinanceTransaction[]): InrAmount {
  return txs.reduce((sum, t) => sum + t.amount, 0);
}

function buildCategorySpendItem(params: {
  category: FinanceCategory;
  expenseTransactions: FinanceTransaction[];
  prevMonthExpenses: FinanceTransaction[];
  totalSpent: number;
  dayOfMonthProgressPct: number;
}): CategorySpendItem {
  const { category, expenseTransactions, prevMonthExpenses, totalSpent, dayOfMonthProgressPct } = params;
  const catTxs = expenseTransactions.filter((t) => t.categoryId === category.id);
  const spent = catTxs.reduce((sum, t) => sum + t.amount, 0);
  const baseBudgetLimit = category.monthlyBudgetLimit;
  const rolloverAmount = computeCategoryRollover(category, baseBudgetLimit, prevMonthExpenses);
  const budgetLimit = baseBudgetLimit + rolloverAmount;
  const percentageOfBudget = roundedPct(spent, budgetLimit);

  return {
    category,
    spent,
    budgetLimit,
    baseBudgetLimit,
    rolloverAmount,
    percentageOfBudget,
    percentageOfTotalSpend: roundedPct(spent, totalSpent),
    transactionCount: catTxs.length,
    status: resolveCategorySpendStatus(budgetLimit, percentageOfBudget),
    paceDiffPercentage: budgetLimit > 0 ? percentageOfBudget - dayOfMonthProgressPct : 0,
  };
}

function isEmiUnpaidThisMonth(
  emi: EmiTracker,
  targetMonth: string,
  expenseTransactions: FinanceTransaction[]
): boolean {
  const isActive = emi.status === 'active' && emi.paidMonths < emi.tenureMonths && !emi.deletedAt;
  if (!isActive) return false;
  return emi.lastPaidMonthKey !== targetMonth && !expenseTransactions.some((t) => t.linkedEmiId === emi.id);
}

function computeRemainingObligationsForMonth(params: {
  input: MonthlySummaryInput;
  expenseTransactions: FinanceTransaction[];
  totalInvested: number;
  budgetObj?: FinanceBudget;
}) {
  const { input, expenseTransactions, totalInvested, budgetObj } = params;
  const targetMonth = input.monthKey;

  const remainingUnpaidCommitments = input.commitments
    .filter((c) => c.isActive && !c.deletedAt)
    .map((c) => calculateCommitmentLedger(c, targetMonth, input.transactions))
    .reduce((sum, l) => sum + l.remainingBalance, 0);

  const remainingUnpaidEmis = input.emiTrackers
    .filter((emi) => isEmiUnpaidThisMonth(emi, targetMonth, expenseTransactions))
    .reduce((sum, e) => sum + e.emiAmount, 0);

  const plannedDebtInstallmentsDue = computePlannedDebtInstallmentsDue(
    input.debtRecords,
    input.debtInstallments,
    targetMonth
  );
  const remainingUnpaidBills = input.recurringBills
    .filter((b) => b.isActive && !b.deletedAt && b.lastPaidMonthKey !== targetMonth)
    .reduce((sum, b) => sum + b.amount, 0);

  const remainingActiveSipsSum = input.sipPlans
    .filter((s) => s.isActive && !s.deletedAt && s.lastInvestedMonthKey !== targetMonth)
    .reduce((sum, s) => sum + s.monthlyAmount, 0);
  const remainingPlannedSips = Math.max(
    remainingActiveSipsSum,
    Math.max(0, (budgetObj?.plannedSipAmount || 0) - totalInvested)
  );

  return {
    remainingUnpaidCommitments,
    remainingUnpaidEmis,
    plannedDebtInstallmentsDue,
    remainingUnpaidBills,
    remainingPlannedSips,
  };
}

function computeSafeToSpendDeductions(
  totalSpent: InrAmount,
  obligations: ReturnType<typeof computeRemainingObligationsForMonth>,
  sipDeduction: InrAmount
): InrAmount {
  return (
    totalSpent +
    obligations.remainingUnpaidEmis +
    obligations.remainingUnpaidCommitments +
    obligations.plannedDebtInstallmentsDue +
    obligations.remainingUnpaidBills +
    sipDeduction
  );
}

function computeSafeToSpendMonthly(params: {
  monthlyBudget: number;
  expectedIncome: number;
  totalSpent: number;
  totalInvested: number;
  obligations: ReturnType<typeof computeRemainingObligationsForMonth>;
}): number {
  const { monthlyBudget, expectedIncome, totalSpent, totalInvested, obligations } = params;
  const basePool = monthlyBudget > 0 ? monthlyBudget : expectedIncome;
  const sipDeduction =
    monthlyBudget === 0 && expectedIncome > 0 ? totalInvested + obligations.remainingPlannedSips : 0;
  return basePool - computeSafeToSpendDeductions(totalSpent, obligations, sipDeduction);
}

function computeMonthlyCashflowTotals(monthTransactions: FinanceTransaction[]) {
  const totalIncome = sumTxAmounts(monthTransactions.filter((t) => t.type === 'income'));
  const expenseTransactions = monthTransactions.filter((t) => t.type === 'expense');
  const totalSpent = sumTxAmounts(expenseTransactions);
  const totalInvested = sumTxAmounts(monthTransactions.filter((t) => t.type === 'investment'));
  const needsReviewCount = monthTransactions.filter((t) => Boolean(t.needsReview)).length;
  return { totalIncome, expenseTransactions, totalSpent, totalInvested, needsReviewCount };
}

function resolveMonthlyBudgetPool(
  budgets: MonthlySummaryInput['budgets'],
  categories: MonthlySummaryInput['categories'],
  targetMonth: MonthKey,
  totalIncome: InrAmount
) {
  const budgetObj = budgets.find((b) => b.monthKey === targetMonth && !b.deletedAt);
  const expenseCats = categories.filter((c) => (c.type === 'expense' || c.type === 'both') && !c.deletedAt);
  const sumCategoryBudgets = expenseCats.reduce((sum, c) => sum + c.monthlyBudgetLimit, 0);
  const monthlyBudget = budgetObj && budgetObj.totalBudget > 0 ? budgetObj.totalBudget : sumCategoryBudgets;
  const expectedIncome = budgetObj?.expectedIncome || totalIncome;
  return { budgetObj, expenseCats, monthlyBudget, expectedIncome };
}

function computeSavingsMetrics(
  totalIncome: InrAmount,
  expectedIncome: InrAmount,
  totalSpent: InrAmount,
  totalInvested: InrAmount
) {
  const incomeBase = totalIncome || expectedIncome;
  const netSavings = incomeBase - totalSpent;
  const savingsRate = roundedPct(netSavings + totalInvested, incomeBase);
  return { netSavings, savingsRate };
}

export function calculateMonthlySummary(input: MonthlySummaryInput) {
  const { monthKey: targetMonth, transactions, categories, budgets, referenceDate } = input;
  const prevMonth = getPreviousMonthKey(targetMonth);
  const monthTransactions = transactions.filter((t) => t.monthKey === targetMonth && !t.deletedAt);
  const prevMonthExpenses = transactions.filter((t) => t.monthKey === prevMonth && t.type === 'expense' && !t.deletedAt);
  const { totalIncome, expenseTransactions, totalSpent, totalInvested, needsReviewCount } =
    computeMonthlyCashflowTotals(monthTransactions);

  const { budgetObj, expenseCats, monthlyBudget, expectedIncome } = resolveMonthlyBudgetPool(
    budgets,
    categories,
    targetMonth,
    totalIncome
  );

  const obligations = computeRemainingObligationsForMonth({ input, expenseTransactions, totalInvested, budgetObj });
  const { remainingDaysInMonth, dayOfMonthProgressPct } = computeMonthDateMetrics(targetMonth, referenceDate);
  const safeToSpendMonthly = computeSafeToSpendMonthly({
    monthlyBudget,
    expectedIncome,
    totalSpent,
    totalInvested,
    obligations,
  });

  const { netSavings, savingsRate } = computeSavingsMetrics(totalIncome, expectedIncome, totalSpent, totalInvested);

  const categoryBreakdown = expenseCats
    .map((category) =>
      buildCategorySpendItem({ category, expenseTransactions, prevMonthExpenses, totalSpent, dayOfMonthProgressPct })
    )
    .sort((a, b) => b.spent - a.spent);

  return {
    monthKey: targetMonth,
    totalIncome,
    totalSpent,
    totalInvested,
    monthlyBudget,
    expectedIncome,
    ...obligations,
    safeToSpendMonthly,
    safeToSpendDaily: Math.max(0, Math.round(safeToSpendMonthly / remainingDaysInMonth)),
    remainingDaysInMonth,
    dayOfMonthProgressPct,
    netSavings,
    savingsRate,
    needsReviewCount,
    categoryBreakdown,
  };
}
