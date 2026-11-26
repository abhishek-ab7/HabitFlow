'use client';

import React from 'react';
import { Snowflake, TrendingDown, Zap } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { runPayoffSimulation } from './debt-payoff-sim';

export function DebtPayoffAcceleratorCard(params: {
  payoffItemsCount: number;
  simulation: ReturnType<typeof runPayoffSimulation>;
  strategy: 'avalanche' | 'snowball';
  setStrategy: (s: 'avalanche' | 'snowball') => void;
  extraPayment: number;
  setExtraPayment: (n: number) => void;
}) {
  const { payoffItemsCount, simulation, strategy, setStrategy, extraPayment, setExtraPayment } = params;
  const btnCls = (active: boolean) =>
    `min-h-[34px] px-3 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <TrendingDown className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-foreground">Debt Payoff Accelerator</h2>
            <p className="text-xs text-muted-foreground font-mono tabular-nums">
              {payoffItemsCount} active balances · Total {formatINR(simulation.totalDebt)}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted">
          <button type="button" onClick={() => setStrategy('avalanche')} className={btnCls(strategy === 'avalanche')}>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Avalanche (High APR)
          </button>
          <button type="button" onClick={() => setStrategy('snowball')} className={btnCls(strategy === 'snowball')}>
            <Snowflake className="w-3.5 h-3.5 text-cyan-500" />
            Snowball (Smallest)
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">Extra monthly prepayment</span>
          <span className="font-mono tabular-nums font-bold text-primary">+{formatINR(extraPayment)} / mo</span>
        </div>
        <input type="range" min={0} max={50000} step={500} value={extraPayment} onChange={(e) => setExtraPayment(parseInt(e.target.value, 10))} aria-label="Extra monthly debt prepayment" className="w-full accent-primary cursor-pointer" />
      </div>

      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60 text-xs">
        <div>
          <span className="text-muted-foreground block">Debt-Free By</span>
          <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-foreground">{simulation.debtFreeLabel}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Time Saved</span>
          <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{simulation.monthsSaved} mo</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Interest Saved</span>
          <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{formatINR(simulation.interestSaved)}</span>
        </div>
      </div>

      {simulation.accelerated.order.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Payoff sequence: <strong className="text-foreground">{simulation.accelerated.order.join(' → ')}</strong>
        </p>
      )}
    </div>
  );
}
