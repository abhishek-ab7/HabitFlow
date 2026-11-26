'use client';

import React from 'react';
import Link from 'next/link';
import { Plus, Wallet, ArrowUpRight, CalendarClock, Sparkles, MessageSquareText, AlertCircle } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { MonthlyFinanceSummary } from '@/lib/types';
import { Button } from '@/components/ui/button';

export interface PacePoint {
  day: number;
  cumulativeSpent: number | null;
  idealCumulativeBudget: number;
}

function buildSparklinePaths(points: PacePoint[]) {
  const width = 180;
  const height = 42;
  const pad = 3;
  const maxVal = Math.max(1, ...points.map((p) => Math.max(p.cumulativeSpent ?? 0, p.idealCumulativeBudget || 0)));
  const maxDay = Math.max(1, points.length - 1);
  const toX = (idx: number) => pad + (idx / maxDay) * (width - pad * 2);
  const toY = (val: number) => height - pad - (val / maxVal) * (height - pad * 2);

  const idealPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.idealCumulativeBudget).toFixed(1)}`).join(' ');
  const actualPoints = points.filter((p) => p.cumulativeSpent !== null);
  const actualPath = actualPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.day - 1).toFixed(1)},${toY(p.cumulativeSpent || 0).toFixed(1)}`).join(' ');
  const lastActual = actualPoints[actualPoints.length - 1];
  const isOver = Boolean(lastActual && lastActual.idealCumulativeBudget > 0 && (lastActual.cumulativeSpent || 0) > lastActual.idealCumulativeBudget * 1.05);
  return {
    width, height, idealPath, actualPath,
    stroke: isOver ? '#f43f5e' : '#10b981',
    lastDot: lastActual ? { cx: toX(lastActual.day - 1), cy: toY(lastActual.cumulativeSpent || 0) } : null,
  };
}

function MiniBurnSparkline({ points }: { points: PacePoint[] }) {
  if (points.length === 0) return null;
  const { width, height, idealPath, actualPath, stroke, lastDot } = buildSparklinePaths(points);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-11 overflow-visible" aria-label="Cumulative monthly burn vs ideal budget pace" role="img">
      <path d={idealPath} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.5" strokeDasharray="3 3" />
      {actualPath && <path d={actualPath} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
      {lastDot && <circle cx={lastDot.cx} cy={lastDot.cy} r="3" fill={stroke} />}
    </svg>
  );
}

function getFinancePaceVisual(isOverBudget: boolean, isAheadOfPace: boolean) {
  if (isOverBudget) return { label: 'Over Budget', textCls: 'text-rose-600 dark:text-rose-400', barCls: 'bg-rose-500' };
  if (isAheadOfPace) return { label: 'Ahead of Pace', textCls: 'text-amber-600 dark:text-amber-400', barCls: 'bg-amber-500' };
  return { label: 'On Pace', textCls: 'text-emerald-600 dark:text-emerald-400', barCls: 'bg-emerald-500' };
}

