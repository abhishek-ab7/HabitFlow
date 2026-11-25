'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  ChevronRight,
  Receipt,
  Check,
  CheckCircle2,
  Trash2,
  Download,
  Upload,
  MessageSquareText,
  X,
  Tag,
  AlertCircle,
  Calendar,
  FileBarChart2,
  SlidersHorizontal,
  Copy,
  Printer,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { FinanceTransaction, FinanceTransactionType } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { CategoryIcon } from './CategoryIcon';
import { formatMonthYear } from '@/lib/date-format';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { toast } from 'sonner';

interface ActivityTabProps {
  onEditTransaction: (tx: FinanceTransaction) => void;
  onOpenAddTransaction: () => void;
  onOpenSmsImport: () => void;
}

function formatDateHeading(dateStr: string): string {
  const todayStr = getLocalIsoDate();
  if (dateStr === todayStr) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === getLocalIsoDate(yesterday)) return 'Yesterday';

  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateOffset(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return getLocalIsoDate(d);
}

export function ActivityTab({
  onEditTransaction,
  onOpenAddTransaction,
  onOpenSmsImport,
}: ActivityTabProps) {
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
  const approveReviewedTransaction = useFinanceStore(
    (s) => s.approveReviewedTransaction
  );
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const bulkUpdateTransactions = useFinanceStore((s) => s.bulkUpdateTransactions);
  const bulkDeleteTransactions = useFinanceStore((s) => s.bulkDeleteTransactions);
  const exportTransactionsCsv = useFinanceStore((s) => s.exportTransactionsCsv);
  const importTransactionsCsv = useFinanceStore((s) => s.importTransactionsCsv);

  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  const [isBulkWorking, setIsBulkWorking] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(25);

  const transactions = useMemo(
    () => getFilteredTransactions(selectedMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getFilteredTransactions, selectedMonth, allTransactions, filters]
  );

  useEffect(() => {
    setVisibleCount(25);
  }, [
    selectedMonth,
    filters.searchQuery,
    filters.type,
    filters.categoryId,
    filters.accountId,
    filters.dateFrom,
    filters.dateTo,
    filters.needsReview,
  ]);

  const visibleTransactions = useMemo(
    () => transactions.slice(0, visibleCount),
    [transactions, visibleCount]
  );

  const categoriesMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accountsMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const commitmentsMap = useMemo(
    () => new Map(commitments.map((c) => [c.id, c])),
    [commitments]
  );

  // Group transactions by date (YYYY-MM-DD)
  const groupedByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        items: FinanceTransaction[];
        dailyExpenseTotal: number;
        dailyIncomeTotal: number;
      }
    >();

    for (const tx of visibleTransactions) {
      const existing = map.get(tx.date) || {
        date: tx.date,
        items: [],
        dailyExpenseTotal: 0,
        dailyIncomeTotal: 0,
      };
      existing.items.push(tx);
      if (tx.type === 'expense') {
        existing.dailyExpenseTotal += tx.amount;
      } else if (tx.type === 'income') {
        existing.dailyIncomeTotal += tx.amount;
      }
      map.set(tx.date, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [visibleTransactions]);

  // Flat ordered list matching rendered rows for keyboard navigation
  const flatOrderedTx = useMemo(
    () => groupedByDate.flatMap((g) => g.items),
    [groupedByDate]
  );

  const flatIndexById = useMemo(
    () => new Map(flatOrderedTx.map((tx, idx) => [tx.id, idx])),
    [flatOrderedTx]
  );

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const focusedIndexRef = useRef(focusedIndex);
  focusedIndexRef.current = focusedIndex;
  const flatOrderedTxRef = useRef(flatOrderedTx);
  flatOrderedTxRef.current = flatOrderedTx;

  // Desktop Keyboard Triage: ↑/↓ focus row, R approve, E edit, D delete w/ undo, / search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      const ordered = flatOrderedTxRef.current;
      if (isTyping || ordered.length === 0) return;

      const curIdx = focusedIndexRef.current;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < ordered.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : ordered.length - 1));
      } else if (curIdx >= 0 && curIdx < ordered.length) {
        const current = ordered[curIdx];
        if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          if (current.needsReview) {
            approveReviewedTransaction(current.id)
              .then(() => {
                toast.success(`Approved "${current.merchantName || current.title}"`);
              })
              .catch(() => {});
          }
        } else if (e.key.toLowerCase() === 'e' || e.key === 'Enter') {
          e.preventDefault();
          onEditTransaction(current);
        } else if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          const snapshot = { ...current };
          deleteTransaction(current.id)
            .then(() => {
              toast(`Deleted "${snapshot.merchantName || snapshot.title}"`, {
                action: {
                  label: 'Undo',
                  onClick: () => {
                    addTransaction({
                      title: snapshot.title,
                      merchantName: snapshot.merchantName,
                      amount: snapshot.amount,
                      type: snapshot.type,
                      categoryId: snapshot.categoryId,
                      accountId: snapshot.accountId,
                      toAccountId: snapshot.toAccountId,
                      date: snapshot.date,
                      notes: snapshot.notes,
                      tags: snapshot.tags,
                      needsReview: snapshot.needsReview,
                    });
                  },
                },
              });
            })
            .catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [approveReviewedTransaction, deleteTransaction, addTransaction, onEditTransaction]);

  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.type !== 'all' ||
    filters.categoryId !== 'all' ||
    filters.accountId !== 'all' ||
    filters.needsReview !== 'all' ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    typeof filters.minAmount === 'number' ||
    typeof filters.maxAmount === 'number';

  const applyDatePreset = (preset: 'month' | '30d' | '90d') => {
    if (preset === 'month') {
      setFilters({ dateFrom: undefined, dateTo: undefined });
    } else if (preset === '30d') {
      setFilters({
        dateFrom: formatDateOffset(30),
        dateTo: formatDateOffset(0),
      });
    } else {
      setFilters({
        dateFrom: formatDateOffset(90),
        dateTo: formatDateOffset(0),
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === transactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transactions.map((t) => t.id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkWorking(true);
    try {
      await bulkUpdateTransactions(selectedIds, { needsReview: false });
      toast.success(`Approved ${selectedIds.length} entries`);
      setSelectedIds([]);
    } finally {
      setIsBulkWorking(false);
    }
  };

  const handleBulkRecategorize = async (nextCategoryId: string) => {
    if (!nextCategoryId || selectedIds.length === 0) return;
    setIsBulkWorking(true);
    try {
      await bulkUpdateTransactions(selectedIds, {
        categoryId: nextCategoryId,
        needsReview: false,
      });
      const cat = categoriesMap.get(nextCategoryId);
      toast.success(
        `Moved ${selectedIds.length} entries to ${cat?.name || 'category'}`
      );
      setBulkCategoryId('');
      setSelectedIds([]);
    } finally {
      setIsBulkWorking(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkWorking(true);
    try {
      await bulkDeleteTransactions(selectedIds);
      toast.success(`Deleted ${selectedIds.length} entries`);
      setSelectedIds([]);
    } finally {
      setIsBulkWorking(false);
    }
  };

  const handleExportCsv = () => {
    const csv = exportTransactionsCsv(selectedMonth);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `habitflow-finance-${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedMonth} statement CSV`);
  };

  const handleCsvFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = String(ev.target?.result || '');
      if (!content.trim()) {
        toast.error('CSV file is empty');
        return;
      }
      const defaultAcc =
        accounts.find((a) => a.isDefault)?.id || accounts[0]?.id;
      const res = await importTransactionsCsv(content, defaultAcc);
      if (res.importedCount > 0) {
        toast.success(
          `Imported ${res.importedCount} entries (flagged for quick review)`
        );
      } else {
        toast.info('No new non-duplicate rows found in CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Monthly Report Card summary data (computed only when Report dialog is open)
  const summary = useMemo(
    () => (isReportOpen ? getMonthlySummary(selectedMonth) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isReportOpen, getMonthlySummary, selectedMonth, allTransactions]
  );
  const categoryBreakdown = useMemo(
    () => (summary ? summary.categoryBreakdown.filter((c) => c.spent > 0) : []),
    [summary]
  );
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
      ...categoryBreakdown
        .slice(0, 5)
        .map((c) => `- ${c.category.name}: ${formatINR(c.spent)}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      toast.success('Copied monthly report summary');
    } catch {
      toast.info('Unable to access clipboard');
    }
  };

  const activeRangePreset =
    !filters.dateFrom && !filters.dateTo
      ? 'month'
      : filters.dateFrom === formatDateOffset(30) &&
        filters.dateTo === formatDateOffset(0)
      ? '30d'
      : filters.dateFrom === formatDateOffset(90) &&
        filters.dateTo === formatDateOffset(0)
      ? '90d'
      : 'custom';

  return (
    <div className="space-y-4">
      {/* Sticky Filter & Import/Export Toolbar Card */}
      <div className="sticky top-[56px] md:top-[64px] z-20 rounded-2xl border border-border bg-card/98 shadow-xs p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              ref={searchInputRef}
              value={filters.searchQuery}
              onChange={(e) => setFilters({ searchQuery: e.target.value })}
              placeholder="Search merchant, title, notes, or #tag... (press /)"
              className="pl-10 h-10 rounded-xl text-xs sm:text-sm"
            />
          </div>

          {/* Type Filter Segmented Control */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-muted overflow-x-auto no-swipe shrink-0">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'expense', label: 'Expense' },
                { id: 'income', label: 'Income' },
                { id: 'investment', label: 'SIP/Invest' },
                { id: 'transfer', label: 'Transfer' },
              ] as Array<{ id: 'all' | FinanceTransactionType; label: string }>
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilters({ type: t.id })}
                className={`min-h-[32px] px-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  filters.type === t.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Second Filter Row: Category, Account, Needs Review, Advanced Range, Import/Export */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by category"
              value={filters.categoryId}
              onChange={(e) => setFilters({ categoryId: e.target.value })}
              className="h-9 px-2.5 text-xs font-medium rounded-xl border border-input bg-background text-foreground"
            >
              <option value="all">All Categories</option>
              {categories
                .filter((c) => !c.deletedAt)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>

            <select
              aria-label="Filter by account"
              value={filters.accountId}
              onChange={(e) => setFilters({ accountId: e.target.value })}
              className="h-9 px-2.5 text-xs font-medium rounded-xl border border-input bg-background text-foreground"
            >
              <option value="all">All Accounts</option>
              {accounts
                .filter((a) => !a.deletedAt)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>

            <button
              type="button"
              onClick={() =>
                setFilters({
                  needsReview:
                    filters.needsReview === 'only_review' ? 'all' : 'only_review',
                })
              }
              className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                filters.needsReview === 'only_review'
                  ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Needs Review</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters((v) => !v)}
              className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                showAdvancedFilters ||
                filters.dateFrom ||
                filters.dateTo ||
                typeof filters.minAmount === 'number' ||
                typeof filters.maxAmount === 'number'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Date &amp; ₹ Range</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-9 px-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsReportOpen(true)}
              className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold"
            >
              <FileBarChart2 className="w-3.5 h-3.5 text-primary" />
              <span>Report</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenSmsImport}
              className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold"
            >
              <MessageSquareText className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">SMS</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => csvFileInputRef.current?.click()}
              className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold"
            >
              <Upload className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
            <input
              ref={csvFileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFileSelected}
              className="hidden"
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* Collapsible Date Range & Amount Range Filter Panel */}
        {showAdvancedFilters && (
          <div className="pt-2.5 border-t border-border/60 grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-4 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Quick Range
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted">
                {(
                  [
                    { id: 'month', label: 'Selected Mo' },
                    { id: '30d', label: 'Last 30d' },
                    { id: '90d', label: 'Last 90d' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyDatePreset(p.id)}
                    className={`h-8 text-xs font-semibold rounded-lg transition-colors ${
                      activeRangePreset === p.id
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="filter-date-from" className="text-[11px] font-medium text-muted-foreground block">
                  From Date
                </label>
                <Input
                  id="filter-date-from"
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) =>
                    setFilters({ dateFrom: e.target.value || undefined })
                  }
                  className="h-9 text-xs font-mono rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="filter-date-to" className="text-[11px] font-medium text-muted-foreground block">
                  To Date
                </label>
                <Input
                  id="filter-date-to"
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) =>
                    setFilters({ dateTo: e.target.value || undefined })
                  }
                  className="h-9 text-xs font-mono rounded-xl"
                />
              </div>
            </div>

            <div className="lg:col-span-4 grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="filter-min-amt" className="text-[11px] font-medium text-muted-foreground block">
                  Min ₹
                </label>
                <Input
                  id="filter-min-amt"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={filters.minAmount ?? ''}
                  onChange={(e) =>
                    setFilters({
                      minAmount: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className="h-9 text-xs font-mono tabular-nums rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="filter-max-amt" className="text-[11px] font-medium text-muted-foreground block">
                  Max ₹
                </label>
                <Input
                  id="filter-max-amt"
                  type="number"
                  min="0"
                  placeholder="Any"
                  value={filters.maxAmount ?? ''}
                  onChange={(e) =>
                    setFilters({
                      maxAmount: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className="h-9 text-xs font-mono tabular-nums rounded-xl"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Multi-Select Bulk Action Bar & Desktop Keyboard Triage Hints */}
      {transactions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5"
            >
              <span
                className={`w-4 h-4 rounded border flex items-center justify-center ${
                  selectedIds.length > 0 &&
                  selectedIds.length === transactions.length
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-input bg-background'
                }`}
              >
                {selectedIds.length > 0 &&
                  selectedIds.length === transactions.length && (
                    <Check className="w-3 h-3" />
                  )}
              </span>
              <span>
                {selectedIds.length > 0
                  ? `${selectedIds.length} selected`
                  : `Select from ${transactions.length} entries`}
              </span>
            </button>

            <span className="hidden lg:inline text-[11px] text-muted-foreground font-mono">
              Shortcuts: ↑↓ select · R approve · E edit · D delete · / search
            </span>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isBulkWorking}
                onClick={handleBulkApprove}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold gap-1 text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve</span>
              </Button>

              <div className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <select
                  aria-label="Bulk recategorize selected transactions"
                  value={bulkCategoryId}
                  onChange={(e) => handleBulkRecategorize(e.target.value)}
                  disabled={isBulkWorking}
                  className="h-8 px-2 text-xs rounded-lg border border-input bg-background text-foreground"
                >
                  <option value="">Move to Category...</option>
                  {categories
                    .filter((c) => !c.deletedAt)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isBulkWorking}
                onClick={handleBulkDelete}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold gap-1 text-rose-600 hover:bg-rose-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Date-Grouped Transaction Ledger */}
      {groupedByDate.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted mx-auto flex items-center justify-center text-muted-foreground">
            <Receipt className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {hasActiveFilters
                ? 'No transactions match your current filters'
                : 'No transactions logged for this month'}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              {hasActiveFilters
                ? 'Try clearing your search, date range, or amount filter.'
                : 'Add an entry manually or import bank SMS, receipts & CSV statements.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                onClick={resetFilters}
                className="h-10 px-4 rounded-xl text-xs font-semibold"
              >
                Reset Filters
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onOpenAddTransaction}
                className="h-10 px-4 rounded-xl text-xs font-semibold"
              >
                Add Entry
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map((group) => (
            <div
              key={group.date}
              className="rounded-2xl border border-border bg-card overflow-hidden"
            >
              {/* Date Group Header with Daily Subtotal */}
              <div className="px-4 py-2.5 bg-muted/35 border-b border-border/60 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground">
                  {formatDateHeading(group.date)}
                </span>
                <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                  {group.dailyIncomeTotal > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      +{formatINR(group.dailyIncomeTotal)}
                    </span>
                  )}
                  {group.dailyExpenseTotal > 0 && (
                    <span className="text-muted-foreground font-semibold">
                      -{formatINR(group.dailyExpenseTotal)}
                    </span>
                  )}
                </div>
              </div>

              {/* Rows inside Date Group */}
              <div className="divide-y divide-border/60">
                {group.items.map((tx) => {
                  const cat = categoriesMap.get(tx.categoryId);
                  const acc = accountsMap.get(tx.accountId);
                  const toAcc = tx.toAccountId
                    ? accountsMap.get(tx.toAccountId)
                    : undefined;
                  const comm = tx.linkedCommitmentId
                    ? commitmentsMap.get(tx.linkedCommitmentId)
                    : undefined;
                  const isSelected = selectedIdSet.has(tx.id);
                  const flatIdx = flatIndexById.get(tx.id) ?? -1;
                  const isKeyboardFocused = flatIdx === focusedIndex;

                  return (
                    <div
                      key={tx.id}
                      className={`cv-auto min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                        isSelected
                          ? 'bg-primary/5'
                          : isKeyboardFocused
                          ? 'bg-muted/50 ring-1 ring-inset ring-primary/30'
                          : 'hover:bg-muted/35'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Selection Checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleSelect(tx.id)}
                          aria-label={
                            isSelected ? 'Deselect transaction' : 'Select transaction'
                          }
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-input bg-background hover:border-primary/60'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>

                        {/* Clickable Transaction Body */}
                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left"
                        >
                          <span
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: cat
                                ? `${cat.color}18`
                                : 'var(--muted)',
                              color: cat?.color || 'currentColor',
                            }}
                          >
                            <CategoryIcon name={cat?.icon} className="w-4 h-4" />
                          </span>

                          <div className="min-w-0 space-y-0.5 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {tx.merchantName || tx.title}
                              </p>
                              {tx.needsReview && (
                                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                                  · Review
                                </span>
                              )}
                              {tx.splitGroupId && (
                                <span className="text-[11px] font-semibold text-primary shrink-0">
                                  · Split
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <span>
                                {tx.type === 'transfer'
                                  ? `${acc?.name || 'From'} → ${toAcc?.name || 'To'}`
                                  : cat?.name || 'General'}
                              </span>
                              {tx.type !== 'transfer' && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{acc?.name || 'Account'}</span>
                                </>
                              )}
                              {comm && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-rose-600 dark:text-rose-400 font-medium">
                                    Offset: {comm.recipientName}
                                  </span>
                                </>
                              )}
                              {tx.tags && tx.tags.length > 0 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono text-[11px]">
                                    #{tx.tags[0]}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {tx.needsReview && (
                          <button
                            type="button"
                            onClick={async () => {
                              await approveReviewedTransaction(tx.id);
                              toast.success('Verified');
                            }}
                            title="Approve imported entry (R)"
                            className="h-8 px-2 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 text-xs font-semibold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Approve</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          className="flex items-center gap-1.5 text-right"
                        >
                          <span
                            className={`text-sm sm:text-base font-bold font-mono tabular-nums ${
                              tx.type === 'income'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : tx.type === 'investment'
                                ? 'text-violet-600 dark:text-violet-400'
                                : tx.type === 'transfer'
                                ? 'text-teal-600 dark:text-teal-400'
                                : 'text-foreground'
                            }`}
                          >
                            {tx.type === 'income'
                              ? '+'
                              : tx.type === 'transfer'
                              ? '⇄ '
                              : '-'}
                            {formatINR(tx.amount)}
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {transactions.length > visibleCount && (
            <div className="flex flex-col items-center gap-1.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((c) => c + 25)}
                className="h-10 px-5 rounded-xl text-xs font-semibold"
              >
                Load {Math.min(25, transactions.length - visibleCount)} more ({transactions.length - visibleCount} remaining)
              </Button>
              <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                Showing {visibleTransactions.length} of {transactions.length} transactions
              </span>
            </div>
          )}
        </div>
      )}

      {/* Monthly Financial Report Card Modal */}
      {isReportOpen && summary && netWorth && (
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent
          showCloseButton={false}
          className="p-0 gap-0 overflow-hidden max-w-lg w-full rounded-2xl border-border bg-background"
        >
          <div className="px-5 py-4 border-b border-border bg-card flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Monthly Financial Report · {formatMonthYear(selectedMonth)}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Cashflow, savings rate, investments &amp; net worth snapshot
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsReportOpen(false)}
              aria-label="Close report"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border bg-card p-3 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Income
                </span>
                <span className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatINR(summary.totalIncome)}
                </span>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Expenses
                </span>
                <span className="text-base font-bold font-mono tabular-nums text-foreground">
                  {formatINR(summary.totalSpent)}
                </span>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground block">
                  SIP / Invest
                </span>
                <span className="text-base font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400">
                  {formatINR(summary.totalInvested)}
                </span>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Savings Rate
                </span>
                <span className="text-base font-bold font-mono tabular-nums text-foreground">
                  {summary.savingsRate}%
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Net Worth ({formatINR(netWorth.totalAssets)} assets − {formatINR(netWorth.totalLiabilities)} debt)
              </span>
              <span className="text-sm font-bold font-mono tabular-nums text-foreground">
                {formatINR(netWorth.netWorth)}
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Top Expense Categories
              </h4>
              {categoryBreakdown.length === 0 ? (
                <p className="text-xs text-muted-foreground">No expenses logged this month.</p>
              ) : (
                <div className="space-y-2">
                  {categoryBreakdown.slice(0, 6).map((c) => {
                    const pct =
                      summary.totalSpent > 0
                        ? Math.round((c.spent / summary.totalSpent) * 100)
                        : 0;
                    return (
                      <div key={c.category.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">
                            {c.category.name}
                          </span>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            <strong className="text-foreground">{formatINR(c.spent)}</strong> · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, pct)}%`,
                              backgroundColor: c.category.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="px-5 py-3.5 border-t border-border bg-background flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyReportText}
              className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Summary
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleExportCsv}
              className="h-9 px-3.5 rounded-xl gap-1.5 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
