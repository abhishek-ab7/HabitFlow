'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { calculateDailyFuelSummary } from '@/lib/fitness/shared-analytics';
import { estimateHinglishFoodMacros } from '@/lib/fitness/meal-estimator';
import { buildAutoMealSupplementNoteTag } from '@/lib/fitness/supplement-meal-bridge';
import { findBestMealTransactionMatch, findCandidateTransactionsForMeal } from '@/lib/fitness/meal-finance-matcher';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFeedback } from '@/hooks/use-feedback';
import type { FinanceCategory, MealLog, MealLogFormData, MealTemplate, MealTemplateFormData } from '@/lib/types';
import type { CandidateTxMatch } from './FuelMealTimeline';

const DEFAULT_MEAL_FORM: MealLogFormData = {
  name: '', calories: 300, proteinG: 15, carbsG: 30, fatG: 10, mealType: 'snack', isJunk: false, notes: '',
};

const DEFAULT_STAPLE_FORM: MealTemplateFormData = {
  name: '', hindiAliases: [], calories: 250, proteinG: 15, carbsG: 25, fatG: 8,
  servingLabel: '1 serving', mealType: 'snack', isJunk: false, isPinned: true,
};

function notifySupplementAutoSync(mealId: string) {
  const state = useFitnessStore.getState();
  const tag = buildAutoMealSupplementNoteTag(mealId);
  const matchedLog = state.supplementLogs.find((l) => !l.deletedAt && String(l.notes || '').includes(tag));
  if (!matchedLog) return;
  const sup = state.supplementInventory.find((s) => s.id === matchedLog.supplementId);
  if (sup) toast.info(`Synced ${matchedLog.servingsTaken} ${sup.unitLabel} from ${sup.brand || sup.name} inventory`);
}

function matchesMealCategory(cat: FinanceCategory, isJunk: boolean): boolean {
  if (cat.deletedAt) return false;
  return isJunk ? cat.slug === 'junk-food' || /junk/i.test(cat.name) : cat.slug === 'food-dining' || /food|dining/i.test(cat.name);
}

function resolveMealFinanceCategoryId(isJunk: boolean | undefined, categories: FinanceCategory[]): string {
  const target = categories.find((c) => matchesMealCategory(c, Boolean(isJunk)));
  const fallback = target || categories.find((c) => !c.deletedAt && c.type !== 'income');
  return fallback?.id || 'default';
}

function isValidPositiveExpense(params: { amount: number; accountId: string }): boolean {
  return Number.isFinite(params.amount) && params.amount > 0 && Boolean(params.accountId);
}

function useFuelFinanceSync(userId: string) {
  const financeAccounts = useFinanceStore((s) => s.accounts);
  const financeCategories = useFinanceStore((s) => s.categories);
  const financeTransactions = useFinanceStore((s) => s.transactions);
  const financeHasLoaded = useFinanceStore((s) => s.hasLoaded);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);

  useEffect(() => {
    if (!financeHasLoaded && typeof loadFinanceData === 'function') loadFinanceData(userId, false).catch(() => undefined);
  }, [financeHasLoaded, loadFinanceData, userId]);

  const activeFinanceAccounts = useMemo(
    () => financeAccounts.filter((a) => !a.deletedAt && !a.archived && a.type !== 'investment'),
    [financeAccounts]
  );

  return { activeFinanceAccounts, financeCategories, financeTransactions };
}

function useFuelDerivedData(params: { selectedDate: string; userId: string }) {
  const { selectedDate, userId } = params;
  const profile = useFitnessStore((s) => s.profile);
  const dailyLogs = useFitnessStore((s) => s.dailyLogs);
  const mealTemplates = useFitnessStore((s) => s.mealTemplates);
  const mealLogs = useFitnessStore((s) => s.mealLogs);
  const { activeFinanceAccounts, financeCategories, financeTransactions } = useFuelFinanceSync(userId);

  const todayLog = useMemo(() => dailyLogs.find((d) => d.date === selectedDate && !d.deletedAt), [dailyLogs, selectedDate]);
  const summary = useMemo(() => calculateDailyFuelSummary(mealLogs, todayLog, profile, selectedDate), [mealLogs, todayLog, profile, selectedDate]);
  const dayMeals = useMemo(() => mealLogs.filter((m) => !m.deletedAt && m.date === selectedDate), [mealLogs, selectedDate]);
  const pinnedTemplates = useMemo(() => mealTemplates.filter((t) => !t.deletedAt).sort((a, b) => a.order - b.order), [mealTemplates]);

  const candidateTxByMealId = useMemo(() => {
    const map = new Map<string, CandidateTxMatch>();
    if (financeTransactions.length === 0) return map;
    for (const meal of dayMeals) {
      if (meal.linkedTransactionId) continue;
      const top = findCandidateTransactionsForMeal(meal, financeTransactions, mealLogs, financeCategories)[0];
      if (top) map.set(meal.id, top);
    }
    return map;
  }, [dayMeals, financeTransactions, mealLogs, financeCategories]);

  return {
    activeFinanceAccounts,
    financeCategories,
    financeTransactions,
    summary,
    dayMeals,
    pinnedTemplates,
    candidateTxByMealId,
  };
}

