'use client';

import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { normalizePaydayOfMonth } from '@/lib/finance/payday';
import type { FinanceBudgetMode } from '@/lib/types';
import {
  buildInitialBudgetState,
  buildNumericCategoryLimits,
  computeBudgetFormDerived,
} from '@/lib/finance/budget-helpers';
import { toast } from 'sonner';

function useBudgetFocusEffect(open: boolean, focusCategoryId?: string | null) {
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
}

export function useMonthlyBudgetController(params: {
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

  useBudgetFocusEffect(open, focusCategoryId);

  const derived = computeBudgetFormDerived({
    categoryInputs, overallInput, expectedIncomeInput, plannedSipInput, baseSalaryInput, leaveDaysInput, salaryDivisor, summary,
  });

  const handleAutoAssignRemaining = () => {
    if (derived.readyToAssign <= 0) {
      toast.info('All income is already assigned (or over-assigned)');
      return;
    }
    const savingsCat = activeExpenseCategories.find((c) => /saving|buffer|misc|personal|shopping/i.test(c.name));
    if (savingsCat) {
      const currentVal = parseFloat(categoryInputs[savingsCat.id] || '0') || 0;
      setCategoryInputs((prev) => ({ ...prev, [savingsCat.id]: String(Math.round(currentVal + derived.readyToAssign)) }));
      toast.success(`Assigned ${formatINR(derived.readyToAssign)} to ${savingsCat.name}`);
      return;
    }
    setPlannedSipInput(String(Math.round(derived.plannedSipNum + derived.readyToAssign)));
    toast.success(`Assigned ${formatINR(derived.readyToAssign)} to Target SIP / Savings`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericLimits = buildNumericCategoryLimits(categories, categoryInputs);
    const effectiveOverall = budgetMode === 'zero_based' && derived.categorySum > 0 ? derived.categorySum : derived.overallNum;

    setIsSaving(true);
    try {
      await saveMonthlyBudgetSettings(selectedMonth, effectiveOverall, numericLimits, {
        expectedIncome: derived.expectedIncomeNum,
        plannedSipAmount: derived.plannedSipNum,
        paydayOfMonth: normalizePaydayOfMonth(parseInt(paydayInput, 10)) ?? 1,
        categoryRollovers,
        budgetMode,
        assignedIncome: budgetMode === 'zero_based' ? derived.totalAssigned : undefined,
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
    budgetMode, setBudgetMode,
    overallInput, setOverallInput,
    expectedIncomeInput, setExpectedIncomeInput,
    paydayInput, setPaydayInput,
    plannedSipInput, setPlannedSipInput,
    categoryInputs, setCategoryInputs,
    categoryRollovers, setCategoryRollovers,
    isSaving,
    showLeaveHelper, setShowLeaveHelper,
    baseSalaryInput, setBaseSalaryInput,
    leaveDaysInput, setLeaveDaysInput,
    salaryDivisor, setSalaryDivisor,
    spentByCat,
    activeExpenseCategories,
    ...derived,
    handleAutoAssignRemaining,
    handleSave,
    clearCategoryLimits,
  };
}
