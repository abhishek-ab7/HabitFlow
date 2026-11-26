'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Beef,
  Dumbbell,
  Flame,
  Footprints,
  Moon,
  Pill,
  Scale,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard';
import { AnalyticsChartTooltip } from '@/components/analytics/shared/AnalyticsChartTooltip';
import { AnalyticsKpiGrid, type AnalyticsKpiItem } from '@/components/analytics/shared/AnalyticsKpiGrid';
import { formatHumanDate } from '@/lib/date-format';
import { cn } from '@/lib/utils';
import type { AnalyticsTabProps } from './types';

const CHART_MARGIN = { top: 8, right: 10, left: -16, bottom: 2 };

function buildFitnessKpiItems(fitness: AnalyticsTabProps['snapshot']['fitness']): AnalyticsKpiItem[] {
  const weightVal =
    fitness.latestRollingAvgKg !== null
      ? `${fitness.latestRollingAvgKg.toFixed(1)} kg`
      : fitness.latestWeightKg !== null
        ? `${fitness.latestWeightKg.toFixed(1)} kg`
        : '—';
  const weightDelta =
    fitness.weeklyWeightDeltaKg !== null
      ? `${fitness.weeklyWeightDeltaKg > 0 ? '+' : ''}${fitness.weeklyWeightDeltaKg.toFixed(1)} kg/wk`
      : 'Log weigh-ins';

  return [
    {
      id: 'fitness-weight',
      label: '7D Rolling Weight',
      value: weightVal,
      deltaText: weightDelta,
      deltaTone: 'neutral',
      subtitle: fitness.latestWaistInches !== null ? `Waist ${fitness.latestWaistInches.toFixed(1)}"` : undefined,
      icon: <Scale className="w-4 h-4" />,
    },
    {
      id: 'fitness-protein',
      label: 'Avg Protein (Big 2)',
      value: `${fitness.avgProteinG}g`,
      deltaText: `${fitness.proteinAdherencePct}% of ${fitness.proteinTargetG}g`,
      deltaTone: fitness.proteinAdherencePct >= 85 ? 'positive' : 'neutral',
      subtitle: `${fitness.avgCalories.toLocaleString('en-IN')} kcal/d`,
      icon: <Beef className="w-4 h-4" />,
    },
    {
      id: 'fitness-workouts',
      label: 'Workouts & Steps',
      value: `${fitness.workoutCount}`,
      deltaText:
        fitness.avgSteps > 0 ? `${fitness.avgSteps.toLocaleString('en-IN')} avg steps` : `${fitness.totalWorkoutMinutes} min`,
      deltaTone: fitness.workoutCount > 0 ? 'positive' : 'neutral',
      subtitle: `${fitness.totalVolumeKg.toLocaleString('en-IN')} kg vol`,
      icon: <Dumbbell className="w-4 h-4" />,
    },
    {
      id: 'fitness-recovery',
      label: 'Sleep & Clean Streak',
      value: fitness.avgSleepHours !== null ? `${fitness.avgSleepHours}h` : '—',
      deltaText: `${fitness.junkFreeStreakDays}d junk-free`,
      deltaTone: fitness.junkFreeStreakDays >= 3 ? 'positive' : 'neutral',
      subtitle: fitness.avgEnergyLevel !== null ? `Energy ${fitness.avgEnergyLevel}/5` : undefined,
      icon: <Moon className="w-4 h-4" />,
    },
  ];
}

