'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { BarChart3, TrendingUp, GitFork } from 'lucide-react';
import {
  useFinanceStore,
  formatINR,
  type SixMonthTrendPoint,
} from '@/lib/stores/finance-store';
import type { DailyPacePoint } from '@/lib/types';

interface SpendingTrendChartProps {
  onOpenBudgetModal: (focusCategoryId?: string) => void;
}

type AnalyticsChartMode = 'pace' | 'sankey' | 'trend';

function formatCompactINR(value: number): string {
  if (value === 0) return '₹0';
  if (value >= 100000) return `₹${(value / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `₹${Math.round(value)}`;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: SixMonthTrendPoint;
  }>;
}

function TrendTooltip({ active, payload }: TrendTooltipProps) {
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

interface PaceTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: DailyPacePoint;
  }>;
}

function PaceTooltip({ active, payload }: PaceTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const actual = point.cumulativeSpent;
  const ideal = point.idealCumulativeBudget;
  const lastMonth = point.lastMonthCumulativeSpent;
  const diff = actual !== null && ideal > 0 ? ideal - actual : null;

  return (
    <div className="rounded-xl border border-border bg-popover text-popover-foreground shadow-md px-3.5 py-2.5 text-xs space-y-1.5 min-w-[190px]">
      <p className="font-semibold text-foreground font-mono tabular-nums">
        Day {point.day} ({point.dateStr})
      </p>
      {actual !== null && (
        <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
          <span className="text-muted-foreground">Actual Burn</span>
          <span className="font-bold text-foreground">{formatINR(actual)}</span>
        </div>
      )}
      {ideal > 0 && (
        <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
          <span className="text-muted-foreground">Linear Target</span>
          <span className="font-semibold text-foreground">{formatINR(ideal)}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
        <span className="text-muted-foreground">Last Month</span>
        <span className="text-muted-foreground">{formatINR(lastMonth)}</span>
      </div>
      {diff !== null && (
        <div
          className={`pt-1 border-t border-border/60 flex items-center justify-between gap-4 font-mono tabular-nums font-medium ${
            diff < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-emerald-600 dark:text-emerald-400'
          }`}
        >
          <span>{diff < 0 ? 'Ahead of pace by' : 'Below pace by'}</span>
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
  const getYearlySpendingTrends = useFinanceStore(
    (s) => s.getYearlySpendingTrends
  );
  const getDailySpendingPace = useFinanceStore((s) => s.getDailySpendingPace);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);

  const [chartMode, setChartMode] = useState<AnalyticsChartMode>('pace');
  const [timeframe, setTimeframe] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [hoveredSankeyNode, setHoveredSankeyNode] = useState<string | null>(null);

  const summary = useMemo(
    () => getMonthlySummary(selectedMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getMonthlySummary, selectedMonth, transactions, categories, budgets]
  );

  const paceData = useMemo(
    () => getDailySpendingPace(selectedMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getDailySpendingPace, selectedMonth, transactions, budgets, categories]
  );

  const trendData = useMemo(
    () =>
      timeframe === 'monthly'
        ? getSixMonthSpendingTrends(selectedMonth, selectedCategoryId)
        : getYearlySpendingTrends(selectedMonth, selectedCategoryId, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      timeframe,
      getSixMonthSpendingTrends,
      getYearlySpendingTrends,
      selectedMonth,
      selectedCategoryId,
      transactions,
      categories,
      budgets,
    ]
  );

  const expenseCategories = useMemo(
    () => categories.filter((c) => (c.type === 'expense' || c.type === 'both') && !c.deletedAt),
    [categories]
  );

  const activeCategory =
    selectedCategoryId !== 'all'
      ? expenseCategories.find((c) => c.id === selectedCategoryId)
      : undefined;

  // Pace status check
  const latestPacePoint = useMemo(() => {
    for (let i = paceData.length - 1; i >= 0; i--) {
      if (paceData[i].cumulativeSpent !== null) return paceData[i];
    }
    return paceData[0];
  }, [paceData]);

  const isAheadOfPace =
    latestPacePoint &&
    latestPacePoint.cumulativeSpent !== null &&
    latestPacePoint.idealCumulativeBudget > 0 &&
    latestPacePoint.cumulativeSpent > latestPacePoint.idealCumulativeBudget * 1.05;

  // Sankey flow model computation
  const sankeyModel = useMemo(() => {
    const fixedObligations =
      summary.remainingUnpaidEmis +
      summary.remainingUnpaidCommitments +
      summary.remainingUnpaidBills +
      summary.plannedDebtInstallmentsDue;

    const investedTotal = summary.totalInvested + summary.remainingPlannedSips;
    const variableSpend = summary.totalSpent;

    const inflowBase = Math.max(
      summary.totalIncome,
      summary.monthlyBudget,
      summary.expectedIncome,
      fixedObligations + investedTotal + variableSpend,
      1
    );

    const unallocatedSavings = Math.max(
      0,
      inflowBase - (fixedObligations + investedTotal + variableSpend)
    );

    // Top 4 variable categories + other
    const sortedCats = [...summary.categoryBreakdown]
      .filter((c) => c.spent > 0)
      .sort((a, b) => b.spent - a.spent);
    const topCats = sortedCats.slice(0, 4);
    const otherCatsSpent = sortedCats
      .slice(4)
      .reduce((sum, c) => sum + c.spent, 0);

    const targets: Array<{
      id: string;
      label: string;
      amount: number;
      color: string;
      group: string;
    }> = [];

    if (fixedObligations > 0) {
      targets.push({
        id: 'fixed',
        label: 'Fixed Bills & EMIs',
        amount: fixedObligations,
        color: '#f59e0b',
        group: 'Fixed',
      });
    }

    if (investedTotal > 0) {
      targets.push({
        id: 'invested',
        label: 'Investments & SIPs',
        amount: investedTotal,
        color: '#8b5cf6',
        group: 'Wealth',
      });
    }

    for (const item of topCats) {
      targets.push({
        id: `cat-${item.category.id}`,
        label: item.category.name,
        amount: item.spent,
        color: item.category.color || '#3b82f6',
        group: 'Variable',
      });
    }

    if (otherCatsSpent > 0) {
      targets.push({
        id: 'cat-other',
        label: 'Other Variable',
        amount: otherCatsSpent,
        color: '#64748b',
        group: 'Variable',
      });
    }

    if (unallocatedSavings > 0 || targets.length === 0) {
      targets.push({
        id: 'savings',
        label: 'Safe Buffer / Savings',
        amount: Math.max(unallocatedSavings, targets.length === 0 ? inflowBase : 0),
        color: '#10b981',
        group: 'Buffer',
      });
    }

    const totalOutflow = targets.reduce((s, t) => s + t.amount, 0) || 1;

    return {
      inflowBase,
      inflowLabel:
        summary.totalIncome > 0
          ? 'Monthly Income'
          : summary.monthlyBudget > 0
          ? 'Monthly Budget'
          : 'Cash Flow Base',
      totalOutflow,
      targets: targets.map((t) => ({
        ...t,
        sharePct: Math.round((t.amount / totalOutflow) * 100),
      })),
    };
  }, [summary]);

  const hasAnyBudget = trendData.some((d) => d.budget > 0);
  const totalPeriodSpent = trendData.reduce((sum, d) => sum + d.spent, 0);
  const periodAvg =
    trendData.length > 0 ? Math.round(totalPeriodSpent / trendData.length) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      {/* Top Bar: Title + 3-Way Chart Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {chartMode === 'pace' ? (
              <TrendingUp className="w-4 h-4" />
            ) : chartMode === 'sankey' ? (
              <GitFork className="w-4 h-4" />
            ) : (
              <BarChart3 className="w-4 h-4" />
            )}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">
              {chartMode === 'pace'
                ? 'Cumulative Daily Spending Pace'
                : chartMode === 'sankey'
                ? 'Sankey Cash Flow Allocation'
                : timeframe === 'monthly'
                ? '6-Month Spending vs. Budget'
                : 'Yearly Spending vs. Budget'}
            </h2>
            <p className="text-xs text-muted-foreground font-mono tabular-nums truncate">
              {chartMode === 'pace' ? (
                latestPacePoint && latestPacePoint.cumulativeSpent !== null ? (
                  <>
                    Day {latestPacePoint.day} · Burn{' '}
                    {formatINR(latestPacePoint.cumulativeSpent)}
                    {latestPacePoint.idealCumulativeBudget > 0
                      ? ` vs ${formatINR(latestPacePoint.idealCumulativeBudget)} target`
                      : ''}
                  </>
                ) : (
                  'Cumulative burn vs linear monthly trajectory'
                )
              ) : chartMode === 'sankey' ? (
                <>
                  {sankeyModel.inflowLabel}: {formatINR(sankeyModel.inflowBase)} →{' '}
                  {sankeyModel.targets.length} buckets
                </>
              ) : (
                <>
                  Avg {formatINR(periodAvg)}/{timeframe === 'monthly' ? 'mo' : 'yr'} · Total{' '}
                  {formatINR(totalPeriodSpent)}
                </>
              )}
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label="Visual analytics chart mode"
          className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted shrink-0"
        >
          {(
            [
              { id: 'pace', label: 'Daily Pace' },
              { id: 'sankey', label: 'Cash Flow' },
              { id: 'trend', label: '6M Trend' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={chartMode === tab.id}
              onClick={() => setChartMode(tab.id)}
              className={`min-h-[36px] px-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                chartMode === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode 1: Cumulative Daily Spending Pace Curve */}
      {chartMode === 'pace' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isAheadOfPace ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                />
                <span>This Month Actual</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500" />
                <span>Ideal Budget Pace</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t-2 border-dotted border-muted-foreground" />
                <span>Last Month</span>
              </span>
            </div>

            {summary.monthlyBudget <= 0 && (
              <button
                type="button"
                onClick={() => onOpenBudgetModal()}
                className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
              >
                Set monthly budget for pace line
              </button>
            )}
          </div>

          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={paceData}
                margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="paceBurnGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={isAheadOfPace ? '#f43f5e' : '#10b981'}
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="95%"
                      stopColor={isAheadOfPace ? '#f43f5e' : '#10b981'}
                      stopOpacity={0.0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="text-border/60"
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground font-mono"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatCompactINR}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground font-mono"
                  width={56}
                />
                <Tooltip content={<PaceTooltip />} />
                <Line
                  type="monotone"
                  dataKey="lastMonthCumulativeSpent"
                  name="Last Month"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="2 3"
                  dot={false}
                />
                {summary.monthlyBudget > 0 && (
                  <Line
                    type="monotone"
                    dataKey="idealCumulativeBudget"
                    name="Linear Budget Target"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="cumulativeSpent"
                  name="Actual Cumulative Burn"
                  stroke={isAheadOfPace ? '#f43f5e' : '#10b981'}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#paceBurnGradient)"
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Mode 2: Sankey Cash Flow Diagram */}
      {chartMode === 'sankey' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* SVG Sankey Ribbon Diagram */}
            <div className="sm:col-span-7">
              <svg
                viewBox="0 0 420 220"
                className="w-full h-52 sm:h-56 overflow-visible select-none"
                role="img"
                aria-label="Sankey cash flow diagram from income to expenses and investments"
              >
                {(() => {
                  const sourceX = 18;
                  const sourceW = 14;
                  const sourceTop = 24;
                  const sourceH = 172;

                  const targetX = 270;
                  const targetW = 12;
                  const gap = 8;
                  const count = sankeyModel.targets.length;
                  const availableTargetH = 192 - gap * Math.max(0, count - 1);

                  let currentSourceY = sourceTop;
                  let currentTargetY = 14;

                  return (
                    <>
                      {/* Source Node Bar */}
                      <rect
                        x={sourceX}
                        y={sourceTop}
                        width={sourceW}
                        height={sourceH}
                        rx={4}
                        fill="#10b981"
                      />
                      <text
                        x={sourceX}
                        y={sourceTop - 6}
                        className="fill-foreground text-[10px] font-semibold"
                      >
                        {sankeyModel.inflowLabel} ({formatCompactINR(sankeyModel.inflowBase)})
                      </text>

                      {sankeyModel.targets.map((target) => {
                        const weight = target.amount / sankeyModel.totalOutflow;
                        const sBandH = Math.max(4, weight * sourceH);
                        const tBandH = Math.max(12, weight * availableTargetH);

                        const sy0 = currentSourceY;
                        const sy1 = currentSourceY + sBandH;
                        currentSourceY = sy1;

                        const ty0 = currentTargetY;
                        const ty1 = currentTargetY + tBandH;
                        currentTargetY = ty1 + gap;

                        const x0 = sourceX + sourceW;
                        const x1 = targetX;
                        const cx = (x0 + x1) / 2;

                        const pathD = `
                          M ${x0} ${sy0}
                          C ${cx} ${sy0}, ${cx} ${ty0}, ${x1} ${ty0}
                          L ${x1} ${ty1}
                          C ${cx} ${ty1}, ${cx} ${sy1}, ${x0} ${sy1}
                          Z
                        `;

                        const isHovered = hoveredSankeyNode === target.id;
                        const isDimmed =
                          hoveredSankeyNode !== null && !isHovered;

                        return (
                          <g
                            key={target.id}
                            onMouseEnter={() => setHoveredSankeyNode(target.id)}
                            onMouseLeave={() => setHoveredSankeyNode(null)}
                            className="cursor-pointer transition-opacity"
                            style={{ opacity: isDimmed ? 0.3 : 1 }}
                          >
                            <path
                              d={pathD}
                              fill={target.color}
                              fillOpacity={isHovered ? 0.48 : 0.28}
                              stroke={target.color}
                              strokeOpacity={0.5}
                              strokeWidth={0.75}
                            />
                            <rect
                              x={targetX}
                              y={ty0}
                              width={targetW}
                              height={tBandH}
                              rx={3}
                              fill={target.color}
                            />
                            <text
                              x={targetX + targetW + 8}
                              y={ty0 + tBandH / 2 - 1}
                              dominantBaseline="middle"
                              className="fill-foreground text-[10px] font-semibold"
                            >
                              {target.label.length > 18
                                ? `${target.label.slice(0, 17)}…`
                                : target.label}
                            </text>
                            <text
                              x={targetX + targetW + 8}
                              y={ty0 + tBandH / 2 + 10}
                              dominantBaseline="middle"
                              className="fill-muted-foreground text-[9px] font-mono"
                            >
                              {formatCompactINR(target.amount)} · {target.sharePct}%
                            </text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Legend & Interactive Breakdown Table */}
            <div className="sm:col-span-5 space-y-2">
              {sankeyModel.targets.map((t) => (
                <div
                  key={t.id}
                  onMouseEnter={() => setHoveredSankeyNode(t.id)}
                  onMouseLeave={() => setHoveredSankeyNode(null)}
                  className={`px-3 py-2 rounded-xl border transition-colors flex items-center justify-between gap-2 text-xs ${
                    hoveredSankeyNode === t.id
                      ? 'border-primary bg-muted/60'
                      : 'border-border/60 bg-background/50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="font-medium text-foreground truncate">
                      {t.label}
                    </span>
                  </div>
                  <div className="font-mono tabular-nums shrink-0 text-right">
                    <span className="font-semibold text-foreground">
                      {formatINR(t.amount)}
                    </span>
                    <span className="text-muted-foreground ml-1.5">
                      ({t.sharePct}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mode 3: 6-Month / Yearly Spending vs. Budget BarChart */}
      {chartMode === 'trend' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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
                <span>{timeframe === 'monthly' ? 'Budget' : 'Annual Budget'}</span>
              </span>
              {hasAnyBudget && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                  <span>Over Budget</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-muted shrink-0">
                {(['monthly', 'yearly'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTimeframe(mode)}
                    className={`min-h-[30px] px-2 text-[11px] font-semibold rounded-md capitalize transition-colors whitespace-nowrap ${
                      timeframe === mode
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <select
                aria-label="Filter trend chart by category"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="h-9 px-2.5 text-xs font-medium rounded-xl border border-input bg-background text-foreground shrink-0 max-w-[175px]"
              >
                <option value="all">All Categories</option>
                {expenseCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trendData}
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
                  {trendData.map((entry) => (
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
      )}
    </div>
  );
}
