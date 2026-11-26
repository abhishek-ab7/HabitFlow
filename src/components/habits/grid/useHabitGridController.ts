'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, getDay, getDaysInMonth, isFuture, isToday, startOfMonth } from 'date-fns';
import { KeyboardSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { SmartPointerSensor } from '@/lib/dnd-sensors';
import { useFeedback } from '@/hooks/use-feedback';
import { useHabitStore } from '@/lib/stores/habit-store';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import type { Habit, HabitCompletion } from '@/lib/types';
import type { HabitDayInfo } from '../row/habit-row-helpers';

function buildMonthDays(selectedMonth: Date): HabitDayInfo[] {
  const daysInMonth = getDaysInMonth(selectedMonth);
  const firstDayOfWeek = getDay(startOfMonth(selectedMonth));

  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
    const dayOfWeek = (firstDayOfWeek + i) % 7;
    return {
      day,
      dateStr: format(date, 'yyyy-MM-dd'),
      dayOfWeek,
      dayLabel: format(date, 'EEE')[0],
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isFuture: isFuture(date),
      isToday: isToday(date),
    };
  });
}

function centerTodayCellOnMobile(container: HTMLDivElement | null) {
  if (!container) return;
  const todayEl = container.querySelector('.today-cell-header') as HTMLElement | null;
  if (!todayEl) return;

  const stickyWidth = 176;
  const visibleCellsWidth = container.clientWidth - stickyWidth;
  const todayRect = todayEl.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const todayContentCenter = todayRect.left - containerRect.left + container.scrollLeft + todayRect.width / 2;
  container.scrollLeft = Math.max(0, todayContentCenter - (stickyWidth + visibleCellsWidth / 2));
}

export function useHabitGridController(params: {
  habits: Habit[];
  completions: HabitCompletion[];
  selectedMonth: Date;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { habits, completions, selectedMonth, containerRef } = params;
  const router = useRouter();
  const feedback = useFeedback();

  const reorder = useHabitStore((s) => s.reorder);
  const freezeHabit = useHabitStore((s) => s.freezeHabit);
  const markRestDay = useHabitStore((s) => s.markRestDay);
  const startUrgeTimer = usePomodoroStore((s) => s.startUrgeTimer);

  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1024 : false));
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedHabitForLog, setSelectedHabitForLog] = useState<Habit | null>(null);
  const [logDate, setLogDate] = useState('');
  const [logNote, setLogNote] = useState('');
  const [logValue, setLogValue] = useState(0);
  const [showNoShieldsDialog, setShowNoShieldsDialog] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const sensors = useSensors(
    useSensor(SmartPointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  const displayedDays = useMemo(() => buildMonthDays(selectedMonth), [selectedMonth]);

  const completionsByHabit = useMemo(() => {
    const map = new Map<string, HabitCompletion[]>();
    for (const c of completions) {
      const arr = map.get(c.habitId);
      if (arr) arr.push(c);
      else map.set(c.habitId, [c]);
    }
    return map;
  }, [completions]);

  const completionsMapByHabit = useMemo(() => {
    const map = new Map<string, Map<string, HabitCompletion>>();
    for (const c of completions) {
      let inner = map.get(c.habitId);
      if (!inner) {
        inner = new Map();
        map.set(c.habitId, inner);
      }
      inner.set(c.date, c);
    }
    return map;
  }, [completions]);

  const habitIds = useMemo(() => habits.map((h) => h.id), [habits]);

  const mobileDays = useMemo(() => {
    const todayIndex = displayedDays.findIndex((d) => d.isToday);
    if (todayIndex !== -1) return displayedDays.slice(Math.max(0, todayIndex - 4), todayIndex + 1);
    return displayedDays.slice(-5);
  }, [displayedDays]);

  useEffect(() => {
    if (isMobile) centerTodayCellOnMobile(containerRef.current);
  }, [isMobile, displayedDays, containerRef]);

  const handleOpenLogModal = (habit: Habit) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const comp = completionsMapByHabit.get(habit.id)?.get(todayStr);
    setSelectedHabitForLog(habit);
    setLogDate(todayStr);
    setLogNote(comp?.note || '');
    setLogValue(comp?.value || 0);
    setShowLogModal(true);
  };

  const handleSaveLogModal = async () => {
    if (!selectedHabitForLog) return;
    feedback.complete();
    const { updateNote, updateValue } = useHabitStore.getState();
    await updateNote(selectedHabitForLog.id, logDate, logNote);
    if (selectedHabitForLog.isQuantitative) await updateValue(selectedHabitForLog.id, logDate, logValue);
    setShowLogModal(false);
    toast.success('Progress log updated');
  };

  const handleMobileRest = async (habitId: string, dateStr: string) => {
    feedback.tap();
    try {
      await markRestDay(habitId, dateStr);
      toast.success('Rest day updated');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleMobileFreeze = async (habitId: string, dateStr: string) => {
    feedback.tap();
    try {
      await freezeHabit(habitId, dateStr);
    } catch (err) {
      if ((err as Error).message === 'NO_SHIELDS_LEFT') setShowNoShieldsDialog(true);
      else toast.error((err as Error).message);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = habits.findIndex((h) => h.id === active.id);
    const newIndex = habits.findIndex((h) => h.id === over.id);
    await reorder(arrayMove(habits, oldIndex, newIndex).map((h) => h.id));
  };

  return {
    router, feedback, isMobile, sensors,
    displayedDays, mobileDays, habitIds,
    completionsByHabit, completionsMapByHabit,
    freezeHabit, startUrgeTimer,
    showLogModal, setShowLogModal, selectedHabitForLog,
    logDate, setLogDate, logNote, setLogNote, logValue, setLogValue,
    showNoShieldsDialog, setShowNoShieldsDialog,
    handleOpenLogModal, handleSaveLogModal, handleMobileRest, handleMobileFreeze, handleDragEnd,
  };
}
