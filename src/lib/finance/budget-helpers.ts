import { resolveEffectivePaydayOfMonth } from '@/lib/finance/payday';
import type { FinanceBudget, FinanceBudgetMode, FinanceCategory } from '@/lib/types';

export interface BudgetSummarySnapshot {
  totalIncome: number;
  remainingUnpaidEmis: number;
  remainingUnpaidCommitments: number;
  remainingUnpaidBills: number;
  plannedDebtInstallmentsDue: number;
}

export function formatMonthDisplay(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const date = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export const positiveStr = (val?: number): string => (val && val > 0 ? String(val) : '');

export function buildCategoryMaps(categories: FinanceCategory[]) {
  const categoryInputs: Record<string, string> = {};
  const categoryRollovers: Record<string, boolean> = {};
  for (const cat of categories) {
    categoryInputs[cat.id] = positiveStr(cat.monthlyBudgetLimit);
    categoryRollovers[cat.id] = Boolean(cat.rolloverEnabled);
  }
  return { categoryInputs, categoryRollovers };
}

export function computeLeaveMetrics(
  baseSalaryInput: string,
  leaveDaysInput: string,
  salaryDivisor: 30 | 26
) {
  const baseSalaryNum = parseFloat(baseSalaryInput) || 0;
  const leaveDaysNum = Math.max(0, parseFloat(leaveDaysInput) || 0);
  const leaveCutAmount =
    baseSalaryNum > 0 && leaveDaysNum > 0 ? Math.round((baseSalaryNum / salaryDivisor) * leaveDaysNum) : 0;
  const netSalaryAfterLeave = Math.max(0, Math.round(baseSalaryNum - leaveCutAmount));
  return { leaveDaysNum, leaveCutAmount, netSalaryAfterLeave };
}

export function computeBudgetFormDerived(params: {
  categoryInputs: Record<string, string>;
  overallInput: string;
  expectedIncomeInput: string;
  plannedSipInput: string;
  baseSalaryInput: string;
  leaveDaysInput: string;
  salaryDivisor: 30 | 26;
  summary: BudgetSummarySnapshot;
}) {
  const categorySum = Object.values(params.categoryInputs).reduce(
    (sum, val) => sum + (parseFloat(val) > 0 ? parseFloat(val) : 0),
    0
  );
  const overallNum = parseFloat(params.overallInput) || 0;
  const expectedIncomeNum = parseFloat(params.expectedIncomeInput) || 0;
  const plannedSipNum = parseFloat(params.plannedSipInput) || 0;
  const leave = computeLeaveMetrics(params.baseSalaryInput, params.leaveDaysInput, params.salaryDivisor);
  const fixedObligations =
    params.summary.remainingUnpaidEmis +
    params.summary.remainingUnpaidCommitments +
    params.summary.remainingUnpaidBills +
    params.summary.plannedDebtInstallmentsDue;
  const assignableIncomeBase = expectedIncomeNum > 0 ? expectedIncomeNum : params.summary.totalIncome;
  const totalAssigned = categorySum + plannedSipNum + fixedObligations;

  return {
    categorySum,
    overallNum,
    expectedIncomeNum,
    plannedSipNum,
    ...leave,
    fixedObligations,
    assignableIncomeBase,
    totalAssigned,
    readyToAssign: Math.round(assignableIncomeBase - totalAssigned),
  };
}

export function buildInitialBudgetState(params: {
  selectedMonth: string;
  categories: FinanceCategory[];
  budgets: FinanceBudget[];
  totalIncome: number;
}) {
  const existing = params.budgets.find((b) => b.monthKey === params.selectedMonth && !b.deletedAt);
  const resolvedIncomeStr = positiveStr(existing?.expectedIncome) || positiveStr(params.totalIncome);
  const { categoryInputs, categoryRollovers } = buildCategoryMaps(params.categories);
  return {
    budgetMode: existing?.budgetMode ?? ('cap' as FinanceBudgetMode),
    overallInput: positiveStr(existing?.totalBudget),
    expectedIncomeInput: resolvedIncomeStr,
    baseSalaryInput: resolvedIncomeStr || '19000',
    paydayInput: String(resolveEffectivePaydayOfMonth(params.budgets, params.selectedMonth) ?? 1),
    plannedSipInput: positiveStr(existing?.plannedSipAmount),
    categoryInputs,
    categoryRollovers,
  };
}

export function buildNumericCategoryLimits(
  categories: FinanceCategory[],
  categoryInputs: Record<string, string>
): Record<string, number> {
  const numericLimits: Record<string, number> = {};
  for (const cat of categories) {
    const parsed = parseFloat(categoryInputs[cat.id] ?? '0');
    numericLimits[cat.id] = !isNaN(parsed) && parsed > 0 ? parsed : 0;
  }
  return numericLimits;
}