export function useFuelTabController(params: { selectedDate: string; userId: string }) {
  const { selectedDate, userId } = params;
  const upsertDailyLog = useFitnessStore((s) => s.upsertDailyLog);
  const toggleLowEnergyMode = useFitnessStore((s) => s.toggleLowEnergyMode);
  const incrementWater = useFitnessStore((s) => s.incrementWater);
  const incrementSteps = useFitnessStore((s) => s.incrementSteps);
  const logFromTemplate = useFitnessStore((s) => s.logFromTemplate);
  const addMealLog = useFitnessStore((s) => s.addMealLog);
  const updateMealLog = useFitnessStore((s) => s.updateMealLog);
  const deleteMealLog = useFitnessStore((s) => s.deleteMealLog);
  const addMealTemplate = useFitnessStore((s) => s.addMealTemplate);
  const deleteMealTemplate = useFitnessStore((s) => s.deleteMealTemplate);
  const linkMealToTransaction = useFitnessStore((s) => s.linkMealToTransaction);
  const addFinanceTransaction = useFinanceStore((s) => s.addTransaction);
  const feedback = useFeedback();

  const {
    activeFinanceAccounts, financeCategories, financeTransactions,
    summary, dayMeals, pinnedTemplates, candidateTxByMealId,
  } = useFuelDerivedData({ selectedDate, userId });

  const [portionMultiplier, setPortionMultiplier] = useState(1);
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealLog | null>(null);
  const [mealForm, setMealForm] = useState<MealLogFormData>(DEFAULT_MEAL_FORM);
  const [paidOutside, setPaidOutside] = useState(false);
  const [paidAmountStr, setPaidAmountStr] = useState('');
  const [paidAccountId, setPaidAccountId] = useState('');
  const [stapleModalOpen, setStapleModalOpen] = useState(false);
  const [stapleForm, setStapleForm] = useState<MealTemplateFormData>(DEFAULT_STAPLE_FORM);

  const tryAutoLinkMealToFinance = async (logged: MealLog) => {
    if (logged.linkedTransactionId) return;
    const match = findBestMealTransactionMatch(logged, financeTransactions, useFitnessStore.getState().mealLogs, financeCategories);
    if (!match || match.confidence !== 'high') return;
    await linkMealToTransaction(logged.id, match.transaction.id);
    const label = match.transaction.merchantName || match.transaction.title;
    toast.info(`Linked to ₹${match.transaction.amount} ${label}`, {
      action: { label: 'Undo', onClick: () => void linkMealToTransaction(logged.id, null) },
    });
  };

  const handleTapStaple = async (tpl: MealTemplate) => {
    feedback.complete();
    const logged = await logFromTemplate(tpl.id, { date: selectedDate, multiplier: portionMultiplier, source: 'staple' }, userId);
    if (!logged) return;
    toast.success(`+${logged.name} (${logged.calories} kcal · ${logged.proteinG}g P)`);
    notifySupplementAutoSync(logged.id);
    await tryAutoLinkMealToFinance(logged);
  };

  const openAddMealModal = () => {
    setEditingMeal(null);
    setMealForm(DEFAULT_MEAL_FORM);
    setPaidOutside(false);
    setPaidAmountStr('');
    const defaultAcc = activeFinanceAccounts.find((a) => a.isDefault)?.id || activeFinanceAccounts[0]?.id || '';
    setPaidAccountId(defaultAcc);
    setMealModalOpen(true);
  };

  const openEditMealModal = (meal: MealLog) => {
    setEditingMeal(meal);
    setMealForm({
      name: meal.name, calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG,
      fatG: meal.fatG, mealType: meal.mealType, isJunk: meal.isJunk, notes: meal.notes || '',
    });
    setPaidOutside(false);
    setPaidAmountStr('');
    setMealModalOpen(true);
  };

  const handleAutoEstimateMeal = () => {
    if (!mealForm.name.trim()) return;
    const est = estimateHinglishFoodMacros(mealForm.name, { forceJunk: mealForm.isJunk });
    setMealForm((prev) => ({ ...prev, calories: est.calories, proteinG: est.proteinG, carbsG: est.carbsG, fatG: est.fatG, mealType: est.mealType, isJunk: est.isJunk }));
    toast.info(`Estimated ${est.calories} kcal · ${est.proteinG}g protein`);
  };

  const handleSaveMealWithExpense = async (expense: { paidAmount: number; resolvedAccId: string }) => {
    const createdTx = await addFinanceTransaction({
      title: mealForm.name.trim(), merchantName: mealForm.name.trim(), amount: expense.paidAmount, type: 'expense',
      categoryId: resolveMealFinanceCategoryId(mealForm.isJunk, financeCategories),
      subcategory: mealForm.isJunk ? 'Junk Food' : 'Healthy Meal',
      accountId: expense.resolvedAccId, date: selectedDate,
      notes: mealForm.notes?.trim() || `Logged with meal: ${mealForm.name.trim()}`,
      tags: ['fitness_meal', ...(mealForm.isJunk ? ['junk_food'] : [])],
      skipAutoDietBridge: true,
    });
    const logged = await addMealLog({ ...mealForm, date: selectedDate, source: 'manual', linkedTransactionId: createdTx.id }, userId);
    toast.success(`Logged meal & ₹${expense.paidAmount} expense (linked)`);
    notifySupplementAutoSync(logged.id);
  };

  const createNewMeal = async (expense: { paidAmount: number; resolvedAccId: string }) => {
    if (paidOutside && expense.paidAmount > 0) {
      await handleSaveMealWithExpense(expense);
      return;
    }
    const logged = await addMealLog({ ...mealForm, date: selectedDate, source: 'manual' }, userId);
    toast.success('Meal logged');
    notifySupplementAutoSync(logged.id);
    await tryAutoLinkMealToFinance(logged);
  };

  const resolveExpenseAccountId = () =>
    paidAccountId || activeFinanceAccounts.find((a) => a.isDefault)?.id || activeFinanceAccounts[0]?.id || '';

  const handleSaveMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealForm.name.trim()) return void feedback.error();
    if (editingMeal) {
      feedback.complete();
      await updateMealLog(editingMeal.id, mealForm);
      toast.success('Meal updated');
      return void setMealModalOpen(false);
    }

    const paidAmount = parseFloat(paidAmountStr);
    const resolvedAccId = resolveExpenseAccountId();
    if (paidOutside && !isValidPositiveExpense({ amount: paidAmount, accountId: resolvedAccId })) {
      feedback.error();
      return void toast.error('Enter a valid expense amount and select an account');
    }
    feedback.complete();
    await createNewMeal({ paidAmount, resolvedAccId });
    setMealModalOpen(false);
  };

  const handleSaveStaple = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stapleForm.name.trim()) return;
    await addMealTemplate(stapleForm, userId);
    toast.success(`Saved staple "${stapleForm.name}"`);
    setStapleModalOpen(false);
    setStapleForm(DEFAULT_STAPLE_FORM);
  };

  const handleToggleLowEnergy = async () => {
    const nextEnabled = !summary.lowEnergyMode;
    feedback.toggle(nextEnabled);
    const { restedHabitIds } = await toggleLowEnergyMode(selectedDate, nextEnabled, userId);
    if (!nextEnabled) return void toast.success('Normal targets restored');
    toast.success(
      restedHabitIds.length > 0
        ? `Low-Energy Mode ON (${restedHabitIds.length} gym habit marked Rest, protein & zero-junk active)`
        : 'Low-Energy Mode ON (reduced steps + maintenance buffer)'
    );
  };

  return {
    summary, dayMeals, pinnedTemplates, candidateTxByMealId, activeFinanceAccounts,
    portionMultiplier, setPortionMultiplier,
    mealModalOpen, setMealModalOpen, editingMeal, mealForm, setMealForm,
    paidOutside, setPaidOutside, paidAmountStr, setPaidAmountStr, paidAccountId, setPaidAccountId,
    stapleModalOpen, setStapleModalOpen, stapleForm, setStapleForm,
    handleTapStaple, openAddMealModal, openEditMealModal, handleAutoEstimateMeal, handleSaveMeal, handleSaveStaple, handleToggleLowEnergy,
    saveExactSteps: async (val: number) => {
      await upsertDailyLog(selectedDate, { steps: val }, userId);
      toast.success(`Steps set to ${val.toLocaleString()}`);
    },
    add2kSteps: () => { feedback.complete(); incrementSteps(2000, selectedDate, userId); },
    onIncrementWater: (deltaMl: number) => {
      if (deltaMl > 0) feedback.complete(); else feedback.tap();
      incrementWater(deltaMl, selectedDate, userId);
    },
    onSelectSleep: (hrs: number) => { feedback.complete(); upsertDailyLog(selectedDate, { sleepHours: hrs }, userId); },
    onSelectEnergy: (val: number) => { feedback.complete(); upsertDailyLog(selectedDate, { energyLevel: val }, userId); },
    onDeleteStaple: deleteMealTemplate,
    onDeleteMeal: (id: string) => { deleteMealLog(id); toast.success('Meal removed'); },
    onLinkMealTx: async (meal: MealLog, match: CandidateTxMatch) => {
      feedback.complete();
      await linkMealToTransaction(meal.id, match.transaction.id);
      toast.success(`Linked "${meal.name}" to ₹${match.transaction.amount} ${match.transaction.merchantName || match.transaction.title}`);
    },
  };
}
