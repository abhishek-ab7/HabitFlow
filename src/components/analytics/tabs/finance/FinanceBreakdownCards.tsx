'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Users } from 'lucide-react';
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard';
import {
  OverviewCategoryDonut,
  type OverviewDonutCategoryItem,
} from '@/components/finance/OverviewCategoryDonut';
import {
  computeOutflowMix,
  getCategoryPaceStatusClass,
} from '@/lib/analytics/finance-analytics-helpers';
import { formatHumanDate } from '@/lib/date-format';
import { formatINR } from '@/lib/stores/finance-store';
import { cn } from '@/lib/utils';
import type { AnalyticsTabProps } from '../types';

export function ModeToggleGroup<T extends string>(props: {
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

function CategoryPaceRow({ cat }: { cat: AnalyticsTabProps['snapshot']['finance']['categorySpend'][number] }) {
  const budgetPct = cat.budgetLimit > 0 ? Math.round((cat.amount / cat.budgetLimit) * 100) : null;
  const statusClass = getCategoryPaceStatusClass(budgetPct);

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

export function CategoryBreakdownCard({
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

export function OutflowAllocationCard({ finance }: { finance: AnalyticsTabProps['snapshot']['finance'] }) {
  const { mixTotal, needsPct, discPct, invPct } = computeOutflowMix(finance);

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

export function CreditCardUtilizationCard({ finance }: { finance: AnalyticsTabProps['snapshot']['finance'] }) {
  return (
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
  );
}

export function AnomaliesObligationsCard({ finance }: { finance: AnalyticsTabProps['snapshot']['finance'] }) {
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

export function FriendLedgerCard({ finance }: { finance: AnalyticsTabProps['snapshot']['finance'] }) {
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
