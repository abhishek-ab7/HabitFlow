import { eachDayOfInterval, isAfter, parseISO, subDays } from 'date-fns';
import type {
  Category,
  CategoryBreakdown,
  DailyStats,
  Habit,
  HabitCompletion,
  HeatmapData,
  Task,
} from '../types';
import {
  formatDate,
  getEffectiveTargetDaysPerWeek,
  getHabitWeekProgress,
  isExplicitRestCompletion,
} from './date-and-schedule';

function isCompletedNotRest(c: HabitCompletion): boolean {
  return Boolean(c.completed && c.status !== 'rest' && !c.skipped);
}

function indexCompletionsByDate(completions: HabitCompletion[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of completions) {
    if (isCompletedNotRest(c)) {
      map.set(c.date, (map.get(c.date) || 0) + 1);
    }
  }
  return map;
}

function toRoundedPct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function buildDailyStatEntry(
  day: Date,
  completionsByDate: Map<string, number>,
  habitsWithCreatedDate: Array<{ parsedCreatedAt: Date }>
): DailyStats {
  const dateStr = formatDate(day);
  const completedHabits = completionsByDate.get(dateStr) ?? 0;
  const totalHabits = habitsWithCreatedDate.filter((h) => !isAfter(h.parsedCreatedAt, day)).length;
  return {
    date: dateStr,
    completedHabits,
    totalHabits,
    completionRate: toRoundedPct(completedHabits, totalHabits),
  };
}

export function calculateDailyStats(
  habits: Habit[],
  completions: HabitCompletion[],
  startDate: Date,
  endDate: Date
): DailyStats[] {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const completionsByDate = indexCompletionsByDate(completions);
  const habitsWithCreatedDate = habits
    .filter((h) => !h.archived)
    .map((h) => ({ parsedCreatedAt: parseISO(h.createdAt) }));

  return days.map((day) => buildDailyStatEntry(day, completionsByDate, habitsWithCreatedDate));
}

export function calculateCategoryBreakdown(
  habits: Habit[],
  completions: HabitCompletion[]
): CategoryBreakdown[] {
  const categories = ['health', 'work', 'learning', 'personal', 'finance', 'relationships'] as Category[];
  const completedCompletions = completions.filter(isCompletedNotRest);

  return categories
    .map((category) => {
      const categoryHabits = habits.filter((h) => h.category === category && !h.archived);
      const categoryHabitIds = new Set(categoryHabits.map((h) => h.id));
      const completedCount = completedCompletions.filter((c) => categoryHabitIds.has(c.habitId)).length;
      const totalPossible = categoryHabits.reduce(
        (sum, h) => sum + Math.round((30 / 7) * getEffectiveTargetDaysPerWeek(h)),
        0
      );
      return {
        category,
        count: categoryHabits.length,
        percentage: habits.length > 0 ? Math.round((categoryHabits.length / habits.length) * 100) : 0,
        completionRate: totalPossible > 0 ? Math.min(100, Math.round((completedCount / totalPossible) * 100)) : 0,
      };
    })
    .filter((b) => b.count > 0);
}

function resolveHeatmapLevel(count: number, maxPossible: number): 0 | 1 | 2 | 3 | 4 {
  if (maxPossible <= 0) return 0;
  const pct = count / maxPossible;
  if (pct > 0.8) return 4;
  if (pct > 0.6) return 3;
  if (pct > 0.4) return 2;
  return pct > 0 ? 1 : 0;
}

export function generateHeatmapData(
  completions: HabitCompletion[],
  habits: Habit[],
  days: number = 365
): HeatmapData[] {
  const today = new Date();
  const dates = eachDayOfInterval({ start: subDays(today, days - 1), end: today });
  const maxPossible = habits.filter((h) => !h.archived).length;
  const completedByDate = indexCompletionsByDate(completions);

  return dates.map((date) => {
    const dateStr = formatDate(date);
    const count = completedByDate.get(dateStr) || 0;
    return { date: dateStr, count, level: resolveHeatmapLevel(count, maxPossible) };
  });
}

export interface TodayMomentumScoreResult {
  score: number;
  todayCompleted: number;
  todayTotal: number;
  restingCount: number;
  quotaMetCount: number;
  completedTasks: number;
  totalTasks: number;
}

type HabitOutcomeKind = 'completed' | 'resting' | 'quota_met' | 'pending';

