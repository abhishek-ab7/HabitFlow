'use client';

import React from 'react';
import { formatINR, type SixMonthTrendPoint } from '@/lib/stores/finance-store';
import type { CashFlowForecastPoint, DailyPacePoint } from '@/lib/types';

export function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs === 0) return '₹0';
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${sign}₹${Math.round(abs)}`;
}

export function TrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: SixMonthTrendPoint }> }) {
  if (!active || !payload?.length) return null;
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
        <span className="font-semibold text-foreground">{hasBudget ? formatINR(point.budget) : 'Not set'}</span>
      </div>
      {hasBudget && (
        <div className={`pt-1 border-t border-border/60 flex items-center justify-between gap-4 font-mono tabular-nums font-medium ${diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          <span>{diff < 0 ? 'Over by' : 'Under by'}</span>
          <span>{formatINR(Math.abs(diff))}</span>
        </div>
      )}
    </div>
  );
}

function PaceDiffRow({ diff }: { diff: number | null }) {
  if (diff === null) return null;
  const colorCls = diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400';
  return (
    <div className={`pt-1 border-t border-border/60 flex items-center justify-between gap-4 font-mono tabular-nums font-medium ${colorCls}`}>
      <span>{diff < 0 ? 'Ahead of pace by' : 'Below pace by'}</span>
      <span>{formatINR(Math.abs(diff))}</span>
    </div>
  );
}

export function PaceTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DailyPacePoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const actual = point.cumulativeSpent;
  const ideal = point.idealCumulativeBudget;
  const diff = actual !== null && ideal > 0 ? ideal - actual : null;

  return (
    <div className="rounded-xl border border-border bg-popover text-popover-foreground shadow-md px-3.5 py-2.5 text-xs space-y-1.5 min-w-[190px]">
      <p className="font-semibold text-foreground font-mono tabular-nums">Day {point.day} ({point.dateStr})</p>
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
        <span className="text-muted-foreground">{formatINR(point.lastMonthCumulativeSpent)}</span>
      </div>
      <PaceDiffRow diff={diff} />
    </div>
  );
}

export function ForecastTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CashFlowForecastPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover text-popover-foreground shadow-md px-3.5 py-2.5 text-xs space-y-1.5 min-w-[200px]">
      <p className="font-semibold text-foreground font-mono tabular-nums">{point.label} ({point.dateStr})</p>
      <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
        <span className="text-muted-foreground">Projected Liquid</span>
        <span className={`font-bold ${point.projectedBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {formatINR(point.projectedBalance)}
        </span>
      </div>
      {point.scheduledInflow > 0 && (
        <div className="flex items-center justify-between gap-4 font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
          <span>Scheduled Inflow</span>
          <span>+{formatINR(point.scheduledInflow)}</span>
        </div>
      )}
      {point.scheduledOutflow > 0 && (
        <div className="flex items-center justify-between gap-4 font-mono tabular-nums text-rose-600 dark:text-rose-400">
          <span>Scheduled Bills/EMIs</span>
          <span>-{formatINR(point.scheduledOutflow)}</span>
        </div>
      )}
      {point.events.length > 0 && (
        <div className="pt-1 border-t border-border/60 space-y-0.5 text-[11px] text-muted-foreground">
          {point.events.slice(0, 3).map((ev, i) => (
            <p key={i} className="truncate">· {ev}</p>
          ))}
        </div>
      )}
    </div>
  );
}
