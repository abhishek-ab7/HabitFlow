'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { SlidersHorizontal, PieChart as PieChartIcon, BarChart2 } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { MonthlyFinanceSummary } from '@/lib/types';
import { CategoryIcon } from '../CategoryIcon';

type CategoryBreakdownItem = MonthlyFinanceSummary['categoryBreakdown'][number];

const OverviewCategoryDonut = dynamic(
  () => import('../OverviewCategoryDonut').then((m) => ({ default: m.OverviewCategoryDonut })),
  {
    ssr: false,
    loading: () => <div className="h-48 w-full rounded-xl bg-muted/40 animate-pulse" />,
  }
);

function getCategoryRowStyle(status: CategoryBreakdownItem['status'], isAhead: boolean) {
  if (status === 'exceeded') return { text: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500' };
  if (isAhead || status === 'warning') return { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
  return { text: 'text-muted-foreground', bar: 'bg-emerald-500' };
}

function getCategorySubtext(item: CategoryBreakdownItem, isAhead: boolean): string {
  if (item.budgetLimit <= 0) return `${item.percentageOfTotalSpend}% of total spend`;
  if (item.status === 'exceeded') return `Over by ${formatINR(Math.max(0, item.spent - item.budgetLimit))}`;
  if (isAhead) return `Ahead of pace (+${item.paceDiffPercentage}%)`;
  return `${formatINR(Math.max(0, item.budgetLimit - item.spent))} left`;
}

function CategoryPaceProgressBar(params: {
  barWidth: number;
  barCls: string;
  hasLimit: boolean;
  dayProgressPct: number;
}) {
  const { barWidth, barCls, hasLimit, dayProgressPct } = params;
  const paceLeft = Math.min(99, Math.max(1, dayProgressPct));
  return (
    <div className="relative h-2 w-full rounded-full bg-muted overflow-visible">
      <div style={{ width: `${barWidth}%` }} className={`h-full rounded-full transition-all duration-300 ${barCls}`} />
      {hasLimit && (
        <div style={{ left: `${paceLeft}%` }} title={`Today's ideal pace: ${dayProgressPct}%`} className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground/75 rounded-full" />
      )}
    </div>
  );
}

function CategoryRowLimitButton(params: {
  item: CategoryBreakdownItem;
  rawPct: number;
  onEditLimit: (categoryId: string) => void;
}) {
  const { item, rawPct, onEditLimit } = params;
  return (
    <button type="button" onClick={() => onEditLimit(item.category.id)} className="text-right shrink-0 font-mono tabular-nums hover:underline">
      <span className="text-xs sm:text-sm font-semibold text-foreground">{formatINR(item.spent)}</span>
      {item.budgetLimit > 0 ? (
        <>
          <span className="text-xs text-muted-foreground"> / {formatINR(item.budgetLimit)}</span>
          <span className="text-[11px] text-muted-foreground block">{rawPct}%</span>
        </>
      ) : (
        <span className="text-[11px] text-primary block">Set limit</span>
      )}
    </button>
  );
}

function CategoryPaceRow(params: {
  item: CategoryBreakdownItem;
  dayProgressPct: number;
  onSelect: (categoryId: string) => void;
  onEditLimit: (categoryId: string) => void;
}) {
  const { item, dayProgressPct, onSelect, onEditLimit } = params;
  const rawPct = item.budgetLimit > 0 ? Math.round((item.spent / item.budgetLimit) * 100) : 0;
  const barWidth = item.budgetLimit > 0 ? Math.min(100, rawPct) : Math.min(100, item.percentageOfTotalSpend);
  const isAhead = item.budgetLimit > 0 && item.status !== 'exceeded' && (item.paceDiffPercentage || 0) > 10;
  const style = getCategoryRowStyle(item.status, isAhead);

  return (
    <div className="w-full text-left space-y-1.5 rounded-xl p-2 -mx-2 hover:bg-muted/40 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => onSelect(item.category.id)} className="flex items-center gap-2.5 min-w-0 text-left">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${item.category.color}18`, color: item.category.color }}
          >
            <CategoryIcon name={item.category.icon} className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-medium text-foreground truncate">{item.category.name}</span>
              {(item.rolloverAmount || 0) > 0 && (
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                  · +{formatINR(item.rolloverAmount || 0)} rollover
                </span>
              )}
            </div>
            <span className={`text-[11px] font-medium block ${style.text}`}>{getCategorySubtext(item, isAhead)}</span>
          </div>
        </button>

        <CategoryRowLimitButton item={item} rawPct={rawPct} onEditLimit={onEditLimit} />
      </div>

      <CategoryPaceProgressBar barWidth={barWidth} barCls={style.bar} hasLimit={item.budgetLimit > 0} dayProgressPct={dayProgressPct} />
    </div>
  );
}

export function OverviewCategorySection(params: {
  budgetedCategories: CategoryBreakdownItem[];
  donutCategories: CategoryBreakdownItem[];
  totalSpent: number;
  dayOfMonthProgressPct: number;
  onSelectCategory: (categoryId: string) => void;
  onOpenBudgetModal: (focusCategoryId?: string) => void;
}) {
  const { budgetedCategories, donutCategories, totalSpent, dayOfMonthProgressPct, onSelectCategory, onOpenBudgetModal } = params;
  const [viewMode, setViewMode] = useState<'bars' | 'donut'>('bars');

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Category Breakdown &amp; Pace</h2>
          <p className="text-xs text-muted-foreground">
            {viewMode === 'bars' ? 'Tick line marks today’s ideal day-of-month pace' : 'Tap any category to inspect transactions'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <div className="inline-flex items-center p-1 rounded-xl bg-muted/80 border border-border/60">
            <button
              type="button"
              onClick={() => setViewMode('bars')}
              aria-label="Progress bars view"
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'bars' ? 'bg-card text-foreground shadow-xs border border-border/50' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Pace</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('donut')}
              aria-label="Category donut view"
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'donut' ? 'bg-card text-foreground shadow-xs border border-border/50' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              <span>Donut</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onOpenBudgetModal()}
            className="h-9 px-3 rounded-xl border border-border/70 bg-card/60 hover:bg-muted text-xs font-semibold text-primary flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            title="Manage Category Limits"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Limits</span>
          </button>
        </div>
      </div>

      {budgetedCategories.length === 0 ? (
        <button
          type="button"
          onClick={() => onOpenBudgetModal()}
          className="w-full min-h-[72px] rounded-xl border border-dashed border-border px-4 py-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
        >
          <span className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
            <PieChartIcon className="w-5 h-5" />
          </span>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">Set category spending limits</p>
            <p className="text-xs text-muted-foreground">Track pace ticks and rollover envelopes for Food, Groceries, Shopping &amp; more.</p>
          </div>
        </button>
      ) : viewMode === 'donut' ? (
        <div className="space-y-4">
          {donutCategories.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Log your first expense this month to see the category donut chart.</p>
          ) : (
            <OverviewCategoryDonut donutCategories={donutCategories} totalSpent={totalSpent} onSelectCategory={onSelectCategory} />
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {budgetedCategories.slice(0, 7).map((item) => (
            <CategoryPaceRow
              key={item.category.id}
              item={item}
              dayProgressPct={dayOfMonthProgressPct}
              onSelect={onSelectCategory}
              onEditLimit={onOpenBudgetModal}
            />
          ))}
        </div>
      )}
    </div>
  );
}
