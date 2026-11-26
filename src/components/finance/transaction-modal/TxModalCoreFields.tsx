'use client';

import React from 'react';
import { ChevronDown, X, MessageSquareText } from 'lucide-react';
import { DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { FinanceAccount, FinanceCategory, FinanceTransactionType } from '@/lib/types';
import { CategoryIcon } from '../CategoryIcon';

const TX_TYPES = [
  { id: 'expense', label: 'Expense' },
  { id: 'income', label: 'Income' },
  { id: 'investment', label: 'Invest' },
  { id: 'transfer', label: 'Transfer' },
] as const;

export function TxModalHeader(params: {
  isEditing: boolean;
  type: FinanceTransactionType;
  onSelectType: (t: FinanceTransactionType) => void;
  onOpenSms: () => void;
  onClose: () => void;
}) {
  const { isEditing, type, onSelectType, onOpenSms, onClose } = params;
  return (
    <div className="px-4 pt-2 pb-3 border-b border-border/60 bg-card flex items-center justify-between gap-2 shrink-0">
      <DialogTitle className="sr-only">{isEditing ? 'Edit Transaction' : 'Quick Add Transaction'}</DialogTitle>
      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-muted flex-1">
        {TX_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectType(t.id)}
            className={`min-h-[38px] px-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              type === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {!isEditing && (
        <button
          type="button"
          onClick={onOpenSms}
          aria-label="Fetch from SMS or Notification"
          title="Fetch from SMS or Notification"
          className="min-h-[42px] px-2.5 flex items-center justify-center gap-1 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-primary transition-colors shrink-0"
        >
          <MessageSquareText className="w-4 h-4" />
          <span className="hidden sm:inline">SMS</span>
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

const AMOUNT_COLOR_BY_TYPE: Record<FinanceTransactionType, string> = {
  income: 'text-emerald-600 dark:text-emerald-400',
  investment: 'text-violet-600 dark:text-violet-400',
  expense: 'text-foreground',
  transfer: 'text-foreground',
};

export function TxHeroAmountInput(params: {
  amountInputRef: React.RefObject<HTMLInputElement | null>;
  amountStr: string;
  setAmountStr: React.Dispatch<React.SetStateAction<string>>;
  type: FinanceTransactionType;
}) {
  const { amountInputRef, amountStr, setAmountStr, type } = params;
  return (
    <div className="text-center py-1 px-4 cursor-text" onClick={() => amountInputRef.current?.focus()}>
      <div className="inline-flex items-center justify-center gap-1.5 max-w-full">
        <span className="text-3xl sm:text-4xl font-semibold text-muted-foreground select-none">₹</span>
        <input
          ref={amountInputRef}
          id="tx-amount-input"
          type="text"
          inputMode="decimal"
          pattern="[0-9]*[.,]?[0-9]*"
          value={amountStr}
          onChange={(e) => {
            const val = e.target.value.replace(',', '.');
            if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setAmountStr(val);
          }}
          placeholder="0"
          autoFocus
          className={`w-full max-w-[260px] text-4xl sm:text-5xl font-bold font-mono tabular-nums tracking-tight text-center bg-transparent border-b-2 border-transparent hover:border-border/60 focus:border-primary outline-none focus:outline-none transition-colors ${AMOUNT_COLOR_BY_TYPE[type]}`}
          aria-label="Transaction Amount in Rupees"
        />
      </div>
    </div>
  );
}

function TxCategorySelectorButton({ selectedCategory, onClick }: { selectedCategory?: FinanceCategory; onClick: () => void }) {
  const catColor = selectedCategory?.color || '#64748b';
  return (
    <div className="col-span-5 space-y-1">
      <span className="text-xs font-medium text-muted-foreground block">Category</span>
      <button
        type="button"
        onClick={onClick}
        className="w-full h-11 px-2.5 rounded-xl border border-input bg-card hover:bg-muted/60 flex items-center justify-between gap-1.5 text-left transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
            style={{ borderWidth: '1.5px', borderStyle: 'solid', borderColor: `${catColor}80`, backgroundColor: `${catColor}15`, color: selectedCategory?.color || 'currentColor' }}
          >
            <CategoryIcon name={selectedCategory?.icon} className="w-3.5 h-3.5" />
          </span>
          <span className="text-xs font-medium text-foreground truncate">{selectedCategory?.name || 'Select'}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
    </div>
  );
}

export function TxMerchantAndCategoryRow(params: {
  type: FinanceTransactionType;
  title: string;
  onTitleChange: (val: string) => void;
  isCategorySplitEnabled: boolean;
  selectedCategory?: FinanceCategory;
  onOpenCategorySheet: () => void;
}) {
  const { type, title, onTitleChange, isCategorySplitEnabled, selectedCategory, onOpenCategorySheet } = params;
  return (
    <div className="grid grid-cols-12 gap-2.5 items-end">
      <div className={isCategorySplitEnabled ? 'col-span-12 space-y-1' : 'col-span-7 space-y-1'}>
        <label htmlFor="tx-description" className="text-xs font-medium text-muted-foreground block">Merchant or Description</label>
        <Input
          id="tx-description"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={type === 'investment' ? 'e.g. Nifty 50 Index SIP' : 'e.g. Swiggy, Uber, Grocery'}
          className="h-11 text-sm rounded-xl"
        />
      </div>
      {!isCategorySplitEnabled && <TxCategorySelectorButton selectedCategory={selectedCategory} onClick={onOpenCategorySheet} />}
    </div>
  );
}

export function TxTransferFields(params: {
  activeAccounts: FinanceAccount[];
  toAccountId: string;
  setToAccountId: React.Dispatch<React.SetStateAction<string>>;
  title: string;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { activeAccounts, toAccountId, setToAccountId, title, setTitle } = params;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">To Account</span>
        <div className="flex gap-2 overflow-x-auto pb-1 no-swipe">
          {activeAccounts.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => setToAccountId(acc.id)}
              className={`shrink-0 min-h-[40px] px-3 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap ${
                toAccountId === acc.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:bg-muted'
              }`}
            >
              {acc.name}
            </button>
          ))}
        </div>
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Transfer note (optional)" className="h-10 text-sm rounded-xl" />
    </div>
  );
}
