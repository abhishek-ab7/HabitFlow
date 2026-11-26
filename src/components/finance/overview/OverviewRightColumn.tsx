'use client';

import React from 'react';
import { ChevronRight, Receipt, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinanceAccount, FinanceCategory, FinanceTransaction, MonthlyCommitment } from '@/lib/types';
import { CategoryIcon } from '../CategoryIcon';
import { formatHumanDate } from '@/lib/date-format';

function ReviewQueueItemRow(params: {
  tx: FinanceTransaction;
  cat?: FinanceCategory;
  onEdit: (tx: FinanceTransaction) => void;
  onApprove: (txId: string) => void;
}) {
  const { tx, cat, onEdit, onApprove } = params;
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 flex items-center justify-between gap-3">
      <button type="button" onClick={() => onEdit(tx)} className="flex items-center gap-2.5 min-w-0 text-left flex-1">
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: cat ? `${cat.color}18` : 'var(--muted)', color: cat?.color || 'currentColor' }}
        >
          <CategoryIcon name={cat?.icon} className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{tx.merchantName || tx.title}</p>
          <p className="text-[11px] text-muted-foreground">{cat?.name || 'Uncategorized'} · {formatHumanDate(tx.date)}</p>
        </div>
      </button>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-foreground">{formatINR(tx.amount)}</span>
        <button
          type="button"
          onClick={() => onApprove(tx.id)}
          className="h-8 px-2.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 text-xs font-semibold flex items-center gap-1 transition-colors"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Approve</span>
        </button>
      </div>
    </div>
  );
}

export function OverviewReviewQueue(params: {
  reviewQueue: FinanceTransaction[];
  needsReviewCount: number;
  categoriesMap: Map<string, FinanceCategory>;
  onEditTransaction: (tx: FinanceTransaction) => void;
  onApproveTransaction: (txId: string) => void;
  onReviewAll?: () => void;
}) {
  const { reviewQueue, needsReviewCount, categoriesMap, onEditTransaction, onApproveTransaction, onReviewAll } = params;
  if (reviewQueue.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-foreground">Needs Review ({needsReviewCount})</h3>
        </div>
        {onReviewAll && (
          <button type="button" onClick={onReviewAll} className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline">
            Review all in Activity →
          </button>
        )}
      </div>

      <div className="space-y-2">
        {reviewQueue.map((tx) => (
          <ReviewQueueItemRow
            key={tx.id}
            tx={tx}
            cat={categoriesMap.get(tx.categoryId)}
            onEdit={onEditTransaction}
            onApprove={onApproveTransaction}
          />
        ))}
      </div>
    </div>
  );
}

function getTxAmountDisplay(tx: FinanceTransaction) {
  if (tx.type === 'income') return { cls: 'text-emerald-600 dark:text-emerald-400', prefix: '+' };
  if (tx.type === 'investment') return { cls: 'text-violet-600 dark:text-violet-400', prefix: '-' };
  return { cls: 'text-foreground', prefix: '-' };
}

function RecentTransactionMeta(params: {
  tx: FinanceTransaction;
  cat?: FinanceCategory;
  acc?: FinanceAccount;
  comm?: MonthlyCommitment;
}) {
  const { tx, cat, acc, comm } = params;
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold text-foreground truncate">{tx.merchantName || tx.title}</p>
        {tx.type === 'investment' && <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">· SIP/Invest</span>}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
        <span>{cat?.name || 'General'}</span>
        <span aria-hidden="true">·</span>
        <span>{acc?.name || 'Account'}</span>
        <span aria-hidden="true">·</span>
        <span>{formatHumanDate(tx.date)}</span>
        {comm && <span className="text-rose-600 dark:text-rose-400 font-medium">· Offset: {comm.recipientName}</span>}
      </div>
    </div>
  );
}

function RecentTransactionRow(params: {
  tx: FinanceTransaction;
  cat?: FinanceCategory;
  acc?: FinanceAccount;
  comm?: MonthlyCommitment;
  onEdit: (tx: FinanceTransaction) => void;
}) {
  const { tx, cat, acc, comm, onEdit } = params;
  const amountDisp = getTxAmountDisplay(tx);

  return (
    <button
      type="button"
      onClick={() => onEdit(tx)}
      className="w-full min-h-[60px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: cat ? `${cat.color}18` : 'var(--muted)', color: cat?.color || 'currentColor' }}
        >
          <CategoryIcon name={cat?.icon} className="w-4 h-4" />
        </span>
        <RecentTransactionMeta tx={tx} cat={cat} acc={acc} comm={comm} />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-sm font-bold font-mono tabular-nums ${amountDisp.cls}`}>
          {amountDisp.prefix}{formatINR(tx.amount)}
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
      </div>
    </button>
  );
}

export function OverviewRecentTransactions(params: {
  recentTransactions: FinanceTransaction[];
  totalMonthCount: number;
  categoriesMap: Map<string, FinanceCategory>;
  accountsMap: Map<string, FinanceAccount>;
  commitmentsMap: Map<string, MonthlyCommitment>;
  onEditTransaction: (tx: FinanceTransaction) => void;
  onOpenAddTransaction: () => void;
  onOpenActivityTab?: () => void;
}) {
  const { recentTransactions, totalMonthCount, categoriesMap, accountsMap, commitmentsMap, onEditTransaction, onOpenAddTransaction, onOpenActivityTab } = params;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border/60 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-foreground">Recent Transactions</h3>
          <p className="text-xs text-muted-foreground font-mono tabular-nums">
            Showing latest {recentTransactions.length} of {totalMonthCount} this month
          </p>
        </div>
        {onOpenActivityTab && (
          <button
            type="button"
            onClick={onOpenActivityTab}
            className="min-h-[36px] px-3 rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold text-foreground flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
          >
            <span>Open Full Ledger</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {recentTransactions.length === 0 ? (
        <div className="px-6 py-10 text-center space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-muted mx-auto flex items-center justify-center text-muted-foreground">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">No entries recorded for this month</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">Log your first expense, income, or SIP investment using the Add button.</p>
          </div>
          <button
            type="button"
            onClick={onOpenAddTransaction}
            className="inline-flex items-center justify-center min-h-[40px] px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Add First Entry
          </button>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {recentTransactions.map((tx) => (
            <RecentTransactionRow
              key={tx.id}
              tx={tx}
              cat={categoriesMap.get(tx.categoryId)}
              acc={accountsMap.get(tx.accountId)}
              comm={tx.linkedCommitmentId ? commitmentsMap.get(tx.linkedCommitmentId) : undefined}
              onEdit={onEditTransaction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
