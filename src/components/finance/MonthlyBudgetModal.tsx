'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CategoryIcon } from './CategoryIcon';
import { toast } from 'sonner';

interface MonthlyBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusCategoryId?: string | null;
}

function formatMonthDisplay(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const date = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export function MonthlyBudgetModal({
  open,
  onOpenChange,
  focusCategoryId,
}: MonthlyBudgetModalProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const budgets = useFinanceStore((s) => s.budgets);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const saveMonthlyBudgetSettings = useFinanceStore(
    (s) => s.saveMonthlyBudgetSettings
  );

  const [overallInput, setOverallInput] = useState('');
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const summary = getMonthlySummary(selectedMonth);
  const spentByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of summary.categoryBreakdown) {
      map.set(item.category.id, item.spent);
    }
    return map;
  }, [summary.categoryBreakdown]);

  useEffect(() => {
    if (!open) return;

    const existingBudget = budgets.find((b) => b.monthKey === selectedMonth);
    setOverallInput(
      existingBudget && existingBudget.totalBudget > 0
        ? String(existingBudget.totalBudget)
        : ''
    );

    const nextCats: Record<string, string> = {};
    for (const cat of categories) {
      nextCats[cat.id] = cat.monthlyBudgetLimit > 0 ? String(cat.monthlyBudgetLimit) : '';
    }
    setCategoryInputs(nextCats);
  }, [open, selectedMonth, categories, budgets]);

  useEffect(() => {
    if (!open || !focusCategoryId) return;
    const el = document.getElementById(`cat-budget-input-${focusCategoryId}`);
    if (el) {
      setTimeout(() => {
        el.focus();
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 120);
    }
  }, [open, focusCategoryId]);

  const categorySum = useMemo(() => {
    return Object.values(categoryInputs).reduce((sum, val) => {
      const n = parseFloat(val);
      return sum + (!isNaN(n) && n > 0 ? n : 0);
    }, 0);
  }, [categoryInputs]);

  const overallNum = parseFloat(overallInput) || 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericLimits: Record<string, number> = {};
    for (const cat of categories) {
      const parsed = parseFloat(categoryInputs[cat.id] || '0');
      numericLimits[cat.id] = !isNaN(parsed) && parsed > 0 ? parsed : 0;
    }

    setIsSaving(true);
    try {
      await saveMonthlyBudgetSettings(selectedMonth, overallNum, numericLimits);
      toast.success('Monthly & category budgets saved');
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-[500px] w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col border-border bg-background"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-2 shrink-0">
          <div>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
              Monthly Budgets ({formatMonthDisplay(selectedMonth)})
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Set an overall cap and limits for specific expense categories
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Overall Monthly Spending Limit */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="overall-budget-input"
                  className="text-sm font-semibold text-foreground"
                >
                  Overall Monthly Budget (₹)
                </Label>
                {categorySum > 0 && overallNum !== categorySum && (
                  <button
                    type="button"
                    onClick={() => setOverallInput(String(categorySum))}
                    className="min-h-[36px] px-2.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 transition-colors whitespace-nowrap"
                  >
                    Use sum ({formatINR(categorySum)})
                  </button>
                )}
              </div>

              <Input
                id="overall-budget-input"
                type="number"
                min="0"
                step="100"
                value={overallInput}
                onChange={(e) => setOverallInput(e.target.value)}
                placeholder={
                  categorySum > 0
                    ? `Auto: ${categorySum} (sum of categories)`
                    : 'e.g., 30000'
                }
                className="h-11 font-mono tabular-nums text-base"
              />
              <p className="text-xs text-muted-foreground">
                Allocated across categories:{' '}
                <span className="font-mono tabular-nums font-semibold text-foreground">
                  {formatINR(categorySum)}
                </span>
              </p>
            </div>

            {/* Category Spending Limits */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Category Spending Limits
                </span>
                {categorySum > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const cleared: Record<string, string> = {};
                      for (const cat of categories) cleared[cat.id] = '';
                      setCategoryInputs(cleared);
                    }}
                    className="min-h-[36px] px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden">
                {categories.map((cat) => {
                  const spent = spentByCat.get(cat.id) || 0;
                  return (
                    <div
                      key={cat.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${cat.color}18`,
                            color: cat.color,
                          }}
                        >
                          <CategoryIcon name={cat.icon} className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <label
                            htmlFor={`cat-budget-input-${cat.id}`}
                            className="text-sm font-medium text-foreground truncate block"
                          >
                            {cat.name}
                          </label>
                          <span className="text-xs text-muted-foreground font-mono tabular-nums">
                            Spent {formatINR(spent)}
                          </span>
                        </div>
                      </div>

                      <div className="relative w-28 sm:w-32 shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          ₹
                        </span>
                        <Input
                          id={`cat-budget-input-${cat.id}`}
                          type="number"
                          min="0"
                          step="50"
                          value={categoryInputs[cat.id] || ''}
                          onChange={(e) =>
                            setCategoryInputs((prev) => ({
                              ...prev,
                              [cat.id]: e.target.value,
                            }))
                          }
                          placeholder="No limit"
                          className="h-11 pl-6 pr-2.5 text-right text-sm font-mono tabular-nums rounded-xl"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="px-5 py-3.5 border-t border-border bg-background flex items-center gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="min-h-[44px] flex-1 rounded-xl"
            >
              {isSaving ? 'Saving...' : 'Save Budgets'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
