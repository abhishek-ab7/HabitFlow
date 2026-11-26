'use client';

import React, { useMemo } from 'react';
import { CheckCircle2, Flame, Target, TrendingUp } from 'lucide-react';
import { CategoryBreakdownChart } from '@/components/analytics/category-breakdown';
import { ConsistencyChart } from '@/components/analytics/consistency-chart';
import { HeatmapCalendar } from '@/components/analytics/heatmap-calendar';
import { PredictiveAnalytics } from '@/components/analytics/PredictiveAnalytics';
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard';
import { AnalyticsKpiGrid, type AnalyticsKpiItem } from '@/components/analytics/shared/AnalyticsKpiGrid';
import { WeekdayChart } from '@/components/analytics/weekday-chart';
import { parseIsoAsLocalNoon } from '@/lib/analytics/life-os-aggregator';
import { formatHumanDate } from '@/lib/date-format';
import { DAYS_OF_WEEK, type WeekdayStats } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { AnalyticsTabProps } from './types';

function buildHabitsKpiItems(habits: AnalyticsTabProps['snapshot']['habits']): AnalyticsKpiItem[] {
  return [
    {
      id: 'habits-rate',
      label: 'Completion Rate',
      value: `${habits.completionRatePct}%`,
      deltaText: `${habits.completionRateDeltaPct >= 0 ? '+' : ''}${habits.completionRateDeltaPct}% vs prev`,
      deltaTone: habits.completionRateDeltaPct > 0 ? 'positive' : habits.completionRateDeltaPct < 0 ? 'negative' : 'neutral',
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      id: 'habits-streak',
      label: 'Best Active Streak',
      value: `${habits.currentBestActiveStreak}d`,
      subtitle: `All-time ${habits.allTimeBestStreak}d`,
      icon: <Flame className="w-4 h-4" />,
    },
    {
      id: 'habits-checkins',
      label: 'Total Check-ins',
      value: `${habits.periodCompletions}`,
      subtitle: `${habits.activeHabitsCount} active habits`,
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      id: 'habits-goals',
      label: 'Active Goals',
      value: `${habits.activeGoalsCount}`,
      deltaText: habits.activeGoalsCount > 0 ? `${habits.onTrackGoalsCount}/${habits.activeGoalsCount} on track` : 'No active goals',
      deltaTone: habits.activeGoalsCount > 0 && habits.onTrackGoalsCount === habits.activeGoalsCount ? 'positive' : 'neutral',
      icon: <Target className="w-4 h-4" />,
    },
  ];
}

function buildWeekdayStats(dailyStats: AnalyticsTabProps['snapshot']['habits']['dailyStats']): WeekdayStats[] {
  const buckets = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    dayName: DAYS_OF_WEEK[dayOfWeek],
    rateSum: 0,
    daysCount: 0,
    totalCompletions: 0,
  }));

  for (const day of dailyStats) {
    const bucket = buckets[parseIsoAsLocalNoon(day.date).getDay()];
    if (!bucket) continue;
    bucket.rateSum += day.completionRate;
    bucket.daysCount += 1;
    bucket.totalCompletions += day.completedHabits;
  }

  return buckets.map((b) => ({
    dayOfWeek: b.dayOfWeek,
    dayName: b.dayName,
    averageCompletionRate: b.daysCount > 0 ? Math.round(b.rateSum / b.daysCount) : 0,
    totalCompletions: b.totalCompletions,
  }));
}

function GoalVelocityCard({ habits }: { habits: AnalyticsTabProps['snapshot']['habits'] }) {
  return (
    <AnalyticsChartCard
      title="Goal Velocity"
      subtitle={
        habits.activeGoalsCount > 0
          ? `${habits.onTrackGoalsCount} of ${habits.activeGoalsCount} active goals pacing on schedule`
          : 'Track milestone pace against target deadlines'
      }
      isEmpty={habits.goalProgressList.length === 0}
      emptyTitle="No active goals in flight"
      emptyDescription="Add a goal with milestones to monitor deadline velocity right alongside your habits."
      emptyActionLabel="Create Goal"
      emptyActionHref="/goals"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {habits.goalProgressList.slice(0, 6).map(({ goal, stats }) => (
          <div key={goal.id} className="rounded-xl bg-muted/35 p-3.5 space-y-2 border border-border/50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{goal.title}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  Due {formatHumanDate(goal.deadline)} · {stats.daysRemaining}d left
                </p>
              </div>
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-[10px] font-semibold shrink-0',
                  stats.isOnTrack ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                )}
              >
                {stats.isOnTrack ? 'On Track' : 'Behind'}
              </span>
            </div>

            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', stats.isOnTrack ? 'bg-emerald-500' : 'bg-amber-500')}
                  style={{ width: `${Math.min(100, Math.max(3, stats.progress))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>{stats.milestonesCompleted}/{stats.milestonesTotal} milestones</span>
                <span className="font-semibold text-foreground">{stats.progress}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AnalyticsChartCard>
  );
}

function HabitsAnalyticsTabInner({ snapshot }: AnalyticsTabProps) {
  const { habits } = snapshot;
  const kpiItems = useMemo(() => buildHabitsKpiItems(habits), [habits]);
  const weekdayStats = useMemo(() => buildWeekdayStats(habits.dailyStats), [habits.dailyStats]);
  const heatmapWeeks = snapshot.window.range === '7d' ? 8 : 12;

  return (
    <div className="space-y-4 sm:space-y-5">
      <AnalyticsKpiGrid items={kpiItems} />
      <ConsistencyChart data={habits.dailyStats} trend={habits.momentum} averageRate={habits.completionRatePct} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryBreakdownChart data={habits.categoryBreakdown} />
        <WeekdayChart data={weekdayStats} />
      </div>

      <GoalVelocityCard habits={habits} />
      <HeatmapCalendar data={habits.heatmapData} weeks={heatmapWeeks} />
      <PredictiveAnalytics />
    </div>
  );
}

export default React.memo(HabitsAnalyticsTabInner);
