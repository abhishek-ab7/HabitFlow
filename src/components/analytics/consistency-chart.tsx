'use client';

import React, { useMemo, useState } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard';
import { AnalyticsChartTooltip } from '@/components/analytics/shared/AnalyticsChartTooltip';
import { formatHumanDate } from '@/lib/date-format';
import type { DailyStats, Trend } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ConsistencyChartProps {
  data: DailyStats[];
  trend: Trend;
  averageRate: number;
}

const CHART_MARGIN = { top: 8, right: 12, left: -16, bottom: 2 };

const TREND_META: Record<Trend, { Icon: typeof TrendingUp; label: string; className: string }> = {
  up: { Icon: TrendingUp, label: 'Improving', className: 'text-emerald-600 dark:text-emerald-400' },
  down: { Icon: TrendingDown, label: 'Declining', className: 'text-rose-600 dark:text-rose-400' },
  stable: { Icon: Minus, label: 'Steady', className: 'text-muted-foreground' },
};

function computeConsistencyChartData(data: DailyStats[]) {
  return data.map((day, idx) => {
    const windowSlice = data.slice(Math.max(0, idx - 6), idx + 1);
    const rollingAvg =
      windowSlice.length > 0
        ? Math.round(windowSlice.reduce((sum, item) => sum + item.completionRate, 0) / windowSlice.length)
        : day.completionRate;
    return { ...day, dateLabel: formatHumanDate(day.date), rollingAvg };
  });
}

function SmoothingModeToggle({ mode, onChange }: { mode: 'daily' | 'rolling'; onChange: (m: 'daily' | 'rolling') => void }) {
  return (
    <div role="group" aria-label="Consistency smoothing mode" className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-[11px]">
      {([['daily', 'Daily'], ['rolling', '7D Rolling']] as const).map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={mode === key}
          onClick={() => onChange(key)}
          className={cn(
            'rounded-md px-2 py-1 font-medium transition-colors',
            mode === key ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ConsistencyChartInner({ data, trend, averageRate }: ConsistencyChartProps) {
  const [mode, setMode] = useState<'daily' | 'rolling'>('daily');
  const chartData = useMemo(() => computeConsistencyChartData(data), [data]);
  const hasSignal = useMemo(
    () => data.filter((d) => d.totalHabits > 0).length >= 2 && data.some((d) => d.completedHabits > 0),
    [data]
  );
  const { Icon: TrendIcon, label: trendLabel, className: trendClass } = TREND_META[trend];

  return (
    <AnalyticsChartCard
      title="Consistency Trend"
      subtitle="Completion rate across active habits"
      badge={
        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', trendClass)}>
          <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{trendLabel}</span>
          <span className="text-muted-foreground font-normal tabular-nums">· {Math.round(averageRate)}% avg</span>
        </span>
      }
      headerRight={<SmoothingModeToggle mode={mode} onChange={setMode} />}
      isEmpty={!hasSignal}
      emptyTitle="Too few check-ins for a consistency curve"
      emptyDescription="Complete habits on at least 2 days in this range to plot your daily and 7-day rolling curve."
      emptyActionLabel="Log Habits"
      emptyActionHref="/habits"
    >
      <div className="h-[210px] sm:h-[245px] w-full">
        <ResponsiveContainer width="100%" height="100%" debounce={150}>
          <LineChart data={chartData} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.65} vertical={false} />
            <XAxis dataKey="dateLabel" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={32} dy={6} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
            <Tooltip content={<AnalyticsChartTooltip valueFormatter={(val) => `${Math.round(val)}%`} />} />
            <ReferenceLine y={averageRate} stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey={mode === 'rolling' ? 'rollingAvg' : 'completionRate'}
              name={mode === 'rolling' ? '7D Rolling' : 'Daily Rate'}
              stroke="var(--primary)"
              strokeWidth={2.25}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--background)', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </AnalyticsChartCard>
  );
}

export const ConsistencyChart = React.memo(ConsistencyChartInner);
