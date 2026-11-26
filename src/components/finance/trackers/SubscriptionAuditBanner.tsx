'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, Sparkles, PauseCircle } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinanceRecurringBill } from '@/lib/types';

interface SubscriptionAuditBannerProps {
  bills: FinanceRecurringBill[];
  onPauseBill: (bill: FinanceRecurringBill) => void;
}

const ANNUAL_MULTIPLIER: Record<string, { annual: number; monthlyDiv: number }> = {
  yearly: { annual: 1, monthlyDiv: 12 },
  quarterly: { annual: 4, monthlyDiv: 3 },
  monthly: { annual: 12, monthlyDiv: 1 },
};

function computeSubscriptionAudit(bills: FinanceRecurringBill[]) {
  const activeBills = bills.filter((b) => b.isActive && !b.deletedAt);
  let monthlyEquivalent = 0;
  let annualizedTotal = 0;
  const hiked: FinanceRecurringBill[] = [];

  for (const bill of activeBills) {
    const mult = ANNUAL_MULTIPLIER[bill.cadence] ?? ANNUAL_MULTIPLIER.monthly;
    annualizedTotal += bill.amount * mult.annual;
    monthlyEquivalent += bill.amount / mult.monthlyDiv;
    if (bill.previousAmount && bill.amount > bill.previousAmount) {
      hiked.push(bill);
    }
  }

  return {
    count: activeBills.length,
    monthlyEquivalent: Math.round(monthlyEquivalent),
    annualizedTotal: Math.round(annualizedTotal),
    hiked,
  };
}

export function SubscriptionAuditBanner({
  bills,
  onPauseBill,
}: SubscriptionAuditBannerProps) {
  const audit = useMemo(() => computeSubscriptionAudit(bills), [bills]);

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
