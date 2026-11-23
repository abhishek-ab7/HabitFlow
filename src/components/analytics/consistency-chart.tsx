'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DailyStats, Trend } from '@/lib/types';

interface ConsistencyChartProps {
  data: DailyStats[];
  trend: Trend;
  averageRate: number;
}

export function ConsistencyChart({ data, trend, averageRate }: ConsistencyChartProps) {
  const chartData = useMemo(() => {
    return data.map(day => ({
      ...day,
      dateLabel: new Date(day.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
    }));
  }, [data]);

  const getTrendInfo = () => {
    switch (trend) {
      case 'up':
        return {
          icon: TrendingUp,
          label: 'Improving',
          color: 'text-emerald-600 dark:text-emerald-400',
        };
      case 'down':
        return {
          icon: TrendingDown,
          label: 'Declining',
          color: 'text-rose-600 dark:text-rose-400',
        };
      default:
        return {
          icon: Minus,
          label: 'Stable',
          color: 'text-muted-foreground',
        };
    }
  };

  const trendInfo = getTrendInfo();
  const TrendIcon = trendInfo.icon;

  return (
    <Card className="col-span-full lg:col-span-2 rounded-2xl border border-border/80 shadow-none">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base sm:text-lg font-semibold">Consistency Over Time</CardTitle>
          <CardDescription>Your daily habit completion rate</CardDescription>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
          <span className="font-semibold text-foreground">
            {averageRate.toFixed(0)}% avg
          </span>
          <span className="text-muted-foreground" aria-hidden="true">·</span>
          <span className={cn('inline-flex items-center gap-1 font-sans font-semibold', trendInfo.color)}>
            <TrendIcon className="h-3.5 w-3.5" />
            {trendInfo.label}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="h-[280px] sm:h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                strokeOpacity={0.7}
                vertical={false}
              />
              <XAxis
                dataKey="dateLabel"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={8}
                interval="preserveStartEnd"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={value => `${value}%`}
                dx={-4}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const point = payload[0].payload;
                    return (
                      <div className="bg-popover text-popover-foreground border border-border rounded-xl shadow-lg p-3">
                        <p className="text-xs font-semibold text-foreground">{point.dateLabel}</p>
                        <p className="text-xs text-muted-foreground font-mono tabular-nums mt-0.5">
                          {point.completedHabits}/{point.totalHabits} habits
                        </p>
                        <p className="text-base font-bold font-mono tabular-nums text-primary mt-0.5">
                          {point.completionRate.toFixed(0)}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                y={averageRate}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.65}
                strokeDasharray="5 5"
                label={{
                  value: 'Avg',
                  position: 'right',
                  fill: 'var(--muted-foreground)',
                  fontSize: 11,
                  fontWeight: 500,
                }}
              />
              <Line
                type="monotone"
                dataKey="completionRate"
                stroke="var(--primary)"
                strokeWidth={2.25}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: 'var(--primary)',
                  stroke: 'var(--background)',
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </CardContent>
    </Card>
  );
}
