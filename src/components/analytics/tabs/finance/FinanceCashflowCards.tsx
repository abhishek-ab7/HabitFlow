'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard';
import { AnalyticsChartTooltip } from '@/components/analytics/shared/AnalyticsChartTooltip';
import { formatCompactINR } from '@/lib/analytics/finance-analytics-helpers';
import { formatHumanDate } from '@/lib/date-format';
import { formatINR } from '@/lib/stores/finance-store';
import { cn } from '@/lib/utils';
import type { AnalyticsTabProps } from '../types';
import { ModeToggleGroup } from './FinanceBreakdownCards';

const CHART_MARGIN = { top: 8, right: 10, left: -12, bottom: 2 };

function CashflowBurnChart({ data }: { data: AnalyticsTabProps['snapshot']['finance']['dailyCashflow'] }) {
  return (
    <div className="h-[220px] sm:h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%" debounce={150}>
        <BarChart data={data} margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.65} vertical={false} />
          <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatCompactINR} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
          <Tooltip content={<AnalyticsChartTooltip valueFormatter={(val) => formatINR(val)} />} />
          <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="expense" name="Expense" fill="#0ea5e9" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RunwayForecastChart({ forecast30d }: { forecast30d: AnalyticsTabProps['snapshot']['finance']['forecast30d'] }) {
  return (
    <div className="space-y-3">
      <div className="h-[210px] sm:h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%" debounce={150}>
          <AreaChart data={forecast30d.points} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.65} vertical={false} />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatCompactINR} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
            <Tooltip content={<AnalyticsChartTooltip valueFormatter={(val) => formatINR(val)} />} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="projectedBalance" name="Projected Cash" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.14} strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/35 px-3 py-2 text-xs">
        <span className="text-muted-foreground tabular-nums">
          End of 30d: <strong className="text-foreground">{formatINR(forecast30d.endingProjectedBalance)}</strong>
        </span>
        <span className={cn('font-medium tabular-nums', forecast30d.crunchDate ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
          {forecast30d.crunchDate
            ? `Crunch risk on ${formatHumanDate(forecast30d.crunchDate)}`
            : `Low point ${formatINR(forecast30d.lowestProjectedBalance)}`}
        </span>
      </div>
    </div>
  );
}

export function CashflowTrajectoryCard({
  finance,
  dateSpanLabel,
  cashflowMode,
  onModeChange,
}: {
  finance: AnalyticsTabProps['snapshot']['finance'];
  dateSpanLabel: string;
  cashflowMode: 'burn' | 'runway';
  onModeChange: (m: 'burn' | 'runway') => void;
}) {
  const hasCashflowSignal = useMemo(
    () => finance.dailyCashflow.some((d) => d.income > 0 || d.expense > 0),
    [finance.dailyCashflow]
  );

  return (
    <AnalyticsChartCard
      title={cashflowMode === 'burn' ? 'Cashflow & Daily Burn' : '30-Day Liquid Runway'}
      subtitle={
        cashflowMode === 'burn'
          ? `Income vs expense across ${dateSpanLabel}`
          : `Projected liquid balance from ${formatINR(finance.forecast30d.startingLiquidBalance)} starting cash`
      }
      headerRight={
        <ModeToggleGroup
          ariaLabel="Finance trajectory mode"
          value={cashflowMode}
          options={[{ key: 'burn', label: 'Daily Flow' }, { key: 'runway', label: '30D Runway' }]}
          onChange={onModeChange}
        />
      }
      isEmpty={cashflowMode === 'burn' ? !hasCashflowSignal : finance.forecast30d.points.length === 0}
      emptyTitle="No cashflow activity recorded yet"
      emptyDescription="Add accounts, income, or expense transactions to project cash burn and 30-day runway."
      emptyActionLabel="Open Finance"
      emptyActionHref="/finance"
    >
      {cashflowMode === 'burn' ? (
        <CashflowBurnChart data={finance.dailyCashflow} />
      ) : (
        <RunwayForecastChart forecast30d={finance.forecast30d} />
      )}
    </AnalyticsChartCard>
  );
}
