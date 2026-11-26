'use client';

import React from 'react';
import { Star, CreditCard, Tag, X } from 'lucide-react';
import type { FinanceAccount, FinanceTransactionType } from '@/lib/types';
import { resolveTransactionCycle, getCycleWindowForMonth, getLocalIsoDate, formatShortDate } from '@/lib/finance/credit-card-cycles';

function DefaultAccountBadge(params: {
  selectedAcc?: FinanceAccount;
  onSetDefault: (id: string) => void;
}) {
  const { selectedAcc, onSetDefault } = params;
  if (!selectedAcc) return null;
  if (selectedAcc.isDefault) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
        <Star className="w-3 h-3 fill-primary" />
        Default payment method
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onSetDefault(selectedAcc.id)}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
    >
      <Star className="w-3 h-3" />
      Set {selectedAcc.name} as default
    </button>
  );
}

function CreditCardCycleNotice({ selectedAcc, date }: { selectedAcc?: FinanceAccount; date: string }) {
  if (selectedAcc?.type !== 'credit_card') return null;
  const bDay = selectedAcc.billingDay ?? selectedAcc.statementDay ?? 1;
  const dDay = selectedAcc.dueDay ?? 20;
  const txDate = date || getLocalIsoDate();
  const cycleKey = resolveTransactionCycle(txDate, bDay, dDay);
  const [y, m] = cycleKey.split('-').map(Number);
  const cycleWin = getCycleWindowForMonth(bDay, dDay, y, m - 1, selectedAcc.gracePeriodDays);

  return (
    <div className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary">
      <CreditCard className="w-3.5 h-3.5 shrink-0 text-primary" />
      <span>
        Bill Cycle: <strong className="text-foreground">{formatShortDate(cycleWin.periodEnd)}</strong> · Due on{' '}
        <strong className="text-warning">{formatShortDate(cycleWin.dueDate)}</strong>
      </span>
    </div>
  );
}

export function TxAccountSelector(params: {
  type: FinanceTransactionType;
  accountId: string;
  setAccountId: (id: string) => void;
  activeAccounts: FinanceAccount[];
  date: string;
  onSetDefaultAccount: (acc: FinanceAccount) => void;
}) {
  const { type, accountId, setAccountId, activeAccounts, date, onSetDefaultAccount } = params;
  const selectedAcc = activeAccounts.find((a) => a.id === accountId);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{type === 'transfer' ? 'From Account' : 'Paid via'}</span>
        {type !== 'transfer' && (
          <DefaultAccountBadge selectedAcc={selectedAcc} onSetDefault={() => selectedAcc && onSetDefaultAccount(selectedAcc)} />
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {activeAccounts.map((acc) => {
          const isSelected = accountId === acc.id;
          return (
            <button
              key={acc.id}
              type="button"
              onClick={() => setAccountId(acc.id)}
              className={`min-h-[40px] px-2.5 rounded-xl border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 truncate ${
                isSelected ? 'bg-foreground text-background border-foreground' : 'bg-card text-foreground border-border hover:bg-muted'
              }`}
            >
              <span className="truncate">{acc.name}</span>
              {acc.isDefault && (
                <Star aria-label="Default account" className={`w-3 h-3 shrink-0 ${isSelected ? 'fill-background text-background' : 'fill-primary text-primary'}`} />
              )}
            </button>
          );
        })}
      </div>
      <CreditCardCycleNotice selectedAcc={selectedAcc} date={date} />
    </div>
  );
}

export function TxTagsPicker(params: {
  tags: string[];
  tagInput: string;
  setTagInput: React.Dispatch<React.SetStateAction<string>>;
  suggestedTags: string[];
  onAddTag: (raw: string) => void;
  onRemoveTag: (tag: string) => void;
}) {
  const { tags, tagInput, setTagInput, suggestedTags, onAddTag, onRemoveTag } = params;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Tag className="w-3 h-3" />
          Tags
        </span>
        {tags.length > 0 && <span className="text-[11px] font-mono text-muted-foreground">{tags.length} added</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onRemoveTag(tag)}
            className="h-7 px-2.5 rounded-full bg-primary/10 text-primary text-xs font-medium inline-flex items-center gap-1 hover:bg-primary/20 transition-colors"
          >
            <span>#{tag}</span>
            <X className="w-3 h-3" />
          </button>
        ))}
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                onAddTag(tagInput);
              }
            }}
            placeholder="+ Add tag"
            aria-label="Add tag"
            className="h-7 w-24 px-2 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
          {tagInput.trim() && (
            <button type="button" onClick={() => onAddTag(tagInput)} className="h-7 px-2 rounded-lg bg-muted hover:bg-muted/80 text-xs font-semibold">
              Add
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {suggestedTags
          .filter((t) => !tags.includes(t))
          .slice(0, 5)
          .map((sugg) => (
            <button
              key={sugg}
              type="button"
              onClick={() => onAddTag(sugg)}
              className="h-6 px-2 rounded-md border border-border/70 bg-muted/30 hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              +{sugg}
            </button>
          ))}
      </div>
    </div>
  );
}