function isRestingOutcomeToday(
  todayComp: HabitCompletion | undefined,
  weekProg: ReturnType<typeof getHabitWeekProgress>
): boolean {
  return Boolean(todayComp && isExplicitRestCompletion(todayComp)) || weekProg.isAutoRestDay;
}

function classifyHabitOutcomeToday(
  habit: Habit,
  todayComp: HabitCompletion | undefined,
  weekProg: ReturnType<typeof getHabitWeekProgress>
): HabitOutcomeKind {
  if (todayComp && isCompletedNotRest(todayComp)) return 'completed';
  if (isRestingOutcomeToday(todayComp, weekProg)) return 'resting';
  if (weekProg.quotaMet && (habit.targetDaysPerWeek ?? 7) < 7) return 'quota_met';
  return 'pending';
}

function summarizeTodayHabits(params: {
  activeHabits: Habit[];
  completions: HabitCompletion[];
  todayStr: string;
  referenceDate: Date;
}) {
  let todayCompleted = 0;
  let todayTotal = 0;
  let restingCount = 0;
  let quotaMetCount = 0;

  for (const habit of params.activeHabits) {
    const todayComp = params.completions.find((c) => c.habitId === habit.id && c.date === params.todayStr);
    const weekProg = getHabitWeekProgress(habit, params.completions, params.referenceDate);
    const outcome = classifyHabitOutcomeToday(habit, todayComp, weekProg);
    if (outcome === 'completed') {
      todayCompleted++;
      todayTotal++;
    } else if (outcome === 'resting') restingCount++;
    else if (outcome === 'quota_met') quotaMetCount++;
    else todayTotal++;
  }
  return { todayCompleted, todayTotal, restingCount, quotaMetCount };
}

function filterTodayTasks(tasks: Task[], todayStr: string): Task[] {
  return tasks.filter((t) => {
    if (t.status === 'archived') return false;
    const isDueToday = Boolean(t.due_date && t.due_date.startsWith(todayStr));
    const isOverdueTodo = Boolean(t.status === 'todo' && t.due_date && t.due_date <= `${todayStr}T23:59:59`);
    return isDueToday || isOverdueTodo;
  });
}

function combineHabitAndTaskScore(params: {
  hasActiveHabits: boolean;
  habitRate: number;
  hasActiveTasks: boolean;
  taskRate: number;
}): number {
  const { hasActiveHabits, habitRate, hasActiveTasks, taskRate } = params;
  if (hasActiveHabits && hasActiveTasks) return Math.round(habitRate * 60 + taskRate * 40);
  if (hasActiveHabits) return Math.round(habitRate * 100);
  if (hasActiveTasks) return Math.round(taskRate * 100);
  return 100;
}

/**
 * Computes today's unified momentum score (60% habits, 40% due/overdue tasks).
 * Habits marked as `rest`, `skipped`, auto-rest, or weekly quota-met are excluded from
 * `todayTotal` so Low-Energy / guilt-free rest days never lower the score.
 */
export function calculateTodayMomentumScore(params: {
  habits: Habit[];
  completions: HabitCompletion[];
  tasks: Task[];
  todayStr: string;
  isTasksEnabled?: boolean;
  referenceDate?: Date;
}): TodayMomentumScoreResult {
  const { habits, completions, tasks, todayStr, isTasksEnabled = true, referenceDate = parseISO(todayStr) } = params;
  const habitSummary = summarizeTodayHabits({
    activeHabits: habits.filter((h) => !h.archived),
    completions,
    todayStr,
    referenceDate,
  });

  const todayTasksList = filterTodayTasks(tasks, todayStr);
  const totalTasks = todayTasksList.length;
  const completedTasks = todayTasksList.filter((t) => t.status === 'done').length;

  const score = combineHabitAndTaskScore({
    hasActiveHabits: habitSummary.todayTotal > 0,
    habitRate: habitSummary.todayTotal > 0 ? habitSummary.todayCompleted / habitSummary.todayTotal : 1,
    hasActiveTasks: totalTasks > 0 && isTasksEnabled,
    taskRate: totalTasks > 0 ? completedTasks / totalTasks : 1,
  });

  return {
    score,
    ...habitSummary,
    completedTasks: isTasksEnabled ? completedTasks : 0,
    totalTasks: isTasksEnabled ? totalTasks : 0,
  };
}
