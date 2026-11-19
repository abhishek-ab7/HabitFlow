'use client';

import React, { useState, useMemo, useRef } from 'react';
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
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { FinanceTransaction, FinanceTransactionType } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from './CategoryIcon';
import { toast } from 'sonner';

interface ActivityTabProps {
  onEditTransaction: (tx: FinanceTransaction) => void;
  onOpenAddTransaction: () => void;
  onOpenSmsImport: () => void;
}

function formatDateHeading(dateStr: string): string {
  const todayStr = new Date().toISOString().split('T')[0];
  if (dateStr === todayStr) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';

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

export function ActivityTab({
  onEditTransaction,
  onOpenAddTransaction,
  onOpenSmsImport,
}: ActivityTabProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const commitments = useFinanceStore((s) => s.commitments);
  const filters = useFinanceStore((s) => s.filters);
  const setFilters = useFinanceStore((s) => s.setFilters);
  const resetFilters = useFinanceStore((s) => s.resetFilters);
  const getFilteredTransactions = useFinanceStore((s) => s.getFilteredTransactions);
  const approveReviewedTransaction = useFinanceStore(
    (s) => s.approveReviewedTransaction
  );
  const bulkUpdateTransactions = useFinanceStore((s) => s.bulkUpdateTransactions);
  const bulkDeleteTransactions = useFinanceStore((s) => s.bulkDeleteTransactions);
  const exportTransactionsCsv = useFinanceStore((s) => s.exportTransactionsCsv);
  const importTransactionsCsv = useFinanceStore((s) => s.importTransactionsCsv);

  const csvFileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  const [isBulkWorking, setIsBulkWorking] = useState(false);

  const transactions = getFilteredTransactions(selectedMonth);

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

    for (const tx of transactions) {
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
  }, [transactions]);

  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.type !== 'all' ||
    filters.categoryId !== 'all' ||
    filters.accountId !== 'all' ||
    filters.needsReview !== 'all';

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
      const count = await importTransactionsCsv(content, defaultAcc);
      if (count > 0) {
        toast.success(
          `Imported ${count} entries (flagged for quick review)`
        );
      } else {
        toast.info('No new non-duplicate rows found in CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Filter & Import/Export Toolbar Card */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={filters.searchQuery}
              onChange={(e) => setFilters({ searchQuery: e.target.value })}
              placeholder="Search merchant, title, notes, or #tag..."
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

        {/* Second Filter Row: Category, Account, Needs Review, Import/Export */}
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

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenSmsImport}
              className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold"
            >
              <MessageSquareText className="w-3.5 h-3.5 text-primary" />
              <span>SMS Import</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => csvFileInputRef.current?.click()}
              className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold"
            >
              <Upload className="w-3.5 h-3.5 text-primary" />
              <span>CSV Import</span>
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
      </div>

      {/* Multi-Select Bulk Action Bar */}
      {transactions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
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
                ? 'Try clearing your search or category filter.'
                : 'Add an entry manually or import bank SMS & CSV statements.'}
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
                  const isSelected = selectedIds.includes(tx.id);

                  return (
                    <div
                      key={tx.id}
                      className={`min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                        isSelected ? 'bg-primary/5' : 'hover:bg-muted/35'
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
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                                  Review
                                </span>
                              )}
                              {tx.splitGroupId && (
                                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
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
                                  <span className="text-pink-600 dark:text-pink-400 font-medium">
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
                            title="Approve imported entry"
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
        </div>
      )}
    </div>
  );
}
