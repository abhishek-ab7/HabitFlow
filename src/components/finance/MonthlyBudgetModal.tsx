'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { FinanceBudgetMode } from '@/lib/types';
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

  const [budgetMode, setBudgetMode] = useState<FinanceBudgetMode>('cap');
  const [overallInput, setOverallInput] = useState('');
  const [expectedIncomeInput, setExpectedIncomeInput] = useState('');
  const [plannedSipInput, setPlannedSipInput] = useState('');
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});
  const [categoryRollovers, setCategoryRollovers] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  const summary = getMonthlySummary(selectedMonth);
  const spentByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of summary.categoryBreakdown) {
      map.set(item.category.id, item.spent);
    }
    return map;
  }, [summary.categoryBreakdown]);

  const activeExpenseCategories = useMemo(
    () => categories.filter((c) => !c.deletedAt && c.type !== 'income'),
    [categories]
  );

  useEffect(() => {
    if (!open) return;

    const existingBudget = budgets.find(
      (b) => b.monthKey === selectedMonth && !b.deletedAt
    );
    setBudgetMode(existingBudget?.budgetMode || 'cap');
    setOverallInput(
      existingBudget && existingBudget.totalBudget > 0
        ? String(existingBudget.totalBudget)
        : ''
    );
    setExpectedIncomeInput(
      existingBudget && existingBudget.expectedIncome > 0
        ? String(existingBudget.expectedIncome)
        : summary.totalIncome > 0
        ? String(summary.totalIncome)
        : ''
    );
    setPlannedSipInput(
      existingBudget && (existingBudget.plannedSipAmount || 0) > 0
        ? String(existingBudget.plannedSipAmount)
        : ''
    );

    const nextCats: Record<string, string> = {};
    const nextRollovers: Record<string, boolean> = {};
    for (const cat of categories) {
      nextCats[cat.id] =
        cat.monthlyBudgetLimit > 0 ? String(cat.monthlyBudgetLimit) : '';
      nextRollovers[cat.id] = Boolean(cat.rolloverEnabled);
    }
    setCategoryInputs(nextCats);
    setCategoryRollovers(nextRollovers);
  }, [open, selectedMonth, categories, budgets, summary.totalIncome]);

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
  const expectedIncomeNum = parseFloat(expectedIncomeInput) || 0;
  const plannedSipNum = parseFloat(plannedSipInput) || 0;

  const fixedObligations =
    summary.remainingUnpaidEmis +
    summary.remainingUnpaidCommitments +
    summary.remainingUnpaidBills +
    summary.plannedDebtInstallmentsDue;

  const assignableIncomeBase =
    expectedIncomeNum > 0 ? expectedIncomeNum : summary.totalIncome;
  const totalAssigned = categorySum + plannedSipNum + fixedObligations;
  const readyToAssign = Math.round(assignableIncomeBase - totalAssigned);

  const handleAutoAssignRemaining = () => {
    if (readyToAssign <= 0) {
      toast.info('All income is already assigned (or over-assigned)');
      return;
    }
    // Put remaining into SIP/Savings target or top unbudgeted category
    const savingsCat = activeExpenseCategories.find((c) =>
      /saving|buffer|misc|personal|shopping/i.test(c.name)
    );
    if (savingsCat) {
      const currentVal = parseFloat(categoryInputs[savingsCat.id] || '0') || 0;
      setCategoryInputs((prev) => ({
        ...prev,
        [savingsCat.id]: String(Math.round(currentVal + readyToAssign)),
      }));
      toast.success(
        `Assigned ${formatINR(readyToAssign)} to ${savingsCat.name}`
      );
    } else {
      setPlannedSipInput(String(Math.round(plannedSipNum + readyToAssign)));
      toast.success(`Assigned ${formatINR(readyToAssign)} to Target SIP / Savings`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericLimits: Record<string, number> = {};
    for (const cat of categories) {
      const parsed = parseFloat(categoryInputs[cat.id] || '0');
      numericLimits[cat.id] = !isNaN(parsed) && parsed > 0 ? parsed : 0;
    }

    const effectiveOverall =
      budgetMode === 'zero_based' && categorySum > 0 ? categorySum : overallNum;

    setIsSaving(true);
    try {
      await saveMonthlyBudgetSettings(
        selectedMonth,
        effectiveOverall,
        numericLimits,
        {
          expectedIncome: expectedIncomeNum,
          plannedSipAmount: plannedSipNum,
          categoryRollovers,
          budgetMode,
          assignedIncome: budgetMode === 'zero_based' ? totalAssigned : undefined,
        }
      );
      toast.success(
        budgetMode === 'zero_based'
          ? 'Zero-Based budget plan saved'
          : 'Monthly budgets & rollover envelopes saved'
      );
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-[540px] w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col border-border bg-background"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border bg-card/85 backdrop-blur-md flex items-center justify-between gap-2 shrink-0">
          <div>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
              Monthly Budgets &amp; Envelopes ({formatMonthDisplay(selectedMonth)})
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Switch between flexible Cap Mode and Zero-Based Ready to Assign
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
            {/* Mode Switcher: Cap Mode (Default) vs Zero-Based ("Ready to Assign") */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted">
              <button
                type="button"
                onClick={() => setBudgetMode('cap')}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold transition-all ${
                  budgetMode === 'cap'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Cap Mode (Default)
              </button>
              <button
                type="button"
                onClick={() => setBudgetMode('zero_based')}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold transition-all ${
                  budgetMode === 'zero_based'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Zero-Based (Ready to Assign)
              </button>
            </div>

            {/* Zero-Based Ready to Assign Banner */}
            {budgetMode === 'zero_based' && (
              <div
                className={`rounded-2xl border p-4 space-y-2.5 ${
                  readyToAssign === 0
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : readyToAssign < 0
                    ? 'border-rose-500/40 bg-rose-500/5'
                    : 'border-primary/35 bg-primary/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Ready to Assign
                    </p>
                    <p
                      className={`text-2xl font-bold font-mono tabular-nums mt-0.5 ${
                        readyToAssign === 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : readyToAssign < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-foreground'
                      }`}
                    >
                      {formatINR(readyToAssign)}
                    </p>
                  </div>

                  {readyToAssign > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAutoAssignRemaining}
                      className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      Auto-Assign
                    </Button>
                  ) : readyToAssign === 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Every ₹ has a job
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="w-4 h-4" />
                      Over-assigned
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums text-muted-foreground pt-1 border-t border-border/50">
                  <span>Income {formatINR(assignableIncomeBase)}</span>
                  <span>·</span>
                  <span>Envelopes {formatINR(categorySum)}</span>
                  <span>·</span>
                  <span>SIPs {formatINR(plannedSipNum)}</span>
                  <span>·</span>
                  <span>Fixed Dues {formatINR(fixedObligations)}</span>
                </div>
              </div>
            )}

            {/* Overall Monthly Spending Limit & Cash Flow Inputs */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3.5">
              {budgetMode === 'cap' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="overall-budget-input"
                      className="text-xs sm:text-sm font-semibold text-foreground"
                    >
                      Overall Variable Spending Budget (₹)
                    </Label>
                    {categorySum > 0 && overallNum !== categorySum && (
                      <button
                        type="button"
                        onClick={() => setOverallInput(String(categorySum))}
                        className="min-h-[30px] px-2.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 transition-colors whitespace-nowrap"
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
                        : 'e.g., 35000'
                    }
                    className="h-10 font-mono tabular-nums text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label
                    htmlFor="expected-income-input"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {budgetMode === 'zero_based'
                      ? 'Monthly Income to Assign (₹)'
                      : 'Expected Monthly Income (₹)'}
                  </Label>
                  <Input
                    id="expected-income-input"
                    type="number"
                    min="0"
                    step="500"
                    value={expectedIncomeInput}
                    onChange={(e) => setExpectedIncomeInput(e.target.value)}
                    placeholder="e.g., 85000"
                    className="h-10 font-mono tabular-nums text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="planned-sip-input"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Target Monthly SIP / Savings (₹)
                  </Label>
                  <Input
                    id="planned-sip-input"
                    type="number"
                    min="0"
                    step="500"
                    value={plannedSipInput}
                    onChange={(e) => setPlannedSipInput(e.target.value)}
                    placeholder="e.g., 15000"
                    className="h-10 font-mono tabular-nums text-sm"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Allocated across categories:{' '}
                <span className="font-mono tabular-nums font-semibold text-foreground">
                  {formatINR(categorySum)}
                </span>
              </p>
            </div>

            {/* Category Spending Limits & Rollover Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Category Envelopes &amp; Unused Rollover
                </span>
                {categorySum > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const cleared: Record<string, string> = {};
                      for (const cat of categories) cleared[cat.id] = '';
                      setCategoryInputs(cleared);
                    }}
                    className="min-h-[32px] px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear limits
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden">
                {activeExpenseCategories.map((cat) => {
                  const spent = spentByCat.get(cat.id) || 0;
                  const isRolloverOn = Boolean(categoryRollovers[cat.id]);
                  return (
                    <div
                      key={cat.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
                            className="text-xs sm:text-sm font-medium text-foreground truncate block"
                          >
                            {cat.name}
                          </label>
                          <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                            Spent {formatINR(spent)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setCategoryRollovers((prev) => ({
                            ...prev,
                            [cat.id]: !prev[cat.id],
                          }))
                        }
                        title="Roll over unused budget from previous month"
                        className={`h-8 px-2 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0 ${
                          isRolloverOn
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'border-border bg-background text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span className="hidden sm:inline">Rollover</span>
                      </button>

                      <div className="relative w-24 sm:w-28 shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
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
                          placeholder={budgetMode === 'zero_based' ? '0' : 'No limit'}
                          className="h-9 pl-5 pr-2 text-right text-xs sm:text-sm font-mono tabular-nums rounded-xl"
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
              {isSaving
                ? 'Saving...'
                : budgetMode === 'zero_based'
                ? 'Save Zero-Based Plan'
                : 'Save Budgets'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
