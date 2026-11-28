'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinanceBudgetMode } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { CategoryIcon } from '../CategoryIcon';

export const BudgetCategoryRow = React.memo(function BudgetCategoryRow(props: {
  cat: { id: string; name: string; color: string; icon: string };
  spent: number;
  isRolloverOn: boolean;
  inputValue: string;
  budgetMode: FinanceBudgetMode;
  onToggleRollover: () => void;
  onInputChange: (val: string) => void;
}) {
  const { cat, spent, isRolloverOn, inputValue, budgetMode, onToggleRollover, onInputChange } = props;
  return (
    <div className="px-3.5 py-2.5 flex items-center justify-between gap-2.5">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${cat.color}18`, color: cat.color }}>
          <CategoryIcon name={cat.icon} className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <label htmlFor={`cat-budget-input-${cat.id}`} className="text-xs sm:text-sm font-medium text-foreground truncate block">{cat.name}</label>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums">Spent {formatINR(spent)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleRollover}
        title="Roll over unused budget from previous month"
        className={`h-8 px-2 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0 ${
          isRolloverOn ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'border-border bg-background text-muted-foreground hover:text-foreground'
        }`}
      >
        <RefreshCw className="w-3 h-3" />
        <span className="hidden sm:inline">Rollover</span>
      </button>
      <div className="relative w-24 sm:w-28 shrink-0">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
        <Input
          id={`cat-budget-input-${cat.id}`}
          type="number"
          min="0"
          step="50"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={budgetMode === 'zero_based' ? '0' : 'No limit'}
          className="h-9 pl-5 pr-2 text-right text-xs sm:text-sm font-mono tabular-nums rounded-xl"
        />
      </div>
    </div>
  );
});
