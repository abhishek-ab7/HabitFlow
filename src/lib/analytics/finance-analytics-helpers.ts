import type { OverviewDonutCategoryItem } from '@/components/finance/OverviewCategoryDonut';
import type { AnalyticsTabProps } from '@/components/analytics/tabs/types';

type FinanceSnapshot = AnalyticsTabProps['snapshot']['finance'];

export function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs === 0) return '₹0';
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${sign}₹${Math.round(abs)}`;
}

export function buildDonutCategories(
  categorySpend: FinanceSnapshot['categorySpend']
): OverviewDonutCategoryItem[] {
  return categorySpend.map((item) => ({
    category: item.category ?? {
      id: item.categoryId,
      userId: '',
      name: item.name,
      slug: item.categoryId,
      type: 'expense',
      icon: 'tag',
      color: item.color,
      monthlyBudgetLimit: item.budgetLimit,
      subcategories: [],
      order: 0,
      isSystem: false,
      archived: false,
      createdAt: '',
      updatedAt: '',
    },
    spent: item.amount,
    percentageOfTotalSpend: item.sharePct,
    transactionCount: item.transactionCount,
  }));
}

export function computeOutflowMix(finance: FinanceSnapshot) {
  const mixTotal = finance.needsSpend + finance.discretionarySpend + finance.totalInvestment;
  const needsPct = mixTotal > 0 ? Math.round((finance.needsSpend / mixTotal) * 100) : 0;
  const discPct = mixTotal > 0 ? Math.round((finance.discretionarySpend / mixTotal) * 100) : 0;
  const invPct = mixTotal > 0 ? Math.max(0, 100 - needsPct - discPct) : 0;
  return { mixTotal, needsPct, discPct, invPct };
}

export function getCategoryPaceStatusClass(budgetPct: number | null): string {
  if (budgetPct !== null && budgetPct >= 100) return 'text-rose-600 dark:text-rose-400';
  if (budgetPct !== null && budgetPct >= 80) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}
