'use client';

import React from 'react';
import { ChevronRight, Check, CheckCircle2 } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinanceAccount, FinanceCategory, FinanceTransaction, MonthlyCommitment } from '@/lib/types';
import { CategoryIcon } from '../CategoryIcon';

const ROW_AMOUNT_STYLE: Record<FinanceTransaction['type'], { cls: string; prefix: string }> = {
  income: { cls: 'text-emerald-600 dark:text-emerald-400', prefix: '+' },
  investment: { cls: 'text-violet-600 dark:text-violet-400', prefix: '-' },
  transfer: { cls: 'text-teal-600 dark:text-teal-400', prefix: '⇄ ' },
  expense: { cls: 'text-foreground', prefix: '-' },
};

function buildPrimaryMetaLabel(tx: FinanceTransaction, cat?: FinanceCategory, acc?: FinanceAccount, toAcc?: FinanceAccount): string {
  if (tx.type === 'transfer') return `${acc?.name || 'From'} → ${toAcc?.name || 'To'}`;
  return `${cat?.name || 'General'} · ${acc?.name || 'Account'}`;
}

function ActivityRowMetaLine(params: {
  tx: FinanceTransaction;
  cat?: FinanceCategory;
  acc?: FinanceAccount;
  toAcc?: FinanceAccount;
  comm?: MonthlyCommitment;
}) {
  const { tx, cat, acc, toAcc, comm } = params;
  const firstTag = tx.tags?.[0];
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span>{buildPrimaryMetaLabel(tx, cat, acc, toAcc)}</span>
      {comm && <span className="text-rose-600 dark:text-rose-400 font-medium">· Offset: {comm.recipientName}</span>}
      {firstTag && <span className="font-mono text-[11px]">· #{firstTag}</span>}
    </div>
  );
}

function ActivityRowTrailingActions(params: {
  tx: FinanceTransaction;
  onEdit: (tx: FinanceTransaction) => void;
  onApprove: (txId: string) => void;
}) {
  const { tx, onEdit, onApprove } = params;
  const amtStyle = ROW_AMOUNT_STYLE[tx.type];
  return (
    <div className="flex items-center gap-2 shrink-0">
      {tx.needsReview && (
        <button
          type="button"
          onClick={() => onApprove(tx.id)}
          title="Approve imported entry (R)"
          className="h-8 px-2 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 text-xs font-semibold flex items-center gap-1"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Approve</span>
        </button>
      )}
      <button type="button" onClick={() => onEdit(tx)} className="flex items-center gap-1.5 text-right">
        <span className={`text-sm sm:text-base font-bold font-mono tabular-nums ${amtStyle.cls}`}>
          {amtStyle.prefix}{formatINR(tx.amount)}
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
      </button>
    </div>
  );
}

function resolveRowClassName(isSelected: boolean, isKeyboardFocused: boolean): string {
  if (isSelected) return 'bg-primary/5';
  if (isKeyboardFocused) return 'bg-muted/50 ring-1 ring-inset ring-primary/30';
  return 'hover:bg-muted/35';
}

function ActivityRowSelectCheckbox({ isSelected, onToggle }: { isSelected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isSelected ? 'Deselect transaction' : 'Select transaction'}
      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
        isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background hover:border-primary/60'
      }`}
    >
      {isSelected && <Check className="w-3.5 h-3.5" />}
    </button>
  );
}

export function ActivityTransactionRow(params: {
  tx: FinanceTransaction;
  cat?: FinanceCategory;
  acc?: FinanceAccount;
  toAcc?: FinanceAccount;
  comm?: MonthlyCommitment;
  isSelected: boolean;
  isKeyboardFocused: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (tx: FinanceTransaction) => void;
  onApprove: (txId: string) => void;
}) {
  const { tx, cat, acc, toAcc, comm, isSelected, isKeyboardFocused, onToggleSelect, onEdit, onApprove } = params;
  const rowCls = resolveRowClassName(isSelected, isKeyboardFocused);

  return (
    <div className={`cv-auto min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 transition-colors ${rowCls}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <ActivityRowSelectCheckbox isSelected={isSelected} onToggle={() => onToggleSelect(tx.id)} />

        <button type="button" onClick={() => onEdit(tx)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: cat ? `${cat.color}18` : 'var(--muted)', color: cat?.color || 'currentColor' }}
          >
            <CategoryIcon name={cat?.icon} className="w-4 h-4" />
          </span>
          <div className="min-w-0 space-y-0.5 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground truncate">{tx.merchantName || tx.title}</p>
              {tx.needsReview && <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">· Review</span>}
              {tx.splitGroupId && <span className="text-[11px] font-semibold text-primary shrink-0">· Split</span>}
            </div>
            <ActivityRowMetaLine tx={tx} cat={cat} acc={acc} toAcc={toAcc} comm={comm} />
          </div>
        </button>
      </div>

      <ActivityRowTrailingActions tx={tx} onEdit={onEdit} onApprove={onApprove} />
    </div>
  );
}
