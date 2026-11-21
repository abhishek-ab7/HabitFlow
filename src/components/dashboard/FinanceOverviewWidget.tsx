'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  ArrowRight,
  Plus,
  CalendarClock,
  CheckCircle2,
  Receipt,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { FinancialObligationItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { AddTransactionModal } from '@/components/finance/AddTransactionModal';
import { PayCreditCardModal } from '@/components/finance/credit-cards/PayCreditCardModal';
import { CategoryIcon } from '@/components/finance/CategoryIcon';
import type { FinanceAccount } from '@/lib/types';
import { toast } from 'sonner';

export function FinanceOverviewWidget() {
  const router = useRouter();
  const isLoading = useFinanceStore((s) => s.isLoading);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getNetWorthSummary = useFinanceStore((s) => s.getNetWorthSummary);
  const getUpcomingFinancialObligations = useFinanceStore(
    (s) => s.getUpcomingFinancialObligations
  );
  const payRecurringBill = useFinanceStore((s) => s.payRecurringBill);
  const payMonthlyEmi = useFinanceStore((s) => s.payMonthlyEmi);
  const payMonthlySip = useFinanceStore((s) => s.payMonthlySip);
  const settleCommitmentBalance = useFinanceStore((s) => s.settleCommitmentBalance);

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [payingCardAccount, setPayingCardAccount] = useState<FinanceAccount | null>(null);
  const [payingCardAmount, setPayingCardAmount] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (categories.length === 0) {
      loadFinanceData();
    }
  }, [categories.length, loadFinanceData]);

  const summary = getMonthlySummary();
  const netWorth = getNetWorthSummary();
  const due14d = getUpcomingFinancialObligations(14);
  const dueTotal = due14d.reduce((acc, item) => acc + item.amount, 0);

  const topCategories = summary.categoryBreakdown
    .filter((c) => c.budgetLimit > 0 || c.spent > 0)
    .slice(0, 4);

  const recentTxs = useMemo(() => {
    return transactions
      .filter((t) => !t.deletedAt)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 4);
  }, [transactions]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const handleQuickPay = async (item: FinancialObligationItem) => {
    if (item.type === 'bill') {
      const tx = await payRecurringBill(item.sourceId);
      if (tx) toast.success(`Marked ${item.title} paid`);
    } else if (item.type === 'emi') {
      const tx = await payMonthlyEmi(item.sourceId);
      if (tx) toast.success(`Logged ${item.title}`);
    } else if (item.type === 'sip') {
      const tx = await payMonthlySip(item.sourceId);
      if (tx) toast.success(`Logged ${item.title}`);
    } else if (item.type === 'commitment') {
      const tx = await settleCommitmentBalance(item.sourceId, undefined, selectedMonth);
      if (tx) toast.success(`Settled ${item.title}`);
    } else {
      router.push('/finance?tab=trackers');
    }
  };

  if (isLoading && categories.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 h-56 animate-pulse" />
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-4 sm:p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-foreground leading-snug">
                Cashflow, Budgets &amp; Dues Radar
              </h2>
              <p className="text-xs text-muted-foreground font-mono tabular-nums truncate">
                Net Worth {formatINR(netWorth.netWorth)} · Month Pace{' '}
                {summary.dayOfMonthProgressPct}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={() => setIsQuickAddOpen(true)}
              className="gap-1 text-xs min-h-[36px] px-3 rounded-xl whitespace-nowrap font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log Expense</span>
              <span className="sm:hidden">Log</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => router.push('/finance')}
              className="group gap-1 text-xs min-h-[36px] px-2.5 text-muted-foreground hover:text-foreground rounded-xl whitespace-nowrap"
            >
              <span className="hidden sm:inline">Finance</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>

        {/* 2-Column Operational Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-border/60">
          {/* Left 7 cols: Budget Pace Envelopes + Recent Activity */}
          <div className="lg:col-span-7 space-y-4">
            {topCategories.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    Top Budget Envelopes
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push('/finance')}
                    className="text-primary hover:underline font-medium"
                  >
                    All Budgets →
                  </button>
                </div>
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
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="flex items-center gap-1.5 font-medium text-foreground truncate">
                          <CategoryIcon
                            name={item.category.icon}
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: item.category.color }}
                          />
                          <span className="truncate">{item.category.name}</span>
                        </span>
                        <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                          <strong className="text-foreground">
                            {formatINR(item.spent)}
                          </strong>
                          {item.budgetLimit > 0
                            ? ` / ${formatINR(item.budgetLimit)}`
                            : ''}
                        </span>
                      </div>
                      <div className="relative h-1.5 w-full rounded-full bg-muted overflow-visible">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full transition-all ${
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
                            title={`Today's month pace (${summary.dayOfMonthProgressPct}%)`}
                            className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground/80 rounded-full"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Recent Activity Mini-Feed */}
            {recentTxs.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-border/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground inline-flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                    Recent Activity
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push('/finance?tab=activity')}
                    className="text-primary hover:underline font-medium"
                  >
                    Ledger →
                  </button>
                </div>
                <div className="divide-y divide-border/60">
                  {recentTxs.map((tx) => {
                    const cat = categoryMap.get(tx.categoryId);
                    return (
                      <div
                        key={tx.id}
                        className="py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {tx.merchantName || tx.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {cat?.name || 'General'} · {tx.date}
                          </p>
                        </div>
                        <span
                          className={`font-mono tabular-nums font-bold shrink-0 ${
                            tx.type === 'income'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : tx.type === 'investment'
                              ? 'text-violet-600 dark:text-violet-400'
                              : 'text-foreground'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}
                          {formatINR(tx.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right 5 cols: Upcoming 14-Day Obligations Radar */}
          <div className="lg:col-span-5 lg:border-l lg:border-border/60 lg:pl-5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground inline-flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-amber-500" />
                Upcoming Dues (14d)
              </span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {due14d.length > 0 ? formatINR(dueTotal) : 'Clear'}
              </span>
            </div>

            {due14d.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>No unpaid bills, EMIs, or SIPs due in the next 14 days.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {due14d.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/80 bg-background p-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] font-mono tabular-nums text-muted-foreground truncate">
                        <span
                          className={
                            item.isOverdue
                              ? 'text-rose-600 dark:text-rose-400 font-semibold'
                              : item.daysUntilDue <= 3
                              ? 'text-amber-600 dark:text-amber-400 font-semibold'
                              : ''
                          }
                        >
                          {item.isOverdue
                            ? `${Math.abs(item.daysUntilDue)}d overdue`
                            : item.daysUntilDue === 0
                            ? 'Today'
                            : `In ${item.daysUntilDue}d`}
                        </span>{' '}
                        · {formatINR(item.amount)}
                      </p>
                    </div>
                    {item.type === 'credit_card' ? (
                      <button
                        type="button"
                        onClick={() => {
                          const card = accounts.find((a) => a.id === item.sourceId);
                          if (card) {
                            setPayingCardAccount(card);
                            setPayingCardAmount(item.amount);
                          } else {
                            router.push('/finance?tab=accounts');
                          }
                        }}
                        className="min-h-[32px] px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold shrink-0 transition-colors"
                      >
                        Pay
                      </button>
                    ) : item.type !== 'debt' ? (
                      <button
                        type="button"
                        onClick={() => handleQuickPay(item)}
                        className="min-h-[32px] px-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-semibold shrink-0 transition-colors"
                      >
                        {item.type === 'sip'
                          ? 'Invest'
                          : item.type === 'commitment'
                          ? 'Settle'
                          : 'Paid'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => router.push('/finance?tab=trackers')}
                        className="min-h-[32px] px-2.5 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground shrink-0"
                      >
                        View
                      </button>
                    )}
                  </div>
                ))}
                {due14d.length > 4 && (
                  <button
                    type="button"
                    onClick={() => router.push('/finance?tab=trackers')}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    +{due14d.length - 4} more obligations →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AddTransactionModal
        open={isQuickAddOpen}
        onOpenChange={setIsQuickAddOpen}
      />

      {payingCardAccount && (
        <PayCreditCardModal
          open={!!payingCardAccount}
          onOpenChange={(open) => {
            if (!open) {
              setPayingCardAccount(null);
              setPayingCardAmount(undefined);
            }
          }}
          card={payingCardAccount}
          defaultAmount={payingCardAmount}
        />
      )}
    </section>
  );
}
