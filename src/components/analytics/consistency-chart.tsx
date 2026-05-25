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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DailyStats, Trend } from '@/lib/types';

interface ConsistencyChartProps {
  data: DailyStats[];
  trend: Trend;
  averageRate: number;
}

export function ConsistencyChart({ data, trend, averageRate }: ConsistencyChartProps) {
  // Format data for the chart
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
          color: 'text-success',
          bgColor: 'bg-success/10',
        };
      case 'down':
        return { 
          icon: TrendingDown, 
          label: 'Declining', 
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
        };
      default:
        return { 
          icon: Minus, 
          label: 'Stable', 
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
        };
    }
  };

  const trendInfo = getTrendInfo();
  const TrendIcon = trendInfo.icon;

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg font-semibold">Consistency Over Time</CardTitle>
          <CardDescription>Your daily habit completion rate</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono">
            {averageRate.toFixed(0)}% avg
          </Badge>
          <Badge 
            variant="secondary" 
            className={cn("gap-1", trendInfo.bgColor, trendInfo.color)}
          >
            <TrendIcon className="h-3 w-3" />
            {trendInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis 
                dataKey="dateLabel"
                stroke="hsl(var(--foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                dy={10}
                interval="preserveStartEnd"
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
              />
              <YAxis
                stroke="hsl(var(--foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={value => `${value}%`}
                dx={-10}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                        <p className="text-sm font-medium">{data.dateLabel}</p>
                        <p className="text-sm text-muted-foreground">
                          {data.completedHabits}/{data.totalHabits} habits
                        </p>
                        <p className="text-lg font-bold text-primary">
                          {data.completionRate.toFixed(0)}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine 
                y={averageRate} 
                stroke="hsl(var(--muted-foreground))" 
                strokeDasharray="5 5"
                label={{
                  value: 'Avg',
                  position: 'right',
                  fill: 'hsl(var(--foreground))',
                  fontSize: 11,
                  fontWeight: 500,
                }}
              />
              <Line
                type="monotone"
                dataKey="completionRate"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 6,
                  fill: "hsl(var(--primary))",
                  stroke: "hsl(var(--background))",
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
