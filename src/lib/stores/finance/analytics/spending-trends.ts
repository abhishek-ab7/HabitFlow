import type { FinanceBudget, FinanceCategory, FinanceTransaction } from '@/lib/types';
import { getPreviousMonthKey, type FinanceStore, type SixMonthTrendPoint } from '../helpers';

interface PeriodQuery {
  transactions: FinanceTransaction[];
  periodKey: string;
  exactMatch: boolean;
  selectedCategoryId?: string;
}

function matchesPeriodExpense(tx: FinanceTransaction, query: PeriodQuery): boolean {
  if (tx.deletedAt || tx.type !== 'expense') return false;
  const periodOk = query.exactMatch
    ? tx.monthKey === query.periodKey
    : tx.monthKey.startsWith(query.periodKey);
  if (!periodOk) return false;
  return !query.selectedCategoryId || tx.categoryId === query.selectedCategoryId;
}

function sumPeriodExpenses(query: PeriodQuery): number {
  return query.transactions
    .filter((tx) => matchesPeriodExpense(tx, query))
    .reduce((sum, tx) => sum + tx.amount, 0);
}

function getSelectedCategoryAndBudgetSum(categories: FinanceCategory[], categoryId: string) {
  const selectedCategory =
    categoryId !== 'all' ? categories.find((c) => c.id === categoryId) : undefined;
  const sumCategoryBudgets = categories
    .filter((c) => c.type === 'expense' || c.type === 'both')
    .reduce((sum, c) => sum + (c.monthlyBudgetLimit || 0), 0);
  return { selectedCategory, sumCategoryBudgets };
}

function resolveMonthTrendBudget(params: {
  mKey: string;
  selectedCategory?: FinanceCategory;
  sumCategoryBudgets: number;
  budgets: FinanceBudget[];
}): number {
  if (params.selectedCategory) return params.selectedCategory.monthlyBudgetLimit || 0;
  if (params.sumCategoryBudgets > 0) return params.sumCategoryBudgets;
  return params.budgets.find((b) => b.monthKey === params.mKey)?.totalBudget || 0;
}

function resolveYearlyBudget(params: {
  yearStr: string;
  selectedCategory?: FinanceCategory;
  sumCategoryBudgets: number;
  budgets: FinanceBudget[];
}): number {
  if (params.selectedCategory) return (params.selectedCategory.monthlyBudgetLimit || 0) * 12;
  if (params.sumCategoryBudgets > 0) return params.sumCategoryBudgets * 12;

  const yearBudgets = params.budgets.filter(
    (b) => b.monthKey.startsWith(`${params.yearStr}-`) && b.totalBudget > 0
  );
  if (yearBudgets.length === 0) return 0;
  const total = yearBudgets.reduce((sum, b) => sum + b.totalBudget, 0);
  return yearBudgets.length === 12 ? total : Math.round((total / yearBudgets.length) * 12);
}

function buildTrendPoint(params: {
  monthKey: string;
  label: string;
  fullLabel: string;
  spent: number;
  budget: number;
}): SixMonthTrendPoint {
  const { monthKey, label, fullLabel, spent, budget } = params;
  return {
    monthKey,
    label,
    fullLabel,
    spent,
    budget,
    variance: budget - spent,
    isOverBudget: budget > 0 && spent > budget,
  };
}

function buildSixMonthKeys(anchorMonth: string): string[] {
  const months: string[] = [];
  let cursor = anchorMonth;
  for (let i = 0; i < 6; i++) {
    months.unshift(cursor);
    cursor = getPreviousMonthKey(cursor);
  }
  return months;
}

export function computeSixMonthTrends(
  state: FinanceStore,
  endMonthKey?: string,
  categoryId = 'all'
): SixMonthTrendPoint[] {
  const months = buildSixMonthKeys(endMonthKey || state.selectedMonth);
  const { selectedCategory, sumCategoryBudgets } = getSelectedCategoryAndBudgetSum(
    state.categories,
    categoryId
  );

  return months.map((mKey) => {
    const [yStr, mStr] = mKey.split('-');
    const dateObj = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
    const spent = sumPeriodExpenses({
      transactions: state.transactions,
      periodKey: mKey,
      exactMatch: true,
      selectedCategoryId: selectedCategory?.id,
    });
    const budget = resolveMonthTrendBudget({
      mKey,
      selectedCategory,
      sumCategoryBudgets,
      budgets: state.budgets,
    });
    return buildTrendPoint({
      monthKey: mKey,
      label: dateObj.toLocaleDateString('en-IN', { month: 'short' }),
      fullLabel: dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      spent,
      budget,
    });
  });
}

export function computeYearlyTrends(
  state: FinanceStore,
  endMonthKey?: string,
  categoryId = 'all',
  yearCount = 5
): SixMonthTrendPoint[] {
  const anchorMonth = endMonthKey || state.selectedMonth;
  const endYear = parseInt(anchorMonth.split('-')[0], 10) || new Date().getFullYear();
  const count = Math.max(1, yearCount);
  const years = Array.from({ length: count }, (_, idx) => endYear - (count - 1 - idx));

  const { selectedCategory, sumCategoryBudgets } = getSelectedCategoryAndBudgetSum(
    state.categories,
    categoryId
  );

  return years.map((year) => {
    const yearStr = String(year);
    const spent = sumPeriodExpenses({
      transactions: state.transactions,
      periodKey: `${yearStr}-`,
      exactMatch: false,
      selectedCategoryId: selectedCategory?.id,
    });
    const budget = resolveYearlyBudget({
      yearStr,
      selectedCategory,
      sumCategoryBudgets,
      budgets: state.budgets,
    });
    return buildTrendPoint({
      monthKey: yearStr,
      label: yearStr,
      fullLabel: `Year ${yearStr}`,
      spent,
      budget,
    });
  });
}
