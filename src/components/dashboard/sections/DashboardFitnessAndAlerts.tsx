'use client';

import React from 'react';
import Link from 'next/link';
import { BatteryLow, ArrowUpRight, MessageSquareText, AlertCircle, Dumbbell, Droplets, Footprints, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FuelSummaryLike {
  lowEnergyMode?: boolean;
  caloriesRemaining: number;
  caloriesConsumed: number;
  calorieTarget: number;
  proteinConsumedG: number;
  proteinTargetG: number;
  steps: number;
  stepsTarget: number;
  waterMl: number;
  waterTargetMl: number;
  sleepHours?: number | null;
}

export function DashboardFitnessHero(params: {
  todayFuelSummary: FuelSummaryLike;
  onToggleLowEnergy: () => void;
  onAddWater: () => void;
}) {
  const { todayFuelSummary, onToggleLowEnergy, onAddWater } = params;
  const calLabel =
    todayFuelSummary.caloriesRemaining >= 0
      ? `${todayFuelSummary.caloriesRemaining} kcal left`
      : `${Math.abs(todayFuelSummary.caloriesRemaining)} kcal over`;

  return (
    <section className="surface-hero p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span>Body &amp; Fuel Today</span>
              {todayFuelSummary.lowEnergyMode && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 normal-case tracking-normal">
                  Low-Energy Day
                </span>
              )}
            </p>
            <p className="text-sm font-bold text-foreground">
              {calLabel}{' '}
              <span className="text-muted-foreground font-normal">({todayFuelSummary.caloriesConsumed}/{todayFuelSummary.calorieTarget})</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
          <div>
            <span className="text-muted-foreground font-sans block text-[11px]">Protein</span>
            <strong className="text-emerald-600 dark:text-emerald-400 text-sm">{todayFuelSummary.proteinConsumedG}g</strong>
            <span className="text-muted-foreground">/{todayFuelSummary.proteinTargetG}g</span>
          </div>
          <div>
            <span className="text-muted-foreground font-sans flex items-center gap-1 text-[11px]"><Footprints className="w-3 h-3 text-sky-500" /> Steps</span>
            <strong className="text-foreground text-sm">{todayFuelSummary.steps.toLocaleString()}</strong>
            <span className="text-muted-foreground">/{todayFuelSummary.stepsTarget.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground font-sans flex items-center gap-1 text-[11px]"><Droplets className="w-3 h-3 text-sky-500" /> Water</span>
            <strong className="text-foreground text-sm">{todayFuelSummary.waterMl}ml</strong>
            <span className="text-muted-foreground">/{todayFuelSummary.waterTargetMl}ml</span>
          </div>
          {todayFuelSummary.sleepHours != null && (
            <div>
              <span className="text-muted-foreground font-sans block text-[11px]">Sleep</span>
              <strong className="text-foreground text-sm">{todayFuelSummary.sleepHours}h</strong>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button
          type="button" size="sm" variant={todayFuelSummary.lowEnergyMode ? 'default' : 'secondary'}
          data-testid="dashboard-low-energy-toggle" onClick={onToggleLowEnergy}
          className={`h-8 text-xs gap-1 ${todayFuelSummary.lowEnergyMode ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
        >
          <BatteryLow className="w-3.5 h-3.5" />
          {todayFuelSummary.lowEnergyMode ? 'Low-Energy ON' : 'Low-Energy'}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onAddWater} className="h-8 text-xs gap-1">
          <Droplets className="w-3.5 h-3.5 text-sky-500" /> +250ml
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => window.dispatchEvent(new Event('open-quick-capture'))} className="h-8 text-xs gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-500" /> 10s Capture
        </Button>
        <Button size="sm" variant="outline" asChild className="h-8 text-xs gap-1">
          <Link href="/fitness">Open Fitness <ArrowUpRight className="w-3.5 h-3.5" /></Link>
        </Button>
      </div>
    </section>
  );
}

interface CrossDomainAlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  metricBadge: string;
  pillar: string;
}

interface FinanceAnomalyItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  actionLabel: string;
  actionTarget: string;
}

const ALERT_SEVERITY_CLS: Record<'critical' | 'warning' | 'info', string> = {
  critical: 'border-rose-500/30 bg-rose-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  info: 'border-border bg-background/60',
};

export function DashboardDeterministicAlerts(params: {
  crossAlerts: CrossDomainAlertItem[];
  financeAnomalies: FinanceAnomalyItem[];
  isFinanceEnabled: boolean;
  onOpenAskAi: () => void;
  onNavigate: (path: string) => void;
}) {
  const { crossAlerts, financeAnomalies, isFinanceEnabled, onOpenAskAi, onNavigate } = params;
  if (crossAlerts.length === 0 && financeAnomalies.length === 0) return null;

  return (
    <section data-testid="dashboard-deterministic-alerts" aria-label="Life OS Cross-Domain Alerts" className="surface-card p-3.5 sm:p-4 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
            <AlertCircle className="w-3.5 h-3.5" />
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Life OS Signals &amp; Wallet Alerts</h2>
        </div>
        {isFinanceEnabled && (
          <Button type="button" variant="outline" size="sm" onClick={onOpenAskAi} className="h-7 px-2.5 text-[11px] gap-1 rounded-lg">
            <MessageSquareText className="w-3 h-3 text-primary" />
            Ask Life OS
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {crossAlerts.slice(0, 4).map((alert) => (
          <div key={alert.id} className={`rounded-xl border p-3 flex items-start justify-between gap-2.5 text-xs ${ALERT_SEVERITY_CLS[alert.severity]}`}>
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-foreground">{alert.title}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-secondary text-[10px] font-mono text-muted-foreground">{alert.metricBadge}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{alert.description}</p>
            </div>
            <button type="button" onClick={() => onNavigate(alert.pillar === 'gym_supplement_roi' ? '/fitness' : '/analytics')} className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0">
              Inspect <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        ))}
        {financeAnomalies.map((anomaly) => {
          const target = anomaly.actionTarget === 'finance' || anomaly.actionTarget === 'budgets' ? '/finance' : `/finance?tab=${anomaly.actionTarget}`;
          return (
            <div key={anomaly.id} className={`rounded-xl border p-3 flex items-start justify-between gap-2.5 text-xs ${ALERT_SEVERITY_CLS[anomaly.severity]}`}>
              <div className="min-w-0 space-y-0.5">
                <p className="font-semibold text-foreground">{anomaly.title}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{anomaly.description}</p>
              </div>
              <button type="button" onClick={() => onNavigate(target)} className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0">
                {anomaly.actionLabel} <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
