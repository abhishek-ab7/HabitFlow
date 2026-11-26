'use client';

import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  HeartHandshake,
  Receipt,
  Link2,
  Unlink,
  Trash2,
  RefreshCw,
  ArrowDownLeft,
} from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { CommitmentLedgerSummary, FinanceTransaction } from '@/lib/types';
import { Button } from '@/components/ui/button';

function getTxContributionLabel(tx: FinanceTransaction): string {
  if (tx.type === 'income') return 'Reimbursement received';
  return tx.commitmentContributionType === 'direct_payment' ? 'Direct transfer' : 'Offset deduction';
}

function CommitmentTransactionsList(params: {
  transactions: FinanceTransaction[];
  onUnlink: (txId: string) => void;
}) {
  const { transactions, onUnlink } = params;
  if (transactions.length === 0) return null;

  return (
    <div className="divide-y divide-border/60 border-t border-b border-border/60">
      {transactions.map((tx) => (
        <div key={tx.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{tx.title}</p>
            <p className="text-muted-foreground">{tx.date} · {getTxContributionLabel(tx)}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`font-mono tabular-nums font-semibold ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
              {tx.type === 'income' ? '+' : '-'}{formatINR(tx.amount)}
            </span>
            <button
              type="button"
              onClick={() => onUnlink(tx.id)}
              aria-label="Unlink transaction"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Unlink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommitmentActionBar(params: {
  ledger: CommitmentLedgerSummary;
  onLogOffset: () => void;
  onOpenReimburse: () => void;
  onOpenLinkExpense: () => void;
  onToggleRollover: () => void;
  onDelete: () => void;
}) {
  const { ledger, onLogOffset, onOpenReimburse, onOpenLinkExpense, onToggleRollover, onDelete } = params;
  const rolloverOn = ledger.commitment.autoRolloverOverpayment;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onLogOffset} className="min-h-[40px] px-3 text-xs gap-1.5 rounded-xl">
        <Receipt className="w-3.5 h-3.5" />
        Log Offset
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onOpenReimburse}
        className="min-h-[40px] px-3 text-xs gap-1.5 rounded-xl text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
      >
        <ArrowDownLeft className="w-3.5 h-3.5" />
        Received Back
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onOpenLinkExpense} className="min-h-[40px] px-3 text-xs gap-1.5 rounded-xl">
        <Link2 className="w-3.5 h-3.5" />
        Link Expense
      </Button>
      <button
        type="button"
        onClick={onToggleRollover}
        className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
          rolloverOn
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'
        }`}
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Rollover: {rolloverOn ? 'ON' : 'OFF'}</span>
      </button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onDelete}
        className="min-h-[40px] px-3 text-xs gap-1.5 text-rose-500 hover:text-rose-600 ml-auto rounded-xl"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </Button>
    </div>
  );
}

function CommitmentCardHeader(params: {
  ledger: CommitmentLedgerSummary;
  isOpen: boolean;
  onToggleExpand: () => void;
  onSettle: (e: React.MouseEvent) => void;
}) {
  const { ledger, isOpen, onToggleExpand, onSettle } = params;
  const { commitment } = ledger;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggleExpand}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleExpand();
        }
      }}
      className="w-full p-4 flex flex-col gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{commitment.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {commitment.recipientName} · Target {formatINR(ledger.effectiveTargetAmount)} · Due Day {commitment.dueDayOfMonth}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-sm sm:text-base font-bold font-mono tabular-nums text-foreground">
              {ledger.remainingBalance > 0 ? formatINR(ledger.remainingBalance) : 'Settled'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {ledger.remainingBalance > 0 ? 'left to pay' : `${ledger.progressPercentage}% done`}
            </p>
          </div>
          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
          <div style={{ width: `${ledger.progressPercentage}%` }} className="h-full bg-rose-500 transition-all duration-300" />
        </div>
        {ledger.remainingBalance > 0 ? (
          <Button type="button" size="sm" onClick={onSettle} className="min-h-[36px] px-3 text-xs rounded-lg whitespace-nowrap shrink-0">
            Settle {formatINR(ledger.remainingBalance)}
          </Button>
        ) : (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">Settled</span>
        )}
      </div>
    </div>
  );
}

export function CommitmentLedgerCard(params: {
  ledger: CommitmentLedgerSummary;
  isOpen: boolean;
  onToggleExpand: () => void;
  onSettle: (e: React.MouseEvent) => void;
  onUnlinkTx: (txId: string) => void;
  onLogOffset: () => void;
  onOpenReimburse: () => void;
  onOpenLinkExpense: () => void;
  onToggleRollover: () => void;
  onDelete: () => void;
}) {
  const { ledger, isOpen, onToggleExpand, onSettle, onUnlinkTx, onLogOffset, onOpenReimburse, onOpenLinkExpense, onToggleRollover, onDelete } = params;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <CommitmentCardHeader ledger={ledger} isOpen={isOpen} onToggleExpand={onToggleExpand} onSettle={onSettle} />

      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-border/70 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-xs pt-1">
            <div>
              <span className="text-muted-foreground block">Offsets</span>
              <span className="font-bold font-mono tabular-nums text-foreground">{formatINR(ledger.offsetExpensesAmount)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Direct Sent</span>
              <span className="font-bold font-mono tabular-nums text-foreground">{formatINR(ledger.directPaidAmount)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">{ledger.overpaidAmount > 0 ? 'Next Rollover' : 'Remaining'}</span>
              <span className="font-bold font-mono tabular-nums text-foreground">
                {ledger.overpaidAmount > 0 ? `-${formatINR(ledger.overpaidAmount)}` : formatINR(ledger.remainingBalance)}
              </span>
            </div>
          </div>

          <CommitmentTransactionsList transactions={ledger.transactions} onUnlink={onUnlinkTx} />
          <CommitmentActionBar
            ledger={ledger}
            onLogOffset={onLogOffset}
            onOpenReimburse={onOpenReimburse}
            onOpenLinkExpense={onOpenLinkExpense}
            onToggleRollover={onToggleRollover}
            onDelete={onDelete}
          />
        </div>
      )}
    </div>
  );
}
