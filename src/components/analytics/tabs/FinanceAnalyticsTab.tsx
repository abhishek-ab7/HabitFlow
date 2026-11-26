'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CreditCard,
  PiggyBank,
  TrendingDown,
  Users,
  Wallet,
} from 'lucide-react';
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
import { AnalyticsKpiGrid, type AnalyticsKpiItem } from '@/components/analytics/shared/AnalyticsKpiGrid';
import {
  OverviewCategoryDonut,
  type OverviewDonutCategoryItem,
} from '@/components/finance/OverviewCategoryDonut';
import { formatHumanDate } from '@/lib/date-format';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinanceCategory } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { AnalyticsTabProps } from './types';

const CHART_MARGIN = { top: 8, right: 10, left: -12, bottom: 2 };

function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs === 0) return '₹0';
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${sign}₹${Math.round(abs)}`;
}

function buildFinanceKpiItems(
  finance: AnalyticsTabProps['snapshot']['finance'],
  windowLabel: string
): AnalyticsKpiItem[] {
  return [
    {
      id: 'finance-spend',
      label: 'Total Spend',
      value: formatINR(finance.totalExpense),
      deltaText:
        finance.expenseDeltaPct !== null
          ? `${finance.expenseDeltaPct > 0 ? '+' : ''}${finance.expenseDeltaPct}% vs prev`
          : `${formatINR(finance.dailyAvgBurn)}/day burn`,
      deltaTone:
        finance.expenseDeltaPct === null ? 'neutral' : finance.expenseDeltaPct <= 0 ? 'positive' : 'negative',
      subtitle: windowLabel,
      icon: <TrendingDown className="w-4 h-4" />,
    },
    {
      id: 'finance-net',
      label: 'Net Cashflow',
      value: formatINR(finance.netSavings),
      deltaText: `${finance.savingsRatePct}% savings rate`,
      deltaTone: finance.netSavings >= 0 ? 'positive' : 'negative',
      subtitle:
        finance.monthlySummary.safeToSpendDaily > 0
          ? `${formatINR(finance.monthlySummary.safeToSpendDaily)}/d safe`
          : undefined,
      icon: <PiggyBank className="w-4 h-4" />,
    },
    {
      id: 'finance-networth',
      label: 'Net Worth',
      value: formatINR(finance.netWorth.netWorth),
      subtitle: `Liquid ${formatINR(finance.netWorth.liquidAssets)}`,
      deltaText: finance.netWorth.totalLiabilities > 0 ? `${formatINR(finance.netWorth.totalLiabilities)} debt` : 'Zero debt',
      deltaTone: finance.netWorth.totalLiabilities > 0 ? 'neutral' : 'positive',
      icon: <Wallet className="w-4 h-4" />,
    },
    {
      id: 'finance-cards',
      label: 'Card Utilization',
      value: `${finance.totalCardUtilizationPct}%`,
      deltaText:
        finance.creditCardSummaries.length > 0
          ? `${finance.creditCardSummaries.length} active card${finance.creditCardSummaries.length === 1 ? '' : 's'}`
          : 'No credit cards',
      deltaTone: finance.totalCardUtilizationPct > 50 ? 'negative' : 'positive',
      icon: <CreditCard className="w-4 h-4" />,
    },
  ];
}

function buildDonutCategories(
  categorySpend: AnalyticsTabProps['snapshot']['finance']['categorySpend']
): OverviewDonutCategoryItem[] {
  return categorySpend.map((item) => ({
    category: item.category ?? {
      id: item.categoryId,
      userId: '',
      name: item.name,
      slug: item.categoryId,
      type: 'expense',
      icon: 'tag',
      color: item.color,
      monthlyBudgetLimit: item.budgetLimit,
      subcategories: [],
      order: 0,
      isSystem: false,
      archived: false,
      createdAt: '',
      updatedAt: '',
    },
    spent: item.amount,
    percentageOfTotalSpend: item.sharePct,
    transactionCount: item.transactionCount,
  }));
}

function ModeToggleGroup<T extends string>(props: {
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

function CashflowTrajectoryCard({
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

function CategoryPaceRow({
  cat,
}: {
  cat: AnalyticsTabProps['snapshot']['finance']['categorySpend'][number];
}) {
  const budgetPct = cat.budgetLimit > 0 ? Math.round((cat.amount / cat.budgetLimit) * 100) : null;
  const statusClass =
    budgetPct !== null && budgetPct >= 100
      ? 'text-rose-600 dark:text-rose-400'
      : budgetPct !== null && budgetPct >= 80
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="space-y-1.5 rounded-xl bg-muted/35 p-2.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
          <span className="font-semibold text-foreground truncate">{cat.name}</span>
        </div>
        <span className="text-foreground font-semibold tabular-nums shrink-0">
          {formatINR(cat.amount)}
          <span className="text-muted-foreground font-normal ml-1">({cat.sharePct}%)</span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, Math.max(3, budgetPct ?? cat.sharePct))}%`,
            backgroundColor: budgetPct !== null && budgetPct >= 100 ? '#ef4444' : cat.color,
          }}
        />
      </div>
      {budgetPct !== null && (
        <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>Budget cap {formatINR(cat.budgetLimit)}</span>
          <span className={cn('font-medium', statusClass)}>{budgetPct}% used</span>
        </div>
      )}
    </div>
  );
}

