'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Sparkles,
} from 'lucide-react';
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard';
import type { AnalyticsTabId } from '@/components/analytics/tabs/types';
import type { LifeOsAnalyticsSnapshot } from '@/lib/analytics/life-os-aggregator';
import { formatHumanDate } from '@/lib/date-format';
import { cn } from '@/lib/utils';

interface PulseActionFeedProps {
  snapshot: LifeOsAnalyticsSnapshot;
  onSelectTab: (tab: AnalyticsTabId) => void;
}

type FeedSeverity = 'critical' | 'warning' | 'positive' | 'info';

interface ActionFeedItem {
  id: string;
  domain: 'Cross-Domain' | 'Habits' | 'Finance' | 'Fitness';
  severity: FeedSeverity;
  title: string;
  description: string;
  metricBadge?: string;
  actionLabel: string;
  tabTarget?: AnalyticsTabId;
  href?: string;
}

const SEVERITY_ORDER: Record<FeedSeverity, number> = {
  critical: 0,
  warning: 1,
  positive: 2,
  info: 3,
};

const SEVERITY_BADGE_CLASSES: Record<FeedSeverity, string> = {
  critical: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  positive: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  info: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
};

function SeverityIcon({ severity }: { severity: FeedSeverity }) {
  if (severity === 'critical' || severity === 'warning') {
    return (
      <AlertTriangle
        className={cn(
          'w-4 h-4 shrink-0 mt-0.5',
          severity === 'critical' ? 'text-rose-500' : 'text-amber-500'
        )}
        aria-hidden="true"
      />
    );
  }
  if (severity === 'positive') {
    return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />;
  }
  return <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" aria-hidden="true" />;
}

function resolveAlertTabTarget(pillar: string): AnalyticsTabId {
  if (pillar === 'gym_supplement_roi') return 'fitness';
  if (pillar === 'trigger_pattern' || pillar === 'wallet_waistline') return 'finance';
  return 'pulse';
}

function buildFinanceActionItems(finance: LifeOsAnalyticsSnapshot['finance']): ActionFeedItem[] {
  const items: ActionFeedItem[] = finance.anomalies.map((anomaly) => ({
    id: `fin-anom-${anomaly.id}`,
    domain: 'Finance',
    severity: anomaly.severity,
    title: anomaly.title,
    description: anomaly.description,
    metricBadge:
      typeof anomaly.amount === 'number' && anomaly.amount > 0
        ? `₹${Math.round(anomaly.amount).toLocaleString('en-IN')}`
        : undefined,
    actionLabel: anomaly.actionLabel || 'Finance Tab',
    tabTarget: 'finance',
  }));

  if (finance.upcomingObligations7d.length > 0) {
    const nextDue = finance.upcomingObligations7d[0];
    items.push({
      id: `fin-due-${nextDue.id}`,
      domain: 'Finance',
      severity: nextDue.isOverdue ? 'critical' : 'warning',
      title: `${nextDue.title} due ${formatHumanDate(nextDue.dueDate)}`,
      description: `${finance.upcomingObligations7d.length} obligation(s) scheduled within 7 days.`,
      metricBadge: `₹${Math.round(nextDue.amount).toLocaleString('en-IN')}`,
      actionLabel: 'View Dues',
      tabTarget: 'finance',
    });
  }

  if (finance.forecast30d.crunchDate) {
    items.push({
      id: 'fin-crunch',
      domain: 'Finance',
      severity: 'critical',
      title: `Cash runway dip projected on ${formatHumanDate(finance.forecast30d.crunchDate)}`,
      description: 'Scheduled bills and trailing burn push liquid cash below ₹0 unless adjusted.',
      actionLabel: 'Check Runway',
      tabTarget: 'finance',
    });
  }
  return items;
}

function buildHabitActionItems(habits: LifeOsAnalyticsSnapshot['habits']): ActionFeedItem[] {
  const items: ActionFeedItem[] = [];
  if (habits.overdueTasksCount > 0) {
    items.push({
      id: 'habits-overdue-tasks',
      domain: 'Habits',
      severity: 'warning',
      title: `${habits.overdueTasksCount} overdue task(s) need triage`,
      description: 'Reschedule or finish stale tasks to keep momentum high.',
      actionLabel: 'Open Tasks',
      href: '/tasks',
    });
  }
  if (habits.activeGoalsCount > 0 && habits.onTrackGoalsCount < habits.activeGoalsCount) {
    const behindCount = habits.activeGoalsCount - habits.onTrackGoalsCount;
    items.push({
      id: 'habits-behind-goals',
      domain: 'Habits',
      severity: 'warning',
      title: `${behindCount} goal(s) pacing behind deadline`,
      description: 'Review milestones in the Habits tab to rebalance weekly pace.',
      actionLabel: 'Habits & Goals',
      tabTarget: 'habits',
    });
  }
  if (habits.completionRatePct >= 80 && habits.currentBestActiveStreak >= 7) {
    items.push({
      id: 'habits-strong-streak',
      domain: 'Habits',
      severity: 'positive',
      title: `${habits.currentBestActiveStreak}-day active streak & ${habits.completionRatePct}% consistency`,
      description: 'Routine execution is compounding cleanly across this window.',
      actionLabel: 'Habits Tab',
      tabTarget: 'habits',
    });
  }
  return items;
}

