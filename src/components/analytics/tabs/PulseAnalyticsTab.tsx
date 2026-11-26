'use client';

import React, { useMemo } from 'react';
import {
  Activity,
  ArrowRight,
  Flame,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { CrossDomainCorrelationsHub } from '@/components/analytics/pulse/CrossDomainCorrelationsHub';
import { PulseActionFeed } from '@/components/analytics/pulse/PulseActionFeed';
import { cn } from '@/lib/utils';
import type { AnalyticsTabId, AnalyticsTabProps } from './types';

interface PillarSummaryCardData {
  id: AnalyticsTabId;
  title: string;
  weightPct: number;
  score: number;
  accentBarClass: string;
  accentTextClass: string;
  primaryMetricLabel: string;
  primaryMetricValue: string;
  secondaryMetricLabel: string;
  secondaryMetricValue: string;
  icon: React.ReactNode;
}

function getScoreBadgeLabel(score: number): { label: string; className: string } {
  if (score >= 80) {
    return {
      label: 'Peak Alignment',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    };
  }
  if (score >= 60) {
    return {
      label: 'Steady Rhythm',
      className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    };
  }
  if (score > 0) {
    return {
      label: 'Needs Rebalance',
      className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    };
  }
  return {
    label: 'Awaiting Logs',
    className: 'bg-muted text-muted-foreground',
  };
}

function buildPillarSummaryCards(snapshot: AnalyticsTabProps['snapshot']): PillarSummaryCardData[] {
  const { modules, weights, habits, finance, fitness } = snapshot;
  const cards: PillarSummaryCardData[] = [
    {
      id: 'habits',
      title: 'Habits & Goals',
      weightPct: weights.habitsPct,
      score: habits.score,
      accentBarClass: 'bg-emerald-500',
      accentTextClass: 'text-emerald-600 dark:text-emerald-400',
      primaryMetricLabel: 'Consistency',
      primaryMetricValue: `${habits.completionRatePct}%`,
      secondaryMetricLabel: 'Best Streak',
      secondaryMetricValue: `${habits.currentBestActiveStreak}d`,
      icon: <Flame className="w-4 h-4 text-emerald-500" aria-hidden="true" />,
    },
  ];

  if (modules.showFinance) {
    cards.push({
      id: 'finance',
      title: 'Finance',
      weightPct: weights.financePct,
      score: finance.score,
      accentBarClass: 'bg-sky-500',
      accentTextClass: 'text-sky-600 dark:text-sky-400',
      primaryMetricLabel: 'Net Cashflow',
      primaryMetricValue: `₹${finance.netSavings.toLocaleString('en-IN')}`,
      secondaryMetricLabel: 'Savings Rate',
      secondaryMetricValue: `${finance.savingsRatePct}%`,
      icon: <Wallet className="w-4 h-4 text-sky-500" aria-hidden="true" />,
    });
  }

  if (modules.showFitness) {
    cards.push({
      id: 'fitness',
      title: 'Fitness & Bio',
      weightPct: weights.fitnessPct,
      score: fitness.score,
      accentBarClass: 'bg-orange-500',
      accentTextClass: 'text-orange-600 dark:text-orange-400',
      primaryMetricLabel: 'Avg Protein',
      primaryMetricValue: `${fitness.avgProteinG}/${fitness.proteinTargetG}g`,
      secondaryMetricLabel: 'Workouts',
      secondaryMetricValue: `${fitness.workoutCount}`,
      icon: <Activity className="w-4 h-4 text-orange-500" aria-hidden="true" />,
    });
  }
  return cards;
}

function LifeOsBalanceHeroCard({ snapshot }: { snapshot: AnalyticsTabProps['snapshot'] }) {
  const { modules, weights } = snapshot;
  const activeModuleCount = 1 + (modules.showFinance ? 1 : 0) + (modules.showFitness ? 1 : 0);
  const scoreBadge = getScoreBadgeLabel(snapshot.lifeOsScore);
  const deltaPositive = snapshot.lifeOsScoreDelta > 0;
  const deltaNegative = snapshot.lifeOsScoreDelta < 0;
  const deltaClass = deltaPositive
    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    : deltaNegative
      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
      : 'bg-muted text-muted-foreground';

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Life OS Balance Score
            </span>
            <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', scoreBadge.className)}>
              {scoreBadge.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {snapshot.window.dateSpanLabel} · Weighted across {activeModuleCount} active {activeModuleCount === 1 ? 'pillar' : 'pillars'}
          </p>
        </div>

        <div className="flex items-baseline gap-3 self-start sm:self-center">
          <div className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground tabular-nums leading-none">
            {snapshot.lifeOsScore}
            <span className="text-base sm:text-lg font-medium text-muted-foreground">/100</span>
          </div>
          <div className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold tabular-nums', deltaClass)}>
            {deltaPositive && <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />}
            {deltaNegative && <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />}
            <span>
              {snapshot.lifeOsScoreDelta === 0
                ? 'Steady vs prior'
                : `${deltaPositive ? '+' : ''}${snapshot.lifeOsScoreDelta} pts`}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div
          className="h-3 w-full overflow-hidden rounded-full bg-muted flex"
          role="img"
          aria-label={`Pillar weights: Habits ${weights.habitsPct}%${modules.showFinance ? `, Finance ${weights.financePct}%` : ''}${modules.showFitness ? `, Fitness ${weights.fitnessPct}%` : ''}`}
        >
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${weights.habitsPct}%` }} />
          {modules.showFinance && <div className="h-full bg-sky-500 transition-all" style={{ width: `${weights.financePct}%` }} />}
          {modules.showFitness && <div className="h-full bg-orange-500 transition-all" style={{ width: `${weights.fitnessPct}%` }} />}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Habits {weights.habitsPct}%
          </span>
          {modules.showFinance && (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden="true" />
              Finance {weights.financePct}%
            </span>
          )}
          {modules.showFitness && (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden="true" />
              Fitness {weights.fitnessPct}%
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function PillarSummaryButton({
  card,
  onSelectTab,
}: {
  card: PillarSummaryCardData;
  onSelectTab: (tab: AnalyticsTabId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectTab(card.id)}
      className="group rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors flex flex-col justify-between gap-3"
    >
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2 min-w-0">
          {card.icon}
          <span className="text-sm font-semibold text-foreground truncate">{card.title}</span>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors shrink-0">
          <span className={cn('font-bold tabular-nums', card.accentTextClass)}>{card.score}/100</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', card.accentBarClass)} style={{ width: `${Math.max(4, card.score)}%` }} />
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/35 px-3 py-2 w-full">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">{card.primaryMetricLabel}</p>
          <p className="text-sm font-bold text-foreground tabular-nums truncate">{card.primaryMetricValue}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[11px] text-muted-foreground truncate">{card.secondaryMetricLabel}</p>
          <p className="text-sm font-bold text-foreground tabular-nums truncate">{card.secondaryMetricValue}</p>
        </div>
      </div>
    </button>
  );
}

function PulseAnalyticsTabInner({ snapshot, onSelectTab }: AnalyticsTabProps) {
  const pillarCards = useMemo(() => buildPillarSummaryCards(snapshot), [snapshot]);
  const gridColsClass =
    pillarCards.length === 3 ? 'md:grid-cols-3' : pillarCards.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1';

  return (
    <div className="space-y-5 sm:space-y-6">
      <LifeOsBalanceHeroCard snapshot={snapshot} />

      <div className={cn('grid grid-cols-1 gap-3 sm:gap-3.5', gridColsClass)}>
        {pillarCards.map((card) => (
          <PillarSummaryButton key={card.id} card={card} onSelectTab={onSelectTab} />
        ))}
      </div>

      <CrossDomainCorrelationsHub snapshot={snapshot} />
      <PulseActionFeed snapshot={snapshot} onSelectTab={onSelectTab} />
    </div>
  );
}

export default React.memo(PulseAnalyticsTabInner);
