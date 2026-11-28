'use client';

import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useMoodStore } from '@/lib/stores/mood-store';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import {
  buildDeterministicWeeklyReview,
  type WeeklyReviewDigestInput,
  type WeeklyReviewOutput,
  type WeeklyReviewProposal,
} from '@/lib/ai/graphs/weekly-review';
import {
  buildLast7Days,
  computeActiveMitDate,
  computeFourTruthsSummary,
  computeWeeklyHabitStats,
} from './weekly-review-analytics';

async function persistMitSelection(params: {
  tasks: ReturnType<typeof useTaskStore.getState>['tasks'];
  selectedMitIds: string[];
  activeMitDate: string;
  editTask: ReturnType<typeof useTaskStore.getState>['editTask'];
}) {
  const { tasks, selectedMitIds, activeMitDate, editTask } = params;
  const toUnpin = tasks.filter((t) => t.metadata?.isMitForDate === activeMitDate && !selectedMitIds.includes(t.id));
  for (const t of toUnpin) {
    await editTask(t.id, { metadata: { ...(t.metadata || {}), isMitForDate: null, mitRank: null } });
  }
  for (let i = 0; i < selectedMitIds.length; i += 1) {
    const task = tasks.find((t) => t.id === selectedMitIds[i]);
    if (task) await editTask(task.id, { metadata: { ...(task.metadata || {}), isMitForDate: activeMitDate, mitRank: i + 1 } });
  }
}

async function applyCheckedProposals(params: {
  proposals: WeeklyReviewProposal[];
  checkedIds: string[];
  habits: ReturnType<typeof useHabitStore.getState>['habits'];
  editHabit: ReturnType<typeof useHabitStore.getState>['editHabit'];
  financeCategories: ReturnType<typeof useFinanceStore.getState>['categories'];
  updateCategoryBudget: ReturnType<typeof useFinanceStore.getState>['updateCategoryBudget'];
}): Promise<{ appliedCount: number; undoActions: Array<() => Promise<void>> }> {
  const undoActions: Array<() => Promise<void>> = [];
  let appliedCount = 0;

  for (const p of params.proposals) {
    if (!params.checkedIds.includes(p.id)) continue;

    if (p.domain === 'habit' && typeof params.editHabit === 'function') {
      const target = params.habits.find((h) => h.id === p.habitId);
      if (!target) continue;
      if (p.actionType === 'adjust_target_days' && p.payload.targetDaysPerWeek) {
        const prev = target.targetDaysPerWeek;
        await params.editHabit(target.id, { targetDaysPerWeek: p.payload.targetDaysPerWeek });
        undoActions.push(() => params.editHabit(target.id, { targetDaysPerWeek: prev }));
        appliedCount += 1;
      } else if (p.actionType === 'set_two_minute_floor' && p.payload.twoMinuteVersion) {
        const prevMeta = target.metadata ? { ...target.metadata } : undefined;
        await params.editHabit(target.id, {
          metadata: { ...(target.metadata || {}), twoMinuteVersion: p.payload.twoMinuteVersion },
        });
        undoActions.push(() => params.editHabit(target.id, { metadata: prevMeta }));
        appliedCount += 1;
      }
    } else if (
      p.domain === 'finance' &&
      p.payload.categoryId &&
      p.payload.suggestedLimitINR &&
      typeof params.updateCategoryBudget === 'function'
    ) {
      const cat = params.financeCategories.find((c) => c.id === p.payload.categoryId);
      if (!cat) continue;
      const prevLimit = cat.monthlyBudgetLimit;
      const catId = cat.id;
      await params.updateCategoryBudget(catId, p.payload.suggestedLimitINR);
      undoActions.push(() => params.updateCategoryBudget(catId, prevLimit));
      appliedCount += 1;
    }
  }

  return { appliedCount, undoActions };
}