function CategoryBreakdownCard({
  finance,
  windowLabel,
  categoryMode,
  onModeChange,
  donutCategories,
  onSelectCategory,
}: {
  finance: AnalyticsTabProps['snapshot']['finance'];
  windowLabel: string;
  categoryMode: 'pace' | 'donut';
  onModeChange: (m: 'pace' | 'donut') => void;
  donutCategories: OverviewDonutCategoryItem[];
  onSelectCategory: () => void;
}) {
  return (
    <AnalyticsChartCard
      title="Category Spend & Budget Variance"
      subtitle={`Expenses across ${windowLabel}`}
      headerRight={
        <ModeToggleGroup
          ariaLabel="Category chart view"
          value={categoryMode}
          options={[{ key: 'pace', label: 'Pace' }, { key: 'donut', label: 'Donut' }]}
          onChange={onModeChange}
        />
      }
      isEmpty={finance.categorySpend.length === 0}
      emptyTitle="No category spend in this range"
      emptyDescription="Log expenses to inspect category budget pace and spending share."
      emptyActionLabel="Add Expense"
      emptyActionHref="/finance"
    >
      {categoryMode === 'donut' ? (
        <OverviewCategoryDonut donutCategories={donutCategories} totalSpent={finance.totalExpense} onSelectCategory={onSelectCategory} />
      ) : (
        <div className="space-y-3">
          {finance.categorySpend.slice(0, 6).map((cat) => (
            <CategoryPaceRow key={cat.categoryId} cat={cat} />
          ))}
        </div>
      )}
    </AnalyticsChartCard>
  );
}

