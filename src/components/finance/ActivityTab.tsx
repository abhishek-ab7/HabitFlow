'use client';

import React, { useCallback, useDeferredValue, useState, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { FinanceFilterState, FinanceTransaction } from '@/lib/types';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { toast } from 'sonner';
import { ActivityFiltersBar } from './activity/ActivityFiltersBar';
import { ActivityBulkActionBar } from './activity/ActivityBulkActionBar';
import { ActivityLedgerList, type DateGroupedTransactions } from './activity/ActivityLedgerList';

const ActivityMonthlyReportDialog = dynamic(
  () => import('./activity/ActivityMonthlyReportDialog').then((m) => ({ default: m.ActivityMonthlyReportDialog })),
  { ssr: false }
);

interface ActivityTabProps {
  onEditTransaction: (tx: FinanceTransaction) => void;
  onOpenAddTransaction: () => void;
  onOpenSmsImport: () => void;
}

function formatDateOffset(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return getLocalIsoDate(d);
}

function checkHasActiveFilters(filters: FinanceFilterState): boolean {
  const hasBase =
    filters.searchQuery.trim() !== '' ||
    filters.type !== 'all' ||
    filters.categoryId !== 'all' ||
    filters.accountId !== 'all';
  const hasExtra =
    filters.needsReview !== 'all' ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    typeof filters.minAmount === 'number' ||
    typeof filters.maxAmount === 'number';
  return hasBase || hasExtra;
}

function resolveRangePreset(filters: FinanceFilterState): 'month' | '30d' | '90d' | 'custom' {
  if (!filters.dateFrom && !filters.dateTo) return 'month';
  const today = formatDateOffset(0);
  if (filters.dateFrom === formatDateOffset(30) && filters.dateTo === today) return '30d';
  if (filters.dateFrom === formatDateOffset(90) && filters.dateTo === today) return '90d';
  return 'custom';
}

function groupTransactionsByDate(items: FinanceTransaction[]): DateGroupedTransactions[] {
  const map = new Map<string, DateGroupedTransactions>();
  for (const tx of items) {
    const existing = map.get(tx.date) || { date: tx.date, items: [], dailyExpenseTotal: 0, dailyIncomeTotal: 0 };
    existing.items.push(tx);
    if (tx.type === 'expense') existing.dailyExpenseTotal += tx.amount;
    else if (tx.type === 'income') existing.dailyIncomeTotal += tx.amount;
    map.set(tx.date, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function isEditableTarget(target: HTMLElement | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

function moveFocusedIndex(key: string, length: number, setFocusedIndex: React.Dispatch<React.SetStateAction<number>>): boolean {
  if (key === 'ArrowDown' || key === 'j') {
    setFocusedIndex((prev) => (prev < length - 1 ? prev + 1 : 0));
    return true;
  }
  if (key === 'ArrowUp' || key === 'k') {
    setFocusedIndex((prev) => (prev > 0 ? prev - 1 : length - 1));
    return true;
  }
  return false;
}

function dispatchItemShortcut(params: {
  e: KeyboardEvent;
  current: FinanceTransaction;
  onApprove: (tx: FinanceTransaction) => void;
  onEdit: (tx: FinanceTransaction) => void;
  onDelete: (tx: FinanceTransaction) => void;
}) {
  const { e, current, onApprove, onEdit, onDelete } = params;
  const lower = e.key.toLowerCase();
  if (lower === 'r' && current.needsReview) {
    e.preventDefault();
    onApprove(current);
  } else if (lower === 'e' || e.key === 'Enter') {
    e.preventDefault();
    onEdit(current);
  } else if (lower === 'd') {
    e.preventDefault();
    onDelete(current);
  }
}

function processLedgerKeyDown(params: {
  e: KeyboardEvent;
  ordered: FinanceTransaction[];
  curIdx: number;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  setFocusedIndex: React.Dispatch<React.SetStateAction<number>>;
  onApprove: (tx: FinanceTransaction) => void;
  onEdit: (tx: FinanceTransaction) => void;
  onDelete: (tx: FinanceTransaction) => void;
}) {
  const { e, ordered, curIdx, searchInputRef, setFocusedIndex, onApprove, onEdit, onDelete } = params;
  const isTyping = isEditableTarget(e.target as HTMLElement | null);
  if (e.key === '/' && !isTyping) {
    e.preventDefault();
    return void searchInputRef.current?.focus();
  }
  if (isTyping || ordered.length === 0) return;
  if (moveFocusedIndex(e.key, ordered.length, setFocusedIndex)) return void e.preventDefault();
  if (curIdx < 0 || curIdx >= ordered.length) return;
  dispatchItemShortcut({ e, current: ordered[curIdx], onApprove, onEdit, onDelete });
}

function useActivityKeyboardTriage(params: {
  flatOrderedTx: FinanceTransaction[];
  focusedIndex: number;
  setFocusedIndex: React.Dispatch<React.SetStateAction<number>>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onEditTransaction: (tx: FinanceTransaction) => void;
}) {
  const { flatOrderedTx, focusedIndex, setFocusedIndex, searchInputRef, onEditTransaction } = params;
  const approveReviewedTransaction = useFinanceStore((s) => s.approveReviewedTransaction);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);
  const addTransaction = useFinanceStore((s) => s.addTransaction);

  const focusedIndexRef = useRef(focusedIndex);
  const flatOrderedTxRef = useRef(flatOrderedTx);

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
    flatOrderedTxRef.current = flatOrderedTx;
  }, [focusedIndex, flatOrderedTx]);

  useEffect(() => {
    const deleteWithUndo = (snapshot: FinanceTransaction) => {
      deleteTransaction(snapshot.id)
        .then(() => {
          toast(`Deleted "${snapshot.merchantName || snapshot.title}"`, {
            action: {
              label: 'Undo',
              onClick: () =>
                addTransaction({
                  title: snapshot.title, merchantName: snapshot.merchantName, amount: snapshot.amount,
                  type: snapshot.type, categoryId: snapshot.categoryId, accountId: snapshot.accountId,
                  toAccountId: snapshot.toAccountId, date: snapshot.date, notes: snapshot.notes,
                  tags: snapshot.tags, needsReview: snapshot.needsReview,
                }),
            },
          });
        })
        .catch(() => {});
    };

    const handleKeyDown = (e: KeyboardEvent) =>
      processLedgerKeyDown({
        e,
        ordered: flatOrderedTxRef.current,
        curIdx: focusedIndexRef.current,
        searchInputRef,
        setFocusedIndex,
        onApprove: (tx) => approveReviewedTransaction(tx.id).then(() => toast.success(`Approved "${tx.merchantName || tx.title}"`)).catch(() => {}),
        onEdit: onEditTransaction,
        onDelete: (tx) => deleteWithUndo({ ...tx }),
      });

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [approveReviewedTransaction, deleteTransaction, addTransaction, onEditTransaction, searchInputRef, setFocusedIndex]);
}

export function ActivityTab({ onEditTransaction, onOpenAddTransaction, onOpenSmsImport }: ActivityTabProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const allTransactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const commitments = useFinanceStore((s) => s.commitments);
  const filters = useFinanceStore((s) => s.filters);
  const setFilters = useFinanceStore((s) => s.setFilters);
  const resetFilters = useFinanceStore((s) => s.resetFilters);
  const getFilteredTransactions = useFinanceStore((s) => s.getFilteredTransactions);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getNetWorthSummary = useFinanceStore((s) => s.getNetWorthSummary);
  const approveReviewedTransaction = useFinanceStore((s) => s.approveReviewedTransaction);
  const bulkUpdateTransactions = useFinanceStore((s) => s.bulkUpdateTransactions);
  const bulkDeleteTransactions = useFinanceStore((s) => s.bulkDeleteTransactions);
  const exportTransactionsCsv = useFinanceStore((s) => s.exportTransactionsCsv);
  const importTransactionsCsv = useFinanceStore((s) => s.importTransactionsCsv);

  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [isBulkWorking, setIsBulkWorking] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(25);

  const transactions = useMemo(
    () => getFilteredTransactions(selectedMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getFilteredTransactions, selectedMonth, allTransactions, filters]
  );

  useEffect(() => {
    setVisibleCount(25);
  }, [selectedMonth, filters.searchQuery, filters.type, filters.categoryId, filters.accountId, filters.dateFrom, filters.dateTo, filters.needsReview]);

  const visibleTransactions = useMemo(() => transactions.slice(0, visibleCount), [transactions, visibleCount]);
  const categoriesMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountsMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const commitmentsMap = useMemo(() => new Map(commitments.map((c) => [c.id, c])), [commitments]);
  const groupedByDate = useMemo(() => groupTransactionsByDate(visibleTransactions), [visibleTransactions]);
  const deferredGroupedByDate = useDeferredValue(groupedByDate);
  const flatOrderedTx = useMemo(() => groupedByDate.flatMap((g) => g.items), [groupedByDate]);
  const flatIndexById = useMemo(() => new Map(flatOrderedTx.map((tx, idx) => [tx.id, idx])), [flatOrderedTx]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const handleToggleSelect = useCallback(
    (id: string) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    []
  );

  const handleApproveTransaction = useCallback(
    async (txId: string) => {
      await approveReviewedTransaction(txId);
      toast.success('Verified');
    },
    [approveReviewedTransaction]
  );

  useActivityKeyboardTriage({ flatOrderedTx, focusedIndex, setFocusedIndex, searchInputRef, onEditTransaction });

  const applyDatePreset = (preset: 'month' | '30d' | '90d') => {
    if (preset === 'month') setFilters({ dateFrom: undefined, dateTo: undefined });
    else setFilters({ dateFrom: formatDateOffset(preset === '30d' ? 30 : 90), dateTo: formatDateOffset(0) });
  };

  const runBulkAction = async (fn: () => Promise<void>) => {
    if (selectedIds.length === 0) return;
    setIsBulkWorking(true);
    try {
      await fn();
    } finally {
      setIsBulkWorking(false);
    }
  };

  const handleExportCsv = () => {
    const csv = exportTransactionsCsv(selectedMonth);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `habitflow-finance-${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedMonth} statement CSV`);
  };

  const processCsvContent = async (content: string) => {
    if (!content.trim()) return void toast.error('CSV file is empty');
    const defaultAcc = accounts.find((a) => a.isDefault)?.id || accounts[0]?.id;
    const res = await importTransactionsCsv(content, defaultAcc);
    if (res.importedCount > 0) toast.success(`Imported ${res.importedCount} entries (flagged for quick review)`);
    else toast.info('No new non-duplicate rows found in CSV');
  };

  const handleCsvFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => void processCsvContent(String(ev.target?.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  const summary = useMemo(
    () => (isReportOpen ? getMonthlySummary(selectedMonth) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isReportOpen, getMonthlySummary, selectedMonth, allTransactions]
  );
  const categoryBreakdown = useMemo(() => (summary ? summary.categoryBreakdown.filter((c) => c.spent > 0) : []), [summary]);
  const netWorth = useMemo(
    () => (isReportOpen ? getNetWorthSummary() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isReportOpen, getNetWorthSummary, allTransactions, accounts]
  );

  const handleCopyReportText = async () => {
    if (!summary || !netWorth) return;
    const lines = [
      `HabitFlow Monthly Finance Report (${selectedMonth})`,
      `Income: ${formatINR(summary.totalIncome)}`,
      `Spent: ${formatINR(summary.totalSpent)}`,
      `Invested / SIPs: ${formatINR(summary.totalInvested)}`,
      `Savings Rate: ${summary.savingsRate}%`,
      `Net Worth: ${formatINR(netWorth.netWorth)}`,
      '',
      'Top Categories:',
      ...categoryBreakdown.slice(0, 5).map((c) => `- ${c.category.name}: ${formatINR(c.spent)}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      toast.success('Copied monthly report summary');
    } catch {
      toast.info('Unable to access clipboard');
    }
  };

  const hasActiveFilters = checkHasActiveFilters(filters);

  return (
    <div className="space-y-4">
      <ActivityFiltersBar
        searchInputRef={searchInputRef}
        csvFileInputRef={csvFileInputRef}
        filters={filters}
        setFilters={setFilters}
        resetFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
        showAdvancedFilters={showAdvancedFilters}
        setShowAdvancedFilters={setShowAdvancedFilters}
        activeRangePreset={resolveRangePreset(filters)}
        onApplyDatePreset={applyDatePreset}
        categories={categories}
        accounts={accounts}
        onOpenReport={() => setIsReportOpen(true)}
        onOpenSmsImport={onOpenSmsImport}
        onCsvFileSelected={handleCsvFileSelected}
        onExportCsv={handleExportCsv}
      />

      <ActivityBulkActionBar
        totalCount={transactions.length}
        selectedIds={selectedIds}
        bulkCategoryId={bulkCategoryId}
        isBulkWorking={isBulkWorking}
        categories={categories}
        onToggleSelectAll={() => setSelectedIds(selectedIds.length === transactions.length ? [] : transactions.map((t) => t.id))}
        onBulkApprove={() =>
          runBulkAction(async () => {
            await bulkUpdateTransactions(selectedIds, { needsReview: false });
            toast.success(`Approved ${selectedIds.length} entries`);
            setSelectedIds([]);
          })
        }
        onBulkRecategorize={(catId) => {
          if (!catId) return;
          runBulkAction(async () => {
            await bulkUpdateTransactions(selectedIds, { categoryId: catId, needsReview: false });
            toast.success(`Moved ${selectedIds.length} entries to ${categoriesMap.get(catId)?.name || 'category'}`);
            setBulkCategoryId('');
            setSelectedIds([]);
          });
        }}
        onBulkDelete={() =>
          runBulkAction(async () => {
            await bulkDeleteTransactions(selectedIds);
            toast.success(`Deleted ${selectedIds.length} entries`);
            setSelectedIds([]);
          })
        }
      />

      <ActivityLedgerList
        groupedByDate={deferredGroupedByDate}
        totalCount={transactions.length}
        visibleCount={visibleCount}
        visibleLength={visibleTransactions.length}
        hasActiveFilters={hasActiveFilters}
        categoriesMap={categoriesMap}
        accountsMap={accountsMap}
        commitmentsMap={commitmentsMap}
        selectedIdSet={selectedIdSet}
        flatIndexById={flatIndexById}
        focusedIndex={focusedIndex}
        onResetFilters={resetFilters}
        onOpenAddTransaction={onOpenAddTransaction}
        onToggleSelect={handleToggleSelect}
        onEditTransaction={onEditTransaction}
        onApproveTransaction={handleApproveTransaction}
        onLoadMore={() => setVisibleCount((c) => c + 25)}
      />

      {isReportOpen && summary && netWorth && (
        <ActivityMonthlyReportDialog
          open={isReportOpen}
          onOpenChange={setIsReportOpen}
          selectedMonth={selectedMonth}
          summary={summary}
          netWorth={netWorth}
          categoryBreakdown={categoryBreakdown}
          onCopySummary={handleCopyReportText}
          onExportCsv={handleExportCsv}
        />
      )}
    </div>
  );
}
