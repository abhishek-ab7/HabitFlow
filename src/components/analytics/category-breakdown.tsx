'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CategoryBreakdown, Category } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';

interface CategoryBreakdownChartProps {
  data: CategoryBreakdown[];
}

const CATEGORY_COLORS: Record<Category, string> = {
  health: 'hsl(142, 71%, 45%)',
  work: 'hsl(217, 91%, 60%)',
  learning: 'hsl(280, 87%, 65%)',
  personal: 'hsl(334, 86%, 67%)',
  finance: 'hsl(43, 96%, 56%)',
  relationships: 'hsl(12, 76%, 61%)',
};

export function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
  const chartData = useMemo(() => {
    return data
      .filter(d => d.count > 0)
      .map(d => ({
        ...d,
        name: CATEGORY_LABELS[d.category],
        color: CATEGORY_COLORS[d.category],
      }));
  }, [data]);

  const totalHabits = data.reduce((sum, d) => sum + d.count, 0);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Habit Categories</CardTitle>
          <CardDescription>Distribution of your habits</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">No habit data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Habit Categories</CardTitle>
        <CardDescription>
          {totalHabits} habit{totalHabits !== 1 ? 's' : ''} across {chartData.length} categor{chartData.length !== 1 ? 'ies' : 'y'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="count"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                        <p className="text-sm font-medium">{data.name}</p>
                        <p className="text-lg font-bold">{data.count} habit{data.count !== 1 ? 's' : ''}</p>
                        <p className="text-sm text-muted-foreground">
                          {data.completionRate.toFixed(0)}% completion rate
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value, entry: any) => (
                  <span className="text-sm text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Category completion rates */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {chartData.map(cat => (
            <div 
              key={cat.category}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-sm">{cat.name}</span>
              </div>
              <span className="text-sm font-medium">
                {cat.completionRate.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
