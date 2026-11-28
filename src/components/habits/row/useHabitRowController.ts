'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Habit, HabitCompletion } from '@/lib/types';
import { getHabitWeekProgress } from '@/lib/calculations';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { useFeedback } from '@/hooks/use-feedback';
import { useStableCallback } from '@/hooks/use-stable-callback';
import { useHabitStore } from '@/lib/stores/habit-store';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { countMonthlyCompletions, getNextQuantitativeValue, type HabitDayInfo } from './habit-row-helpers';

const MILESTONE_STREAKS = new Set([7, 14, 30, 100]);

function getOffsetIsoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return getLocalIsoDate(d);
}

function useHabitRowModalState(params: { habit: Habit; completionMap: Map<string, HabitCompletion> }) {
  const { habit, completionMap } = params;
  const updateNote = useHabitStore((s) => s.updateNote);
  const updateValue = useHabitStore((s) => s.updateValue);

  const [openPopoverDate, setOpenPopoverDate] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');
  const [tempValue, setTempValue] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logDate, setLogDate] = useState('');
  const [logNote, setLogNote] = useState('');
  const [logValue, setLogValue] = useState(0);
  const [showNoShieldsDialog, setShowNoShieldsDialog] = useState(false);

  const handleOpenLogModal = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const comp = completionMap.get(todayStr);
    setLogDate(todayStr);
    setLogNote(comp?.note || '');
    setLogValue(comp?.value || 0);
    setShowLogModal(true);
  };

  const handleSaveLogModal = async () => {
    const store = useHabitStore.getState();
    await store.updateNote(habit.id, logDate, logNote);
    if (habit.isQuantitative) await store.updateValue(habit.id, logDate, logValue);
    setShowLogModal(false);
    toast.success('Progress log updated');
  };

  const handleOpenPopover = useStableCallback((dateStr: string) => {
    const comp = completionMap.get(dateStr);
    setTempNote(comp?.note || '');
    setTempValue(comp?.value || 0);
    setOpenPopoverDate(dateStr);
  });

  const handleSavePopover = useStableCallback(async (dateStr: string) => {
    await updateNote(habit.id, dateStr, tempNote);
    if (habit.isQuantitative) await updateValue(habit.id, dateStr, tempValue);
    setOpenPopoverDate(null);
  });

  return {
    openPopoverDate, setOpenPopoverDate, tempNote, setTempNote, tempValue, setTempValue,
    showShareModal, setShowShareModal, showRecovery, setShowRecovery,
    showLogModal, setShowLogModal, logDate, setLogDate, logNote, setLogNote, logValue, setLogValue,
    showNoShieldsDialog, setShowNoShieldsDialog,
    handleOpenLogModal, handleSaveLogModal, handleOpenPopover, handleSavePopover,
  };
}

