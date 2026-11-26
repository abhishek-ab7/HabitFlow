import { format, startOfWeek, endOfWeek, parseISO, differenceInCalendarDays } from 'date-fns';
import { getHabitWeekProgress } from '../calculations';
import { getSyncEngine } from '../sync';
import type { Habit, HabitCompletion } from '../types';
import { useGamificationStore } from './gamification-store';

function assertWithinFreezeWindow(date: string): Date {
  const dateObj = parseISO(date);
  const diffDays = differenceInCalendarDays(new Date(), dateObj);
  if (diffDays < 0 || diffDays > 7) {
    throw new Error('You can only freeze missed days within the past 7 days.');
  }
  return dateObj;
}

export async function handleWeeklyFreezeVerification(
  completions: HabitCompletion[],
  date: string
): Promise<void> {
  const dateObj = assertWithinFreezeWindow(date);
  const startStr = format(startOfWeek(dateObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const endStr = format(endOfWeek(dateObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const hasWeeklyFreeze = completions.some(
    (c) => c.status === 'frozen' && c.date >= startStr && c.date <= endStr
  );
  if (!hasWeeklyFreeze) return;

  const success = await useGamificationStore.getState().useShield();
  if (!success) {
    throw new Error('NO_SHIELDS_LEFT');
  }
}

export async function syncBatchCompletions(results: HabitCompletion[]): Promise<void> {
  try {
    const syncEngine = getSyncEngine();
    for (const result of results) {
      await syncEngine.pushCompletion(result);
    }
  } catch (error) {
    console.error('Failed to sync batch completions:', error);
  }
}

export function isRangeAlreadyLoaded(
  loadedRange: { start: string; end: string } | null,
  start: string,
  end: string
): boolean {
  if (!loadedRange) return false;
  return start >= loadedRange.start && end <= loadedRange.end;
}

export function calculateUnionRange(
  loadedRange: { start: string; end: string } | null,
  start: string,
  end: string
) {
  if (!loadedRange) return { start, end };
  return {
    start: start < loadedRange.start ? start : loadedRange.start,
    end: end > loadedRange.end ? end : loadedRange.end,
  };
}

export function applyHabitEditToList(
  habits: Habit[],
  id: string,
  data: Partial<Habit>,
  fullHabit: Habit | undefined
): Habit[] {
  if (data.archived === true) {
    return habits.filter((h) => h.id !== id);
  }
  const shouldRestore = data.archived === false && Boolean(fullHabit) && !habits.some((h) => h.id === id);
  if (shouldRestore && fullHabit) {
    return [...habits, fullHabit].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return habits.map((h) => (h.id === id ? { ...h, ...data } : h));
}

export function assertRestDayAllowed(
  habit: Habit,
  completions: HabitCompletion[],
  date: string
): void {
  const weekStatus = getHabitWeekProgress(habit, completions, parseISO(date));
  if (weekStatus.restAllowedCount <= 0 && !weekStatus.isAutoRestDay) {
    throw new Error(
      'This is a 7-days/week daily habit with 0 free rest days. Edit the habit schedule or use a Streak Shield.'
    );
  }
  const restExhausted =
    weekStatus.restRemainingCount <= 0 && !weekStatus.isAutoRestDay && !weekStatus.quotaMet;
  if (restExhausted) {
    throw new Error(
      `You've used all ${weekStatus.restAllowedCount} rest day(s) for this week. Use a Streak Shield to protect your streak.`
    );
  }
}

function classifyHabitTodayStatus(
  habit: Habit,
  completions: HabitCompletion[],
  today: string,
  now: Date
): 'done' | 'rest' | 'quota' | 'pending' {
  const comp = completions.find((c) => c.habitId === habit.id && c.date === today);
  const isDone = Boolean(comp && comp.completed && comp.status !== 'rest' && !comp.skipped);
  if (isDone) return 'done';

  const isRest = Boolean(comp && (comp.status === 'rest' || comp.skipped));
  const weekProg = getHabitWeekProgress(habit, completions, now);
  if (isRest || weekProg.isAutoRestDay) return 'rest';

  if (weekProg.quotaMet && (habit.targetDaysPerWeek ?? 7) < 7) return 'quota';
  return 'pending';
}

function tallyHabitStatuses(habits: Habit[], completions: HabitCompletion[], today: string, now: Date) {
  const counts = { completed: 0, totalDueToday: 0, restingCount: 0, quotaMetCount: 0 };
  for (const habit of habits) {
    const status = classifyHabitTodayStatus(habit, completions, today, now);
    if (status === 'done') {
      counts.completed++;
      counts.totalDueToday++;
    } else if (status === 'rest') {
      counts.restingCount++;
    } else if (status === 'quota') {
      counts.quotaMetCount++;
    } else {
      counts.totalDueToday++;
    }
  }
  return counts;
}

export function computeTodayHabitProgress(habits: Habit[], completions: HabitCompletion[]) {
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const activeHabits = habits.filter((h) => !h.archived);
  const { completed, totalDueToday, restingCount, quotaMetCount } = tallyHabitStatuses(
    activeHabits,
    completions,
    today,
    now
  );

  const allExempt = activeHabits.length > 0 && (restingCount > 0 || quotaMetCount > 0);
  const percentage =
    totalDueToday > 0 ? Math.round((completed / totalDueToday) * 100) : allExempt ? 100 : 0;

  return { completed, total: totalDueToday, percentage, restingCount, quotaMetCount };
}
