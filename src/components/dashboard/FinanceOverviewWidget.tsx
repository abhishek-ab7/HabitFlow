'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, Plus, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/stores/finance-store';
import { FinanceDueSoonStrip } from './finance-overview/FinanceDueSoonStrip';
import { FinanceRecentFeed, FinanceTopEnvelopes } from './finance-overview/FinanceEnvelopesAndFeed';
import { FinanceUpcomingRadar } from './finance-overview/FinanceUpcomingRadar';
import { useFinanceOverviewController } from './finance-overview/useFinanceOverviewController';

const AddTransactionModal = dynamic(
  () => import('@/components/finance/AddTransactionModal').then((m) => ({ default: m.AddTransactionModal })),
  { ssr: false }
);
const PayCreditCardModal = dynamic(
  () => import('@/components/finance/credit-cards/PayCreditCardModal').then((m) => ({ default: m.PayCreditCardModal })),
  { ssr: false }
);

export function FinanceOverviewWidget() {
  const vm = useFinanceOverviewController();

  if (vm.isLoading && vm.categories.length === 0) {
    return <section className="rounded-2xl border border-border bg-card p-6 h-56 animate-pulse" />;
  }

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-4 sm:p-5 space-y-5">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-foreground leading-snug">Cashflow, Budgets &amp; Dues Radar</h2>
              <p className="text-xs text-muted-foreground font-mono tabular-nums truncate">
                Net Worth {formatINR(vm.netWorth.netWorth)} · Month Pace {vm.summary.dayOfMonthProgressPct}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button type="button" size="sm" onClick={() => vm.setIsQuickAddOpen(true)} className="gap-1 text-xs min-h-[36px] px-3 rounded-xl whitespace-nowrap font-semibold">
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log Expense</span>
              <span className="sm:hidden">Log</span>
            </Button>
            <Button variant="ghost" size="sm" asChild className="group gap-1 text-xs min-h-[36px] px-2.5 text-muted-foreground hover:text-foreground rounded-xl whitespace-nowrap">
              <Link href="/finance">
                <span className="hidden sm:inline">Finance</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
        </div>

        <FinanceDueSoonStrip due5d={vm.due5d} totalDue5d={vm.totalDue5d} payingId={vm.payingId} onQuickPay={vm.handleQuickPay} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-border/60">
          <div className="lg:col-span-7 space-y-4">
            <FinanceTopEnvelopes topCategories={vm.topCategories} dayOfMonthProgressPct={vm.summary.dayOfMonthProgressPct} />
            <FinanceRecentFeed recentTxs={vm.recentTxs} categoryMap={vm.categoryMap} />
          </div>
          <FinanceUpcomingRadar due14d={vm.due14d} dueTotal14d={vm.dueTotal14d} payingId={vm.payingId} onQuickPay={vm.handleQuickPay} />
        </div>
      </div>

      {vm.isQuickAddOpen && <AddTransactionModal open={vm.isQuickAddOpen} onOpenChange={vm.setIsQuickAddOpen} />}

      {vm.payingCardAccount && (
        <PayCreditCardModal
          open={Boolean(vm.payingCardAccount)}
          onOpenChange={(open) => {
            if (!open) {
              vm.setPayingCardAccount(null);
              vm.setPayingCardAmount(undefined);
            }
          }}
          card={vm.payingCardAccount}
          defaultAmount={vm.payingCardAmount}
        />
      )}
    </section>
  );
}
