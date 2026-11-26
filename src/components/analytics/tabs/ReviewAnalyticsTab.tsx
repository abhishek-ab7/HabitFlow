'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Award,
  CheckCircle2,
  Flame,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { YearInReview } from '@/components/analytics/YearInReview';
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard';
import { AnalyticsKpiGrid, type AnalyticsKpiItem } from '@/components/analytics/shared/AnalyticsKpiGrid';
import { useLifeOsAnalytics } from '@/lib/analytics/use-life-os-analytics';
import { formatINR } from '@/lib/stores/finance-store';
import type { AnalyticsTabProps } from './types';

function buildReviewDigestKpis(snapshot: AnalyticsTabProps['snapshot']): AnalyticsKpiItem[] {
  const { habits, finance, fitness, modules } = snapshot;
  const items: AnalyticsKpiItem[] = [
    {
      id: 'review-score',
      label: 'Life OS Pulse',
      value: `${snapshot.lifeOsScore}/100`,
      deltaText:
        snapshot.lifeOsScoreDelta === 0
          ? 'Steady vs prior'
          : `${snapshot.lifeOsScoreDelta > 0 ? '+' : ''}${snapshot.lifeOsScoreDelta} pts`,
      deltaTone: snapshot.lifeOsScoreDelta > 0 ? 'positive' : snapshot.lifeOsScoreDelta < 0 ? 'negative' : 'neutral',
      subtitle: snapshot.window.label,
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: 'review-habits',
      label: 'Habit Check-ins',
      value: `${habits.periodCompletions}`,
      deltaText: `${habits.completionRatePct}% consistency`,
      deltaTone: habits.completionRatePct >= 75 ? 'positive' : 'neutral',
      subtitle: `${habits.currentBestActiveStreak}d streak`,
      icon: <Flame className="w-4 h-4" />,
    },
  ];

  if (modules.showFinance) {
    items.push({
      id: 'review-finance',
      label: 'Net Saved',
      value: formatINR(finance.netSavings),
      deltaText: `${finance.savingsRatePct}% savings rate`,
      deltaTone: finance.netSavings >= 0 ? 'positive' : 'negative',
      subtitle: `Spent ${formatINR(finance.totalExpense)}`,
      icon: <Wallet className="w-4 h-4" />,
    });
  }

  if (modules.showFitness) {
    items.push({
      id: 'review-fitness',
      label: 'Workouts & Fuel',
      value: `${fitness.workoutCount}`,
      deltaText: `${fitness.avgProteinG}g avg protein`,
      deltaTone: fitness.proteinAdherencePct >= 80 ? 'positive' : 'neutral',
      subtitle: `${fitness.junkFreeStreakDays}d clean streak`,
      icon: <Award className="w-4 h-4" />,
    });
  }

  return items;
}

function resolveTopFocusPrompt(snapshot: AnalyticsTabProps['snapshot']): string {
  const { habits, finance, fitness, modules, intelligence } = snapshot;
  if (intelligence.alerts.length > 0) {
    return intelligence.alerts[0].actionHint || intelligence.alerts[0].description;
  }
  if (modules.showFinance && finance.anomalies.length > 0) {
    return finance.anomalies[0].description;
  }
  if (modules.showFitness && fitness.proteinAdherencePct > 0 && fitness.proteinAdherencePct < 80) {
    return `Protein averaged ${fitness.avgProteinG}g vs ${fitness.proteinTargetG}g target—anchor one 30g protein staple per day.`;
  }
  if (habits.overdueTasksCount > 0) {
    return `Triage ${habits.overdueTasksCount} overdue task(s) before locking in next week's top 3 priorities.`;
  }
  return 'All active pillars are steady—protect your sleep window and morning anchor habits next week.';
}

function DigestPillarCard(props: {
  icon: React.ReactNode;
  title: string;
  score: number;
  summary: string;
  ctaLabel: string;
  onOpen: () => void;
}) {
  const { icon, title, score, summary, ctaLabel, onOpen } = props;
  return (
    <div className="rounded-xl bg-muted/35 border border-border/50 p-3.5 space-y-2 flex flex-col justify-between">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
            {icon}
            {title}
          </span>
          <span className="text-xs font-bold text-foreground tabular-nums">{score}/100</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed tabular-nums">{summary}</p>
      </div>
      <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline self-start">
        <span>{ctaLabel}</span>
        <ArrowRight className="w-3 h-3" aria-hidden="true" />
      </button>
    </div>
  );
}

