'use client';

import { X } from 'lucide-react';
import { formatMonthDisplay } from '@/lib/finance/budget-helpers';
import { useMonthlyBudgetController } from './budget/useMonthlyBudgetController';
import { BudgetCategoryRow } from './budget/BudgetCategoryRow';
import {
  BudgetIncomeSettingsCard,
  ZeroBasedReadyBanner,
} from './budget/BudgetSections';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface MonthlyBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusCategoryId?: string | null;
}

export function MonthlyBudgetModal({ open, onOpenChange, focusCategoryId }: MonthlyBudgetModalProps) {
  const f = useMonthlyBudgetController({ open, onOpenChange, focusCategoryId });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-[540px] w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col border-border bg-background"
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="px-5 py-3.5 border-b border-border bg-card flex items-center justify-between gap-2 shrink-0">
          <div>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
              Monthly Budgets &amp; Envelopes ({formatMonthDisplay(f.selectedMonth)})
            </DialogTitle>
            <p className="text-xs text-muted-foreground">Switch between flexible Cap Mode and Zero-Based Ready to Assign</p>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={f.handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted">
              {([['cap', 'Cap Mode (Default)'], ['zero_based', 'Zero-Based (Ready to Assign)']] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => f.setBudgetMode(mode)}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold transition-all ${
                    f.budgetMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {f.budgetMode === 'zero_based' && (
              <ZeroBasedReadyBanner
                readyToAssign={f.readyToAssign}
                assignableIncomeBase={f.assignableIncomeBase}
                categorySum={f.categorySum}
                plannedSipNum={f.plannedSipNum}
                fixedObligations={f.fixedObligations}
                onAutoAssign={f.handleAutoAssignRemaining}
              />
            )}

            <BudgetIncomeSettingsCard f={f} />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Category Envelopes &amp; Unused Rollover</span>
                {f.categorySum > 0 && (
                  <button type="button" onClick={f.clearCategoryLimits} className="min-h-[32px] px-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Clear limits
                  </button>
                )}
              </div>
              <div className="rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden">
                {f.activeExpenseCategories.map((cat) => (
                  <BudgetCategoryRow
                    key={cat.id}
                    cat={cat}
                    spent={f.spentByCat.get(cat.id) ?? 0}
                    isRolloverOn={Boolean(f.categoryRollovers[cat.id])}
                    inputValue={f.categoryInputs[cat.id] ?? ''}
                    budgetMode={f.budgetMode}
                    onToggleRollover={f.toggleCategoryRollover}
                    onInputChange={f.setCategoryInput}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 py-3.5 border-t border-border bg-background flex items-center gap-2.5 shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px] flex-1 rounded-xl">Cancel</Button>
            <Button type="submit" disabled={f.isSaving} className="min-h-[44px] flex-1 rounded-xl">
              {f.isSaving ? 'Saving...' : f.budgetMode === 'zero_based' ? 'Save Zero-Based Plan' : 'Save Budgets'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