function FitnessMetricToggle<T extends string>(props: {
  ariaLabel: string;
  value: T;
  options: Array<{ key: T; label: string }>;
  onChange: (val: T) => void;
}) {
  return (
    <div role="group" aria-label={props.ariaLabel} className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-[11px]">
      {props.options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          aria-pressed={props.value === opt.key}
          onClick={() => props.onChange(opt.key)}
          className={cn(
            'rounded-md px-2 py-1 font-medium transition-colors',
            props.value === opt.key ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function getBodyCompositionSubtitle(
  fitness: AnalyticsTabProps['snapshot']['fitness'],
  bodyMetric: 'weight' | 'waist'
): string {
  if (bodyMetric === 'weight') {
    return fitness.latestRollingAvgKg !== null
      ? `Latest avg ${fitness.latestRollingAvgKg.toFixed(1)} kg · smooths daily water noise`
      : 'Smoothed 7-day average vs raw weigh-ins';
  }
  if (fitness.latestWaistInches === null) return 'Weekly waist circumference check-ins';
  const deltaPart =
    fitness.totalWaistDeltaInches !== null
      ? ` (${fitness.totalWaistDeltaInches > 0 ? '+' : ''}${fitness.totalWaistDeltaInches.toFixed(1)}" vs start)`
      : '';
  return `Current ${fitness.latestWaistInches.toFixed(1)}"${deltaPart}`;
}

function BodyCompositionChart({
  bodyMetric,
  weightChartData,
  waistChartData,
}: {
  bodyMetric: 'weight' | 'waist';
  weightChartData: Array<Record<string, unknown>>;
  waistChartData: Array<Record<string, unknown>>;
}) {
  if (bodyMetric === 'weight') {
    return (
      <LineChart data={weightChartData} margin={CHART_MARGIN}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.65} vertical={false} />
        <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
        <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `${v}kg`} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
        <Tooltip content={<AnalyticsChartTooltip valueFormatter={(v) => `${v.toFixed(1)} kg`} />} />
        <Line type="monotone" dataKey="weightKg" name="Daily Scale" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="rolling7DayAvg" name="7D Rolling Avg" stroke="#f97316" strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    );
  }

  return (
    <LineChart data={waistChartData} margin={CHART_MARGIN}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.65} vertical={false} />
      <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
      <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `${v}"`} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
      <Tooltip content={<AnalyticsChartTooltip valueFormatter={(v) => `${v.toFixed(1)}"`} />} />
      <Line type="monotone" dataKey="waistInches" name="Waist" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
    </LineChart>
  );
}

function BodyCompositionCard({
  fitness,
  bodyMetric,
  onMetricChange,
}: {
  fitness: AnalyticsTabProps['snapshot']['fitness'];
  bodyMetric: 'weight' | 'waist';
  onMetricChange: (m: 'weight' | 'waist') => void;
}) {
  const weightChartData = useMemo(
    () => fitness.rollingWeight.points.map((pt) => ({ ...pt, label: formatHumanDate(pt.date) })),
    [fitness.rollingWeight.points]
  );
  const waistChartData = useMemo(
    () => fitness.waistTrend.points.map((pt) => ({ ...pt, label: formatHumanDate(pt.date) })),
    [fitness.waistTrend.points]
  );

  return (
    <AnalyticsChartCard
      title={bodyMetric === 'weight' ? 'Weight & 7D Rolling Average' : 'Weekly Waist Trend'}
      subtitle={getBodyCompositionSubtitle(fitness, bodyMetric)}
      headerRight={
        <FitnessMetricToggle
          ariaLabel="Body metric view"
          value={bodyMetric}
          options={[{ key: 'weight', label: 'Weight' }, { key: 'waist', label: 'Waist' }]}
          onChange={onMetricChange}
        />
      }
      isEmpty={bodyMetric === 'weight' ? weightChartData.length < 2 : waistChartData.length < 2}
      emptyTitle={bodyMetric === 'weight' ? 'Need 2+ weigh-ins for trend' : 'Need 2+ waist logs'}
      emptyDescription="Log body check-ins on the Fitness page to reveal true recomposition direction."
      emptyActionLabel="Log Body Check-in"
      emptyActionHref="/fitness"
    >
      <div className="h-[215px] sm:h-[245px] w-full">
        <ResponsiveContainer width="100%" height="100%" debounce={150}>
          <BodyCompositionChart
            bodyMetric={bodyMetric}
            weightChartData={weightChartData}
            waistChartData={waistChartData}
          />
        </ResponsiveContainer>
      </div>
    </AnalyticsChartCard>
  );
}

function FuelAdherenceCard({
  fitness,
  windowLabel,
  fuelMetric,
  onMetricChange,
}: {
  fitness: AnalyticsTabProps['snapshot']['fitness'];
  windowLabel: string;
  fuelMetric: 'protein' | 'calories';
  onMetricChange: (m: 'protein' | 'calories') => void;
}) {
  const hasMealSignal = useMemo(
    () => fitness.dailyFuelSeries.some((d) => d.calories > 0 || d.proteinG > 0),
    [fitness.dailyFuelSeries]
  );
  const isProtein = fuelMetric === 'protein';

  return (
    <AnalyticsChartCard
      title="Big 2: Protein & Calorie Adherence"
      subtitle={`Avg ${fitness.avgProteinG}g P · ${fitness.avgCalories.toLocaleString('en-IN')} kcal (${windowLabel})`}
      badge={
        fitness.junkFreeStreakDays > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
            <Flame className="w-3 h-3" aria-hidden="true" />
            {fitness.junkFreeStreakDays}d clean
          </span>
        ) : null
      }
      headerRight={
        <FitnessMetricToggle
          ariaLabel="Fuel metric view"
          value={fuelMetric}
          options={[{ key: 'protein', label: 'Protein' }, { key: 'calories', label: 'Calories' }]}
          onChange={onMetricChange}
        />
      }
      isEmpty={!hasMealSignal}
      emptyTitle="No meals logged in this window"
      emptyDescription="Use 1-Tap Indian Staples or Meal Log on Fitness to track daily calories & protein."
      emptyActionLabel="Log Meal"
      emptyActionHref="/fitness"
    >
      <div className="h-[215px] sm:h-[245px] w-full">
        <ResponsiveContainer width="100%" height="100%" debounce={150}>
          <BarChart data={fitness.dailyFuelSeries} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.65} vertical={false} />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => (isProtein ? `${v}g` : `${v}`)} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
            <Tooltip
              content={
                <AnalyticsChartTooltip
                  valueFormatter={(val) => (isProtein ? `${Math.round(val)} g` : `${Math.round(val).toLocaleString('en-IN')} kcal`)}
                />
              }
            />
            <ReferenceLine y={isProtein ? fitness.proteinTargetG : fitness.calorieTarget} stroke="#10b981" strokeDasharray="4 4" />
            <Bar dataKey={isProtein ? 'proteinG' : 'calories'} name={isProtein ? 'Protein' : 'Calories'} fill={isProtein ? '#10b981' : '#f97316'} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AnalyticsChartCard>
  );
}