function ReviewAnalyticsTabInner({ snapshot, onSelectTab }: AnalyticsTabProps) {
  const { snapshot: yearSnapshot } = useLifeOsAnalytics('year', { hydrate: false });
  const { habits, finance, fitness, modules } = snapshot;

  const digestKpis = useMemo(() => buildReviewDigestKpis(snapshot), [snapshot]);
  const topFocusPrompt = useMemo(() => resolveTopFocusPrompt(snapshot), [snapshot]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <AnalyticsKpiGrid items={digestKpis} />

      <AnalyticsChartCard title="Reflection Digest" subtitle={`Cross-domain summary for ${snapshot.window.dateSpanLabel}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DigestPillarCard
              icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />}
              title="Habits & Goals"
              score={habits.score}
              summary={`${habits.periodCompletions} check-ins (${habits.completionRatePct}% adherence), ${habits.completedTasksCount} completed task(s), and ${habits.onTrackGoalsCount}/${habits.activeGoalsCount} goals on track.`}
              ctaLabel="Open Habits"
              onOpen={() => onSelectTab('habits')}
            />

            {modules.showFinance && (
              <DigestPillarCard
                icon={<Wallet className="w-3.5 h-3.5 text-sky-500" aria-hidden="true" />}
                title="Finance"
                score={finance.score}
                summary={`Income ${formatINR(finance.totalIncome)} vs Expense ${formatINR(finance.totalExpense)} (${finance.savingsRatePct}% saved). ${finance.upcomingObligations7d.length} due(s) next 7d.`}
                ctaLabel="Open Finance"
                onOpen={() => onSelectTab('finance')}
              />
            )}

            {modules.showFitness && (
              <DigestPillarCard
                icon={<Activity className="w-3.5 h-3.5 text-orange-500" aria-hidden="true" />}
                title="Fitness & Bio"
                score={fitness.score}
                summary={`${fitness.workoutCount} workout(s), ${fitness.avgProteinG}g avg protein (${fitness.proteinAdherencePct}% target), ${fitness.avgSteps.toLocaleString('en-IN')} avg steps.`}
                ctaLabel="Open Fitness"
                onOpen={() => onSelectTab('fitness')}
              />
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl bg-muted/35 px-3.5 py-2.5 text-xs border border-border/50">
            <div className="space-y-0.5 min-w-0">
              <span className="font-semibold text-foreground">Next Week Focus: </span>
              <span className="text-muted-foreground">{topFocusPrompt}</span>
            </div>
            <Link href="/dashboard" className="inline-flex items-center gap-1 font-medium text-primary hover:underline shrink-0">
              <span>Dashboard</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </AnalyticsChartCard>

      {/* Multi-Domain 2026 Life OS Wrapped */}
      <YearInReview
        financeSummary={{
          enabled: yearSnapshot.modules.showFinance,
          totalIncome: yearSnapshot.finance.totalIncome,
          totalExpense: yearSnapshot.finance.totalExpense,
          totalInvestment: yearSnapshot.finance.totalInvestment,
          savingsRatePct: yearSnapshot.finance.savingsRatePct,
          netWorthInr: yearSnapshot.finance.netWorth.netWorth,
        }}
        fitnessSummary={{
          enabled: yearSnapshot.modules.showFitness,
          workoutCount: yearSnapshot.fitness.workoutCount,
          totalVolumeKg: yearSnapshot.fitness.totalVolumeKg,
          avgProteinG: yearSnapshot.fitness.avgProteinG,
          latestWeightKg: yearSnapshot.fitness.latestWeightKg,
          junkFreeStreakDays: yearSnapshot.fitness.junkFreeStreakDays,
        }}
      />
    </div>
  );
}

export default React.memo(ReviewAnalyticsTabInner);
