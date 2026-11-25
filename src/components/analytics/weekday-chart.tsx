'use client';

import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard';
import { AnalyticsChartTooltip } from '@/components/analytics/shared/AnalyticsChartTooltip';
import { DAYS_OF_WEEK_SHORT, type WeekdayStats } from '@/lib/types';

interface WeekdayChartProps {
  data: WeekdayStats[];
}

const CHART_MARGIN = { top: 8, right: 8, left: -16, bottom: 2 };

function getBarColor(rate: number): string {
  if (rate >= 75) return '#10b981';
  if (rate >= 50) return '#0ea5e9';
  if (rate >= 25) return '#f59e0b';
  return 'var(--muted-foreground)';
}

function WeekdayChartInner({ data }: WeekdayChartProps) {
  const chartData = useMemo(
    () =>
      data.map((day) => ({
        ...day,
        name: DAYS_OF_WEEK_SHORT[day.dayOfWeek],
      })),
    [data]
  );

  const totalCompletions = useMemo(
    () => data.reduce((sum, d) => sum + d.totalCompletions, 0),
    [data]
  );

  const { bestDay, worstDay } = useMemo(() => {
    if (data.length === 0) return { bestDay: null, worstDay: null };
    const sorted = [...data].sort(
      (a, b) => b.averageCompletionRate - a.averageCompletionRate
    );
    return { bestDay: sorted[0], worstDay: sorted[sorted.length - 1] };
  }, [data]);

  return (
    <AnalyticsChartCard
      title="Weekday Performance"
      subtitle={
        bestDay && worstDay && totalCompletions > 0
          ? `Best: ${bestDay.dayName} (${Math.round(bestDay.averageCompletionRate)}%) · Lowest: ${worstDay.dayName} (${Math.round(worstDay.averageCompletionRate)}%)`
          : 'Average habit adherence by day of week'
      }
      isEmpty={totalCompletions === 0}
      emptyTitle="No weekday pattern yet"
      emptyDescription="Check off habits across a few days to identify your strongest and weakest weekdays."
    >
      <div className="h-[210px] sm:h-[235px] w-full">
        <ResponsiveContainer width="100%" height="100%" debounce={150}>
          <BarChart data={chartData} margin={CHART_MARGIN}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              strokeOpacity={0.65}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
            <Tooltip
              content={
                <AnalyticsChartTooltip valueFormatter={(val) => `${Math.round(val)}%`} />
              }
            />
            <Bar
              dataKey="averageCompletionRate"
              name="Completion"
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.dayOfWeek}
                  fill={getBarColor(entry.averageCompletionRate)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AnalyticsChartCard>
  );
}

export const WeekdayChart = React.memo(WeekdayChartInner);
