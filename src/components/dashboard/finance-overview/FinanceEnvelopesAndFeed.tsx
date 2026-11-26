'use client';

import React from 'react';
import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { CategoryIcon } from '@/components/finance/CategoryIcon';
import { formatHumanDate } from '@/lib/date-format';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinanceCategory, FinanceTransaction } from '@/lib/types';

interface CategoryBreakdownRow {
  category: FinanceCategory;
  spent: number;
  budgetLimit: number;
  percentageOfTotalSpend: number;
  status: 'ok' | 'warning' | 'exceeded' | string;
}

const STATUS_BAR_CLASS: Record<string, string> = {
  exceeded: 'bg-rose-500',
  warning: 'bg-amber-500',
};

const TX_AMOUNT_CLASS: Record<string, string> = {
  income: 'text-emerald-600 dark:text-emerald-400',
  investment: 'text-violet-600 dark:text-violet-400',
};

export function FinanceTopEnvelopes(params: {
  topCategories: CategoryBreakdownRow[];
  dayOfMonthProgressPct: number;
}) {
  if (params.topCategories.length === 0) return null;
  const paceLeft = Math.min(99, Math.max(1, params.dayOfMonthProgressPct));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">Top Budget Envelopes</span>
        <Link href="/finance" className="text-primary hover:underline font-medium">All Budgets →</Link>
      </div>
      {params.topCategories.map((item) => {
        const pct = item.budgetLimit > 0 ? Math.min(100, Math.round((item.spent / item.budgetLimit) * 100)) : item.percentageOfTotalSpend;
        const barColor = STATUS_BAR_CLASS[item.status] ?? 'bg-emerald-500';
        return (
          <div key={item.category.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="flex items-center gap-1.5 font-medium text-foreground truncate">
                <CategoryIcon name={item.category.icon} className="w-3.5 h-3.5 shrink-0" style={{ color: item.category.color }} />
                <span className="truncate">{item.category.name}</span>
              </span>
              <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                <strong className="text-foreground">{formatINR(item.spent)}</strong>
                {item.budgetLimit > 0 ? ` / ${formatINR(item.budgetLimit)}` : ''}
              </span>
            </div>
            <div className="relative h-1.5 w-full rounded-full bg-muted overflow-visible">
              <div className="h-full w-full rounded-full overflow-hidden">
                <div style={{ transform: `scaleX(${Math.max(0, Math.min(1, pct / 100))})` }} className={`h-full w-full origin-left rounded-full transition-transform duration-300 ${barColor}`} />
              </div>
              {item.budgetLimit > 0 && (
                <div style={{ left: `${paceLeft}%` }} title={`Today's month pace (${params.dayOfMonthProgressPct}%)`} className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground/80 rounded-full" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FinanceRecentFeed(params: {
  recentTxs: FinanceTransaction[];
  categoryMap: Map<string, FinanceCategory>;
}) {
  if (params.recentTxs.length === 0) return null;

  return (
    <div className="space-y-2 pt-3 border-t border-border/60">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground inline-flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5 text-muted-foreground" /> Recent Activity
        </span>
        <Link href="/finance?tab=activity" className="text-primary hover:underline font-medium">Ledger →</Link>
      </div>
      <div className="divide-y divide-border/60">
        {params.recentTxs.map((tx) => {
          const cat = params.categoryMap.get(tx.categoryId);
          const amtClass = TX_AMOUNT_CLASS[tx.type] ?? 'text-foreground';
          return (
            <div key={tx.id} className="py-2 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{tx.merchantName || tx.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{cat?.name || 'General'} · {formatHumanDate(tx.date)}</p>
              </div>
              <span className={`font-mono tabular-nums font-bold shrink-0 ${amtClass}`}>
                {tx.type === 'income' ? '+' : '-'}{formatINR(tx.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
