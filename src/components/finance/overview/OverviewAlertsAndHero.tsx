'use client';

import React, { useState } from 'react';
import {
  SlidersHorizontal,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { MonthlyFinanceSummary } from '@/lib/types';

export interface AnomalyAlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  actionLabel: string;
  actionTarget: string;
  kind?: string;
}

function getSeverityStyle(severity: AnomalyAlertItem['severity']) {
  if (severity === 'critical') return { card: 'border-rose-500/35 bg-rose-500/5', icon: 'text-rose-500' };
  if (severity === 'warning') return { card: 'border-amber-500/35 bg-amber-500/5', icon: 'text-amber-500' };
  return { card: 'border-border bg-card', icon: 'text-primary' };
}

export function OverviewAnomaliesStrip(params: {
  anomalies: AnomalyAlertItem[];
  onAlertAction: (alert: AnomalyAlertItem) => void;
}) {
  const { anomalies, onAlertAction } = params;
  if (anomalies.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {anomalies.slice(0, 2).map((alert) => {
        const style = getSeverityStyle(alert.severity);
        return (
          <div key={alert.id} className={`rounded-2xl border px-4 py-3 flex items-start justify-between gap-3 ${style.card}`}>
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${style.icon}`} />
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-bold text-foreground truncate">{alert.title}</p>
                <p className="text-xs text-muted-foreground leading-snug">{alert.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onAlertAction(alert)}
              className="text-xs font-semibold text-primary hover:underline whitespace-nowrap shrink-0 mt-0.5"
            >
              {alert.actionLabel} →
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SafeToSpendFormulaBreakdown(params: {
  summary: MonthlyFinanceSummary;
  budgetBase: number;
  fixedUnpaidTotal: number;
}) {
  const { summary, budgetBase, fixedUnpaidTotal } = params;
  const [open, setOpen] = useState(false);
  if (budgetBase <= 0) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-muted/25 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>How Safe-to-Spend is calculated</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1.5 border-t border-border/50 space-y-1.5 text-xs font-mono tabular-nums">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-sans">{summary.monthlyBudget > 0 ? 'Monthly Budget' : 'Income Base'}</span>
            <span className="font-semibold text-foreground">{formatINR(budgetBase)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-sans">− Variable Spent</span>
            <span className="text-rose-600 dark:text-rose-400">-{formatINR(summary.totalSpent)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-sans">− Unpaid EMIs, Commitments &amp; Bills</span>
            <span className="text-amber-600 dark:text-amber-400">-{formatINR(fixedUnpaidTotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-sans">− Planned SIPs Remaining</span>
            <span className="text-violet-600 dark:text-violet-400">-{formatINR(summary.remainingPlannedSips)}</span>
          </div>
          <div className="pt-1.5 border-t border-border/60 flex items-center justify-between font-bold">
            <span className="text-foreground font-sans">= Safe Buffer ÷ {summary.remainingDaysInMonth} days</span>
            <span className="text-emerald-600 dark:text-emerald-400">{formatINR(summary.safeToSpendDaily)}/day</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SafeToSpendMetricsGrid(params: {
  summary: MonthlyFinanceSummary;
  dueSoonCount: number;
  dueSoonTotal: number;
  onOpenTrackersTab: () => void;
}) {
  const { summary, dueSoonCount, dueSoonTotal, onOpenTrackersTab } = params;
  return (
    <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border/70">
      <div>
        <span className="text-[11px] text-muted-foreground block">Income</span>
        <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{formatINR(summary.totalIncome)}</span>
      </div>
      <div>
        <span className="text-[11px] text-muted-foreground block">Spent</span>
        <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-foreground">{formatINR(summary.totalSpent)}</span>
      </div>
      <div>
        <span className="text-[11px] text-muted-foreground block">Invested</span>
        <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400">{formatINR(summary.totalInvested)}</span>
      </div>
      <button type="button" onClick={onOpenTrackersTab} className="text-left rounded-lg hover:bg-muted/50 px-1 -mx-1 transition-colors">
        <span className="text-[11px] text-muted-foreground block">Due Soon</span>
        <span className={`text-xs sm:text-sm font-bold font-mono tabular-nums ${dueSoonCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
          {dueSoonCount > 0 ? formatINR(dueSoonTotal) : '₹0'}
        </span>
      </button>
    </div>
  );
}

function getPaceStatusBadge(isOverBudget: boolean, isAheadOfPace: boolean) {
  if (isOverBudget) return { label: 'Over Budget', cls: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500' };
  if (isAheadOfPace) return { label: 'Ahead of Pace', cls: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
  return { label: 'On Pace', cls: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' };
}

export function SafeToSpendHeroCard(params: {
  summary: MonthlyFinanceSummary;
  hasBudget: boolean;
  budgetBase: number;
  budgetPct: number;
  isOverBudget: boolean;
  isAheadOfPace: boolean;
  fixedUnpaidTotal: number;
  dueSoonCount: number;
  dueSoonTotal: number;
  onOpenBudgetModal: () => void;
  onOpenTrackersTab: () => void;
  onOpenAskAi?: () => void;
}) {
  const { summary, hasBudget, budgetBase, budgetPct, isOverBudget, isAheadOfPace, fixedUnpaidTotal, dueSoonCount, dueSoonTotal, onOpenBudgetModal, onOpenTrackersTab, onOpenAskAi } = params;
  const pace = getPaceStatusBadge(isOverBudget, isAheadOfPace);
  const paceLeftPct = Math.min(99, Math.max(1, summary.dayOfMonthProgressPct));

  return (
    <div className="surface-hero p-5 sm:p-6 space-y-4 tour-safe-to-spend">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {budgetBase > 0 ? 'Safe to Spend Today' : 'Spent This Month'}
            {budgetBase > 0 && <span className={`normal-case tracking-normal ml-1 ${pace.cls}`}>· {pace.label}</span>}
          </p>
          <p className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-foreground mt-1">
            {budgetBase > 0 ? formatINR(summary.safeToSpendDaily) : formatINR(summary.totalSpent)}
            {budgetBase > 0 && (
              <span className="text-xs font-normal text-muted-foreground ml-1.5">/ day ({summary.remainingDaysInMonth}d left)</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground font-mono tabular-nums mt-1">
            {budgetBase > 0 ? (
              <>
                Safe monthly buffer: <span className="font-semibold text-foreground">{formatINR(summary.safeToSpendMonthly)}</span> after bills &amp; SIPs
              </>
            ) : (
              'Spent this month (Set a budget to unlock Safe-to-Spend)'
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenAskAi && (
            <button
              type="button"
              onClick={onOpenAskAi}
              aria-label="Ask My Finances AI"
              className="min-h-[40px] px-2.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-primary flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ask AI</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenBudgetModal}
            className="min-h-[40px] px-3 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{hasBudget ? 'Budgets' : 'Set Budget'}</span>
          </button>
        </div>
      </div>

      {hasBudget && (
        <div className="space-y-1.5">
          <div className="relative h-2.5 w-full rounded-full bg-muted overflow-visible">
            <div style={{ width: `${budgetPct}%` }} className={`h-full rounded-full transition-all duration-300 ${pace.bar}`} />
            <div style={{ left: `${paceLeftPct}%` }} title={`Month elapsed: ${summary.dayOfMonthProgressPct}%`} className="absolute -top-1 -bottom-1 w-0.5 bg-foreground/80 rounded-full z-10" />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono tabular-nums">
            <span>Spent {formatINR(summary.totalSpent)} of {formatINR(summary.monthlyBudget)} ({budgetPct}%)</span>
            <span>Month pace: {summary.dayOfMonthProgressPct}%</span>
          </div>
        </div>
      )}

      <SafeToSpendFormulaBreakdown summary={summary} budgetBase={budgetBase} fixedUnpaidTotal={fixedUnpaidTotal} />
      <SafeToSpendMetricsGrid summary={summary} dueSoonCount={dueSoonCount} dueSoonTotal={dueSoonTotal} onOpenTrackersTab={onOpenTrackersTab} />
    </div>
  );
}
