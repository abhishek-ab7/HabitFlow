'use client';

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinanceCategory } from '@/lib/types';

export interface OverviewDonutCategoryItem {
  category: FinanceCategory;
  spent: number;
  percentageOfTotalSpend: number;
  transactionCount: number;
}

interface OverviewCategoryDonutProps {
  donutCategories: OverviewDonutCategoryItem[];
  totalSpent: number;
  onSelectCategory: (categoryId: string) => void;
}

export function OverviewCategoryDonut({
  donutCategories,
  totalSpent,
  onSelectCategory,
}: OverviewCategoryDonutProps) {
  return (
    <>
      <div className="relative h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donutCategories.map((c) => ({
                id: c.category.id,
                name: c.category.name,
                value: c.spent,
                color: c.category.color,
                pct: c.percentageOfTotalSpend,
              }))}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={2}
              onClick={(_data, idx) => {
                const item = donutCategories[idx];
                if (item) onSelectCategory(item.category.id);
              }}
              className="cursor-pointer"
            >
              {donutCategories.map((item) => (
                <Cell key={item.category.id} fill={item.category.color} />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(val: unknown) => [formatINR(Number(val) || 0), 'Spent']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] text-muted-foreground">Total Spent</span>
          <span className="text-sm font-bold font-mono tabular-nums text-foreground">
            {formatINR(totalSpent)}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {donutCategories.slice(0, 6).map((item) => (
          <button
            key={item.category.id}
            type="button"
            onClick={() => onSelectCategory(item.category.id)}
            className="w-full px-2.5 py-1.5 rounded-xl hover:bg-muted/50 flex items-center justify-between gap-2 text-xs transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.category.color }}
              />
              <span className="font-medium text-foreground truncate">
                {item.category.name}
              </span>
              <span className="text-muted-foreground font-mono">
                · {item.transactionCount} tx
              </span>
            </div>
            <div className="font-mono tabular-nums shrink-0">
              <span className="font-semibold text-foreground">
                {formatINR(item.spent)}
              </span>
              <span className="text-muted-foreground ml-1.5">
                ({item.percentageOfTotalSpend}%)
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