function buildFitnessActionItems(fitness: LifeOsAnalyticsSnapshot['fitness']): ActionFeedItem[] {
  const items: ActionFeedItem[] = [];
  if (fitness.hasData && fitness.proteinTargetG > 0 && fitness.proteinAdherencePct < 75) {
    const deficit = Math.max(0, fitness.proteinTargetG - fitness.avgProteinG);
    items.push({
      id: 'fitness-protein-gap',
      domain: 'Fitness',
      severity: 'warning',
      title: `Protein averaging ${deficit}g/day below ${fitness.proteinTargetG}g target`,
      description: 'Adding 1 scoop whey or 3 eggs closes most of your daily protein gap.',
      metricBadge: `${fitness.proteinAdherencePct}%`,
      actionLabel: 'Fitness Tab',
      tabTarget: 'fitness',
    });
  }
  if (fitness.supplementRoi.lowStockItems.length > 0) {
    const firstLow = fitness.supplementRoi.lowStockItems[0];
    items.push({
      id: `fit-lowstock-${firstLow.supplement.id}`,
      domain: 'Fitness',
      severity: 'warning',
      title: `${firstLow.supplement.name} running low`,
      description: `${fitness.supplementRoi.lowStockItems.length} supplement(s) nearing restock threshold.`,
      metricBadge: firstLow.daysRemaining !== null ? `${firstLow.daysRemaining}d left` : 'Low stock',
      actionLabel: 'Restock Check',
      href: '/fitness?tab=supplements',
    });
  }
  return items;
}

function buildPrioritizedFeed(snapshot: LifeOsAnalyticsSnapshot): ActionFeedItem[] {
  const { modules, habits, finance, fitness, intelligence } = snapshot;
  const crossItems: ActionFeedItem[] = intelligence.alerts.map((alert) => ({
    id: `cross-${alert.id}`,
    domain: 'Cross-Domain',
    severity: alert.severity,
    title: alert.title,
    description: alert.description,
    metricBadge: alert.metricBadge,
    actionLabel: 'Inspect Pillar',
    tabTarget: resolveAlertTabTarget(alert.pillar),
  }));

  return [
    ...crossItems,
    ...(modules.showFinance ? buildFinanceActionItems(finance) : []),
    ...buildHabitActionItems(habits),
    ...(modules.showFitness ? buildFitnessActionItems(fitness) : []),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function ActionFeedRow({
  item,
  onSelectTab,
}: {
  item: ActionFeedItem;
  onSelectTab: (tab: AnalyticsTabId) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-xl bg-muted/35 border border-border/60 p-3 sm:p-3.5">
      <div className="flex items-start gap-2.5 min-w-0">
        <SeverityIcon severity={item.severity} />
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', SEVERITY_BADGE_CLASSES[item.severity])}>
              {item.domain}
            </span>
            {item.metricBadge && (
              <span className="rounded-md bg-background border border-border/70 px-1.5 py-0.5 text-[10px] font-semibold text-foreground tabular-nums">
                {item.metricBadge}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm font-semibold text-foreground leading-snug">{item.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
        </div>
      </div>

      {item.href ? (
        <Link
          href={item.href}
          className="inline-flex items-center gap-1 self-start sm:self-center shrink-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 transition-colors"
        >
          <span>{item.actionLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      ) : item.tabTarget ? (
        <button
          type="button"
          onClick={() => onSelectTab(item.tabTarget!)}
          className="inline-flex items-center gap-1 self-start sm:self-center shrink-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 transition-colors"
        >
          <span>{item.actionLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function PulseActionFeedInner({ snapshot, onSelectTab }: PulseActionFeedProps) {
  const [expanded, setExpanded] = useState(false);
  const items = useMemo(() => buildPrioritizedFeed(snapshot), [snapshot]);
  const visibleItems = expanded ? items : items.slice(0, 5);

  return (
    <AnalyticsChartCard
      title="Prioritized AI Action Feed"
      subtitle="Highest-leverage actions ranked across all active Life OS modules"
      headerRight={<Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />}
      isEmpty={items.length === 0}
      emptyTitle="Steady sailing across your Life OS"
      emptyDescription="No urgent risk alerts right now. Keep logging daily habits, meals, or transactions."
    >
      <div className="space-y-2.5">
        {visibleItems.map((item) => (
          <ActionFeedRow key={item.id} item={item} onSelectTab={onSelectTab} />
        ))}

        {items.length > 5 && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-muted/25 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <>
                <span>Show top 5 actions</span>
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              </>
            ) : (
              <>
                <span>Show all {items.length} actions</span>
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              </>
            )}
          </button>
        )}
      </div>
    </AnalyticsChartCard>
  );
}

export const PulseActionFeed = React.memo(PulseActionFeedInner);