function WorkoutSplitCard({ fitness }: { fitness: AnalyticsTabProps['snapshot']['fitness'] }) {
  return (
    <AnalyticsChartCard
      title="Gym Split & Progressive Overload"
      subtitle={`${fitness.workoutCount} sessions · ${fitness.totalWorkoutMinutes} min · ${fitness.totalVolumeKg.toLocaleString('en-IN')} kg volume`}
      isEmpty={fitness.workoutCount === 0 && fitness.overloadHints.length === 0}
      emptyTitle="No workouts logged in this range"
      emptyDescription="Log strength or cardio workouts to unlock split breakdowns and next-session overload targets."
      emptyActionLabel="Log Workout"
      emptyActionHref="/fitness?tab=workouts"
    >
      <div className="space-y-3">
        {fitness.workoutTypeBreakdown.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {fitness.workoutTypeBreakdown.map((split) => (
              <span
                key={split.type}
                className="rounded-lg bg-muted/45 border border-border/60 px-2.5 py-1 text-xs font-medium text-foreground capitalize tabular-nums"
              >
                {split.type.replace('_', ' ')} · {split.count} ({split.minutes}m)
              </span>
            ))}
          </div>
        )}

        {fitness.overloadHints.length > 0 && (
          <div className="space-y-2">
            {fitness.overloadHints.map((hint) => (
              <div
                key={hint.exerciseName}
                className="flex items-center justify-between gap-2 rounded-xl bg-muted/35 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{hint.exerciseName}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    Last: {hint.lastTopWeightKg}kg × {hint.lastTopReps}
                  </p>
                </div>
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums shrink-0">
                  Next: {hint.recommendedWeightKg}kg × {hint.recommendedReps}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AnalyticsChartCard>
  );
}

function StepsRecoveryCard({
  fitness,
  hasStepsOrSleep,
}: {
  fitness: AnalyticsTabProps['snapshot']['fitness'];
  hasStepsOrSleep: boolean;
}) {
  return (
    <AnalyticsChartCard
      title="Daily Steps & Recovery"
      subtitle={`Avg ${fitness.avgSteps.toLocaleString('en-IN')} steps (target ${fitness.stepsTarget.toLocaleString('en-IN')}) · ${fitness.avgSleepHours !== null ? `${fitness.avgSleepHours}h sleep` : 'Sleep not logged'}`}
      headerRight={<Footprints className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
      isEmpty={!hasStepsOrSleep}
      emptyTitle="No steps or sleep recovery logs yet"
      emptyDescription="Track daily step count and sleep duration to spot recovery dips."
      emptyActionLabel="Open Fitness"
      emptyActionHref="/fitness"
    >
      <div className="h-[210px] sm:h-[230px] w-full">
        <ResponsiveContainer width="100%" height="100%" debounce={150}>
          <BarChart data={fitness.dailyFuelSeries} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.65} vertical={false} />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
            <Tooltip content={<AnalyticsChartTooltip valueFormatter={(val) => `${Math.round(val).toLocaleString('en-IN')} steps`} />} />
            <ReferenceLine y={fitness.stepsTarget} stroke="#0ea5e9" strokeDasharray="4 4" />
            <Bar dataKey="steps" name="Steps" fill="#0ea5e9" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AnalyticsChartCard>
  );
}

function SupplementInventoryCard({
  fitness,
  primaryProteinGrade,
}: {
  fitness: AnalyticsTabProps['snapshot']['fitness'];
  primaryProteinGrade: string;
}) {
  return (
    <AnalyticsChartCard
      title="Supplement Stock & Protein Economics"
      subtitle={`Monthly amortized ₹${Math.round(fitness.supplementRoi.totalMonthlySpendInr).toLocaleString('en-IN')} · ${fitness.supplementRoi.lowStockItems.length} low-stock item(s)`}
      badge={
        primaryProteinGrade !== 'N/A' ? (
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            Protein Grade {primaryProteinGrade}
          </span>
        ) : null
      }
      headerRight={<Pill className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
      isEmpty={fitness.supplementRoi.items.length === 0}
      emptyTitle="No supplements in inventory"
      emptyDescription="Add whey isolate, creatine, or micronutrients in Supplements to monitor adherence & ₹/25g protein."
      emptyActionLabel="Add Supplement"
      emptyActionHref="/fitness?tab=supplements"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {fitness.supplementRoi.items.slice(0, 6).map((item) => (
            <div
              key={item.supplement.id}
              className="rounded-xl bg-muted/35 p-3 space-y-1.5 border border-border/50"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-foreground truncate">
                  {item.supplement.name}
                </span>
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shrink-0',
                    item.isLowStock
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                      : 'bg-background text-muted-foreground border border-border/60'
                  )}
                >
                  {item.daysRemaining !== null ? `${item.daysRemaining}d left` : `${item.derivedRemainingServings} left`}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>Adherence {item.adherence30dPct}%</span>
                <span>
                  {item.costPer25gProteinInr !== null
                    ? `₹${Math.round(item.costPer25gProteinInr)}/25g P`
                    : `₹${Math.round(item.costPerServingInr)}/srv`}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Link
            href="/fitness?tab=supplements"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <span>Manage Supplement Inventory</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </AnalyticsChartCard>
  );
}

function FitnessAnalyticsTabInner({ snapshot }: AnalyticsTabProps) {
  const { fitness, intelligence } = snapshot;
  const [bodyMetric, setBodyMetric] = useState<'weight' | 'waist'>('weight');
  const [fuelMetric, setFuelMetric] = useState<'protein' | 'calories'>('protein');

  const kpiItems = useMemo(() => buildFitnessKpiItems(fitness), [fitness]);
  const hasStepsOrSleep = useMemo(
    () => fitness.dailyFuelSeries.some((d) => d.steps > 0 || (d.sleepHours ?? 0) > 0),
    [fitness.dailyFuelSeries]
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <AnalyticsKpiGrid items={kpiItems} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BodyCompositionCard fitness={fitness} bodyMetric={bodyMetric} onMetricChange={setBodyMetric} />
        <FuelAdherenceCard fitness={fitness} windowLabel={snapshot.window.label} fuelMetric={fuelMetric} onMetricChange={setFuelMetric} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WorkoutSplitCard fitness={fitness} />
        <StepsRecoveryCard fitness={fitness} hasStepsOrSleep={hasStepsOrSleep} />
      </div>

      <SupplementInventoryCard
        fitness={fitness}
        primaryProteinGrade={intelligence.report.gymSupplementRoi.primaryProteinGrade}
      />
    </div>
  );
}

export default React.memo(FitnessAnalyticsTabInner);
