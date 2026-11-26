'use client';

import React from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinancialObligationItem } from '@/lib/types';

export const PAY_LABEL_BY_TYPE: Record<string, string> = {
  credit_card: 'Pay Bill',
  sip: 'Invest',
  commitment: 'Settle',
  emi: 'Pay EMI',
  debt: 'Record Pay',
};

const PAY_BTN_BY_TYPE: Record<string, string> = {
  credit_card: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  sip: 'bg-violet-600 hover:bg-violet-700 text-white',
};

function formatDueSoonLabel(item: FinancialObligationItem): string {
  if (item.isOverdue) return `Overdue by ${Math.abs(item.daysUntilDue)}d`;
  if (item.daysUntilDue === 0) return 'Due Today';
  return `Due in ${item.daysUntilDue}d`;
}

function getDueColorClass(item: FinancialObligationItem): string {
  if (item.isOverdue) return 'text-rose-600 dark:text-rose-400 font-semibold';
  if (item.daysUntilDue === 0) return 'text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-muted-foreground';
}

export function FinanceDueSoonStrip(params: {
  due5d: FinancialObligationItem[];
  totalDue5d: number;
  payingId: string | null;
  onQuickPay: (item: FinancialObligationItem) => void;
}) {
  const { due5d, totalDue5d, payingId, onQuickPay } = params;
  if (due5d.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <CalendarClock className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-bold text-foreground">Due Soon (≤5 Days)</span>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            · {due5d.length} {due5d.length === 1 ? 'obligation' : 'obligations'} ({formatINR(totalDue5d)})
          </span>
        </div>
        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">Action needed</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {due5d.map((item) => {
          const isItemPaying = payingId === item.id;
          const btnStyle = PAY_BTN_BY_TYPE[item.type] ?? 'bg-primary hover:bg-primary/90 text-primary-foreground';
          return (
            <div key={`due5-${item.id}`} className="rounded-xl border border-border/80 bg-background/90 p-3 flex flex-col justify-between gap-2.5 shadow-2xs transition-colors hover:border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-foreground truncate">{item.title}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground uppercase">
                      {item.type === 'credit_card' ? 'Card' : item.type}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono tabular-nums mt-0.5">
                    <span className={getDueColorClass(item)}>{formatDueSoonLabel(item)}</span>
                  </p>
                </div>
                <div className="text-right font-mono tabular-nums font-bold text-xs sm:text-sm text-foreground shrink-0">{formatINR(item.amount)}</div>
              </div>

              <div className="flex items-center justify-end pt-1 border-t border-border/40">
                <Button type="button" size="sm" disabled={payingId !== null} onClick={() => onQuickPay(item)} className={`h-7 px-3 text-xs rounded-lg gap-1.5 font-semibold ${btnStyle}`}>
                  {isItemPaying ? <><Loader2 className="w-3 h-3 animate-spin" /> Processing...</> : (PAY_LABEL_BY_TYPE[item.type] ?? 'Mark Paid')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
