'use client';

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { formatINR, type SixMonthTrendPoint } from '@/lib/stores/finance-store';
import type { FinanceCategory, MonthlyFinanceSummary } from '@/lib/types';
import { formatCompactINR, TrendTooltip } from './TrendTooltips';

export interface SankeyTargetItem {
  id: string;
  label: string;
  amount: number;
  color: string;
  group: string;
  sharePct: number;
}

export interface SankeyModel {
  inflowBase: number;
  inflowLabel: string;
  totalOutflow: number;
  targets: SankeyTargetItem[];
}

function buildRawSankeyTargets(summary: MonthlyFinanceSummary, inflowBase: number): Array<Omit<SankeyTargetItem, 'sharePct'>> {
  const fixedObligations =
    summary.remainingUnpaidEmis +
    summary.remainingUnpaidCommitments +
    summary.remainingUnpaidBills +
    summary.plannedDebtInstallmentsDue;
  const investedTotal = summary.totalInvested + summary.remainingPlannedSips;
  const unallocatedSavings = Math.max(0, inflowBase - (fixedObligations + investedTotal + summary.totalSpent));

  const sortedCats = [...summary.categoryBreakdown].filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent);
  const otherCatsSpent = sortedCats.slice(4).reduce((sum, c) => sum + c.spent, 0);

  const rawTargets: Array<Omit<SankeyTargetItem, 'sharePct'>> = [];
  if (fixedObligations > 0) rawTargets.push({ id: 'fixed', label: 'Fixed Bills & EMIs', amount: fixedObligations, color: '#f59e0b', group: 'Fixed' });
  if (investedTotal > 0) rawTargets.push({ id: 'invested', label: 'Investments & SIPs', amount: investedTotal, color: '#8b5cf6', group: 'Wealth' });
  for (const item of sortedCats.slice(0, 4)) {
    rawTargets.push({ id: `cat-${item.category.id}`, label: item.category.name, amount: item.spent, color: item.category.color || '#3b82f6', group: 'Variable' });
  }
  if (otherCatsSpent > 0) rawTargets.push({ id: 'cat-other', label: 'Other Variable', amount: otherCatsSpent, color: '#64748b', group: 'Variable' });
  if (unallocatedSavings > 0 || rawTargets.length === 0) {
    rawTargets.push({ id: 'savings', label: 'Safe Buffer / Savings', amount: Math.max(unallocatedSavings, rawTargets.length === 0 ? inflowBase : 0), color: '#10b981', group: 'Buffer' });
  }
  return rawTargets;
}

export function buildSankeyModel(summary: MonthlyFinanceSummary): SankeyModel {
  const fixedObligations =
    summary.remainingUnpaidEmis +
    summary.remainingUnpaidCommitments +
    summary.remainingUnpaidBills +
    summary.plannedDebtInstallmentsDue;
  const totalUsed = fixedObligations + summary.totalInvested + summary.remainingPlannedSips + summary.totalSpent;
  const inflowBase = Math.max(summary.totalIncome, summary.monthlyBudget, summary.expectedIncome, totalUsed, 1);
  const rawTargets = buildRawSankeyTargets(summary, inflowBase);
  const totalOutflow = rawTargets.reduce((s, t) => s + t.amount, 0) || 1;
  const inflowLabel = summary.totalIncome > 0 ? 'Monthly Income' : summary.monthlyBudget > 0 ? 'Monthly Budget' : 'Cash Flow Base';
  return {
    inflowBase,
    inflowLabel,
    totalOutflow,
    targets: rawTargets.map((t) => ({ ...t, sharePct: Math.round((t.amount / totalOutflow) * 100) })),
  };
}

function computeSankeyTargetGeometries(sankeyModel: SankeyModel) {
  const sourceX = 18;
  const sourceW = 14;
  const sourceTop = 24;
  const sourceH = 172;
  const targetX = 270;
  const gap = 8;
  const availableTargetH = 192 - gap * Math.max(0, sankeyModel.targets.length - 1);

  let currentSourceY = sourceTop;
  let currentTargetY = 14;

  return sankeyModel.targets.map((target) => {
    const weight = target.amount / sankeyModel.totalOutflow;
    const sBandH = Math.max(4, weight * sourceH);
    const tBandH = Math.max(12, weight * availableTargetH);
    const sy0 = currentSourceY;
    const sy1 = sy0 + sBandH;
    currentSourceY = sy1;
    const ty0 = currentTargetY;
    const ty1 = ty0 + tBandH;
    currentTargetY = ty1 + gap;
    const x0 = sourceX + sourceW;
    const cx = (x0 + targetX) / 2;
    const pathD = `M ${x0} ${sy0} C ${cx} ${sy0}, ${cx} ${ty0}, ${targetX} ${ty0} L ${targetX} ${ty1} C ${cx} ${ty1}, ${cx} ${sy1}, ${x0} ${sy1} Z`;
    return { target, pathD, ty0, tBandH };
  });
}

