'use client';

import React from 'react';
import { Receipt } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinanceAccount, FinanceCategory, FinanceTransaction, MonthlyCommitment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { ActivityTransactionRow } from './ActivityTransactionRow';

export interface DateGroupedTransactions {
  date: string;
  items: FinanceTransaction[];
  dailyExpenseTotal: number;
  dailyIncomeTotal: number;
}

function formatDateHeading(dateStr: string): string {
  const todayStr = getLocalIsoDate();
  if (dateStr === todayStr) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === getLocalIsoDate(yesterday)) return 'Yesterday';

  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  if (!y || !m) return dateStr;
  if (!d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ActivityEmptyLedger(params: {
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  onOpenAddTransaction: () => void;
}) {
  const { hasActiveFilters, onResetFilters, onOpenAddTransaction } = params;
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-muted mx-auto flex items-center justify-center text-muted-foreground">
        <Receipt className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {hasActiveFilters ? 'No transactions match your current filters' : 'No transactions logged for this month'}
        </p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          {hasActiveFilters ? 'Try clearing your search, date range, or amount filter.' : 'Add an entry manually or import bank SMS, receipts & CSV statements.'}
        </p>
      </div>
      <div className="flex items-center justify-center gap-2">
        {hasActiveFilters ? (
          <Button type="button" variant="outline" onClick={onResetFilters} className="h-10 px-4 rounded-xl text-xs font-semibold">Reset Filters</Button>
        ) : (
          <Button type="button" onClick={onOpenAddTransaction} className="h-10 px-4 rounded-xl text-xs font-semibold">Add Entry</Button>
        )}
      </div>
    </div>
  );
}

export function ActivityLedgerList(params: {
  groupedByDate: DateGroupedTransactions[];
  totalCount: number;
  visibleCount: number;
  visibleLength: number;
  hasActiveFilters: boolean;
  categoriesMap: Map<string, FinanceCategory>;
  accountsMap: Map<string, FinanceAccount>;
  commitmentsMap: Map<string, MonthlyCommitment>;
  selectedIdSet: Set<string>;
  flatIndexById: Map<string, number>;
  focusedIndex: number;
  onResetFilters: () => void;
  onOpenAddTransaction: () => void;
  onToggleSelect: (id: string) => void;
  onEditTransaction: (tx: FinanceTransaction) => void;
  onApproveTransaction: (txId: string) => void;
  onLoadMore: () => void;
}) {
  const {
    groupedByDate, totalCount, visibleCount, visibleLength, hasActiveFilters,
    categoriesMap, accountsMap, commitmentsMap, selectedIdSet, flatIndexById,
    focusedIndex, onResetFilters, onOpenAddTransaction, onToggleSelect,
    onEditTransaction, onApproveTransaction, onLoadMore,
  } = params;

  if (groupedByDate.length === 0) {
    return (
      <ActivityEmptyLedger
        hasActiveFilters={hasActiveFilters}
        onResetFilters={onResetFilters}
        onOpenAddTransaction={onOpenAddTransaction}
      />
    );
  }

  return (
    <div className="space-y-4">
      {groupedByDate.map((group) => (
        <div key={group.date} className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/35 border-b border-border/60 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-foreground">{formatDateHeading(group.date)}</span>
            <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
              {group.dailyIncomeTotal > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{formatINR(group.dailyIncomeTotal)}</span>}
              {group.dailyExpenseTotal > 0 && <span className="text-muted-foreground font-semibold">-{formatINR(group.dailyExpenseTotal)}</span>}
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {group.items.map((tx) => (
              <ActivityTransactionRow
                key={tx.id}
                tx={tx}
                cat={categoriesMap.get(tx.categoryId)}
                acc={accountsMap.get(tx.accountId)}
                toAcc={tx.toAccountId ? accountsMap.get(tx.toAccountId) : undefined}
                comm={tx.linkedCommitmentId ? commitmentsMap.get(tx.linkedCommitmentId) : undefined}
                isSelected={selectedIdSet.has(tx.id)}
                isKeyboardFocused={(flatIndexById.get(tx.id) ?? -1) === focusedIndex}
                onToggleSelect={onToggleSelect}
                onEdit={onEditTransaction}
                onApprove={onApproveTransaction}
              />
            ))}
          </div>
        </div>
      ))}

      {totalCount > visibleCount && (
        <div className="flex flex-col items-center gap-1.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onLoadMore} className="h-10 px-5 rounded-xl text-xs font-semibold">
            Load {Math.min(25, totalCount - visibleCount)} more ({totalCount - visibleCount} remaining)
          </Button>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
            Showing {visibleLength} of {totalCount} transactions
          </span>
        </div>
      )}
    </div>
  );
}
