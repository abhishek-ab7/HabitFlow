'use client';

import React from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { CashFlowForecastPoint, DailyPacePoint } from '@/lib/types';
import { ForecastTooltip, formatCompactINR, PaceTooltip } from './TrendTooltips';

export function PaceChartPanel(params: {
  paceData: DailyPacePoint[];
  isAheadOfPace: boolean;
  monthlyBudget: number;
  onOpenBudgetModal: () => void;
}) {
  const strokeColor = params.isAheadOfPace ? '#f43f5e' : '#10b981';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${params.isAheadOfPace ? 'bg-rose-500' : 'bg-emerald-500'}`} />
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
        {params.monthlyBudget <= 0 && (
          <button type="button" onClick={params.onOpenBudgetModal} className="text-xs font-medium text-primary hover:underline whitespace-nowrap">
            Set monthly budget for pace line
          </button>
        )}
      </div>

      <div className="h-56 sm:h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={params.paceData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="paceBurnGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.28} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/60" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground font-mono" />
            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactINR} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground font-mono" width={56} />
            <Tooltip content={<PaceTooltip />} />
            <Line type="monotone" dataKey="lastMonthCumulativeSpent" name="Last Month" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="2 3" dot={false} />
            {params.monthlyBudget > 0 && (
              <Line type="monotone" dataKey="idealCumulativeBudget" name="Linear Budget Target" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            )}
            <Area type="monotone" dataKey="cumulativeSpent" name="Actual Cumulative Burn" stroke={strokeColor} strokeWidth={2.5} fillOpacity={1} fill="url(#paceBurnGradient)" connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ForecastChartPanel(params: {
  forecastHorizon: 30 | 60 | 90;
  setForecastHorizon: (d: 30 | 60 | 90) => void;
  includeBurn: boolean;
  setIncludeBurn: (v: boolean) => void;
  forecastData: CashFlowForecastPoint[];
  forecastMinPoint: CashFlowForecastPoint | null;
}) {
  const hasForecastCrunch = Boolean(params.forecastMinPoint && params.forecastMinPoint.projectedBalance < 0);
  const strokeColor = hasForecastCrunch ? '#f43f5e' : '#0ea5e9';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-muted">
          {([30, 60, 90] as const).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => params.setForecastHorizon(days)}
              className={`h-7 px-2.5 rounded-md font-mono font-semibold text-[11px] transition-colors ${params.forecastHorizon === days ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {days}d
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={params.includeBurn} onChange={(e) => params.setIncludeBurn(e.target.checked)} className="rounded border-input" />
          <span>Include daily avg burn</span>
        </label>
      </div>

      {hasForecastCrunch && params.forecastMinPoint && (
        <div className="rounded-xl border border-rose-500/35 bg-rose-500/5 px-3 py-2 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Projected liquid balance dips to{' '}
            <strong className="font-mono tabular-nums">{formatINR(params.forecastMinPoint.projectedBalance)}</strong> around{' '}
            <strong>{params.forecastMinPoint.label}</strong>. Consider trimming variable burn or staging bills.
          </span>
        </div>
      )}

      <div className="h-56 sm:h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={params.forecastData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.28} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/60" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={22} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" />
            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactINR} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground font-mono" width={56} />
            <Tooltip content={<ForecastTooltip />} />
            <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="projectedBalance" name="Projected Liquid Balance" stroke={strokeColor} strokeWidth={2.5} fill="url(#forecastGrad)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
