import type { Goal, Habit, HabitCompletion, Task } from '@/lib/types';

export interface YearInReviewFinanceProps {
  enabled: boolean;
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  savingsRatePct: number;
  netWorthInr: number;
}

export interface YearInReviewFitnessProps {
  enabled: boolean;
  workoutCount: number;
  totalVolumeKg: number;
  avgProteinG: number;
  latestWeightKg: number | null;
  junkFreeStreakDays: number;
}

export interface YearInReviewStats2026 {
  totalCompletions: number;
  bestStreak: number;
  topCategory: string;
  topCategoryCount: number;
  completedTasks: number;
  completedGoals: number;
  totalMilestonesCompleted: number;
}

function computeBest2026Streak(completions2026: HabitCompletion[]): number {
  const dates = Array.from(new Set(completions2026.map((c) => c.date))).sort();
  let bestStreak = 0;
  let tempStreak = 0;
  let lastDate: Date | null = null;
  for (const dateStr of dates) {
    const currentDate = new Date(dateStr);
    const diffDays = lastDate ? Math.ceil(Math.abs(currentDate.getTime() - lastDate.getTime()) / 86400000) : 0;
    tempStreak = lastDate && diffDays <= 1 ? tempStreak + 1 : 1;
    if (tempStreak > bestStreak) bestStreak = tempStreak;
    lastDate = currentDate;
  }
  return bestStreak;
}

function computeTop2026Category(habits: Habit[], completions2026: HabitCompletion[]) {
  const categoryCounts: Record<string, number> = {};
  const habitsMap = new Map(habits.map((h) => [h.id, h]));
  for (const c of completions2026) {
    const habit = habitsMap.get(c.habitId);
    if (habit) categoryCounts[habit.category] = (categoryCounts[habit.category] ?? 0) + 1;
  }
  const topEntry = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const rawCategory = topEntry ? topEntry[0] : 'None';
  return {
    topCategory: rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1),
    topCategoryCount: topEntry ? topEntry[1] : 0,
  };
}

export function compute2026Stats(params: {
  habits: Habit[];
  completions: HabitCompletion[];
  goals: Goal[];
  tasks: Task[];
}): YearInReviewStats2026 {
  const { habits, completions, goals, tasks } = params;
  const completions2026 = completions.filter((c) => c.date.startsWith('2026') && c.completed);
  const bestStreak = computeBest2026Streak(completions2026);
  const { topCategory, topCategoryCount } = computeTop2026Category(habits, completions2026);

  const completedTasks = tasks.filter((t) => t.status === 'done' && t.due_date?.startsWith('2026')).length;
  const completedGoals = goals.filter((g) => g.status === 'completed' && g.deadline?.startsWith('2026')).length;

  return {
    totalCompletions: completions2026.length,
    bestStreak,
    topCategory,
    topCategoryCount,
    completedTasks,
    completedGoals,
    totalMilestonesCompleted: completions2026.length + completedTasks + completedGoals,
  };
}
