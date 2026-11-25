'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BatteryLow,
  ChevronDown,
  ChevronUp,
  Droplets,
  Flame,
  Footprints,
  Moon,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Utensils,
  Wallet,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { calculateDailyFuelSummary } from '@/lib/fitness/shared-analytics';
import { estimateHinglishFoodMacros } from '@/lib/fitness/meal-estimator';
import { buildAutoMealSupplementNoteTag } from '@/lib/fitness/supplement-meal-bridge';
import {
  findBestMealTransactionMatch,
  findCandidateTransactionsForMeal,
} from '@/lib/fitness/meal-finance-matcher';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFeedback } from '@/hooks/use-feedback';
import { cn } from '@/lib/utils';
import type {
  MealLog,
  MealLogFormData,
  MealTemplate,
  MealTemplateFormData,
  MealType,
} from '@/lib/types';

interface FuelTabProps {
  selectedDate: string;
  userId: string;
}

const MacroRing = React.memo(function MacroRing({
  label,
  valueText,
  subText,
  pct,
  colorClass,
  strokeHex,
}: {
  label: string;
  valueText: string;
  subText: string;
  pct: number;
  colorClass: string;
  strokeHex: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5">
      <div className="relative h-20 w-20 shrink-0 flex items-center justify-center">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-muted/35"
            strokeWidth="7"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={strokeHex}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <span className={cn('absolute text-xs font-bold', colorClass)}>
          {Math.round(pct)}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground tracking-tight truncate">
          {valueText}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{subText}</p>
      </div>
    </div>
  );
});

const SLEEP_PRESETS = [5.5, 6, 6.5, 7, 7.5, 8, 8.5];
const ENERGY_PRESETS = [
  { val: 1, label: '1 · Drained' },
  { val: 2, label: '2 · Low' },
  { val: 3, label: '3 · Okay' },
  { val: 4, label: '4 · Good' },
  { val: 5, label: '5 · Peak' },
];
const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
  { value: 'pre_workout', label: 'Pre-Workout' },
  { value: 'post_workout', label: 'Post-Workout' },
];

