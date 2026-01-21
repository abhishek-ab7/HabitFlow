'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { WeekdayStats } from '@/lib/types';
import { DAYS_OF_WEEK_SHORT } from '@/lib/types';

interface WeekdayChartProps {
  data: WeekdayStats[];
}

export function WeekdayChart({ data }: WeekdayChartProps) {
  const chartData = useMemo(() => {
    return data.map(day => ({
      ...day,
      name: DAYS_OF_WEEK_SHORT[day.dayOfWeek],
    }));
  }, [data]);

  // Find best and worst days
  const sortedByRate = [...data].sort((a, b) => b.averageCompletionRate - a.averageCompletionRate);
  const bestDay = sortedByRate[0];
  const worstDay = sortedByRate[sortedByRate.length - 1];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Weekday Performance</CardTitle>
        <CardDescription>
          Best: {bestDay?.dayName} ({bestDay?.averageCompletionRate.toFixed(0)}%) | 
          Lowest: {worstDay?.dayName} ({worstDay?.averageCompletionRate.toFixed(0)}%)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="h-[250px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis 
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={value => `${value}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                        <p className="text-sm font-medium">{data.dayName}</p>
                        <p className="text-lg font-bold text-primary">
                          {data.averageCompletionRate.toFixed(0)}%
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {data.totalCompletions} completions
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="averageCompletionRate" 
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => {
                  // Color based on performance
                  const rate = entry.averageCompletionRate;
                  let color = 'hsl(var(--muted-foreground))';
                  if (rate >= 80) color = 'hsl(var(--chart-1))';
                  else if (rate >= 60) color = 'hsl(var(--chart-2))';
                  else if (rate >= 40) color = 'hsl(var(--chart-3))';
                  else if (rate >= 20) color = 'hsl(var(--chart-4))';
                  
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={color}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </CardContent>
    </Card>
  );
}