export function DashboardFinanceHero(params: {
  bothHeroesVisible: boolean;
  financeSummary: MonthlyFinanceSummary;
  netWorth: number;
  dailyPacePoints: PacePoint[];
  dueSoonCount: number;
  dueSoonTotal: number;
  hasBudget: boolean;
  budgetPct: number;
  isOverBudget: boolean;
  isAheadOfPace: boolean;
  onOpenQuickExpense: () => void;
  onOpenSms: () => void;
  onOpenAskAi: () => void;
}) {
  const {
    bothHeroesVisible, financeSummary, netWorth, dailyPacePoints, dueSoonCount, dueSoonTotal,
    hasBudget, budgetPct, isOverBudget, isAheadOfPace, onOpenQuickExpense, onOpenSms, onOpenAskAi,
  } = params;
  const colCls = bothHeroesVisible ? 'min-w-[90vw] sm:min-w-[520px] lg:min-w-0 snap-center lg:col-span-6' : 'col-span-1';
  const showSafeToSpend = hasBudget || financeSummary.totalIncome > 0;
  const paceVisual = getFinancePaceVisual(isOverBudget, isAheadOfPace);
  const scaleX = Math.max(0, Math.min(1, (hasBudget ? budgetPct : 30) / 100));
  const paceLeft = Math.min(99, Math.max(1, financeSummary.dayOfMonthProgressPct));

  return (
    <section className={`${colCls} surface-hero p-5 sm:p-6 flex flex-col justify-between gap-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-primary" />
              Financial Pulse
            </span>
            {showSafeToSpend && <span className={`font-semibold ${paceVisual.textCls}`}>· {paceVisual.label}</span>}
          </div>
          <div className="flex items-baseline gap-2 pt-0.5 flex-wrap">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground">
              {formatINR(showSafeToSpend ? financeSummary.safeToSpendDaily : financeSummary.totalSpent)}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {showSafeToSpend ? `safe / day · ${financeSummary.remainingDaysInMonth}d left` : 'spent this month'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button type="button" size="sm" onClick={onOpenQuickExpense} className="min-h-[38px] px-3 rounded-xl gap-1 text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" />
            <span>Log</span>
          </Button>
          <button type="button" onClick={onOpenSms} title="Import SMS / UPI notifications" aria-label="Import SMS" className="min-h-[38px] min-w-[38px] rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <MessageSquareText className="w-4 h-4" />
          </button>
          <button type="button" onClick={onOpenAskAi} title="Ask AI about your finances" aria-label="Ask AI Finances" className="min-h-[38px] min-w-[38px] rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center text-invest transition-colors">
            <Sparkles className="w-4 h-4" />
          </button>
          <Link href="/finance" aria-label="Open Finance workspace" className="min-h-[38px] min-w-[38px] rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div className="sm:col-span-7 space-y-1.5">
          <div className="relative h-2 w-full rounded-full bg-muted overflow-visible">
            <div className="h-full w-full rounded-full overflow-hidden">
              <div style={{ transform: `scaleX(${scaleX})` }} className={`h-full w-full origin-left rounded-full transition-transform duration-300 ${paceVisual.barCls}`} />
            </div>
            {hasBudget && <div style={{ left: `${paceLeft}%` }} title={`Today's pace: ${financeSummary.dayOfMonthProgressPct}%`} className="absolute -top-1 -bottom-1 w-0.5 bg-foreground/80 rounded-full" />}
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-muted-foreground">
            <span>Spent {formatINR(financeSummary.totalSpent)}{hasBudget ? ` / ${formatINR(financeSummary.monthlyBudget)}` : ''}</span>
            <span>NW {formatINR(netWorth)}</span>
          </div>
        </div>
        <div className="sm:col-span-5 rounded-xl border border-border/60 bg-muted/35 px-2.5 py-1.5">
          <MiniBurnSparkline points={dailyPacePoints} />
        </div>
      </div>

      <div className="pt-3 border-t border-border/60 grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
        <div>
          <span className="text-[11px] text-muted-foreground font-sans block">Safe Monthly</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatINR(financeSummary.safeToSpendMonthly)}</span>
        </div>
        <Link href="/finance?tab=trackers" className="text-left hover:underline block">
          <span className="text-[11px] text-muted-foreground font-sans flex items-center gap-1">
            <CalendarClock className="w-3 h-3 text-amber-500" />
            Due 7d ({dueSoonCount})
          </span>
          <span className={`font-bold ${dueSoonTotal > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>{formatINR(dueSoonTotal)}</span>
        </Link>
        <Link href="/finance?tab=activity" className="text-left hover:underline block">
          <span className="text-[11px] text-muted-foreground font-sans flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-primary" />
            Review Inbox
          </span>
          <span className={`font-bold ${financeSummary.needsReviewCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
            {financeSummary.needsReviewCount} pending
          </span>
        </Link>
      </div>
    </section>
  );
}