function OutflowAllocationCard({ finance }: { finance: AnalyticsTabProps['snapshot']['finance'] }) {
  const mixTotal = finance.needsSpend + finance.discretionarySpend + finance.totalInvestment;
  const needsPct = mixTotal > 0 ? Math.round((finance.needsSpend / mixTotal) * 100) : 0;
  const discPct = mixTotal > 0 ? Math.round((finance.discretionarySpend / mixTotal) * 100) : 0;
  const invPct = mixTotal > 0 ? Math.max(0, 100 - needsPct - discPct) : 0;

  return (
    <AnalyticsChartCard
      title="Outflow Allocation"
      subtitle="Core needs vs discretionary/junk spend vs investments"
      isEmpty={mixTotal === 0}
      emptyTitle="No outflows logged yet"
      emptyDescription="Track expenses and SIP/investment transfers to view allocation mix."
    >
      <div className="space-y-3">
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted flex">
          <div className="h-full bg-sky-500" style={{ width: `${needsPct}%` }} />
          <div className="h-full bg-amber-500" style={{ width: `${discPct}%` }} />
          <div className="h-full bg-emerald-500" style={{ width: `${invPct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-muted/35 p-2.5">
            <p className="text-[11px] text-muted-foreground">Core Needs</p>
            <p className="text-sm font-bold text-foreground tabular-nums">{formatINR(finance.needsSpend)}</p>
            <p className="text-[11px] text-sky-600 dark:text-sky-400 tabular-nums">{needsPct}%</p>
          </div>
          <div className="rounded-xl bg-muted/35 p-2.5">
            <p className="text-[11px] text-muted-foreground">Discretionary</p>
            <p className="text-sm font-bold text-foreground tabular-nums">{formatINR(finance.discretionarySpend)}</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 tabular-nums">{discPct}%</p>
          </div>
          <div className="rounded-xl bg-muted/35 p-2.5">
            <p className="text-[11px] text-muted-foreground">Invested</p>
            <p className="text-sm font-bold text-foreground tabular-nums">{formatINR(finance.totalInvestment)}</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 tabular-nums">{invPct}%</p>
          </div>
        </div>
      </div>
    </AnalyticsChartCard>
  );
}

function AnomaliesObligationsCard({ finance }: { finance: AnalyticsTabProps['snapshot']['finance'] }) {
  return (
    <AnalyticsChartCard
      title="Anomalies & 7-Day Obligations"
      subtitle="Spend spikes, overdue items, and upcoming bills"
      isEmpty={finance.anomalies.length === 0 && finance.upcomingObligations7d.length === 0}
      emptyTitle="All clear on alerts and upcoming bills"
      emptyDescription="No spending anomalies or obligations due within the next 7 days."
    >
      <div className="space-y-2.5">
        {finance.anomalies.slice(0, 3).map((alert) => (
          <div key={alert.id} className="flex items-start gap-2.5 rounded-xl bg-muted/35 p-3 text-xs border border-border/50">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-semibold text-foreground">{alert.title}</p>
              <p className="text-muted-foreground">{alert.description}</p>
            </div>
          </div>
        ))}
        {finance.upcomingObligations7d.slice(0, 4).map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/35 px-3 py-2.5 text-xs">
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{item.title}</p>
              <p className="text-muted-foreground">{formatHumanDate(item.dueDate)}</p>
            </div>
            <span className="font-semibold text-foreground tabular-nums shrink-0">{formatINR(item.amount)}</span>
          </div>
        ))}
      </div>
    </AnalyticsChartCard>
  );
}

function FriendLedgerCard({ finance }: { finance: AnalyticsTabProps['snapshot']['finance'] }) {
  return (
    <AnalyticsChartCard
      title="Friend Ledger & Debt Position"
      subtitle="Everyday splits and long-term friend settlements"
      headerRight={<Users className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
      isEmpty={finance.debtSummary.totalLentRemaining === 0 && finance.debtSummary.totalBorrowedRemaining === 0}
      emptyTitle="Zero unsettled friend balances"
      emptyDescription="All splits and friend loans are settled."
      emptyActionLabel="Open Friends"
      emptyActionHref="/finance?tab=friends"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-muted/35 p-3">
            <p className="text-[11px] text-muted-foreground">Owed to You</p>
            <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatINR(finance.debtSummary.totalLentRemaining)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/35 p-3">
            <p className="text-[11px] text-muted-foreground">You Owe</p>
            <p className="text-sm sm:text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {formatINR(finance.debtSummary.totalBorrowedRemaining)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/35 p-3">
            <p className="text-[11px] text-muted-foreground">Net Position</p>
            <p className="text-sm sm:text-base font-bold text-foreground tabular-nums">
              {formatINR(finance.debtSummary.netPosition)}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {finance.debtSummary.activeLentCount} active receivable(s) · {finance.debtSummary.activeBorrowedCount} payable(s)
          </span>
          <Link href="/finance?tab=friends" className="inline-flex items-center gap-1 font-medium text-primary hover:underline shrink-0">
            <span>Settle</span>
            <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </AnalyticsChartCard>
  );
}

function FinanceAnalyticsTabInner({ snapshot }: AnalyticsTabProps) {
  const router = useRouter();
  const { finance } = snapshot;
  const [cashflowMode, setCashflowMode] = useState<'burn' | 'runway'>('burn');
  const [categoryMode, setCategoryMode] = useState<'pace' | 'donut'>('pace');

  const kpiItems = useMemo(() => buildFinanceKpiItems(finance, snapshot.window.label), [finance, snapshot.window.label]);
  const donutCategories = useMemo(() => buildDonutCategories(finance.categorySpend), [finance.categorySpend]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <AnalyticsKpiGrid items={kpiItems} />

      <CashflowTrajectoryCard
        finance={finance}
        dateSpanLabel={snapshot.window.dateSpanLabel}
        cashflowMode={cashflowMode}
        onModeChange={setCashflowMode}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryBreakdownCard
          finance={finance}
          windowLabel={snapshot.window.label}
          categoryMode={categoryMode}
          onModeChange={setCategoryMode}
          donutCategories={donutCategories}
          onSelectCategory={() => router.push('/finance?tab=activity')}
        />

        <div className="space-y-4">
          <OutflowAllocationCard finance={finance} />

          <AnalyticsChartCard
            title="Credit Card Dual-Cycle Utilization"
            subtitle="Billed statement due + active unbilled cycle vs limit"
            isEmpty={finance.creditCardSummaries.length === 0}
            emptyTitle="No credit cards configured"
            emptyDescription="Add a credit card account to track statement billing dates and unbilled utilization."
          >
            <div className="space-y-3">
              {finance.creditCardSummaries.map(({ account, summary }) => (
                <div key={account.id} className="rounded-xl bg-muted/35 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-foreground truncate">{account.name}</span>
                    <span className={cn('font-bold tabular-nums shrink-0', summary.utilizationPercent > 50 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>
                      {summary.utilizationPercent}% used
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', summary.utilizationPercent > 50 ? 'bg-rose-500' : 'bg-sky-500')}
                      style={{ width: `${Math.min(100, Math.max(2, summary.utilizationPercent))}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground tabular-nums">
                    <span>Billed {formatINR(summary.billedDueTotal)} · Unbilled {formatINR(summary.unbilledCycle.amount)}</span>
                    <span>
                      {summary.nextDueDate
                        ? `Due ${formatHumanDate(summary.nextDueDate)}`
                        : `Closes ${formatHumanDate(summary.unbilledCycle.periodEnd)}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </AnalyticsChartCard>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnomaliesObligationsCard finance={finance} />
        <FriendLedgerCard finance={finance} />
      </div>
    </div>
  );
}

export default React.memo(FinanceAnalyticsTabInner);
