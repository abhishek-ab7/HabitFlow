'use client';

import React from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatINR } from '@/lib/stores/finance-store';
import type { NetWorthSummary } from '@/lib/types';
import { Button } from '@/components/ui/button';

function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs === 0) return '₹0';
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${sign}₹${Math.round(abs)}`;
}

interface NetWorthHeroSectionProps {
  netWorth: NetWorthSummary;
  netWorthHistory: Array<{ monthKey: string; label: string; netWorth: number }>;
  onAddAccount: () => void;
}

export function NetWorthHeroSection({ netWorth, netWorthHistory, onAddAccount }: NetWorthHeroSectionProps) {
  const totalAssetsAndLiabilities = netWorth.totalAssets + netWorth.totalLiabilities || 1;
  const assetsSharePct = Math.round((netWorth.totalAssets / totalAssetsAndLiabilities) * 100);
  const buckets = [
    { label: 'Liquid Cash/Bank', value: netWorth.liquidAssets, colorClass: 'text-foreground' },
    { label: 'Investments/SIPs', value: netWorth.investmentAssets, colorClass: 'text-violet-600 dark:text-violet-400' },
    { label: 'Friends Owe Me', value: netWorth.friendReceivables, colorClass: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Credit Card Dues', value: netWorth.creditCardLiabilities, colorClass: 'text-rose-600 dark:text-rose-400' },
    { label: 'Loan/EMI Balance', value: netWorth.emiRemainingPrincipal, colorClass: 'text-amber-600 dark:text-amber-400' },
    { label: 'I Owe Friends', value: netWorth.friendPayables, colorClass: 'text-rose-600 dark:text-rose-400' },
  ];

  return (
    <section className="surface-hero p-5 sm:p-6 space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-6 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">True Net Worth</p>
              <p className={`text-3xl sm:text-4xl font-bold font-mono tabular-nums mt-1 ${netWorth.netWorth >= 0 ? 'text-foreground' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatINR(netWorth.netWorth)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Liquid Cash + Investments &amp; SIPs + Receivables − Cards, EMIs &amp; Payables
              </p>
            </div>
            <Button type="button" size="sm" onClick={onAddAccount} className="min-h-[40px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap">
              <Plus className="w-4 h-4" />
              Add Account / Card
            </Button>
          </div>
          <div className="space-y-1.5">
            <div className="h-2.5 w-full rounded-full bg-rose-500/25 overflow-hidden flex">
              <div style={{ width: `${assetsSharePct}%` }} className="h-full bg-emerald-500 transition-all duration-300" />
            </div>
            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Assets: {formatINR(netWorth.totalAssets)}</span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">Liabilities: {formatINR(netWorth.totalLiabilities)}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground inline-flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              6-Month Net Worth Trend
            </span>
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground">{netWorthHistory.length} months tracked</span>
          </div>
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorthHistory} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/50" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" />
                <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactINR} tick={{ fontSize: 10, fill: 'currentColor' }} className="text-muted-foreground font-mono" width={52} />
                <Tooltip
                  formatter={(val: unknown) => [formatINR(Number(val) || 0), 'Net Worth']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="netWorth" stroke="#10b981" strokeWidth={2.5} fill="url(#netWorthGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-border/70 text-xs">
        {buckets.map((b) => (
          <div key={b.label}>
            <span className="text-muted-foreground block">{b.label}</span>
            <span className={`font-bold font-mono tabular-nums ${b.colorClass}`}>{formatINR(b.value)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
