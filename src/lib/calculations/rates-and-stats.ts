import { differenceInDays, endOfMonth, isAfter, isBefore, parseISO, startOfMonth, subDays } from 'date-fns';
import type { Goal, GoalStats, Habit, HabitCompletion, HabitStats, Milestone, Trend } from '../types';
import {
  getEffectiveTargetDaysPerWeek,
  getHabitFrequencyType,
  getHabitWeekProgress,
  isCountableCompletion,
} from './date-and-schedule';
import { calculateBestStreak, calculateCurrentStreak, calculateWeeklyStreak } from './streaks';

export function calculateCompletionRate(
  completions: HabitCompletion[],
  totalDays: number,
  habit?: Habit
): number {
  if (totalDays <= 0) return 0;
  const completed = completions.filter(isCountableCompletion).length;
  if (!habit) return Math.round((completed / totalDays) * 100);

  const freq = getHabitFrequencyType(habit);
  if (freq === 'daily' && (habit.targetDaysPerWeek ?? 7) === 7) {
    return Math.min(100, Math.round((completed / totalDays) * 100));
  }

  const targetPerWeek = getEffectiveTargetDaysPerWeek(habit);
  const expectedSessions =
    freq === 'interval'
      ? Math.max(1, Math.ceil(totalDays / Math.max(1, habit.intervalDays || 2)))
      : totalDays <= 7
        ? Math.max(1, Math.min(totalDays, targetPerWeek))
        : Math.max(1, Math.round((totalDays / 7) * targetPerWeek));

  return Math.min(100, Math.round((completed / expectedSessions) * 100));
}

export function calculateMonthlyCompletionRate(
  completions: HabitCompletion[],
  year: number,
  month: number,
  today: Date = new Date(),
  habit?: Habit
): number {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));
  const endDate = isBefore(monthEnd, today) ? monthEnd : today;
  const totalDays = differenceInDays(endDate, monthStart) + 1;

  const monthCompletions = completions.filter((c) => {
    const date = parseISO(c.date);
    return !isBefore(date, monthStart) && !isAfter(date, endDate) && c.completed;
  });

  return calculateCompletionRate(monthCompletions, totalDays, habit);
}

export function calculateMomentum(
  completions: HabitCompletion[],
  today: Date = new Date()
): Trend {
  const last7DaysStart = subDays(today, 6);
  const prev7DaysStart = subDays(today, 13);
  const prev7DaysEnd = subDays(today, 7);

  const countInRange = (start: Date, end: Date) =>
    completions.filter((c) => {
      const date = parseISO(c.date);
      return !isBefore(date, start) && !isAfter(date, end) && c.completed;
    }).length;

  const last7 = countInRange(last7DaysStart, today);
  const prev7 = countInRange(prev7DaysStart, prev7DaysEnd);
  if (last7 > prev7) return 'up';
  if (last7 < prev7) return 'down';
  return 'stable';
}

export function calculateHabitStats(
  habit: Habit,
  completions: HabitCompletion[],
  today: Date = new Date()
): HabitStats {
  const habitCompletions = completions.filter((c) => c.habitId === habit.id);
  const createdDate = habit.createdAt ? parseISO(habit.createdAt) : today;
  const totalDays = Math.max(1, differenceInDays(today, createdDate) + 1);
  const weekProgress = getHabitWeekProgress(habit, habitCompletions, today);

  return {
    habitId: habit.id,
    currentStreak: calculateCurrentStreak(habitCompletions, today, habit),
    bestStreak: calculateBestStreak(habitCompletions, habit),
    weeklyStreak: calculateWeeklyStreak(habit, habitCompletions, today),
    completionRate: calculateCompletionRate(habitCompletions, totalDays, habit),
    totalCompletions: habitCompletions.filter(isCountableCompletion).length,
    totalDays,
    momentum: calculateMomentum(habitCompletions, today),
    completedThisWeek: weekProgress.completedCount,
    targetThisWeek: weekProgress.targetCount,
    restDaysUsedThisWeek: weekProgress.restUsedCount,
    restDaysAllowedThisWeek: weekProgress.restAllowedCount,
  };
}

export function calculateGoalStats(
  goal: Goal,
  milestones: Milestone[],
  today: Date = new Date()
): GoalStats {
  const goalMilestones = milestones.filter((m) => m.goalId === goal.id);
  const completedMilestones = goalMilestones.filter((m) => m.completed);
  const startDate = parseISO(goal.startDate);
  const deadline = parseISO(goal.deadline);

  const totalDays = differenceInDays(deadline, startDate);
  const daysElapsed = Math.max(0, differenceInDays(today, startDate));
  const daysRemaining = Math.max(0, differenceInDays(deadline, today));

  const progress =
    goalMilestones.length > 0 ? Math.round((completedMilestones.length / goalMilestones.length) * 100) : 0;
  const expectedProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
  const isOnTrack = progress >= expectedProgress - 10;

  let projectedCompletion: number | undefined;
  if (daysElapsed > 0 && progress > 0) {
    projectedCompletion = Math.min(100, Math.round((progress / daysElapsed) * (daysElapsed + daysRemaining)));
  }

  return {
    goalId: goal.id,
    progress,
    milestonesCompleted: completedMilestones.length,
    milestonesTotal: goalMilestones.length,
    daysRemaining,
    daysElapsed,
    totalDays,
    isOnTrack,
    projectedCompletion,
  };
}

export function getDeadlineStatus(deadline: string, today: Date = new Date()): {
  label: string;
  color: 'success' | 'warning' | 'destructive' | 'muted';
  daysLeft: number;
} {
  const daysLeft = differenceInDays(parseISO(deadline), today);
  if (daysLeft < 0) return { label: `Overdue by ${Math.abs(daysLeft)} days`, color: 'destructive', daysLeft };
  if (daysLeft === 0) return { label: 'Due today', color: 'warning', daysLeft };
  if (daysLeft === 1) return { label: 'Due tomorrow', color: 'warning', daysLeft };
  if (daysLeft <= 7) return { label: `${daysLeft} days left`, color: 'warning', daysLeft };
  return { label: `${daysLeft} days left`, color: 'muted', daysLeft };
}
