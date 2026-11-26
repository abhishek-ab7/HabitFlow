import {
  differenceInDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isAfter,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { Habit, HabitCompletion, HabitFrequencyType } from '../types';

export type IsoDate = string;

export function formatDate(date: Date | string): IsoDate {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd');
}

export function getMonthDates(year: number, month: number): Date[] {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(new Date(year, month));
  return eachDayOfInterval({ start, end });
}

export function getWeekDates(date: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const start = startOfWeek(date, { weekStartsOn });
  const end = endOfWeek(date, { weekStartsOn });
  return eachDayOfInterval({ start, end });
}

export function isDateInFuture(date: IsoDate): boolean {
  return isAfter(parseISO(date), new Date());
}

export function isDateToday(date: IsoDate): boolean {
  return isToday(parseISO(date));
}

export function isCountableCompletion(c: HabitCompletion): boolean {
  return Boolean(c.completed && c.status !== 'frozen' && c.status !== 'rest' && !c.skipped);
}

export function isExplicitRestCompletion(c: HabitCompletion): boolean {
  return Boolean(c.status === 'rest' || c.skipped);
}

export function getHabitFrequencyType(habit?: Habit): HabitFrequencyType {
  if (!habit) return 'daily';
  if (habit.frequencyType) return habit.frequencyType;
  return (habit.targetDaysPerWeek ?? 7) < 7 ? 'weekly_flexible' : 'daily';
}

function hasScheduledDays(habit: Habit): boolean {
  return Boolean(habit.scheduledDays && habit.scheduledDays.length > 0);
}

function hasMultiDayInterval(habit: Habit): boolean {
  return (habit.intervalDays || 1) > 1;
}

const TARGET_DAYS_BY_FREQ: Record<HabitFrequencyType, (habit: Habit) => number> = {
  daily: () => 7,
  specific_days: (habit) => (hasScheduledDays(habit) ? habit.scheduledDays!.length : habit.targetDaysPerWeek || 7),
  interval: (habit) => Math.max(1, Math.round(7 / Math.max(1, habit.intervalDays || 2))),
  weekly_flexible: (habit) => Math.min(7, Math.max(1, habit.targetDaysPerWeek || 7)),
};

export function getEffectiveTargetDaysPerWeek(habit?: Habit): number {
  if (!habit) return 7;
  return TARGET_DAYS_BY_FREQ[getHabitFrequencyType(habit)](habit);
}

function findLatestCountableDateBefore(
  habitId: string,
  completions: HabitCompletion[],
  dateStr: IsoDate
): string | null {
  const before = completions.filter(
    (c) => (c.habitId === habitId || !c.habitId) && isCountableCompletion(c) && c.date < dateStr
  );
  if (before.length === 0) return null;
  return before.reduce((max, c) => (c.date > max ? c.date : max), '') || null;
}

function isWithinIntervalRestWindow(
  habit: Habit,
  completions: HabitCompletion[],
  dateStr: IsoDate,
  dateObj: Date
): boolean {
  const latestBefore = findLatestCountableDateBefore(habit.id, completions, dateStr);
  if (!latestBefore) return false;
  const diff = differenceInDays(dateObj, parseISO(latestBefore));
  return diff > 0 && diff < (habit.intervalDays || 2);
}

export function isHabitAutoRestOnDate(
  habit: Habit,
  completions: HabitCompletion[],
  dateStr: IsoDate
): boolean {
  const freq = getHabitFrequencyType(habit);
  const dateObj = parseISO(dateStr);

  if (freq === 'specific_days' && hasScheduledDays(habit)) {
    return !habit.scheduledDays!.includes(getDay(dateObj));
  }
  if (freq === 'interval' && hasMultiDayInterval(habit)) {
    return isWithinIntervalRestWindow(habit, completions, dateStr, dateObj);
  }
  return false;
}

export interface HabitWeekProgress {
  weekStart: string;
  weekEnd: string;
  completedCount: number;
  targetCount: number;
  restUsedCount: number;
  restAllowedCount: number;
  restRemainingCount: number;
  quotaMet: boolean;
  isAutoRestDay: boolean;
  isRestedToday: boolean;
  isCompletedToday: boolean;
  isFrozenToday: boolean;
  isSettledToday: boolean;
}

function isAnySettledFlag(flags: boolean[]): boolean {
  return flags.some(Boolean);
}

function computeTodayProgressFlags(
  habit: Habit,
  habitComps: HabitCompletion[],
  refStr: IsoDate,
  quotaMet: boolean
) {
  const todayComp = habitComps.find((c) => c.date === refStr);
  const isCompletedToday = Boolean(todayComp && isCountableCompletion(todayComp));
  const isFrozenToday = todayComp?.status === 'frozen';
  const isRestedToday = Boolean(todayComp && isExplicitRestCompletion(todayComp));
  const isAutoRestDay = isHabitAutoRestOnDate(habit, habitComps, refStr);
  const isFlexibleSettled = getHabitFrequencyType(habit) === 'weekly_flexible' && quotaMet;
  const isSettledToday = isAnySettledFlag([
    isCompletedToday,
    isFrozenToday,
    isRestedToday,
    isAutoRestDay,
    isFlexibleSettled,
  ]);

  return { isAutoRestDay, isRestedToday, isCompletedToday, isFrozenToday, isSettledToday };
}

export function getHabitWeekProgress(
  habit: Habit,
  completions: HabitCompletion[],
  referenceDate: Date = new Date()
): HabitWeekProgress {
  const weekStartsOn = habit.weekStartsOn ?? 1;
  const weekStart = formatDate(startOfWeek(referenceDate, { weekStartsOn }));
  const weekEnd = formatDate(endOfWeek(referenceDate, { weekStartsOn }));

  const habitComps = completions.filter((c) => c.habitId === habit.id);
  const weekComps = habitComps.filter((c) => c.date >= weekStart && c.date <= weekEnd);

  const targetCount = getEffectiveTargetDaysPerWeek(habit);
  const restAllowedCount = Math.max(0, 7 - targetCount);
  const completedCount = weekComps.filter(isCountableCompletion).length;
  const restUsedCount = weekComps.filter(isExplicitRestCompletion).length;
  const quotaMet = completedCount >= targetCount;

  return {
    weekStart,
    weekEnd,
    completedCount,
    targetCount,
    restUsedCount,
    restAllowedCount,
    restRemainingCount: Math.max(0, restAllowedCount - restUsedCount),
    quotaMet,
    ...computeTodayProgressFlags(habit, habitComps, formatDate(referenceDate), quotaMet),
  };
}
