import { format, startOfWeek, endOfWeek, parseISO, differenceInCalendarDays } from 'date-fns';
import { getHabitWeekProgress } from '../calculations';
import { getSyncEngine } from '../sync';
import type { Habit, HabitCompletion } from '../types';
import { useGamificationStore } from './gamification-store';

export type IsoDateString = string;
export type HabitIdentifier = string;

function assertWithinFreezeWindow(date: IsoDateString): Date {
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
  id: HabitIdentifier,
  data: Partial<Habit>,
  fullHabit: Habit | undefined
): Habit[] {
  if (data.archived === true) return habits.filter((h) => h.id !== id);
  const needsRestore = data.archived === false && !habits.some((h) => h.id === id);
  if (needsRestore && fullHabit) {
    return [...habits, fullHabit].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return habits.map((h) => (h.id === id ? { ...h, ...data } : h));
}

export function assertRestDayAllowed(
  habit: Habit,
  completions: HabitCompletion[],
  date: IsoDateString
): void {
  const weekStatus = getHabitWeekProgress(habit, completions, parseISO(date));
  if (weekStatus.isAutoRestDay) return;
  if (weekStatus.restAllowedCount <= 0) {
    throw new Error(
      'This is a 7-days/week daily habit with 0 free rest days. Edit the habit schedule or use a Streak Shield.'
    );
  }
  if (weekStatus.restRemainingCount <= 0 && !weekStatus.quotaMet) {
    throw new Error(
      `You've used all ${weekStatus.restAllowedCount} rest day(s) for this week. Use a Streak Shield to protect your streak.`
    );
  }
}

function isCompletionDone(comp?: HabitCompletion): boolean {
  return Boolean(comp?.completed && comp.status !== 'rest' && !comp.skipped);
}

function isCompletionRest(comp?: HabitCompletion): boolean {
  return Boolean(comp && (comp.status === 'rest' || comp.skipped));
}

function classifyHabitTodayStatus(
  habit: Habit,
  completions: HabitCompletion[],
  today: string,
  now: Date
): 'done' | 'rest' | 'quota' | 'pending' {
  const comp = completions.find((c) => c.habitId === habit.id && c.date === today);
  if (isCompletionDone(comp)) return 'done';

  const weekProg = getHabitWeekProgress(habit, completions, now);
  if (isCompletionRest(comp) || weekProg.isAutoRestDay) return 'rest';

  if (weekProg.quotaMet && (habit.targetDaysPerWeek ?? 7) < 7) return 'quota';
  return 'pending';
}

const STATUS_INCREMENTS = {
  done: { completed: 1, totalDueToday: 1, restingCount: 0, quotaMetCount: 0 },
  pending: { completed: 0, totalDueToday: 1, restingCount: 0, quotaMetCount: 0 },
  rest: { completed: 0, totalDueToday: 0, restingCount: 1, quotaMetCount: 0 },
  quota: { completed: 0, totalDueToday: 0, restingCount: 0, quotaMetCount: 1 },
} as const;

function tallyHabitStatuses(habits: Habit[], completions: HabitCompletion[], today: string, now: Date) {
  const counts = { completed: 0, totalDueToday: 0, restingCount: 0, quotaMetCount: 0 };
  for (const habit of habits) {
    const inc = STATUS_INCREMENTS[classifyHabitTodayStatus(habit, completions, today, now)];
    counts.completed += inc.completed;
    counts.totalDueToday += inc.totalDueToday;
    counts.restingCount += inc.restingCount;
    counts.quotaMetCount += inc.quotaMetCount;
  }
  return counts;
}

function computeProgressPct(completed: number, totalDueToday: number, isExempt: boolean): number {
  if (totalDueToday > 0) return Math.round((completed / totalDueToday) * 100);
  return isExempt ? 100 : 0;
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
  const percentage = computeProgressPct(completed, totalDueToday, allExempt);

  return { completed, total: totalDueToday, percentage, restingCount, quotaMetCount };
}
