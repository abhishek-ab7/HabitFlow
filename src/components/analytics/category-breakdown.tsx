'use client';

import React, { useMemo } from 'react';
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard';
import type { Category, CategoryBreakdown } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';

interface CategoryBreakdownChartProps {
  data: CategoryBreakdown[];
}

const CATEGORY_COLORS: Record<Category, string> = {
  health: '#10b981',
  work: '#3b82f6',
  learning: '#8b5cf6',
  personal: '#ec4899',
  finance: '#f59e0b',
  relationships: '#f97316',
};

function CategoryBreakdownChartInner({ data }: CategoryBreakdownChartProps) {
  const categories = useMemo(
    () =>
      data
        .filter((d) => d.count > 0)
        .map((d) => ({
          ...d,
          name: CATEGORY_LABELS[d.category],
          color: CATEGORY_COLORS[d.category],
        }))
        .sort((a, b) => b.completionRate - a.completionRate || b.count - a.count),
    [data]
  );

  const totalHabits = useMemo(
    () => categories.reduce((sum, item) => sum + item.count, 0),
    [categories]
  );

  return (
    <AnalyticsChartCard
      title="Category Consistency"
      subtitle={
        categories.length > 0
          ? `${totalHabits} habit${totalHabits === 1 ? '' : 's'} across ${categories.length} area${categories.length === 1 ? '' : 's'}`
          : 'Completion rate by life area'
      }
      isEmpty={categories.length === 0}
      emptyTitle="No active habit categories"
      emptyDescription="Create or activate a habit to track category distribution and adherence."
      emptyActionLabel="Add Habit"
      emptyActionHref="/habits"
    >
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.category} className="space-y-1.5 rounded-xl bg-muted/35 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden="true"
                />
                <span className="font-semibold text-foreground truncate">{cat.name}</span>
                <span className="rounded-md bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/60 tabular-nums shrink-0">
                  {cat.count} {cat.count === 1 ? 'habit' : 'habits'}
                </span>
              </div>
              <span className="font-bold text-foreground tabular-nums shrink-0">
                {Math.round(cat.completionRate)}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(2, Math.round(cat.completionRate)))}%`,
                  backgroundColor: cat.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </AnalyticsChartCard>
  );
}

export const CategoryBreakdownChart = React.memo(CategoryBreakdownChartInner);
