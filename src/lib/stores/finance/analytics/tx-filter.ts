import type { FinanceFilterState, FinanceTransaction } from '@/lib/types';

function matchesSearchQuery(tx: FinanceTransaction, tags: string[], rawQuery: string): boolean {
  const trimmed = rawQuery.trim();
  if (!trimmed) return true;
  const q = trimmed.toLowerCase();
  const fields = [tx.title || '', tx.merchantName || '', tx.subcategory || '', tx.notes || ''];
  if (fields.some((f) => f.toLowerCase().includes(q))) return true;
  return tags.some((tag) => tag.toLowerCase().includes(q));
}

function matchesBasicFilters(
  tx: FinanceTransaction,
  filters: FinanceFilterState,
  targetMonth: string
): boolean {
  const checks: Array<[string, string | null | undefined]> = [
    [targetMonth, tx.monthKey],
    [filters.type, tx.type],
    [filters.categoryId, tx.categoryId],
    [filters.accountId, tx.accountId],
    [filters.commitmentId, tx.linkedCommitmentId],
    [filters.debtId, tx.linkedDebtId],
  ];
  return checks.every(([expected, actual]) => expected === 'all' || actual === expected);
}

function matchesTagFilter(filters: FinanceFilterState, tags: string[]): boolean {
  if (!filters.tag || filters.tag === 'all') return true;
  return tags.includes(filters.tag);
}

function matchesReviewFilter(tx: FinanceTransaction, filters: FinanceFilterState): boolean {
  return filters.needsReview !== 'only_review' || Boolean(tx.needsReview);
}

function matchesDateFrom(tx: FinanceTransaction, filters: FinanceFilterState): boolean {
  return !filters.dateFrom || tx.date >= filters.dateFrom;
}

function matchesDateTo(tx: FinanceTransaction, filters: FinanceFilterState): boolean {
  return !filters.dateTo || tx.date <= filters.dateTo;
}

function matchesMinAmount(tx: FinanceTransaction, filters: FinanceFilterState): boolean {
  return filters.minAmount === undefined || tx.amount >= filters.minAmount;
}

function matchesMaxAmount(tx: FinanceTransaction, filters: FinanceFilterState): boolean {
  return filters.maxAmount === undefined || tx.amount <= filters.maxAmount;
}

function matchesRangeAndReview(
  tx: FinanceTransaction,
  filters: FinanceFilterState,
  tags: string[]
): boolean {
  const checks = [
    matchesTagFilter(filters, tags),
    matchesReviewFilter(tx, filters),
    matchesDateFrom(tx, filters),
    matchesDateTo(tx, filters),
    matchesMinAmount(tx, filters),
    matchesMaxAmount(tx, filters),
  ];
  return checks.every(Boolean);
}

function matchesAllCriteria(
  tx: FinanceTransaction,
  filters: FinanceFilterState,
  targetMonth: string
): boolean {
  const tags = Array.isArray(tx.tags) ? tx.tags : [];
  if (!matchesBasicFilters(tx, filters, targetMonth)) return false;
  if (!matchesRangeAndReview(tx, filters, tags)) return false;
  return matchesSearchQuery(tx, tags, filters.searchQuery);
}

export function filterTransactions(
  transactions: FinanceTransaction[],
  filters: FinanceFilterState,
  targetMonth: string
): FinanceTransaction[] {
  return transactions.filter((tx) => !tx.deletedAt && matchesAllCriteria(tx, filters, targetMonth));
}
