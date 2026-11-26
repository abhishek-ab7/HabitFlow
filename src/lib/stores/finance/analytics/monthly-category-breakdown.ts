import type { CategorySpendItem, FinanceCategory, FinanceTransaction } from '@/lib/types';

function computeCategoryRollover(
  category: FinanceCategory,
  prevMonthExpenses: FinanceTransaction[]
): number {
  const baseLimit = category.monthlyBudgetLimit;
  if (!category.rolloverEnabled || baseLimit <= 0) return 0;
  if (prevMonthExpenses.length === 0) return 0;
  const prevCatSpent = prevMonthExpenses
    .filter((t) => t.categoryId === category.id)
    .reduce((sum, t) => sum + t.amount, 0);
  return prevCatSpent < baseLimit ? baseLimit - prevCatSpent : 0;
}

function resolveBudgetStatus(
  budgetLimit: number,
  percentageOfBudget: number
): CategorySpendItem['status'] {
  if (budgetLimit <= 0) return 'safe';
  if (percentageOfBudget >= 100) return 'exceeded';
  if (percentageOfBudget >= 80) return 'warning';
  return 'safe';
}

function toCategorySpendItem(params: {
  category: FinanceCategory;
  expenseTxs: FinanceTransaction[];
  prevMonthExpenses: FinanceTransaction[];
  totalSpent: number;
  dayOfMonthProgressPct: number;
}): CategorySpendItem {
  const { category, expenseTxs, prevMonthExpenses, totalSpent, dayOfMonthProgressPct } = params;
  const catTxs = expenseTxs.filter((t) => t.categoryId === category.id);
  const spent = catTxs.reduce((sum, t) => sum + t.amount, 0);
  const baseBudgetLimit = category.monthlyBudgetLimit;
  const rolloverAmount = computeCategoryRollover(category, prevMonthExpenses);
  const budgetLimit = baseBudgetLimit + rolloverAmount;
  const percentageOfBudget = budgetLimit > 0 ? Math.round((spent / budgetLimit) * 100) : 0;
  const percentageOfTotalSpend = totalSpent > 0 ? Math.round((spent / totalSpent) * 100) : 0;

  return {
    category,
    spent,
    budgetLimit,
    baseBudgetLimit,
    rolloverAmount,
    percentageOfBudget,
    percentageOfTotalSpend,
    transactionCount: catTxs.length,
    status: resolveBudgetStatus(budgetLimit, percentageOfBudget),
    paceDiffPercentage: budgetLimit > 0 ? percentageOfBudget - dayOfMonthProgressPct : 0,
  };
}

export function buildCategoryBreakdown(params: {
  categories: FinanceCategory[];
  expenseTxs: FinanceTransaction[];
  prevMonthExpenses: FinanceTransaction[];
  totalSpent: number;
  dayOfMonthProgressPct: number;
}): CategorySpendItem[] {
  return params.categories
    .filter((c) => (c.type === 'expense' || c.type === 'both') && !c.deletedAt)
    .map((category) =>
      toCategorySpendItem({
        category,
        expenseTxs: params.expenseTxs,
        prevMonthExpenses: params.prevMonthExpenses,
        totalSpent: params.totalSpent,
        dayOfMonthProgressPct: params.dayOfMonthProgressPct,
      })
    )
    .sort((a, b) => b.spent - a.spent);
}