export const FuelTab = React.memo(function FuelTab({ selectedDate, userId }: FuelTabProps) {
  const profile = useFitnessStore((s) => s.profile);
  const dailyLogs = useFitnessStore((s) => s.dailyLogs);
  const mealTemplates = useFitnessStore((s) => s.mealTemplates);
  const mealLogs = useFitnessStore((s) => s.mealLogs);

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

  const financeAccounts = useFinanceStore((s) => s.accounts);
  const financeCategories = useFinanceStore((s) => s.categories);
  const financeTransactions = useFinanceStore((s) => s.transactions);
  const addFinanceTransaction = useFinanceStore((s) => s.addTransaction);
  const financeHasLoaded = useFinanceStore((s) => s.hasLoaded);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);

  useEffect(() => {
    if (!financeHasLoaded && typeof loadFinanceData === 'function') {
      loadFinanceData(userId, false).catch(() => undefined);
    }
  }, [financeHasLoaded, loadFinanceData, userId]);

  const activeFinanceAccounts = useMemo(
    () =>
      financeAccounts.filter(
        (a) => !a.deletedAt && !a.archived && a.type !== 'investment'
      ),
    [financeAccounts]
  );

  const todayLog = useMemo(
    () => dailyLogs.find((d) => d.date === selectedDate && !d.deletedAt),
    [dailyLogs, selectedDate]
  );

  const summary = useMemo(
    () => calculateDailyFuelSummary(mealLogs, todayLog, profile, selectedDate),
    [mealLogs, todayLog, profile, selectedDate]
  );

  const dayMeals = useMemo(
    () => mealLogs.filter((m) => !m.deletedAt && m.date === selectedDate),
    [mealLogs, selectedDate]
  );

  const candidateTxByMealId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof findCandidateTransactionsForMeal>[number]>();
    if (financeTransactions.length === 0) return map;
    for (const meal of dayMeals) {
      if (meal.linkedTransactionId) continue;
      const top = findCandidateTransactionsForMeal(
        meal,
        financeTransactions,
        mealLogs,
        financeCategories
      )[0];
      if (top) map.set(meal.id, top);
    }
    return map;
  }, [dayMeals, financeTransactions, mealLogs, financeCategories]);

  const pinnedTemplates = useMemo(
    () => mealTemplates.filter((t) => !t.deletedAt).sort((a, b) => a.order - b.order),
    [mealTemplates]
  );

  const [portionMultiplier, setPortionMultiplier] = useState<number>(1);
  const feedback = useFeedback();
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [stepsDraft, setStepsDraft] = useState<string>('');
  const [isEditingSteps, setIsEditingSteps] = useState(false);

  // Custom / Edit Meal Modal
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealLog | null>(null);
  const [mealForm, setMealForm] = useState<MealLogFormData>({
    name: '',
    calories: 300,
    proteinG: 20,
    carbsG: 30,
    fatG: 10,
    mealType: 'snack',
    isJunk: false,
    notes: '',
  });
  const [paidOutside, setPaidOutside] = useState(false);
  const [paidAmountStr, setPaidAmountStr] = useState('');
  const [paidAccountId, setPaidAccountId] = useState('');

  // Add Staple Modal
  const [stapleModalOpen, setStapleModalOpen] = useState(false);
  const [stapleForm, setStapleForm] = useState<MealTemplateFormData>({
    name: '',
    hindiAliases: [],
    calories: 250,
    proteinG: 15,
    carbsG: 25,
    fatG: 8,
    servingLabel: '1 serving',
    mealType: 'snack',
    isJunk: false,
    isPinned: true,
  });

  const notifySupplementAutoSync = (mealId: string) => {
    const state = useFitnessStore.getState();
    const tag = buildAutoMealSupplementNoteTag(mealId);
    const matchedLog = state.supplementLogs.find(
      (l) => !l.deletedAt && String(l.notes || '').includes(tag)
    );
    if (!matchedLog) return;
    const sup = state.supplementInventory.find((s) => s.id === matchedLog.supplementId);
    if (!sup) return;
    toast.info(
      `Synced ${matchedLog.servingsTaken} ${sup.unitLabel} from ${sup.brand || sup.name} inventory`
    );
  };

  const tryAutoLinkMealToFinance = async (logged: MealLog) => {
    if (logged.linkedTransactionId) return false;
    const match = findBestMealTransactionMatch(
      logged,
      financeTransactions,
      useFitnessStore.getState().mealLogs,
      financeCategories
    );
    if (!match || match.confidence !== 'high') return false;
    await linkMealToTransaction(logged.id, match.transaction.id);
    const label = match.transaction.merchantName || match.transaction.title;
    toast.info(`Linked to ₹${match.transaction.amount} ${label}`, {
      action: {
        label: 'Undo',
        onClick: () => {
          void linkMealToTransaction(logged.id, null);
        },
      },
    });
    return true;
  };

  const handleTapStaple = async (tpl: MealTemplate) => {
    feedback.complete();
    const logged = await logFromTemplate(
      tpl.id,
      { date: selectedDate, multiplier: portionMultiplier, source: 'staple' },
      userId
    );
    if (logged) {
      toast.success(`+${logged.name} (${logged.calories} kcal · ${logged.proteinG}g P)`);
      notifySupplementAutoSync(logged.id);
      await tryAutoLinkMealToFinance(logged);
    }
  };

  const openAddMealModal = () => {
    setEditingMeal(null);
    setMealForm({
      name: '',
      calories: 300,
      proteinG: 15,
      carbsG: 30,
      fatG: 10,
      mealType: 'snack',
      isJunk: false,
      notes: '',
    });
    setPaidOutside(false);
    setPaidAmountStr('');
    const defaultAcc =
      activeFinanceAccounts.find((a) => a.isDefault)?.id ||
      activeFinanceAccounts[0]?.id ||
      '';
    setPaidAccountId(defaultAcc);
    setMealModalOpen(true);
  };

  const openEditMealModal = (meal: MealLog) => {
    setEditingMeal(meal);
    setMealForm({
      name: meal.name,
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      mealType: meal.mealType,
      isJunk: meal.isJunk,
      notes: meal.notes || '',
    });
    setPaidOutside(false);
    setPaidAmountStr('');
    setMealModalOpen(true);
  };

  const handleAutoEstimateMeal = () => {
    if (!mealForm.name.trim()) return;
    const est = estimateHinglishFoodMacros(mealForm.name, { forceJunk: mealForm.isJunk });
    setMealForm((prev) => ({
      ...prev,
      calories: est.calories,
      proteinG: est.proteinG,
      carbsG: est.carbsG,
      fatG: est.fatG,
      mealType: est.mealType,
      isJunk: est.isJunk,
    }));
    toast.info(`Estimated ${est.calories} kcal · ${est.proteinG}g protein`);
  };

  const handleSaveMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealForm.name.trim()) {
      feedback.error();
      return;
    }

    const paidAmount = parseFloat(paidAmountStr);
    const resolvedPaidAccountId =
      paidAccountId ||
      activeFinanceAccounts.find((a) => a.isDefault)?.id ||
      activeFinanceAccounts[0]?.id ||
      '';

    if (
      !editingMeal &&
      paidOutside &&
      (!Number.isFinite(paidAmount) || paidAmount <= 0 || !resolvedPaidAccountId)
    ) {
      feedback.error();
      toast.error('Enter a valid expense amount and select an account');
      return;
    }

    feedback.complete();

    if (editingMeal) {
      await updateMealLog(editingMeal.id, mealForm);
      toast.success('Meal updated');
    } else if (paidOutside && Number.isFinite(paidAmount) && paidAmount > 0) {
      const targetCat = mealForm.isJunk
        ? financeCategories.find(
            (c) => !c.deletedAt && (c.slug === 'junk-food' || /junk/i.test(c.name))
          )
        : financeCategories.find(
            (c) => !c.deletedAt && (c.slug === 'food-dining' || /food|dining/i.test(c.name))
          );
      const fallbackCat =
        targetCat ||
        financeCategories.find((c) => !c.deletedAt && c.type !== 'income');

      const createdTx = await addFinanceTransaction({
        title: mealForm.name.trim(),
        merchantName: mealForm.name.trim(),
        amount: paidAmount,
        type: 'expense',
        categoryId: fallbackCat?.id || 'default',
        subcategory: mealForm.isJunk ? 'Junk Food' : 'Healthy Meal',
        accountId: resolvedPaidAccountId,
        date: selectedDate,
        notes: mealForm.notes?.trim() || `Logged with meal: ${mealForm.name.trim()}`,
        tags: ['fitness_meal', ...(mealForm.isJunk ? ['junk_food'] : [])],
        skipAutoDietBridge: true,
      });

      const logged = await addMealLog(
        {
          ...mealForm,
          date: selectedDate,
          source: 'manual',
          linkedTransactionId: createdTx.id,
        },
        userId
      );
      toast.success(`Logged meal & ₹${paidAmount} expense (linked)`);
      notifySupplementAutoSync(logged.id);
    } else {
      const logged = await addMealLog({ ...mealForm, date: selectedDate, source: 'manual' }, userId);
      toast.success('Meal logged');
      notifySupplementAutoSync(logged.id);
      await tryAutoLinkMealToFinance(logged);
    }
    setMealModalOpen(false);
  };

  const handleSaveStaple = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stapleForm.name.trim()) return;
    await addMealTemplate(stapleForm, userId);
    toast.success(`Saved staple "${stapleForm.name}"`);
    setStapleModalOpen(false);
    setStapleForm({
      name: '',
      hindiAliases: [],
      calories: 250,
      proteinG: 15,
      carbsG: 25,
      fatG: 8,
      servingLabel: '1 serving',
      mealType: 'snack',
      isJunk: false,
      isPinned: true,
    });
  };

  const handleSaveStepsExact = async () => {
    const val = Math.max(0, Math.round(Number(stepsDraft) || 0));
    await upsertDailyLog(selectedDate, { steps: val }, userId);
    setIsEditingSteps(false);
    toast.success(`Steps set to ${val.toLocaleString()}`);
  };

  const handleToggleLowEnergy = async () => {
    const nextEnabled = !summary.lowEnergyMode;
    feedback.toggle(nextEnabled);
    const { restedHabitIds } = await toggleLowEnergyMode(
      selectedDate,
      nextEnabled,
      userId
    );
    if (nextEnabled) {
      toast.success(
        restedHabitIds.length > 0
          ? `Low-Energy Mode ON (${restedHabitIds.length} gym habit marked Rest, protein & zero-junk active)`
          : 'Low-Energy Mode ON (reduced steps + maintenance buffer)'
      );
    } else {
      toast.success('Normal targets restored');
    }
  };

  return (
    <div className="space-y-5">
      {/* MINIMUM VIABLE DAY (LOW-ENERGY MODE) TOGGLE */}
      <div
        className={cn(
          'rounded-2xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 transition-colors',
          summary.lowEnergyMode
            ? 'border-amber-500/40 bg-amber-500/10'
            : 'border-border bg-card'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <BatteryLow
            className={cn(
              'h-4 w-4 shrink-0',
              summary.lowEnergyMode ? 'text-amber-500' : 'text-muted-foreground'
            )}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-foreground">
                Minimum Viable Day (Low-Energy Mode)
              </span>
              {summary.lowEnergyMode && (
                <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30 text-[10px]">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {summary.lowEnergyMode
                ? `Steps ${summary.stepsTarget.toLocaleString()} · Ceiling ${summary.calorieTarget} kcal · Exercise habits rested · Protein & Zero-Junk active`
                : 'Tired or busy? Shrink steps & calorie floor and rest gym habits without losing momentum.'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant={summary.lowEnergyMode ? 'default' : 'outline'}
          data-testid="low-energy-toggle"
          onClick={handleToggleLowEnergy}
          className={cn(
            'h-8 text-xs shrink-0',
            summary.lowEnergyMode && 'bg-amber-500 hover:bg-amber-600 text-white'
          )}
        >
          {summary.lowEnergyMode ? 'Exit Low-Energy' : 'Enable Low-Energy'}
        </Button>
      </div>

      {/* BIG 3 RINGS: Calories, Protein, Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <MacroRing
          label={summary.caloriesRemaining >= 0 ? 'Calories Left' : 'Calories Over'}
          valueText={`${Math.abs(summary.caloriesRemaining)} kcal`}
          subText={`${summary.caloriesConsumed} / ${summary.calorieTarget} kcal${summary.lowEnergyMode ? ' (ceiling)' : ' eaten'}`}
          pct={summary.caloriePct}
          colorClass={
            summary.caloriesRemaining < 0 ? 'text-rose-500' : 'text-amber-500'
          }
          strokeHex={summary.caloriesRemaining < 0 ? '#f43f5e' : '#f59e0b'}
        />

        <MacroRing
          label="Protein Intake"
          valueText={`${summary.proteinConsumedG} / ${summary.proteinTargetG}g`}
          subText={
            summary.proteinRemainingG > 0
              ? `${summary.proteinRemainingG}g remaining today`
              : 'Daily protein target hit!'
          }
          pct={summary.proteinPct}
          colorClass="text-emerald-500"
          strokeHex="#10b981"
        />

        <div className="rounded-2xl border border-border bg-card p-3.5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Footprints className="h-4 w-4 text-sky-500" />
              <span className="text-xs font-medium text-muted-foreground">
                Daily Steps
              </span>
            </div>
            <span className="text-xs font-bold text-sky-500">
              {Math.round(summary.stepsPct)}%
            </span>
          </div>

          {isEditingSteps ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                value={stepsDraft}
                onChange={(e) => setStepsDraft(e.target.value)}
                className="h-8 text-sm"
                placeholder="8000"
                autoFocus
              />
              <Button size="sm" className="h-8" onClick={handleSaveStepsExact}>
                Save
              </Button>
            </div>
          ) : (
            <div className="flex items-baseline justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setStepsDraft(String(summary.steps));
                  setIsEditingSteps(true);
                }}
                className="text-left group"
                title="Tap to edit exact step count"
              >
                <span className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  {summary.steps.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground ml-1">
                  / {summary.stepsTarget.toLocaleString()}
                </span>
              </button>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    feedback.complete();
                    incrementSteps(2000, selectedDate, userId);
                  }}
                >
                  +2k
                </Button>
              </div>
            </div>
          )}

          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all duration-300"
              style={{ width: `${Math.min(100, summary.stepsPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* HYDRATION + SLEEP + ENERGY STRIP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Water Card */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-sky-500" />
              <span className="text-sm font-semibold text-foreground">Water Intake</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {summary.waterMl} / {summary.waterTargetMl} ml ({Math.round(summary.waterPct)}%)
            </span>
          </div>

          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all duration-300"
              style={{ width: `${Math.min(100, summary.waterPct)}%` }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                feedback.complete();
                incrementWater(250, selectedDate, userId);
              }}
              className="h-8 text-xs"
            >
              +250 ml
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                feedback.complete();
                incrementWater(500, selectedDate, userId);
              }}
              className="h-8 text-xs"
            >
              +500 ml
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                feedback.complete();
                incrementWater(1000, selectedDate, userId);
              }}
              className="h-8 text-xs"
            >
              +1 L Bottle
            </Button>
            {summary.waterMl >= 250 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  feedback.tap();
                  incrementWater(-250, selectedDate, userId);
                }}
                className="h-8 text-xs text-muted-foreground"
              >
                -250 ml
              </Button>
            )}
          </div>
        </div>

        {/* Sleep + Energy Bio Strip */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-foreground">
                Sleep &amp; Energy Check-In
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {summary.sleepHours != null ? `${summary.sleepHours}h sleep` : 'Log sleep'} ·{' '}
              {summary.energyLevel != null ? `Energy ${summary.energyLevel}/5` : 'Rate energy'}
            </span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Sleep Duration
              </span>
              <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-1.5">
                {SLEEP_PRESETS.map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => {
                      feedback.complete();
                      upsertDailyLog(selectedDate, { sleepHours: hrs }, userId);
                    }}
                    className={cn(
                      'px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-medium border transition-colors text-center',
                      summary.sleepHours === hrs
                        ? 'bg-indigo-500 text-white border-indigo-500'
                        : 'bg-background border-border hover:bg-muted'
                    )}
                  >
                    {hrs}h
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3 text-amber-500" /> Energy Level
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {ENERGY_PRESETS.map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => {
                      feedback.complete();
                      upsertDailyLog(selectedDate, { energyLevel: p.val }, userId);
                    }}
                    className={cn(
                      'px-2 py-1.5 sm:py-1 rounded-lg text-xs font-medium border transition-colors text-center truncate',
                      summary.energyLevel === p.val
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-background border-border hover:bg-muted'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1-TAP INDIAN STAPLES GRID */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Utensils className="h-4 w-4 text-emerald-500" />
              1-Tap Indian Staples
            </h3>
            <p className="text-xs text-muted-foreground">
              Tap any staple to log instantly · Big 2 Focus: Calories + Protein
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
              {[0.5, 1, 1.5, 2].map((mult) => (
                <button
                  key={mult}
                  type="button"
                  onClick={() => setPortionMultiplier(mult)}
                  className={cn(
                    'px-2 py-1 text-[11px] font-medium rounded-md transition-colors',
                    portionMultiplier === mult
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {mult}x
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setStapleModalOpen(true)}
              className="h-8 text-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add Staple
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {pinnedTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="group relative rounded-xl border border-border/80 bg-background hover:border-primary/60 hover:bg-muted/30 transition-all p-3 flex flex-col justify-between"
            >
              <button
                type="button"
                onClick={() => handleTapStaple(tpl)}
                className="text-left w-full space-y-1"
              >
                <p className="text-sm font-semibold text-foreground pr-5 truncate">
                  {tpl.name}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {tpl.servingLabel}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {Math.round(tpl.calories * portionMultiplier)} kcal
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {Math.round(tpl.proteinG * portionMultiplier * 10) / 10}g P
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => deleteMealTemplate(tpl.id)}
                title="Remove staple"
                className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* TODAY'S MEAL TIMELINE */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-500" />
              Meals Logged ({dayMeals.length})
              {summary.junkMealCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {summary.junkMealCount} Junk ({summary.junkCalories} kcal)
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              Tap any meal row to reveal Carbs, Fat, notes &amp; Finance link
            </p>
          </div>
          <Button type="button" size="sm" onClick={openAddMealModal} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Log Meal
          </Button>
        </div>

        {dayMeals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 py-8 px-4 text-center">
            <p className="text-sm font-medium text-foreground">
              No meals logged for {selectedDate} yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Tap an Indian staple above or press ⌘K for 10-Second Capture
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {dayMeals.map((meal) => {
              const isExpanded = expandedMealId === meal.id;
              const candidateMatch = !meal.linkedTransactionId
                ? candidateTxByMealId.get(meal.id)
                : undefined;
              const showQuickLinkChip =
                Boolean(candidateMatch) &&
                (candidateMatch?.confidence === 'high' || meal.isJunk);
              const handleLinkCandidate = async (e: React.MouseEvent) => {
                e.stopPropagation();
                if (!candidateMatch) return;
                feedback.complete();
                const tx = candidateMatch.transaction;
                await linkMealToTransaction(meal.id, tx.id);
                toast.success(
                  `Linked "${meal.name}" to ₹${tx.amount} ${tx.merchantName || tx.title}`
                );
              };
              return (
                <div key={meal.id} className="cv-auto py-2.5 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMealId(isExpanded ? null : meal.id)
                    }
                    className="w-full text-left flex items-start justify-between gap-3 py-1"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {meal.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                          {meal.mealType.replace('_', ' ')}
                        </Badge>
                        {meal.isJunk && (
                          <Badge variant="destructive" className="text-[10px] shrink-0">
                            Junk
                          </Badge>
                        )}
                        {meal.linkedTransactionId && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] shrink-0 gap-1"
                          >
                            <Wallet className="h-2.5 w-2.5" /> Finance Linked
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
                      <span className="text-sm font-semibold tabular-nums whitespace-nowrap text-amber-600 dark:text-amber-400">
                        {meal.calories} kcal
                      </span>
                      <span className="text-sm font-semibold tabular-nums whitespace-nowrap text-emerald-600 dark:text-emerald-400 min-w-[3.25rem] text-right">
                        {meal.proteinG}g P
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  </button>

                  {showQuickLinkChip && candidateMatch && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleLinkCandidate}
                        className="h-7 max-w-full px-2.5 text-[11px] rounded-full gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                      >
                        <Wallet className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          Link to ₹{candidateMatch.transaction.amount}{' '}
                          {candidateMatch.transaction.merchantName ||
                            candidateMatch.transaction.title}
                        </span>
                      </Button>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-2 rounded-xl bg-muted/35 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                        <span>
                          Carbs: <strong className="text-foreground">{meal.carbsG}g</strong>
                        </span>
                        <span>
                          Fat: <strong className="text-foreground">{meal.fatG}g</strong>
                        </span>
                        <span>
                          Source:{' '}
                          <strong className="text-foreground capitalize">
                            {meal.source.replace('_', ' ')}
                          </strong>
                        </span>
                        {meal.notes && <span>Notes: {meal.notes}</span>}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {candidateMatch && !showQuickLinkChip && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleLinkCandidate}
                            className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
                          >
                            <Wallet className="h-3 w-3" /> Link ₹
                            {candidateMatch.transaction.amount}
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => openEditMealModal(meal)}
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                          onClick={() => {
                            deleteMealLog(meal.id);
                            toast.success('Meal removed');
                          }}
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Custom Meal Modal */}
      <Dialog open={mealModalOpen} onOpenChange={setMealModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{editingMeal ? 'Edit Meal' : 'Log Custom Meal'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveMeal} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Meal Name</label>
              <div className="flex gap-1.5">
                <Input
                  value={mealForm.name}
                  onChange={(e) => setMealForm({ ...mealForm, name: e.target.value })}
                  placeholder="e.g. Paneer Roll, Dal Chawal..."
                  required
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAutoEstimateMeal}
                  title="Auto-estimate macros from Hinglish dish name"
                  className="shrink-0 gap-1"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Estimate
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Calories (kcal)</label>
                <Input
                  type="number"
                  min={0}
                  value={mealForm.calories}
                  onChange={(e) =>
                    setMealForm({ ...mealForm, calories: Number(e.target.value) || 0 })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Protein (g)</label>
                <Input
                  type="number"
                  step="0.5"
                  min={0}
                  value={mealForm.proteinG}
                  onChange={(e) =>
                    setMealForm({ ...mealForm, proteinG: Number(e.target.value) || 0 })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Carbs (g, optional)
                </label>
                <Input
                  type="number"
                  step="0.5"
                  min={0}
                  value={mealForm.carbsG ?? 0}
                  onChange={(e) =>
                    setMealForm({ ...mealForm, carbsG: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Fat (g, optional)
                </label>
                <Input
                  type="number"
                  step="0.5"
                  min={0}
                  value={mealForm.fatG ?? 0}
                  onChange={(e) =>
                    setMealForm({ ...mealForm, fatG: Number(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div className="space-y-1">
                <label className="text-xs font-medium">Meal Slot</label>
                <select
                  value={mealForm.mealType || 'snack'}
                  onChange={(e) =>
                    setMealForm({ ...mealForm, mealType: e.target.value as MealType })
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {MEAL_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm pt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(mealForm.isJunk)}
                  onChange={(e) =>
                    setMealForm({ ...mealForm, isJunk: e.target.checked })
                  }
                  className="rounded accent-destructive h-4 w-4"
                />
                Flag as Junk Food
              </label>
            </div>

            {!editingMeal && (
              <div className="rounded-xl border border-border bg-muted/25 p-3 space-y-2.5">
                <label className="flex items-center justify-between gap-2 text-xs font-medium cursor-pointer">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Wallet className="h-3.5 w-3.5 text-primary" />
                    Paid outside? Add ₹ cost
                  </span>
                  <input
                    type="checkbox"
                    checked={paidOutside}
                    onChange={(e) => setPaidOutside(e.target.checked)}
                    className="rounded accent-primary h-4 w-4"
                  />
                </label>

                {paidOutside && (
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Amount (₹)
                      </label>
                      <Input
                        type="number"
                        min={1}
                        step="1"
                        value={paidAmountStr}
                        onChange={(e) => setPaidAmountStr(e.target.value)}
                        placeholder="e.g., 180"
                        className="h-9 text-sm font-mono tabular-nums"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Account
                      </label>
                      <select
                        value={paidAccountId}
                        onChange={(e) => setPaidAccountId(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {activeFinanceAccounts.length === 0 ? (
                          <option value="">No active accounts</option>
                        ) : (
                          activeFinanceAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMealModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">{editingMeal ? 'Update Meal' : 'Log Meal'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Staple Modal */}
      <Dialog open={stapleModalOpen} onOpenChange={setStapleModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Save 1-Tap Indian Staple</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveStaple} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Staple Name</label>
              <Input
                value={stapleForm.name}
                onChange={(e) => setStapleForm({ ...stapleForm, name: e.target.value })}
                placeholder="e.g. 2 Egg Omelette + 2 Toast"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Serving Size Label</label>
              <Input
                value={stapleForm.servingLabel}
                onChange={(e) =>
                  setStapleForm({ ...stapleForm, servingLabel: e.target.value })
                }
                placeholder="e.g. 1 plate"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Calories</label>
                <Input
                  type="number"
                  min={0}
                  value={stapleForm.calories}
                  onChange={(e) =>
                    setStapleForm({
                      ...stapleForm,
                      calories: Number(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Protein (g)</label>
                <Input
                  type="number"
                  step="0.5"
                  min={0}
                  value={stapleForm.proteinG}
                  onChange={(e) =>
                    setStapleForm({
                      ...stapleForm,
                      proteinG: Number(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Carbs (g)</label>
                <Input
                  type="number"
                  step="0.5"
                  min={0}
                  value={stapleForm.carbsG}
                  onChange={(e) =>
                    setStapleForm({ ...stapleForm, carbsG: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Fat (g)</label>
                <Input
                  type="number"
                  step="0.5"
                  min={0}
                  value={stapleForm.fatG}
                  onChange={(e) =>
                    setStapleForm({ ...stapleForm, fatG: Number(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStapleModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Staple</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
});
