'use client';

import React from 'react';
import { Split, Users, Repeat, Plus, X } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { DebtRecord, FinanceAccount, FinanceCategory } from '@/lib/types';
import { Input } from '@/components/ui/input';
import type { SplitRow } from './tx-modal-types';

function CategorySplitEditor(params: {
  splitRows: SplitRow[];
  setSplitRows: React.Dispatch<React.SetStateAction<SplitRow[]>>;
  splitRemaining: number;
  activeCategories: FinanceCategory[];
}) {
  const { splitRows, setSplitRows, splitRemaining, activeCategories } = params;
  const isBalanced = Math.abs(splitRemaining) <= 0.01;
  const statusLabel = isBalanced
    ? 'Balanced ₹0'
    : splitRemaining > 0
    ? `Remaining ${formatINR(splitRemaining)}`
    : `Over by ${formatINR(Math.abs(splitRemaining))}`;

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-3 space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">Split across categories</span>
        <span className={`font-mono tabular-nums font-semibold ${isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {statusLabel}
        </span>
      </div>

      <div className="space-y-2">
        {splitRows.map((row, idx) => (
          <div key={row.id} className="grid grid-cols-12 gap-1.5 items-center">
            <select
              aria-label={`Split category ${idx + 1}`}
              value={row.categoryId}
              onChange={(e) => setSplitRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, categoryId: e.target.value } : r)))}
              className="col-span-7 h-9 px-2 text-xs rounded-lg border border-input bg-background text-foreground"
            >
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Input
              type="number"
              min="0"
              step="any"
              value={row.amountStr}
              onChange={(e) => setSplitRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, amountStr: e.target.value } : r)))}
              placeholder="₹0"
              aria-label={`Split amount ${idx + 1}`}
              className="col-span-4 h-9 text-xs font-mono tabular-nums text-right rounded-lg"
            />
            <button
              type="button"
              disabled={splitRows.length <= 2}
              onClick={() => setSplitRows((prev) => prev.filter((r) => r.id !== row.id))}
              aria-label="Remove split row"
              className="col-span-1 h-9 flex items-center justify-center text-muted-foreground hover:text-rose-500 disabled:opacity-30"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          setSplitRows((prev) => [
            ...prev,
            { id: crypto.randomUUID(), categoryId: activeCategories[0]?.id || '', amountStr: splitRemaining > 0 ? String(splitRemaining) : '', note: '' },
          ])
        }
        className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" />
        Add category row
      </button>
    </div>
  );
}

function FriendSplitDrawer(params: {
  splitFriendName: string;
  setSplitFriendName: React.Dispatch<React.SetStateAction<string>>;
  splitFriendShareStr: string;
  setSplitFriendShareStr: React.Dispatch<React.SetStateAction<string>>;
  activeDebts: DebtRecord[];
  numericAmount: number;
  categoryName: string;
  isCreditCard: boolean;
}) {
  const { splitFriendName, setSplitFriendName, splitFriendShareStr, setSplitFriendShareStr, activeDebts, numericAmount, categoryName, isCreditCard } = params;
  const parsedShare = parseFloat(splitFriendShareStr);
  const friendShare = !Number.isNaN(parsedShare) && splitFriendShareStr.trim() !== '' ? Math.max(0, parsedShare) : Math.round(numericAmount / 2);
  const myShare = Math.max(0, numericAmount - friendShare);

  return (
    <div className="rounded-xl border border-sky-500/30 bg-card p-3 space-y-2.5">
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-7">
          <Input value={splitFriendName} onChange={(e) => setSplitFriendName(e.target.value)} placeholder="Friend's name (e.g. Rahul)" list="existing-friends-list" className="h-9 text-xs rounded-lg" />
          <datalist id="existing-friends-list">
            {activeDebts.map((d) => (
              <option key={d.id} value={d.personName} />
            ))}
          </datalist>
        </div>
        <div className="col-span-5">
          <Input type="number" min="1" value={splitFriendShareStr} onChange={(e) => setSplitFriendShareStr(e.target.value)} placeholder="Friend owes ₹" className="h-9 text-xs font-mono tabular-nums rounded-lg" />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
        You pay <strong className="text-foreground">{formatINR(myShare)}</strong> ({categoryName}), Friend owes{' '}
        <strong className="text-sky-600 dark:text-sky-400">{formatINR(friendShare)}</strong>
        {isCreditCard && <span> (Credit Card swipe: {formatINR(numericAmount)})</span>}
      </p>
    </div>
  );
}

function RecurringBillDrawer(params: {
  recurringCadence: 'monthly' | 'quarterly' | 'yearly';
  setRecurringCadence: React.Dispatch<React.SetStateAction<'monthly' | 'quarterly' | 'yearly'>>;
  recurringDueDay: string;
  setRecurringDueDay: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { recurringCadence, setRecurringCadence, recurringDueDay, setRecurringDueDay } = params;
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-card p-3 grid grid-cols-2 gap-2.5">
      <div className="space-y-1">
        <label htmlFor="tx-rec-cadence" className="text-[11px] font-medium text-muted-foreground block">Cadence</label>
        <select
          id="tx-rec-cadence"
          value={recurringCadence}
          onChange={(e) => setRecurringCadence(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
          className="w-full h-9 px-2.5 text-xs rounded-lg border border-input bg-background text-foreground"
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="tx-rec-day" className="text-[11px] font-medium text-muted-foreground block">Due Day (1–31)</label>
        <Input id="tx-rec-day" type="number" min="1" max="31" value={recurringDueDay} onChange={(e) => setRecurringDueDay(e.target.value)} className="h-9 text-xs font-mono tabular-nums rounded-lg" />
      </div>
    </div>
  );
}

export function TxSplitAndRecurringSection(params: {
  isCategorySplitEnabled: boolean;
  onToggleCategorySplit: () => void;
  isSplitEnabled: boolean;
  onToggleFriendSplit: () => void;
  isRecurringEnabled: boolean;
  setIsRecurringEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  splitRows: SplitRow[];
  setSplitRows: React.Dispatch<React.SetStateAction<SplitRow[]>>;
  splitRemaining: number;
  activeCategories: FinanceCategory[];
  splitFriendName: string;
  setSplitFriendName: React.Dispatch<React.SetStateAction<string>>;
  splitFriendShareStr: string;
  setSplitFriendShareStr: React.Dispatch<React.SetStateAction<string>>;
  activeDebts: DebtRecord[];
  numericAmount: number;
  categoryName: string;
  selectedAccount?: FinanceAccount;
  recurringCadence: 'monthly' | 'quarterly' | 'yearly';
  setRecurringCadence: React.Dispatch<React.SetStateAction<'monthly' | 'quarterly' | 'yearly'>>;
  recurringDueDay: string;
  setRecurringDueDay: React.Dispatch<React.SetStateAction<string>>;
}) {
  const {
    isCategorySplitEnabled, onToggleCategorySplit, isSplitEnabled, onToggleFriendSplit,
    isRecurringEnabled, setIsRecurringEnabled, splitRows, setSplitRows, splitRemaining,
    activeCategories, splitFriendName, setSplitFriendName, splitFriendShareStr,
    setSplitFriendShareStr, activeDebts, numericAmount, categoryName, selectedAccount,
    recurringCadence, setRecurringCadence, recurringDueDay, setRecurringDueDay,
  } = params;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={onToggleCategorySplit}
          className={`min-h-[38px] px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            isCategorySplitEnabled ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground'
          }`}
        >
          <Split className="w-3.5 h-3.5" />
          <span>Split Cats</span>
        </button>

        <button
          type="button"
          onClick={onToggleFriendSplit}
          className={`min-h-[38px] px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            isSplitEnabled ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'border-border bg-card text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Friend Split</span>
        </button>

        <button
          type="button"
          onClick={() => setIsRecurringEnabled((v) => !v)}
          className={`min-h-[38px] px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            isRecurringEnabled ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-border bg-card text-muted-foreground hover:text-foreground'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Recurring</span>
        </button>
      </div>

      {isCategorySplitEnabled && (
        <CategorySplitEditor splitRows={splitRows} setSplitRows={setSplitRows} splitRemaining={splitRemaining} activeCategories={activeCategories} />
      )}
      {isSplitEnabled && (
        <FriendSplitDrawer
          splitFriendName={splitFriendName}
          setSplitFriendName={setSplitFriendName}
          splitFriendShareStr={splitFriendShareStr}
          setSplitFriendShareStr={setSplitFriendShareStr}
          activeDebts={activeDebts}
          numericAmount={numericAmount}
          categoryName={categoryName}
          isCreditCard={selectedAccount?.type === 'credit_card'}
        />
      )}
      {isRecurringEnabled && (
        <RecurringBillDrawer
          recurringCadence={recurringCadence}
          setRecurringCadence={setRecurringCadence}
          recurringDueDay={recurringDueDay}
          setRecurringDueDay={setRecurringDueDay}
        />
      )}
    </div>
  );
}
