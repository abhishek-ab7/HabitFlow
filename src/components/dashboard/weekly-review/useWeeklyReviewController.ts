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

export function useWeeklyReviewController() {
  const [showFullReview, setShowFullReview] = useState(false);
  const [selectedMitIds, setSelectedMitIds] = useState<string[]>([]);
  const [savingMits, setSavingMits] = useState(false);

  const today = new Date();
  const todayIso = getLocalIsoDate(today);
  const isSunday = today.getDay() === 0;
  const [mitTargetMode, setMitTargetMode] = useState<'today' | 'next_monday'>(isSunday ? 'next_monday' : 'today');
  const activeMitDate = computeActiveMitDate({ todayIso, dayOfWeek: today.getDay(), mitTargetMode });

  const { habits, completions } = useHabitStore(useShallow((s) => ({ habits: s.habits, completions: s.completions })));
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

  const handleOpenReview = async () => {
    const existingPinned = candidateTasks.filter((t) => t.metadata?.isMitForDate === activeMitDate).slice(0, 3).map((t) => t.id);
    setSelectedMitIds(existingPinned.length > 0 ? existingPinned : candidateTasks.slice(0, 3).map((t) => t.id));
    setShowFullReview(true);

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

  const handleSaveWeeklyMits = async () => {
    if (typeof editTask !== 'function') return void setShowFullReview(false);
    setSavingMits(true);
    try {
      await persistMitSelection({ tasks, selectedMitIds, activeMitDate, editTask });
      toast.success(`Locked Top ${selectedMitIds.length} MIT${selectedMitIds.length === 1 ? '' : 's'} for ${activeMitDate}`);
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
    handleOpenReview, toggleMitSelection, handleSaveWeeklyMits,
  };
}
