'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useMemo } from 'react';
import { subDays, subMonths, subYears, format } from 'date-fns';
import { BarChart3, TrendingUp, Target, Flame, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FadeIn, StaggerContainer, StaggerItem, CountUp } from '@/components/motion';
import { TimeRangeTabs } from '@/components/analytics';
import { useHabitStore, useGoalStore, useTaskStore } from '@/lib/stores';
import {
  calculateDailyStats,
  calculateCategoryBreakdown,
  generateHeatmapData,
  calculateMomentum,
  calculateCurrentStreak,
  calculateBestStreak,
} from '@/lib/calculations';
import type { TimeRange, DailyStats, WeekdayStats, Insight, Trend } from '@/lib/types';
import { DAYS_OF_WEEK } from '@/lib/types';

// Dynamic imports for heavy chart components (reduces initial bundle by ~200KB)
const ConsistencyChart = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.ConsistencyChart })),
  { loading: () => <Skeleton className="h-64 w-full rounded-xl" />, ssr: false }
);

const CategoryBreakdownChart = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.CategoryBreakdownChart })),
  { loading: () => <Skeleton className="h-64 w-full rounded-xl" />, ssr: false }
);

const WeekdayChart = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.WeekdayChart })),
  { loading: () => <Skeleton className="h-64 w-full rounded-xl" />, ssr: false }
);

const HeatmapCalendar = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.HeatmapCalendar })),
  { loading: () => <Skeleton className="h-48 w-full rounded-xl" />, ssr: false }
);

const InsightsCards = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.InsightsCards })),
  { loading: () => <Skeleton className="h-64 w-full rounded-xl" />, ssr: false }
);