export function useHabitRowController(params: {
  habit: Habit;
  days: HabitDayInfo[];
  completions: HabitCompletion[];
  streak: number;
  onToggle: (habitId: string, date: string) => void;
  onFreeze?: (habitId: string, date: string) => void;
}) {
  const { habit, days, completions, streak, onToggle, onFreeze } = params;
  const router = useRouter();
  const feedback = useFeedback();
  const updateValue = useHabitStore((s) => s.updateValue);
  const markRestDay = useHabitStore((s) => s.markRestDay);
  const startUrgeTimer = usePomodoroStore((s) => s.startUrgeTimer);

  const [rippleCell, setRippleCell] = useState<string | null>(null);
  const [burstActive, setBurstActive] = useState<string | null>(null);

  const yesterdayStr = useMemo(() => getOffsetIsoDate(1), []);
  const dayBeforeYesterdayStr = useMemo(() => getOffsetIsoDate(2), []);

  const completionMap = useMemo(() => {
    const map = new Map<string, HabitCompletion>();
    for (const c of completions) {
      if (c.habitId === habit.id) map.set(c.date, c);
    }
    return map;
  }, [completions, habit.id]);

  const modals = useHabitRowModalState({ habit, completionMap });

  const isStreakBrokenYesterday = useMemo(() => {
    const yesterdayComp = completionMap.get(yesterdayStr);
    const dayBeforeComp = completionMap.get(dayBeforeYesterdayStr);
    const missedYesterday = !yesterdayComp || (!yesterdayComp.completed && yesterdayComp.status !== 'frozen');
    const completedDayBefore = Boolean(dayBeforeComp && dayBeforeComp.completed && dayBeforeComp.status !== 'frozen');
    return missedYesterday && completedDayBefore;
  }, [yesterdayStr, dayBeforeYesterdayStr, completionMap]);

  const weekProgress = useMemo(() => getHabitWeekProgress(habit, completions, new Date()), [habit, completions]);

  const triggerBurst = (dateStr: string) => {
    setBurstActive(dateStr);
    setTimeout(() => setBurstActive(null), 800);
  };

  const triggerRipple = (dateStr: string) => {
    setRippleCell(`${habit.id}-${dateStr}`);
    setTimeout(() => setRippleCell(null), 500);
  };

  const handleToggleRestDay = useStableCallback(async (dateStr: string) => {
    feedback.tap();
    try {
      await markRestDay(habit.id, dateStr);
      const existing = completionMap.get(dateStr);
      if (existing?.status === 'rest' || existing?.skipped) toast.info('Rest day cleared');
      else toast.success(`Marked as Rest Day (${Math.max(0, weekProgress.restRemainingCount - 1)} rest left this week)`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  });

  const handleQuantitativeClick = (click: { dateStr: string; isShiftKey: boolean; comp?: HabitCompletion }) => {
    const currentValue = click.comp?.value || 0;
    const target = habit.targetValue || 1;
    const newValue = getNextQuantitativeValue({ currentValue, target, isShiftKey: click.isShiftKey });
    if (newValue >= target && currentValue < target) {
      feedback.complete();
      triggerBurst(click.dateStr);
    } else {
      feedback.tap();
    }
    updateValue(habit.id, click.dateStr, newValue);
    triggerRipple(click.dateStr);
  };

  const handleCellClick = useStableCallback((click: { dateStr: string; isFutureDate: boolean; isShiftKey: boolean }) => {
    if (click.isFutureDate) return;
    const comp = completionMap.get(click.dateStr);
    if (habit.isQuantitative) return handleQuantitativeClick({ dateStr: click.dateStr, isShiftKey: click.isShiftKey, comp });

    const completed = comp?.completed && comp?.status !== 'frozen';
    if (!completed) {
      if (MILESTONE_STREAKS.has(streak + 1)) feedback.milestone();
      else feedback.complete();
      triggerBurst(click.dateStr);
    } else {
      feedback.uncheck();
    }
    onToggle(habit.id, click.dateStr);
    triggerRipple(click.dateStr);
  });

  const handleCellRightClick = useStableCallback(async (click: { e: React.MouseEvent; dateStr: string; isFutureDate: boolean }) => {
    click.e.preventDefault();
    if (click.isFutureDate || !onFreeze) return;
    const isCurrentlyFrozen = completionMap.get(click.dateStr)?.status === 'frozen';
    feedback.tap();
    if (!isCurrentlyFrozen) triggerBurst(click.dateStr);

    try {
      await onFreeze(habit.id, click.dateStr);
    } catch (err) {
      if ((err as Error).message === 'NO_SHIELDS_LEFT') modals.setShowNoShieldsDialog(true);
      else toast.error((err as Error).message);
    } finally {
      triggerRipple(click.dateStr);
    }
  });

  const monthlyCount = countMonthlyCompletions(completionMap);
  const totalDays = days.filter((d) => !d.isFuture).length;
  const percentage = totalDays > 0 ? Math.round((monthlyCount / totalDays) * 100) : 0;

  return {
    router,
    startUrgeTimer,
    isQuit: habit.polarity === 'quit',
    yesterdayStr,
    completionMap,
    isStreakBrokenYesterday,
    weekProgress,
    monthlyCount,
    totalDays,
    percentage,
    rippleCell,
    burstActive,
    ...modals,
    handleToggleRestDay,
    handleCellClick,
    handleCellRightClick,
  };
}