function SankeyFlowSvg({
  sankeyModel,
  hoveredSankeyNode,
  setHoveredSankeyNode,
}: {
  sankeyModel: SankeyModel;
  hoveredSankeyNode: string | null;
  setHoveredSankeyNode: (id: string | null) => void;
}) {
  const sourceX = 18;
  const sourceW = 14;
  const sourceTop = 24;
  const sourceH = 172;
  const targetX = 270;
  const targetW = 12;
  const geometries = computeSankeyTargetGeometries(sankeyModel);

  return (
    <svg viewBox="0 0 420 220" className="w-full h-52 sm:h-56 overflow-visible select-none" role="img" aria-label="Sankey cash flow diagram from income to expenses and investments">
      <rect x={sourceX} y={sourceTop} width={sourceW} height={sourceH} rx={4} fill="#10b981" />
      <text x={sourceX} y={sourceTop - 6} className="fill-foreground text-[10px] font-semibold">
        {sankeyModel.inflowLabel} ({formatCompactINR(sankeyModel.inflowBase)})
      </text>
      {geometries.map(({ target, pathD, ty0, tBandH }) => {
        const isHovered = hoveredSankeyNode === target.id;
        const isDimmed = hoveredSankeyNode !== null && !isHovered;

        return (
          <g key={target.id} onMouseEnter={() => setHoveredSankeyNode(target.id)} onMouseLeave={() => setHoveredSankeyNode(null)} className="cursor-pointer transition-opacity" style={{ opacity: isDimmed ? 0.3 : 1 }}>
            <path d={pathD} fill={target.color} fillOpacity={isHovered ? 0.48 : 0.28} stroke={target.color} strokeOpacity={0.5} strokeWidth={0.75} />
            <rect x={targetX} y={ty0} width={targetW} height={tBandH} rx={3} fill={target.color} />
            <text x={targetX + targetW + 8} y={ty0 + tBandH / 2 - 1} dominantBaseline="middle" className="fill-foreground text-[10px] font-semibold">
              {target.label.length > 18 ? `${target.label.slice(0, 17)}…` : target.label}
            </text>
            <text x={targetX + targetW + 8} y={ty0 + tBandH / 2 + 10} dominantBaseline="middle" className="fill-muted-foreground text-[9px] font-mono">
              {formatCompactINR(target.amount)} · {target.sharePct}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function SankeyChartPanel({
  sankeyModel,
  hoveredSankeyNode,
  setHoveredSankeyNode,
}: {
  sankeyModel: SankeyModel;
  hoveredSankeyNode: string | null;
  setHoveredSankeyNode: (id: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        <div className="sm:col-span-7">
          <SankeyFlowSvg sankeyModel={sankeyModel} hoveredSankeyNode={hoveredSankeyNode} setHoveredSankeyNode={setHoveredSankeyNode} />
        </div>
        <div className="sm:col-span-5 space-y-2">
          {sankeyModel.targets.map((t) => (
            <div
              key={t.id}
              onMouseEnter={() => setHoveredSankeyNode(t.id)}
              onMouseLeave={() => setHoveredSankeyNode(null)}
              className={`px-3 py-2 rounded-xl border transition-colors flex items-center justify-between gap-2 text-xs ${hoveredSankeyNode === t.id ? 'border-primary bg-muted/60' : 'border-border/60 bg-background/50'}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <span className="font-medium text-foreground truncate">{t.label}</span>
              </div>
              <div className="font-mono tabular-nums shrink-0 text-right">
                <span className="font-semibold text-foreground">{formatINR(t.amount)}</span>
                <span className="text-muted-foreground ml-1.5">({t.sharePct}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrendBarChartPanel(params: {
  timeframe: 'monthly' | 'yearly';
  setTimeframe: (m: 'monthly' | 'yearly') => void;
  selectedCategoryId: string;
  setSelectedCategoryId: (id: string) => void;
  expenseCategories: FinanceCategory[];
  activeCategory?: FinanceCategory;
  trendData: SixMonthTrendPoint[];
  hasAnyBudget: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: params.activeCategory?.color ?? '#3b82f6' }} />
            <span>Actual Spent</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/35" />
            <span>{params.timeframe === 'monthly' ? 'Budget' : 'Annual Budget'}</span>
          </span>
          {params.hasAnyBudget && (
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
                onClick={() => params.setTimeframe(mode)}
                className={`min-h-[30px] px-2 text-[11px] font-semibold rounded-md capitalize transition-colors whitespace-nowrap ${params.timeframe === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {mode}
              </button>
            ))}
          </div>
          <select aria-label="Filter trend chart by category" value={params.selectedCategoryId} onChange={(e) => params.setSelectedCategoryId(e.target.value)} className="h-9 px-2.5 text-xs font-medium rounded-xl border border-input bg-background text-foreground shrink-0 max-w-[175px]">
            <option value="all">All Categories</option>
            {params.expenseCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="h-56 sm:h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={params.trendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={4} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/60" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" />
            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactINR} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground font-mono" width={56} />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: 'currentColor', opacity: 0.06 }} />
            <Bar dataKey="spent" name="Actual Spent" radius={[6, 6, 0, 0]} maxBarSize={28}>
              {params.trendData.map((entry) => (
                <Cell key={entry.monthKey} fill={entry.isOverBudget ? '#ef4444' : params.activeCategory?.color ?? '#3b82f6'} />
              ))}
            </Bar>
            <Bar dataKey="budget" name="Category Budget" fill="currentColor" className="text-muted-foreground/30" radius={[6, 6, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
