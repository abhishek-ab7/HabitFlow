'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import {
  useFinanceStore,
  formatINR,
  type SixMonthTrendPoint,
} from '@/lib/stores/finance-store';

interface SpendingTrendChartProps {
  onOpenBudgetModal: (focusCategoryId?: string) => void;
}

function formatCompactINR(value: number): string {
  if (value === 0) return '₹0';
  if (value >= 100000) return `₹${(value / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `₹${value}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: SixMonthTrendPoint;
  }>;
}

function TrendTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const hasBudget = point.budget > 0;
  const diff = point.budget - point.spent;

  return (
    <div className="rounded-xl border border-border bg-popover text-popover-foreground shadow-md px-3.5 py-2.5 text-xs space-y-1.5 min-w-[170px]">
      <p className="font-semibold text-foreground">{point.fullLabel}</p>
      <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
        <span className="text-muted-foreground">Spent</span>
        <span className="font-bold text-foreground">{formatINR(point.spent)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
        <span className="text-muted-foreground">Budget</span>
        <span className="font-semibold text-foreground">
          {hasBudget ? formatINR(point.budget) : 'Not set'}
        </span>
      </div>
      {hasBudget && (
        <div
          className={`pt-1 border-t border-border/60 flex items-center justify-between gap-4 font-mono tabular-nums font-medium ${
            diff < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-emerald-600 dark:text-emerald-400'
          }`}
        >
          <span>{diff < 0 ? 'Over by' : 'Under by'}</span>
          <span>{formatINR(Math.abs(diff))}</span>
        </div>
      )}
    </div>
  );
}

export function SpendingTrendChart({ onOpenBudgetModal }: SpendingTrendChartProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const transactions = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const getSixMonthSpendingTrends = useFinanceStore(
    (s) => s.getSixMonthSpendingTrends
  );

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  const data = useMemo(
    () => getSixMonthSpendingTrends(selectedMonth, selectedCategoryId),
    [getSixMonthSpendingTrends, selectedMonth, selectedCategoryId, transactions, categories, budgets]
  );

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense' || c.type === 'both'),
    [categories]
  );

  const activeCategory =
    selectedCategoryId !== 'all'
      ? expenseCategories.find((c) => c.id === selectedCategoryId)
      : undefined;

  const hasAnyBudget = data.some((d) => d.budget > 0);
  const sixMonthTotalSpent = data.reduce((sum, d) => sum + d.spent, 0);
  const sixMonthAvg = Math.round(sixMonthTotalSpent / 6);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      {/* Header + Category Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">
              6-Month Spending vs. Budget
            </h2>
            <p className="text-xs text-muted-foreground font-mono tabular-nums truncate">
              Avg {formatINR(sixMonthAvg)}/mo · Total {formatINR(sixMonthTotalSpent)}
            </p>
          </div>
        </div>

        <select
          aria-label="Filter trend chart by category"
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          className="h-11 sm:h-10 px-3 text-xs font-medium rounded-xl border border-input bg-background text-foreground shrink-0"
        >
          <option value="all">All Category Budgets</option>
          {expenseCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
              {cat.monthlyBudgetLimit > 0
                ? ` (${formatINR(cat.monthlyBudgetLimit)})`
                : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Inline Legend & Quick Budget Prompt */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{
                backgroundColor: activeCategory?.color || '#3b82f6',
              }}
            />
            <span>Actual Spent</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/35" />
            <span>Category Budget</span>
          </span>
          {hasAnyBudget && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
              <span>Over Budget</span>
            </span>
          )}
        </div>

        {!hasAnyBudget && (
          <button
            type="button"
            onClick={() =>
              onOpenBudgetModal(selectedCategoryId !== 'all' ? selectedCategoryId : undefined)
            }
            className="min-h-[36px] px-2.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            Set category budget
          </button>
        )}
      </div>

      {/* Recharts BarChart */}
      <div className="h-56 sm:h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
            barGap={4}
            barCategoryGap="22%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="currentColor"
              className="text-border/60"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={formatCompactINR}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground font-mono"
              width={56}
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={{ fill: 'currentColor', opacity: 0.06 }}
            />
            <Bar
              dataKey="spent"
              name="Actual Spent"
              radius={[6, 6, 0, 0]}
              maxBarSize={28}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.monthKey}
                  fill={
                    entry.isOverBudget
                      ? '#ef4444'
                      : activeCategory?.color || '#3b82f6'
                  }
                />
              ))}
            </Bar>
            <Bar
              dataKey="budget"
              name="Category Budget"
              fill="currentColor"
              className="text-muted-foreground/30"
              radius={[6, 6, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
