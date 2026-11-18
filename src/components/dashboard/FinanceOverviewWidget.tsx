'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, ArrowRight, Plus } from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { Button } from '@/components/ui/button';

export function FinanceOverviewWidget() {
  const router = useRouter();
  const isLoading = useFinanceStore((s) => s.isLoading);
  const categories = useFinanceStore((s) => s.categories);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getUpcomingFinancialObligations = useFinanceStore(
    (s) => s.getUpcomingFinancialObligations
  );

  useEffect(() => {
    if (categories.length === 0) {
      loadFinanceData();
    }
  }, [categories.length, loadFinanceData]);

  const summary = getMonthlySummary();
  const dueSoon = getUpcomingFinancialObligations(10);
  const dueSoonTotal = dueSoon.reduce((acc, item) => acc + item.amount, 0);

  if (isLoading && categories.length === 0) {
    return (
      <section className="bg-card/30 backdrop-blur-2xl rounded-3xl border border-white/10 p-6 h-44 animate-pulse" />
    );
  }

  return (
    <section className="bg-card/35 backdrop-blur-2xl backdrop-saturate-150 rounded-3xl border border-white/10 shadow-xl overflow-hidden">
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Finance
              </h2>
              <p className="text-xs text-muted-foreground">
                This month&apos;s spending &amp; upcoming dues
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => router.push('/finance')}
              className="gap-1.5 text-xs min-h-[40px] px-3 rounded-xl whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/finance')}
              className="group gap-1 text-xs min-h-[40px] px-2.5 text-muted-foreground hover:text-primary whitespace-nowrap"
            >
              Open
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/50">
          <div>
            <span className="text-xs text-muted-foreground block">Spent</span>
            <span className="text-base sm:text-xl font-bold font-mono tabular-nums text-foreground">
              {formatINR(summary.totalSpent)}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Budget</span>
            <span className="text-base sm:text-xl font-bold font-mono tabular-nums text-foreground">
              {summary.monthlyBudget > 0
                ? formatINR(summary.monthlyBudget)
                : 'Not set'}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Due Soon</span>
            <span className="text-base sm:text-xl font-bold font-mono tabular-nums text-foreground">
              {dueSoon.length > 0 ? formatINR(dueSoonTotal) : 'None'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
