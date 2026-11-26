'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import {
  normalizePaydayOfMonth,
  resolveEffectivePaydayOfMonth,
} from '@/lib/finance/payday';
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

function ZeroBasedReadyBanner(props: {
  readyToAssign: number;
  assignableIncomeBase: number;
  categorySum: number;
  plannedSipNum: number;
  fixedObligations: number;
  onAutoAssign: () => void;
}) {
  const { readyToAssign, assignableIncomeBase, categorySum, plannedSipNum, fixedObligations, onAutoAssign } = props;
  const bannerTone =
    readyToAssign === 0
      ? 'border-emerald-500/40 bg-emerald-500/5'
      : readyToAssign < 0
      ? 'border-rose-500/40 bg-rose-500/5'
      : 'border-primary/35 bg-primary/5';
  const amountTone =
    readyToAssign === 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : readyToAssign < 0
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-foreground';

  return (
    <div className={`rounded-2xl border p-4 space-y-2.5 ${bannerTone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ready to Assign</p>
          <p className={`text-2xl font-bold font-mono tabular-nums mt-0.5 ${amountTone}`}>{formatINR(readyToAssign)}</p>
        </div>
        {readyToAssign > 0 ? (
          <Button type="button" size="sm" variant="outline" onClick={onAutoAssign} className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5">
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
  );
}

function SalaryLeaveCalculator(props: {
  salaryDivisor: 30 | 26;
  onDivisorChange: (d: 30 | 26) => void;
  baseSalaryInput: string;
  onBaseSalaryChange: (v: string) => void;
  leaveDaysInput: string;
  onLeaveDaysChange: (v: string) => void;
  leaveDaysNum: number;
  leaveCutAmount: number;
  netSalaryAfterLeave: number;
  onApplyNetSalary: () => void;
}) {
  const {
    salaryDivisor,
    onDivisorChange,
    baseSalaryInput,
    onBaseSalaryChange,
    leaveDaysInput,
    onLeaveDaysChange,
    leaveDaysNum,
    leaveCutAmount,
    netSalaryAfterLeave,
    onApplyNetSalary,
  } = props;

  return (
    <div className="rounded-xl border border-border/80 bg-muted/40 p-3 space-y-2.5 text-xs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-semibold text-foreground">Salary Leave / Half-Day Cut Calculator</span>
        <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-[11px]">
          {([30, 26] as const).map((div) => (
            <button
              key={div}
              type="button"
              onClick={() => onDivisorChange(div)}
              className={`px-2 py-0.5 rounded-md font-medium ${salaryDivisor === div ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              {div === 30 ? '÷30 days' : '÷26 work days'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <Label htmlFor="base-salary-calc" className="text-[11px] text-muted-foreground">Full Base Salary (₹)</Label>
          <Input id="base-salary-calc" type="number" min="0" step="1" value={baseSalaryInput} onChange={(e) => onBaseSalaryChange(e.target.value)} className="h-9 font-mono tabular-nums text-xs" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="leave-days-calc" className="text-[11px] text-muted-foreground">Unpaid Leave Days</Label>
          <Input id="leave-days-calc" type="number" min="0" step="0.5" value={leaveDaysInput} onChange={(e) => onLeaveDaysChange(e.target.value)} className="h-9 font-mono tabular-nums text-xs" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {[0.5, 1, 2, 3].map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => onLeaveDaysChange(String(days))}
            className={`px-2 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
              leaveDaysNum === days ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            {days === 0.5 ? 'Half day (0.5)' : `${days}d off`}
          </button>
        ))}
        <button type="button" onClick={() => onLeaveDaysChange('0')} className="px-2 py-1 rounded-lg border border-border bg-background text-[11px] text-muted-foreground hover:text-foreground">
          Reset
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
        <span className="font-mono tabular-nums text-[11px] text-muted-foreground">
          Cut: <strong className="text-rose-500">-{formatINR(leaveCutAmount)}</strong> · Net: <strong className="text-foreground">{formatINR(netSalaryAfterLeave)}</strong>
        </span>
        <Button type="button" size="sm" onClick={onApplyNetSalary} className="h-8 px-3 text-xs rounded-lg">
          Apply {formatINR(netSalaryAfterLeave)}
        </Button>
      </div>
    </div>
  );
}

function CategoryEnvelopeRow(props: {
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
}

const positiveStr = (val?: number): string => (val && val > 0 ? String(val) : '');

function buildCategoryMaps(categories: ReturnType<typeof useFinanceStore.getState>['categories']) {
  const categoryInputs: Record<string, string> = {};
  const categoryRollovers: Record<string, boolean> = {};
  for (const cat of categories) {
    categoryInputs[cat.id] = positiveStr(cat.monthlyBudgetLimit);
    categoryRollovers[cat.id] = Boolean(cat.rolloverEnabled);
  }
  return { categoryInputs, categoryRollovers };
}

function computeBudgetFormDerived(params: {
  categoryInputs: Record<string, string>;
  overallInput: string;
  expectedIncomeInput: string;
  plannedSipInput: string;
  baseSalaryInput: string;
  leaveDaysInput: string;
  salaryDivisor: 30 | 26;
  summary: ReturnType<ReturnType<typeof useFinanceStore.getState>['getMonthlySummary']>;
}) {
  const categorySum = Object.values(params.categoryInputs).reduce(
    (sum, val) => sum + (parseFloat(val) > 0 ? parseFloat(val) : 0),
    0
  );
  const overallNum = parseFloat(params.overallInput) || 0;
  const expectedIncomeNum = parseFloat(params.expectedIncomeInput) || 0;
  const plannedSipNum = parseFloat(params.plannedSipInput) || 0;
  const baseSalaryNum = parseFloat(params.baseSalaryInput) || 0;
  const leaveDaysNum = Math.max(0, parseFloat(params.leaveDaysInput) || 0);
  const leaveCutAmount =
    baseSalaryNum > 0 && leaveDaysNum > 0 ? Math.round((baseSalaryNum / params.salaryDivisor) * leaveDaysNum) : 0;
  const netSalaryAfterLeave = Math.max(0, Math.round(baseSalaryNum - leaveCutAmount));
  const fixedObligations =
    params.summary.remainingUnpaidEmis +
    params.summary.remainingUnpaidCommitments +
    params.summary.remainingUnpaidBills +
    params.summary.plannedDebtInstallmentsDue;
  const assignableIncomeBase = expectedIncomeNum > 0 ? expectedIncomeNum : params.summary.totalIncome;
  const totalAssigned = categorySum + plannedSipNum + fixedObligations;
  const readyToAssign = Math.round(assignableIncomeBase - totalAssigned);
  return {
    categorySum,
    overallNum,
    expectedIncomeNum,
    plannedSipNum,
    leaveDaysNum,
    leaveCutAmount,
    netSalaryAfterLeave,
    fixedObligations,
    assignableIncomeBase,
    totalAssigned,
    readyToAssign,
  };
}

function buildInitialBudgetState(params: {
  selectedMonth: string;
  categories: ReturnType<typeof useFinanceStore.getState>['categories'];
  budgets: ReturnType<typeof useFinanceStore.getState>['budgets'];
  totalIncome: number;
}) {
  const existing = params.budgets.find((b) => b.monthKey === params.selectedMonth && !b.deletedAt);
  const resolvedIncomeStr = positiveStr(existing?.expectedIncome) || positiveStr(params.totalIncome);
  const { categoryInputs, categoryRollovers } = buildCategoryMaps(params.categories);
  return {
    budgetMode: existing?.budgetMode || ('cap' as FinanceBudgetMode),
    overallInput: positiveStr(existing?.totalBudget),
    expectedIncomeInput: resolvedIncomeStr,
    baseSalaryInput: resolvedIncomeStr || '19000',
    paydayInput: String(resolveEffectivePaydayOfMonth(params.budgets, params.selectedMonth) ?? 1),
    plannedSipInput: positiveStr(existing?.plannedSipAmount),
    categoryInputs,
    categoryRollovers,
  };
}

function useMonthlyBudgetForm(params: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusCategoryId?: string | null;
}) {
  const { open, onOpenChange, focusCategoryId } = params;
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const budgets = useFinanceStore((s) => s.budgets);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const saveMonthlyBudgetSettings = useFinanceStore((s) => s.saveMonthlyBudgetSettings);

  const [budgetMode, setBudgetMode] = useState<FinanceBudgetMode>('cap');
  const [overallInput, setOverallInput] = useState('');
  const [expectedIncomeInput, setExpectedIncomeInput] = useState('');
  const [paydayInput, setPaydayInput] = useState('1');
  const [plannedSipInput, setPlannedSipInput] = useState('');
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});
  const [categoryRollovers, setCategoryRollovers] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showLeaveHelper, setShowLeaveHelper] = useState(false);
  const [baseSalaryInput, setBaseSalaryInput] = useState('');
  const [leaveDaysInput, setLeaveDaysInput] = useState('0');
  const [salaryDivisor, setSalaryDivisor] = useState<30 | 26>(30);

  const summary = getMonthlySummary(selectedMonth);
  const spentByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of summary.categoryBreakdown) map.set(item.category.id, item.spent);
    return map;
  }, [summary.categoryBreakdown]);

  const activeExpenseCategories = useMemo(
    () => categories.filter((c) => !c.deletedAt && c.type !== 'income'),
    [categories]
  );

  useEffect(() => {
    if (!open) return;
    const init = buildInitialBudgetState({ selectedMonth, categories, budgets, totalIncome: summary.totalIncome });
    setBudgetMode(init.budgetMode);
    setOverallInput(init.overallInput);
    setExpectedIncomeInput(init.expectedIncomeInput);
    setBaseSalaryInput(init.baseSalaryInput);
    setLeaveDaysInput('0');
    setShowLeaveHelper(false);
    setPaydayInput(init.paydayInput);
    setPlannedSipInput(init.plannedSipInput);
    setCategoryInputs(init.categoryInputs);
    setCategoryRollovers(init.categoryRollovers);
  }, [open, selectedMonth, categories, budgets, summary.totalIncome]);

  useEffect(() => {
    if (!open || !focusCategoryId) return;
    const el = document.getElementById(`cat-budget-input-${focusCategoryId}`);
    if (!el) return;
    const timer = setTimeout(() => {
      el.focus();
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 120);
    return () => clearTimeout(timer);
  }, [open, focusCategoryId]);

  const {
    categorySum,
    overallNum,
    expectedIncomeNum,
    plannedSipNum,
    leaveDaysNum,
    leaveCutAmount,
    netSalaryAfterLeave,
    fixedObligations,
    assignableIncomeBase,
    totalAssigned,
    readyToAssign,
  } = computeBudgetFormDerived({
    categoryInputs,
    overallInput,
    expectedIncomeInput,
    plannedSipInput,
    baseSalaryInput,
    leaveDaysInput,
    salaryDivisor,
    summary,
  });

  const handleAutoAssignRemaining = () => {
    if (readyToAssign <= 0) {
      toast.info('All income is already assigned (or over-assigned)');
      return;
    }
    const savingsCat = activeExpenseCategories.find((c) => /saving|buffer|misc|personal|shopping/i.test(c.name));
    if (savingsCat) {
      const currentVal = parseFloat(categoryInputs[savingsCat.id] || '0') || 0;
      setCategoryInputs((prev) => ({ ...prev, [savingsCat.id]: String(Math.round(currentVal + readyToAssign)) }));
      toast.success(`Assigned ${formatINR(readyToAssign)} to ${savingsCat.name}`);
      return;
    }
    setPlannedSipInput(String(Math.round(plannedSipNum + readyToAssign)));
    toast.success(`Assigned ${formatINR(readyToAssign)} to Target SIP / Savings`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericLimits: Record<string, number> = {};
    for (const cat of categories) {
      const parsed = parseFloat(categoryInputs[cat.id] || '0');
      numericLimits[cat.id] = !isNaN(parsed) && parsed > 0 ? parsed : 0;
    }
    const effectiveOverall = budgetMode === 'zero_based' && categorySum > 0 ? categorySum : overallNum;

    setIsSaving(true);
    try {
      await saveMonthlyBudgetSettings(selectedMonth, effectiveOverall, numericLimits, {
        expectedIncome: expectedIncomeNum,
        plannedSipAmount: plannedSipNum,
        paydayOfMonth: normalizePaydayOfMonth(parseInt(paydayInput, 10)) ?? 1,
        categoryRollovers,
        budgetMode,
        assignedIncome: budgetMode === 'zero_based' ? totalAssigned : undefined,
      });
      toast.success(budgetMode === 'zero_based' ? 'Zero-Based budget plan saved' : 'Monthly budgets & rollover envelopes saved');
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const clearCategoryLimits = () => {
    const cleared: Record<string, string> = {};
    for (const cat of categories) cleared[cat.id] = '';
    setCategoryInputs(cleared);
  };

  return {
    selectedMonth,
    budgetMode,
    setBudgetMode,
    overallInput,
    setOverallInput,
    expectedIncomeInput,
    setExpectedIncomeInput,
    paydayInput,
    setPaydayInput,
    plannedSipInput,
    setPlannedSipInput,
    categoryInputs,
    setCategoryInputs,
    categoryRollovers,
    setCategoryRollovers,
    isSaving,
    showLeaveHelper,
    setShowLeaveHelper,
    baseSalaryInput,
    setBaseSalaryInput,
    leaveDaysInput,
    setLeaveDaysInput,
    salaryDivisor,
    setSalaryDivisor,
    spentByCat,
    activeExpenseCategories,
    categorySum,
    overallNum,
    expectedIncomeNum,
    plannedSipNum,
    leaveDaysNum,
    leaveCutAmount,
    netSalaryAfterLeave,
    fixedObligations,
    assignableIncomeBase,
    readyToAssign,
    handleAutoAssignRemaining,
    handleSave,
    clearCategoryLimits,
  };
}

function CapModeBudgetField(props: {
  overallInput: string;
  onOverallChange: (v: string) => void;
  overallNum: number;
  categorySum: number;
}) {
  const { overallInput, onOverallChange, overallNum, categorySum } = props;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="overall-budget-input" className="text-xs sm:text-sm font-semibold text-foreground">
          Overall Variable Spending Budget (₹)
        </Label>
        {categorySum > 0 && overallNum !== categorySum && (
          <button
            type="button"
            onClick={() => onOverallChange(String(categorySum))}
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
        onChange={(e) => onOverallChange(e.target.value)}
        placeholder={categorySum > 0 ? `Auto: ${categorySum} (sum of categories)` : 'e.g., 35000'}
        className="h-10 font-mono tabular-nums text-sm"
      />
    </div>
  );
}

function BudgetIncomeSettingsCard({ f }: { f: ReturnType<typeof useMonthlyBudgetForm> }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3.5">
      {f.budgetMode === 'cap' && (
        <CapModeBudgetField overallInput={f.overallInput} onOverallChange={f.setOverallInput} overallNum={f.overallNum} categorySum={f.categorySum} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="expected-income-input" className="text-xs font-medium text-muted-foreground">
              {f.budgetMode === 'zero_based' ? 'Monthly Income to Assign (₹)' : 'Expected Monthly Income (₹)'}
            </Label>
            <button
              type="button"
              onClick={() => {
                if (!f.showLeaveHelper && f.expectedIncomeNum > 0) f.setBaseSalaryInput(String(f.expectedIncomeNum));
                f.setShowLeaveHelper((prev) => !prev);
              }}
              className="text-[11px] font-medium text-primary hover:underline whitespace-nowrap"
            >
              {f.showLeaveHelper ? 'Hide leave calc' : 'Half-day / Leave cut?'}
            </button>
          </div>
          <Input id="expected-income-input" type="number" min="0" step="1" value={f.expectedIncomeInput} onChange={(e) => f.setExpectedIncomeInput(e.target.value)} placeholder="e.g., 19000" className="h-10 font-mono tabular-nums text-sm" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="payday-of-month-input" className="text-xs font-medium text-muted-foreground">Salary / Payday Day (1–31)</Label>
          <Input
            id="payday-of-month-input"
            type="number"
            min="1"
            max="31"
            step="1"
            value={f.paydayInput}
            onChange={(e) => f.setPaydayInput(e.target.value)}
            onBlur={() => f.setPaydayInput(String(normalizePaydayOfMonth(parseInt(f.paydayInput, 10)) ?? 1))}
            placeholder="e.g., 7"
            className="h-10 font-mono tabular-nums text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="planned-sip-input" className="text-xs font-medium text-muted-foreground">Target Monthly SIP / Savings (₹)</Label>
        <Input id="planned-sip-input" type="number" min="0" step="500" value={f.plannedSipInput} onChange={(e) => f.setPlannedSipInput(e.target.value)} placeholder="e.g., 15000" className="h-10 font-mono tabular-nums text-sm" />
      </div>

      {f.showLeaveHelper && (
        <SalaryLeaveCalculator
          salaryDivisor={f.salaryDivisor}
          onDivisorChange={f.setSalaryDivisor}
          baseSalaryInput={f.baseSalaryInput}
          onBaseSalaryChange={f.setBaseSalaryInput}
          leaveDaysInput={f.leaveDaysInput}
          onLeaveDaysChange={f.setLeaveDaysInput}
          leaveDaysNum={f.leaveDaysNum}
          leaveCutAmount={f.leaveCutAmount}
          netSalaryAfterLeave={f.netSalaryAfterLeave}
          onApplyNetSalary={() => {
            f.setExpectedIncomeInput(String(f.netSalaryAfterLeave));
            f.setShowLeaveHelper(false);
            toast.success(`Updated month income to ${formatINR(f.netSalaryAfterLeave)}`);
          }}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Allocated across categories: <span className="font-mono tabular-nums font-semibold text-foreground">{formatINR(f.categorySum)}</span>
      </p>
    </div>
  );
}

export function MonthlyBudgetModal({ open, onOpenChange, focusCategoryId }: MonthlyBudgetModalProps) {
  const f = useMonthlyBudgetForm({ open, onOpenChange, focusCategoryId });

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
                  <CategoryEnvelopeRow
                    key={cat.id}
                    cat={cat}
                    spent={f.spentByCat.get(cat.id) || 0}
                    isRolloverOn={Boolean(f.categoryRollovers[cat.id])}
                    inputValue={f.categoryInputs[cat.id] || ''}
                    budgetMode={f.budgetMode}
                    onToggleRollover={() => f.setCategoryRollovers((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                    onInputChange={(val) => f.setCategoryInputs((prev) => ({ ...prev, [cat.id]: val }))}
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
