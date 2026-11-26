'use client';

import React from 'react';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, Loader2 } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinancialObligationItem } from '@/lib/types';
import { PAY_LABEL_BY_TYPE } from './FinanceDueSoonStrip';

function formatShortDue(item: FinancialObligationItem): string {
  if (item.isOverdue) return `${Math.abs(item.daysUntilDue)}d overdue`;
  if (item.daysUntilDue === 0) return 'Today';
  return `In ${item.daysUntilDue}d`;
}

function getShortDueClass(item: FinancialObligationItem): string {
  if (item.isOverdue) return 'text-rose-600 dark:text-rose-400 font-semibold';
  if (item.daysUntilDue <= 3) return 'text-amber-600 dark:text-amber-400 font-semibold';
  return '';
}

export function FinanceUpcomingRadar(params: {
  due14d: FinancialObligationItem[];
  dueTotal14d: number;
  payingId: string | null;
  onQuickPay: (item: FinancialObligationItem) => void;
}) {
  const { due14d, dueTotal14d, payingId, onQuickPay } = params;

  return (
    <div className="lg:col-span-5 lg:border-l lg:border-border/60 lg:pl-5 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground inline-flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5 text-amber-500" /> Upcoming Dues (14d)
        </span>
        <span className="font-mono tabular-nums text-muted-foreground">{due14d.length > 0 ? formatINR(dueTotal14d) : 'Clear'}</span>
      </div>

      {due14d.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>No unpaid bills, EMIs, or SIPs due in the next 14 days.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {due14d.slice(0, 4).map((item) => {
            const isItemPaying = payingId === item.id;
            const isCard = item.type === 'credit_card';
            return (
              <div key={item.id} className="rounded-xl border border-border/80 bg-background p-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
                  <p className="text-[11px] font-mono tabular-nums text-muted-foreground truncate">
                    <span className={getShortDueClass(item)}>{formatShortDue(item)}</span> · {formatINR(item.amount)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={payingId !== null}
                  onClick={() => onQuickPay(item)}
                  className={
                    isCard
                      ? 'min-h-[32px] px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold shrink-0 transition-colors disabled:opacity-50'
                      : 'min-h-[32px] px-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-semibold shrink-0 transition-colors disabled:opacity-50 flex items-center gap-1'
                  }
                >
                  {isCard ? 'Pay' : isItemPaying ? <Loader2 className="w-3 h-3 animate-spin" /> : (PAY_LABEL_BY_TYPE[item.type] ?? 'Mark Paid')}
                </button>
              </div>
            );
          })}
          {due14d.length > 4 && (
            <Link href="/finance?tab=trackers" className="text-xs text-primary hover:underline font-medium inline-block">
              +{due14d.length - 4} more obligations →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