export function useWeeklyReviewController() {
  const [showFullReview, setShowFullReview] = useState(false);
  const [selectedMitIds, setSelectedMitIds] = useState<string[]>([]);
  const [savingMits, setSavingMits] = useState(false);
  const [aiReview, setAiReview] = useState<WeeklyReviewOutput | null>(null);
  const [loadingAiReview, setLoadingAiReview] = useState(false);
  const [checkedProposalIds, setCheckedProposalIds] = useState<string[]>([]);

  const today = new Date();
  const todayIso = getLocalIsoDate(today);
  const isSunday = today.getDay() === 0;
  const [mitTargetMode, setMitTargetMode] = useState<'today' | 'next_monday'>(isSunday ? 'next_monday' : 'today');
  const activeMitDate = computeActiveMitDate({ todayIso, dayOfWeek: today.getDay(), mitTargetMode });

  const { habits, completions, editHabit } = useHabitStore(
    useShallow((s) => ({ habits: s.habits, completions: s.completions, editHabit: s.editHabit }))
  );
  const tasks = useTaskStore((s) => s.tasks);
  const editTask = useTaskStore((s) => s.editTask);
  const moodLogs = useMoodStore((s) => s.moodLogs);
  const getMoodForDate = useMoodStore((s) => s.getMoodForDate);

  const financeTransactions = useFinanceStore((s) => s.transactions);
  const financeCategories = useFinanceStore((s) => s.categories);
  const financeDebtRecords = useFinanceStore((s) => s.debtRecords);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getNetWorthSummary = useFinanceStore((s) => s.getNetWorthSummary);
  const getDebtSummary = useFinanceStore((s) => s.getDebtSummary);
  const updateCategoryBudget = useFinanceStore((s) => s.updateCategoryBudget);

  const fitnessDailyLogs = useFitnessStore((s) => s.dailyLogs);
  const fitnessMealLogs = useFitnessStore((s) => s.mealLogs);
  const fitnessWorkoutSessions = useFitnessStore((s) => s.workoutSessions);
  const fitnessSupplements = useFitnessStore((s) => s.supplementInventory);
  const fitnessSupplementLogs = useFitnessStore((s) => s.supplementLogs);
  const isFitnessEnabled = isFitnessModuleEnabled(useGamificationStore((s) => s.settings));

  const last7Days = useMemo(() => buildLast7Days(), []);
  const stats = useMemo(() => computeWeeklyHabitStats({ habits, completions, last7Days }), [habits, completions, last7Days]);

  const fourTruths = useMemo(
    () =>
      computeFourTruthsSummary({
        todayIso,
        monthlySummary: getMonthlySummary(),
        netWorth: getNetWorthSummary(),
        debtSummary: getDebtSummary(),
        financeDebtRecords, financeTransactions, financeCategories,
        fitnessDailyLogs, fitnessMealLogs, fitnessWorkoutSessions, fitnessSupplements, fitnessSupplementLogs,
        habits, completions, moodLogs,
      }),
    [
      todayIso, getMonthlySummary, getNetWorthSummary, getDebtSummary,
      financeDebtRecords, financeTransactions, financeCategories,
      fitnessDailyLogs, fitnessMealLogs, fitnessWorkoutSessions, fitnessSupplements, fitnessSupplementLogs,
      habits, completions, moodLogs,
    ]
  );

  const candidateTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'done' && t.status !== 'archived' && !t.parentTaskId)
        .sort((a, b) => {
          const aPinned = a.metadata?.isMitForDate === activeMitDate ? 0 : 1;
          const bPinned = b.metadata?.isMitForDate === activeMitDate ? 0 : 1;
          if (aPinned !== bPinned) return aPinned - bPinned;
          const pRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return (pRank[a.priority] ?? 2) - (pRank[b.priority] ?? 2);
        }),
    [tasks, activeMitDate]
  );

  const buildDigestPayload = (): WeeklyReviewDigestInput => ({
    todayIso,
    weeklyCompletionRate: stats.weeklyCompletionRate,
    bestHabitName: stats.bestHabit?.habit.name ?? null,
    bestHabitRate: stats.bestHabit?.rate ?? null,
    safeToSpendMonthly: fourTruths.truth1Finance.safeToSpendMonthly,
    safeToSpendDaily: fourTruths.truth1Finance.safeToSpendDaily,
    junkSpend14dInr: fourTruths.truth3JunkTrigger.junkSpend14dInr,
    emptyKcal14d: fourTruths.truth3JunkTrigger.emptyKcal14d,
    topTriggerLabel: fourTruths.truth3JunkTrigger.topTriggerLabel,
    triggerMultiplier: fourTruths.truth3JunkTrigger.triggerMultiplier,
    workouts7dCount: fourTruths.truth2BodyWorkouts.workouts7dCount,
    avgSteps7d: fourTruths.truth2BodyWorkouts.avgSteps7d,
    catalog: {
      habits: habits.filter((h) => !h.archived).slice(0, 20).map((h) => ({ id: h.id, name: h.name, targetDaysPerWeek: h.targetDaysPerWeek })),
      categories: financeCategories.filter((c) => !c.archived && !c.deletedAt).slice(0, 20).map((c) => ({ id: c.id, name: c.name, slug: c.slug, monthlyBudgetLimit: c.monthlyBudgetLimit })),
      tasks: candidateTasks.slice(0, 12).map((t) => ({ id: t.id, title: t.title, priority: t.priority })),
    },
  });

  const loadAiWeeklyReview = async (hasExistingPinnedMits: boolean) => {
    const payload = buildDigestPayload();
    setLoadingAiReview(true);
    try {
      const res = await fetch('/api/ai/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result: WeeklyReviewOutput = res.ok
        ? ((await res.json()) as WeeklyReviewOutput)
        : buildDeterministicWeeklyReview(payload);
      setAiReview(result);
      setCheckedProposalIds(result.proposals.map((p) => p.id));
      if (!hasExistingPinnedMits) {
        const mitProp = result.proposals.find((p) => p.domain === 'task');
        if (mitProp && mitProp.domain === 'task' && mitProp.payload.taskIds.length > 0) {
          setSelectedMitIds(mitProp.payload.taskIds);
        }
      }
    } catch {
      const offlineResult = buildDeterministicWeeklyReview(payload);
      setAiReview(offlineResult);
      setCheckedProposalIds(offlineResult.proposals.map((p) => p.id));
    } finally {
      setLoadingAiReview(false);
    }
  };

  const handleOpenReview = async () => {
    const existingPinned = candidateTasks.filter((t) => t.metadata?.isMitForDate === activeMitDate).slice(0, 3).map((t) => t.id);
    setSelectedMitIds(existingPinned.length > 0 ? existingPinned : candidateTasks.slice(0, 3).map((t) => t.id));
    setShowFullReview(true);
    void loadAiWeeklyReview(existingPinned.length > 0);

    if (!isSunday) return;
    try {
      const confetti = (await import('canvas-confetti')).default;
      confetti({ particleCount: 45, spread: 40, origin: { y: 0.7 } });
    } catch {
      // Optional confetti effect
    }
  };

  const toggleMitSelection = (taskId: string) => {
    setSelectedMitIds((prev) => {
      if (prev.includes(taskId)) return prev.filter((id) => id !== taskId);
      return prev.length >= 3 ? [...prev.slice(1), taskId] : [...prev, taskId];
    });
  };

  const toggleProposal = (proposalId: string) => {
    setCheckedProposalIds((prev) =>
      prev.includes(proposalId) ? prev.filter((id) => id !== proposalId) : [...prev, proposalId]
    );
  };

  const handleSaveWeeklyMits = async () => {
    if (typeof editTask !== 'function') return void setShowFullReview(false);
    setSavingMits(true);
    try {
      await persistMitSelection({ tasks, selectedMitIds, activeMitDate, editTask });
      const { appliedCount, undoActions } = await applyCheckedProposals({
        proposals: aiReview?.proposals ?? [],
        checkedIds: checkedProposalIds,
        habits,
        editHabit,
        financeCategories,
        updateCategoryBudget,
      });

      const msg = appliedCount > 0
        ? `Locked ${selectedMitIds.length} MITs + applied ${appliedCount} reset fix${appliedCount === 1 ? '' : 'es'}`
        : `Locked Top ${selectedMitIds.length} MIT${selectedMitIds.length === 1 ? '' : 's'} for ${activeMitDate}`;

      toast.success(
        msg,
        undoActions.length > 0
          ? {
              duration: 5000,
              action: {
                label: 'Undo',
                onClick: () => {
                  void Promise.all(undoActions.map((fn) => fn())).then(() => toast.info('Reverted weekly reset fixes'));
                },
              },
            }
          : undefined
      );
      setShowFullReview(false);
    } catch {
      toast.error('Failed to save weekly MIT priorities');
    } finally {
      setSavingMits(false);
    }
  };

  return {
    habits, completions, isFitnessEnabled, getMoodForDate,
    todayIso, isSunday, mitTargetMode, setMitTargetMode, activeMitDate,
    showFullReview, setShowFullReview, selectedMitIds, savingMits,
    last7Days, stats, fourTruths, candidateTasks,
    aiReview, loadingAiReview, checkedProposalIds, toggleProposal,
    handleOpenReview, toggleMitSelection, handleSaveWeeklyMits,
  };
}