export default function AnalyticsPage() {
  const { habits, completions, loadHabits, loadCompletions, isLoading: habitsLoading } = useHabitStore();
  const { goals, loadGoals, isLoading: goalsLoading } = useGoalStore();
  const { tasks, loadTasks, isLoading: tasksLoading } = useTaskStore();

  const [timeRange, setTimeRange] = useState<TimeRange>('month');

  // Load data on mount
  useEffect(() => {
    loadHabits();
    loadGoals();
    loadTasks();

    // Load last year of data for heatmap + analytics
    // This is much faster than loading ALL history
    const end = new Date();
    const start = subYears(end, 1);
    loadCompletions(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
  }, [loadHabits, loadCompletions, loadGoals, loadTasks]);

  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    const today = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'week':
        startDate = subDays(today, 7);
        break;
      case 'month':
        startDate = subDays(today, 30);
        break;
      case 'quarter':
        startDate = subDays(today, 90);
        break;
      case 'year':
        startDate = subYears(today, 1);
        break;
      default:
        startDate = subDays(today, 30);
    }

    return { startDate, endDate: today };
  }, [timeRange]);

  // Calculate all analytics data
  const analyticsData = useMemo(() => {
    const activeHabits = habits.filter(h => !h.archived);
    const { startDate, endDate } = dateRange;

    // Filter completions within date range
    const rangeCompletions = completions.filter(c => {
      const date = new Date(c.date);
      return date >= startDate && date <= endDate;
    });

    // Daily stats for the range
    const dailyStats = calculateDailyStats(activeHabits, completions, startDate, endDate);

    // Calculate average completion rate
    const avgCompletionRate = dailyStats.length > 0
      ? dailyStats.reduce((sum, d) => sum + d.completionRate, 0) / dailyStats.length
      : 0;

    // Overall trend
    const trend = calculateMomentum(completions);

    // Category breakdown
    const categoryBreakdown = calculateCategoryBreakdown(habits, rangeCompletions);

    // Weekday stats
    const weekdayStats: WeekdayStats[] = DAYS_OF_WEEK.map((dayName, dayOfWeek) => {
      const dayCompletions = dailyStats.filter(d => new Date(d.date).getDay() === dayOfWeek);
      const avgRate = dayCompletions.length > 0
        ? dayCompletions.reduce((sum, d) => sum + d.completionRate, 0) / dayCompletions.length
        : 0;
      const totalCompletions = dayCompletions.reduce((sum, d) => sum + d.completedHabits, 0);

      return {
        dayOfWeek,
        dayName,
        averageCompletionRate: avgRate,
        totalCompletions,
      };
    });

    // Heatmap data (always show full year)
    const heatmapData = generateHeatmapData(completions, habits, 365);

    // Calculate summary metrics
    const totalCompletionsInRange = rangeCompletions.filter(c => c.completed).length;
    const bestStreak = calculateBestStreak(completions);
    const currentStreak = calculateCurrentStreak(completions);
    const activeGoals = goals.filter(g => !g.archived && g.status !== 'completed').length;

    return {
      dailyStats,
      avgCompletionRate,
      trend,
      weekdayStats,
      categoryBreakdown,
      heatmapData,
      totalCompletionsInRange,
      currentStreak,
      bestStreak,
      activeGoals,
      activeHabits: activeHabits.length,
    };
  }, [habits, completions, goals, tasks, dateRange]);

  // Generate insights based on data
  const insights = useMemo((): Insight[] => {
    const result: Insight[] = [];
    const {
      avgCompletionRate,
      trend,
      weekdayStats,
      currentStreak,
      bestStreak,
      categoryBreakdown,
    } = analyticsData;

    // Streak achievements
    if (currentStreak >= 7) {
      result.push({
        id: 'streak-week',
        type: 'achievement',
        title: `${currentStreak} Day Streak!`,
        description: `You've been consistent for ${currentStreak} days. Keep up the momentum!`,
        icon: 'flame',
        priority: 1,
      });
    }

    if (bestStreak > currentStreak && bestStreak >= 7) {
      result.push({
        id: 'best-streak',
        type: 'info',
        title: 'Your Best Streak',
        description: `Your record is ${bestStreak} days. You're ${bestStreak - currentStreak} days away from beating it!`,
        icon: 'trophy',
        priority: 3,
      });
    }

    // Completion rate insights
    if (avgCompletionRate >= 80) {
      result.push({
        id: 'high-completion',
        type: 'achievement',
        title: 'Excellent Consistency',
        description: `With ${avgCompletionRate.toFixed(0)}% completion rate, you're crushing your habits!`,
        icon: 'star',
        priority: 2,
      });
    } else if (avgCompletionRate < 50 && habits.length > 0) {
      result.push({
        id: 'low-completion',
        type: 'warning',
        title: 'Room for Improvement',
        description: 'Consider focusing on fewer habits to build consistency before adding more.',
        icon: 'alert',
        priority: 2,
      });
    }

    // Trend insights
    if (trend === 'up') {
      result.push({
        id: 'trend-up',
        type: 'achievement',
        title: 'Upward Trend',
        description: 'Your completion rate is improving compared to last week. Great progress!',
        icon: 'trending',
        priority: 3,
      });
    } else if (trend === 'down') {
      result.push({
        id: 'trend-down',
        type: 'warning',
        title: 'Declining Trend',
        description: 'Your completion rate dropped this week. Consider reviewing your goals.',
        icon: 'alert',
        priority: 2,
      });
    }

    // Best/worst day suggestions
    const sortedDays = [...weekdayStats].sort((a, b) => b.averageCompletionRate - a.averageCompletionRate);
    const bestDay = sortedDays[0];
    const worstDay = sortedDays[sortedDays.length - 1];

    if (bestDay && worstDay && bestDay.averageCompletionRate - worstDay.averageCompletionRate > 20) {
      result.push({
        id: 'weekday-pattern',
        type: 'suggestion',
        title: `${worstDay.dayName} is Your Challenge Day`,
        description: `You complete ${(bestDay.averageCompletionRate - worstDay.averageCompletionRate).toFixed(0)}% fewer habits on ${worstDay.dayName}s. Try scheduling easier habits for that day.`,
        icon: 'calendar',
        priority: 4,
      });
    }

    // Category suggestions
    const lowPerformingCategory = categoryBreakdown.find(c => c.completionRate < 40 && c.count > 0);
    if (lowPerformingCategory) {
      result.push({
        id: 'category-low',
        type: 'suggestion',
        title: `Review ${lowPerformingCategory.category.charAt(0).toUpperCase() + lowPerformingCategory.category.slice(1)} Habits`,
        description: `Your ${lowPerformingCategory.category} habits have a ${lowPerformingCategory.completionRate}% completion rate. Consider making them easier or more specific.`,
        icon: 'target',
        priority: 4,
      });
    }

    return result.sort((a, b) => a.priority - b.priority);
  }, [analyticsData, habits]);

  const isLoading = habitsLoading || goalsLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="container px-4 py-8 md:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-muted rounded w-48" />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-80 bg-muted rounded-xl" />
            <div className="h-80 bg-muted rounded-xl" />
            <div className="h-80 bg-muted rounded-xl md:col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  const noData = habits.length === 0;

  return (
    <div className="container px-4 py-8 md:px-6 lg:px-8">
      {/* Header */}
      <FadeIn className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Discover patterns and insights in your habits
            </p>
          </div>

          <TimeRangeTabs value={timeRange} onChange={setTimeRange} />
        </div>
      </FadeIn>

      {noData ? (
        <FadeIn className="text-center py-16">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Data Yet</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Start tracking habits to see your analytics. Once you have some completions,
            you'll see charts, insights, and patterns here.
          </p>
        </FadeIn>
      ) : (
        <>
          {/* Summary Cards */}
          <FadeIn delay={0.1} className="mb-8">
            <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StaggerItem>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Completion Rate
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      <CountUp value={analyticsData.avgCompletionRate} />%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Average for selected period
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Current Streak
                    </CardTitle>
                    <Flame className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      <CountUp value={analyticsData.currentStreak} /> days
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Best: {analyticsData.bestStreak} days
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Completions
                    </CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      <CountUp value={analyticsData.totalCompletionsInRange} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      In selected period
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Active Goals
                    </CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      <CountUp value={analyticsData.activeGoals} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analyticsData.activeHabits} active habits
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
            </StaggerContainer>
          </FadeIn>

          {/* Charts Grid */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* Consistency Chart - spans 2 cols on large screens */}
            <FadeIn delay={0.2}>
              <ConsistencyChart
                data={analyticsData.dailyStats}
                trend={analyticsData.trend}
                averageRate={analyticsData.avgCompletionRate}
              />
            </FadeIn>

            {/* Category Breakdown */}
            <FadeIn delay={0.3}>
              <CategoryBreakdownChart data={analyticsData.categoryBreakdown} />
            </FadeIn>

            {/* Weekday Performance */}
            <FadeIn delay={0.4}>
              <WeekdayChart data={analyticsData.weekdayStats} />
            </FadeIn>

            {/* Insights */}
            <FadeIn delay={0.5}>
              <InsightsCards insights={insights} />
            </FadeIn>
          </div>

          {/* Heatmap - Full Width */}
          <FadeIn delay={0.6}>
            <HeatmapCalendar data={analyticsData.heatmapData} weeks={52} />
          </FadeIn>
        </>
      )}
    </div>
  );
}
