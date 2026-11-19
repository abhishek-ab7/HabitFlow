'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, ArrowRight, Plus, CalendarClock } from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { Button } from '@/components/ui/button';
import { AddTransactionModal } from '@/components/finance/AddTransactionModal';
import { CategoryIcon } from '@/components/finance/CategoryIcon';

export function FinanceOverviewWidget() {
  const router = useRouter();
  const isLoading = useFinanceStore((s) => s.isLoading);
  const categories = useFinanceStore((s) => s.categories);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getNetWorthSummary = useFinanceStore((s) => s.getNetWorthSummary);
  const getUpcomingFinancialObligations = useFinanceStore(
    (s) => s.getUpcomingFinancialObligations
  );

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  useEffect(() => {
    if (categories.length === 0) {
      loadFinanceData();
    }
  }, [categories.length, loadFinanceData]);

  const summary = getMonthlySummary();
  const netWorth = getNetWorthSummary();
  const dueSoon = getUpcomingFinancialObligations(10);
  const dueSoonTotal = dueSoon.reduce((acc, item) => acc + item.amount, 0);

  const topCategories = summary.categoryBreakdown
    .filter((c) => c.budgetLimit > 0 || c.spent > 0)
    .slice(0, 3);

  if (isLoading && categories.length === 0) {
    return (
      <section className="bg-card/30 backdrop-blur-2xl rounded-3xl border border-white/10 p-6 h-48 animate-pulse" />
    );
  }

  return (
    <section className="bg-card/35 backdrop-blur-2xl backdrop-saturate-150 rounded-3xl border border-white/10 shadow-xl overflow-hidden">
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-start sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5 sm:mt-0">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-snug">
                Cashflow &amp; Budget Radar
              </h2>
              <p className="text-xs text-muted-foreground font-mono tabular-nums truncate">
                Net Worth {formatINR(netWorth.netWorth)} · Pace {summary.dayOfMonthProgressPct}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              onClick={() => setIsQuickAddOpen(true)}
              className="gap-1 text-xs h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl whitespace-nowrap font-medium shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log Expense</span>
              <span className="sm:hidden">Log</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/finance')}
              className="group gap-1 text-xs h-8 sm:h-9 px-2 sm:px-2.5 text-muted-foreground hover:text-primary rounded-xl whitespace-nowrap"
              title="Open FlowFinance"
            >
              <span className="hidden sm:inline">Open</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>

        {/* 4-Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/50">
          <div>
            <span className="text-xs text-muted-foreground block">
              Safe Today
            </span>
            <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatINR(summary.safeToSpendDaily)}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Spent</span>
            <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-foreground">
              {formatINR(summary.totalSpent)}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Invested</span>
            <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400">
              {formatINR(summary.totalInvested)}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Due Soon</span>
            <span
              className={`text-base sm:text-lg font-bold font-mono tabular-nums ${
                dueSoon.length > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-foreground'
              }`}
            >
              {dueSoon.length > 0 ? formatINR(dueSoonTotal) : '₹0'}
            </span>
          </div>
        </div>

        {/* Top Category Pace Envelopes */}
        {topCategories.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-border/50">
            {topCategories.map((item) => {
              const pct =
                item.budgetLimit > 0
                  ? Math.min(
                      100,
                      Math.round((item.spent / item.budgetLimit) * 100)
                    )
                  : item.percentageOfTotalSpend;

              return (
                <div key={item.category.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground truncate">
                      <CategoryIcon
                        name={item.category.icon}
                        className="w-3.5 h-3.5"
                        style={{ color: item.category.color }}
                      />
                      <span>{item.category.name}</span>
                    </span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {formatINR(item.spent)}
                      {item.budgetLimit > 0
                        ? ` / ${formatINR(item.budgetLimit)}`
                        : ''}
                    </span>
                  </div>
                  <div className="relative h-1.5 w-full rounded-full bg-muted overflow-visible">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full ${
                        item.status === 'exceeded'
                          ? 'bg-rose-500'
                          : item.status === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                    {item.budgetLimit > 0 && (
                      <div
                        style={{
                          left: `${Math.min(
                            99,
                            Math.max(1, summary.dayOfMonthProgressPct)
                          )}%`,
                        }}
                        className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground/75 rounded-full"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Next Upcoming Bill Alert */}
        {dueSoon.length > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarClock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="font-medium text-foreground truncate">
                Next due: {dueSoon[0].title}
              </span>
            </div>
            <span className="font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400 shrink-0">
              {formatINR(dueSoon[0].amount)} ·{' '}
              {dueSoon[0].daysUntilDue === 0
                ? 'Today'
                : `${dueSoon[0].daysUntilDue}d`}
            </span>
          </div>
        )}
      </div>

      <AddTransactionModal
        open={isQuickAddOpen}
        onOpenChange={setIsQuickAddOpen}
      />
    </section>
  );
}
