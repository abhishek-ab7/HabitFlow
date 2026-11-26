import {
  calculateBestStreak,
  calculateCategoryBreakdown,
  calculateCurrentStreak,
  calculateDailyStats,
  calculateGoalStats,
  calculateMomentum,
  generateHeatmapData,
} from '@/lib/calculations';
import type { DailyStats, MoodLog } from '@/lib/types';
import {
  clampScore,
  parseIsoAsLocalNoon,
  type AnalyticsRangeWindow,
  type HabitsAnalyticsSlice,
  type LifeOsAggregatorInput,
} from './life-os-types';

const MOOD_SCORE_MAP: Record<MoodLog['mood'], number> = {
  happy: 5, calm: 4, neutral: 3, sad: 2, stressed: 1,
};

function computePeriodCompletionRate(stats: DailyStats[]) {
  const completed = stats.reduce((sum, d) => sum + d.completedHabits, 0);
  const possible = stats.reduce((sum, d) => sum + d.totalHabits, 0);
  const ratePct = possible > 0 ? clampScore((completed / possible) * 100) : 0;
  return { completed, possible, ratePct };
}

function computeAvgMoodScore(moodLogs: MoodLog[], startDateStr: string, endDateStr: string): number | null {
  const periodMoods = moodLogs.filter((m) => m.date >= startDateStr && m.date <= endDateStr && m.mood in MOOD_SCORE_MAP);
  if (periodMoods.length === 0) return null;
  const total = periodMoods.reduce((s, m) => s + MOOD_SCORE_MAP[m.mood], 0);
  return Number((total / periodMoods.length).toFixed(1));
}

function summarizeTasks(tasks: NonNullable<LifeOsAggregatorInput['tasks']>, todayDateStr: string) {
  const activeTasks = tasks.filter((t) => t.status !== 'archived');
  const completedTasksCount = activeTasks.filter((t) => t.status === 'done').length;
  const openTasksCount = activeTasks.filter((t) => t.status !== 'done').length;
  const overdueTasksCount = activeTasks.filter(
    (t) => t.status !== 'done' && Boolean(t.due_date) && t.due_date!.slice(0, 10) < todayDateStr
  ).length;
  return { activeTasks, completedTasksCount, openTasksCount, overdueTasksCount };
}

function computeStreaksOverview(
  activeHabits: NonNullable<LifeOsAggregatorInput['habits']>,
  completions: NonNullable<LifeOsAggregatorInput['completions']>,
  endLocal: Date
) {
  const habitStreaks = activeHabits.map((h) => {
    const hComps = completions.filter((c) => c.habitId === h.id);
    return { current: calculateCurrentStreak(hComps, endLocal, h), best: calculateBestStreak(hComps, h) };
  });
  return {
    currentBestActiveStreak: habitStreaks.length > 0 ? Math.max(0, ...habitStreaks.map((s) => s.current)) : 0,
    allTimeBestStreak: habitStreaks.length > 0 ? Math.max(0, ...habitStreaks.map((s) => s.best)) : 0,
  };
}

function computeHabitsScore(hasData: boolean, ratePct: number, activeTasksCount: number, completedTasksCount: number): number {
  if (!hasData) return 0;
  if (activeTasksCount === 0) return clampScore(ratePct);
  const taskPct = (completedTasksCount / activeTasksCount) * 100;
  return clampScore(ratePct * 0.8 + taskPct * 0.2);
}

export function computeHabitsAnalyticsSlice(
  input: LifeOsAggregatorInput,
  window: AnalyticsRangeWindow
): HabitsAnalyticsSlice {
  const habits = input.habits ?? [];
  const completions = input.completions ?? [];
  const goals = input.goals ?? [];
  const milestones = input.milestones ?? [];
  const activeHabits = habits.filter((h) => !h.archived);

  const startLocal = parseIsoAsLocalNoon(window.startDateStr);
  const endLocal = parseIsoAsLocalNoon(window.endDateStr);
  const dailyStats = calculateDailyStats(habits, completions, startLocal, endLocal);
  const prevDailyStats = calculateDailyStats(
    habits,
    completions,
    parseIsoAsLocalNoon(window.prevStartDateStr),
    parseIsoAsLocalNoon(window.prevEndDateStr)
  );

  const curr = computePeriodCompletionRate(dailyStats);
  const prev = computePeriodCompletionRate(prevDailyStats);
  const streaks = computeStreaksOverview(activeHabits, completions, endLocal);

  const activeGoals = goals.filter((g) => g.status === 'in_progress' || g.status === 'not_started');
  const goalProgressList = activeGoals.map((goal) => ({ goal, stats: calculateGoalStats(goal, milestones, endLocal) }));
  const taskStats = summarizeTasks(input.tasks ?? [], window.todayDateStr);

  const hasData = activeHabits.length > 0 || curr.completed > 0 || taskStats.activeTasks.length > 0;
  const score = computeHabitsScore(hasData, curr.ratePct, taskStats.activeTasks.length, taskStats.completedTasksCount);
  const previousScore = prev.possible > 0 ? prev.ratePct : 0;

  return {
    hasData,
    score,
    previousScore,
    scoreDelta: score - previousScore,
    activeHabitsCount: activeHabits.length,
    completionRatePct: curr.ratePct,
    prevCompletionRatePct: prev.ratePct,
    completionRateDeltaPct: curr.ratePct - prev.ratePct,
    periodCompletions: curr.completed,
    ...streaks,
    momentum: calculateMomentum(completions, endLocal),
    activeGoalsCount: activeGoals.length,
    onTrackGoalsCount: goalProgressList.filter((item) => item.stats.isOnTrack).length,
    completedTasksCount: taskStats.completedTasksCount,
    openTasksCount: taskStats.openTasksCount,
    overdueTasksCount: taskStats.overdueTasksCount,
    avgMoodScore: computeAvgMoodScore(input.moodLogs ?? [], window.startDateStr, window.endDateStr),
    dailyStats,
    categoryBreakdown: calculateCategoryBreakdown(habits, completions),
    heatmapData: generateHeatmapData(completions, habits, Math.min(365, Math.max(30, window.dayCount))),
    goalProgressList,
  };
}
