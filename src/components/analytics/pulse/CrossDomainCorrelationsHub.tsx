'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Brain, Dumbbell, Flame, ShieldAlert, Sparkles } from 'lucide-react';
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard';
import type { LifeOsAnalyticsSnapshot } from '@/lib/analytics/life-os-aggregator';
import { cn } from '@/lib/utils';

interface CrossDomainCorrelationsHubProps {
  snapshot: LifeOsAnalyticsSnapshot;
}

type TriggerFilterKey = 'all' | 'low_sleep' | 'low_energy' | 'missed_workout' | 'negative_mood';

const TRIGGER_FILTERS: Array<{ key: TriggerFilterKey; label: string }> = [
  { key: 'all', label: 'All Triggers' },
  { key: 'low_sleep', label: 'Low Sleep' },
  { key: 'low_energy', label: 'Low Energy' },
  { key: 'missed_workout', label: 'Missed Workout' },
  { key: 'negative_mood', label: 'Mood Dip' },
];

function ComparisonBarRow({
  label,
  amountInr,
  maxAmount,
  toneClass,
  caption,
}: {
  label: string;
  amountInr: number;
  maxAmount: number;
  toneClass: string;
  caption?: string;
}) {
  const widthPct = maxAmount > 0 ? Math.min(100, Math.max(4, Math.round((amountInr / maxAmount) * 100))) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground truncate">{label}</span>
        <span className="font-semibold text-foreground tabular-nums shrink-0">
          ₹{Math.round(amountInr).toLocaleString('en-IN')}/day
          {caption ? <span className="text-muted-foreground font-normal"> · {caption}</span> : null}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', toneClass)} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

function computeActiveTriggerMetric(
  triggers: LifeOsAnalyticsSnapshot['intelligence']['report']['triggers'],
  triggerFilter: TriggerFilterKey
) {
  if (triggerFilter === 'all') {
    return {
      label: triggers.topTriggerLabel || 'Combined Trigger Days',
      triggerDays: triggers.triggerDaysCount,
      nonTriggerDays: triggers.nonTriggerDaysCount,
      triggerAvg: triggers.triggerAvgDailySpendInr,
      baselineAvg: triggers.baselineAvgDailySpendInr,
      multiplier: triggers.overallSpendMultiplier,
    };
  }
  const bucket = triggers.buckets.find((b) => b.key === triggerFilter);
  return {
    label: bucket?.label || 'Trigger Days',
    triggerDays: bucket?.triggerDaysCount ?? 0,
    nonTriggerDays: bucket?.nonTriggerDaysCount ?? 0,
    triggerAvg: bucket?.triggerAvgDailySpendInr ?? 0,
    baselineAvg: bucket?.baselineAvgDailySpendInr ?? 0,
    multiplier: bucket?.spendMultiplier ?? null,
  };
}

function MoodTriggerSpendCard(props: {
  triggers: LifeOsAnalyticsSnapshot['intelligence']['report']['triggers'];
  triggerFilter: TriggerFilterKey;
  onSelectFilter: (key: TriggerFilterKey) => void;
}) {
  const { triggers, triggerFilter, onSelectFilter } = props;
  const active = useMemo(
    () => computeActiveTriggerMetric(triggers, triggerFilter),
    [triggers, triggerFilter]
  );
  const hasData = active.triggerDays > 0 || active.nonTriggerDays > 0;
  const triggerMax = Math.max(active.triggerAvg, active.baselineAvg, 1);

  return (
    <AnalyticsChartCard
      title="Mood & Recovery → Junk Spend"
      subtitle="30-day trigger vs calm-baseline discretionary spend"
      badge={
        active.multiplier !== null ? (
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums',
              active.multiplier >= 1.5
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
            )}
          >
            {active.multiplier.toFixed(1)}× spend
          </span>
        ) : null
      }
      headerRight={<Brain className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
      isEmpty={!hasData}
      emptyTitle="No trigger spend patterns yet"
      emptyDescription="Track mood, sleep, or food expenses to detect emotional & fatigue spending."
      emptyActionLabel="Log Mood or Spend"
      emptyActionHref="/finance"
    >
      <div className="space-y-3.5">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {TRIGGER_FILTERS.map((f) => {
            const isSelected = triggerFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectFilter(f.key)}
                className={cn(
                  'flex-none rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors border',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                    : 'bg-muted/35 text-muted-foreground border-border/70 hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-2.5">
          <ComparisonBarRow label={active.label} amountInr={active.triggerAvg} maxAmount={triggerMax} toneClass="bg-amber-500" caption={`${active.triggerDays}d`} />
          <ComparisonBarRow label="Calm / Baseline Days" amountInr={active.baselineAvg} maxAmount={triggerMax} toneClass="bg-emerald-500" caption={`${active.nonTriggerDays}d`} />
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/35 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {active.multiplier !== null && active.multiplier >= 1.4
              ? 'Tip: pause before Swiggy/Zomato on low-sleep or stress days.'
              : 'Your discretionary spend stays resilient across triggers.'}
          </span>
          <Link href="/finance" className="inline-flex items-center gap-1 font-medium text-primary hover:underline shrink-0">
            <span>Audit</span>
            <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </AnalyticsChartCard>
  );
}

function HabitDisciplineSpendCard({
  habitSpendCorrelation,
  windowLabel,
}: {
  habitSpendCorrelation: LifeOsAnalyticsSnapshot['intelligence']['habitSpendCorrelation'];
  windowLabel: string;
}) {
  const maxVal = Math.max(habitSpendCorrelation.highHabitAvgSpendInr, habitSpendCorrelation.lowHabitAvgSpendInr, 1);
  const delta = habitSpendCorrelation.dailySavingsDeltaInr;

  return (
    <AnalyticsChartCard
      title="Habit Discipline → Daily Outflow"
      subtitle={`Comparing ≥70% habit days vs <70% days (${windowLabel})`}
      badge={
        habitSpendCorrelation.hasEnoughData && delta !== 0 ? (
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums',
              delta > 0 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
            )}
          >
            {delta > 0 ? `Save ₹${delta.toLocaleString('en-IN')}/d` : `+₹${Math.abs(delta).toLocaleString('en-IN')}/d`}
          </span>
        ) : null
      }
      headerRight={<Flame className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
      isEmpty={!habitSpendCorrelation.hasEnoughData}
      emptyTitle="Need 2+ high & low habit days"
      emptyDescription="Complete habits and log expenses across at least 4 days in this window to compare outflow."
    >
      <div className="space-y-3">
        <ComparisonBarRow label="High-Habit Days (≥70%)" amountInr={habitSpendCorrelation.highHabitAvgSpendInr} maxAmount={maxVal} toneClass="bg-emerald-500" caption={`${habitSpendCorrelation.highHabitDaysCount}d`} />
        <ComparisonBarRow label="Low-Habit Days (<70%)" amountInr={habitSpendCorrelation.lowHabitAvgSpendInr} maxAmount={maxVal} toneClass="bg-rose-500" caption={`${habitSpendCorrelation.lowHabitDaysCount}d`} />
        <div className="rounded-xl bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
          {delta > 0
            ? `You spend ₹${delta.toLocaleString('en-IN')}/day less on days when you hit at least 70% of your habits.`
            : 'High-routine days currently track close to or slightly above baseline outflow—check recurring bills on routine days.'}
        </div>
      </div>
    </AnalyticsChartCard>
  );
}

function WalletWaistlineCard({
  walletWaistline,
  suggestedSwap,
}: {
  walletWaistline: LifeOsAnalyticsSnapshot['intelligence']['report']['walletWaistline'];
  suggestedSwap?: string;
}) {
  const hasData = walletWaistline.spend30dInr > 0 || walletWaistline.emptyKcal30d > 0;
  return (
    <AnalyticsChartCard
      title="Wallet × Waistline Guard"
      subtitle="30-day junk & delivery leakage translated into fat-loss drag"
      badge={
        walletWaistline.spend30dInr > 0 ? (
          <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300 tabular-nums">
            {walletWaistline.fatLossDragKg30d.toFixed(1)} kg drag
          </span>
        ) : null
      }
      headerRight={<ShieldAlert className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
      isEmpty={!hasData}
      emptyTitle="Clean fuel & zero junk leakage"
      emptyDescription="No junk meals or junk delivery transactions logged in the last 30 days."
      emptyActionLabel="Log Meal"
      emptyActionHref="/fitness"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/35 p-3">
          <div>
            <p className="text-[11px] text-muted-foreground">30d Junk Spend</p>
            <p className="text-sm sm:text-base font-bold text-foreground tabular-nums">₹{Math.round(walletWaistline.spend30dInr).toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Empty Kcal</p>
            <p className="text-sm sm:text-base font-bold text-foreground tabular-nums">{Math.round(walletWaistline.emptyKcal30d).toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">70% Cut Saves</p>
            <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">₹{Math.round(walletWaistline.savings70PctMonthlyInr).toLocaleString('en-IN')}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground truncate">
            {walletWaistline.topJunkMerchant ? `Top leak: ${walletWaistline.topJunkMerchant}` : suggestedSwap || 'Keep home-cooked protein anchored.'}
          </span>
          <Link href="/fitness" className="inline-flex items-center gap-1 font-medium text-primary hover:underline shrink-0">
            <span>Fuel Log</span>
            <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </AnalyticsChartCard>
  );
}

function GymSupplementRoiCard({
  gymSupplementRoi,
  lowStockCount,
}: {
  gymSupplementRoi: LifeOsAnalyticsSnapshot['intelligence']['report']['gymSupplementRoi'];
  lowStockCount: number;
}) {
  const hasData =
    gymSupplementRoi.workouts30dCount > 0 ||
    gymSupplementRoi.combinedMonthlyFitnessSpendInr > 0 ||
    gymSupplementRoi.supplementBreakdown.length > 0;

  return (
    <AnalyticsChartCard
      title="Gym & Supplement ROI"
      subtitle="Cost per session and ₹ per 25g bioavailable protein"
      badge={
        gymSupplementRoi.gymRoiGrade !== 'N/A' ? (
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            ROI {gymSupplementRoi.gymRoiGrade}
          </span>
        ) : null
      }
      headerRight={<Dumbbell className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
      isEmpty={!hasData}
      emptyTitle="No workouts or supplements tracked"
      emptyDescription="Log gym sessions or add whey/creatine in Supplements to compute your unit economics."
      emptyActionLabel="Open Supplements"
      emptyActionHref="/fitness?tab=supplements"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/35 p-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Cost / Workout</p>
            <p className="text-sm sm:text-base font-bold text-foreground tabular-nums">
              {gymSupplementRoi.totalFitnessCostPerWorkoutInr !== null ? `₹${Math.round(gymSupplementRoi.totalFitnessCostPerWorkoutInr).toLocaleString('en-IN')}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">30d Sessions</p>
            <p className="text-sm sm:text-base font-bold text-foreground tabular-nums">
              {gymSupplementRoi.workouts30dCount}/{gymSupplementRoi.targetWorkoutsAt4PerWeek}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">₹ / 25g Protein</p>
            <p className="text-sm sm:text-base font-bold text-foreground tabular-nums">
              {gymSupplementRoi.primaryCostPer25gProteinInr !== null ? `₹${Math.round(gymSupplementRoi.primaryCostPer25gProteinInr)}` : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground truncate">
            {gymSupplementRoi.primaryProteinName
              ? `${gymSupplementRoi.primaryProteinName} (Grade ${gymSupplementRoi.primaryProteinGrade})`
              : `${lowStockCount} low-stock item(s)`}
          </span>
          <Link href="/fitness?tab=supplements" className="inline-flex items-center gap-1 font-medium text-primary hover:underline shrink-0">
            <span>Inspect ROI</span>
            <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </AnalyticsChartCard>
  );
}

function CrossDomainCorrelationsHubInner({ snapshot }: CrossDomainCorrelationsHubProps) {
  const { modules, intelligence } = snapshot;
  const { report, habitSpendCorrelation } = intelligence;
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilterKey>('all');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">Life OS Correlations Hub</h2>
          <p className="text-xs text-muted-foreground">
            How mood, sleep, habit discipline &amp; food choices impact your wallet and waistline
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
        {modules.showFinance && (
          <>
            <MoodTriggerSpendCard triggers={report.triggers} triggerFilter={triggerFilter} onSelectFilter={setTriggerFilter} />
            <HabitDisciplineSpendCard habitSpendCorrelation={habitSpendCorrelation} windowLabel={snapshot.window.label} />
          </>
        )}

        {modules.showFinance && modules.showFitness && (
          <WalletWaistlineCard walletWaistline={report.walletWaistline} suggestedSwap={report.socialSpendDiet.suggestedSwaps[0]} />
        )}

        {modules.showFitness && (
          <GymSupplementRoiCard gymSupplementRoi={report.gymSupplementRoi} lowStockCount={snapshot.fitness.supplementRoi.lowStockItems.length} />
        )}

        {!modules.showFinance && !modules.showFitness && (
          <AnalyticsChartCard
            title="Habit & Mood Pulse"
            subtitle="Cross-domain Finance & Fitness modules are currently turned off in Settings"
            headerRight={<Sparkles className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
          >
            <div className="rounded-xl bg-muted/35 p-3.5 text-xs text-muted-foreground flex items-center justify-between gap-3">
              <span>
                Average mood in {snapshot.window.label}:{' '}
                <strong className="text-foreground tabular-nums">
                  {snapshot.habits.avgMoodScore !== null ? `${snapshot.habits.avgMoodScore}/5` : 'Not logged'}
                </strong>
              </span>
              <Link href="/settings" className="font-medium text-primary hover:underline shrink-0">Manage Modules</Link>
            </div>
          </AnalyticsChartCard>
        )}
      </div>
    </div>
  );
}

export const CrossDomainCorrelationsHub = React.memo(CrossDomainCorrelationsHubInner);
