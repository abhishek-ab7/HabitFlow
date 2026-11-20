'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, Sparkles, PauseCircle } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinanceRecurringBill } from '@/lib/types';

interface SubscriptionAuditBannerProps {
  bills: FinanceRecurringBill[];
  onPauseBill: (bill: FinanceRecurringBill) => void;
}

export function SubscriptionAuditBanner({
  bills,
  onPauseBill,
}: SubscriptionAuditBannerProps) {
  const audit = useMemo(() => {
    let monthlyEquivalent = 0;
    let annualizedTotal = 0;
    const hiked: FinanceRecurringBill[] = [];

    for (const bill of bills) {
      if (!bill.isActive || bill.deletedAt) continue;
      if (bill.cadence === 'yearly') {
        annualizedTotal += bill.amount;
        monthlyEquivalent += bill.amount / 12;
      } else if (bill.cadence === 'quarterly') {
        annualizedTotal += bill.amount * 4;
        monthlyEquivalent += bill.amount / 3;
      } else {
        annualizedTotal += bill.amount * 12;
        monthlyEquivalent += bill.amount;
      }
      if (bill.previousAmount && bill.amount > bill.previousAmount) {
        hiked.push(bill);
      }
    }

    return {
      count: bills.filter((b) => b.isActive && !b.deletedAt).length,
      monthlyEquivalent: Math.round(monthlyEquivalent),
      annualizedTotal: Math.round(annualizedTotal),
      hiked,
    };
  }, [bills]);

  if (audit.count === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-cyan-500/12 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Subscription &amp; Recurring Audit
            </h3>
            <p className="text-xs text-muted-foreground font-mono tabular-nums">
              {audit.count} active · ~{formatINR(audit.monthlyEquivalent)}/mo ·{' '}
              <strong className="text-foreground">
                {formatINR(audit.annualizedTotal)}/year
              </strong>
            </p>
          </div>
        </div>
      </div>

      {audit.hiked.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/60">
          {audit.hiked.map((bill) => {
            const delta = bill.amount - (bill.previousAmount || 0);
            return (
              <div
                key={bill.id}
                className="rounded-xl border border-amber-500/35 bg-amber-500/5 px-3 py-2 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-foreground truncate">
                    <strong>{bill.name}</strong> jumped by{' '}
                    <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                      +{formatINR(delta)}
                    </span>{' '}
                    ({formatINR(bill.previousAmount || 0)} → {formatINR(bill.amount)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onPauseBill(bill)}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1 shrink-0"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
