'use client';

import React from 'react';
import { Copy, Download, Printer, X } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { CategorySpendItem, MonthlyFinanceSummary, NetWorthSummary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { formatMonthYear } from '@/lib/date-format';

export function ActivityMonthlyReportDialog(params: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMonth: string;
  summary: MonthlyFinanceSummary;
  netWorth: NetWorthSummary;
  categoryBreakdown: CategorySpendItem[];
  onCopySummary: () => void;
  onExportCsv: () => void;
}) {
  const { open, onOpenChange, selectedMonth, summary, netWorth, categoryBreakdown, onCopySummary, onExportCsv } = params;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="p-0 gap-0 overflow-hidden max-w-lg w-full rounded-2xl border-border bg-background">
        <div className="px-5 py-4 border-b border-border bg-card flex items-center justify-between gap-3">
          <div>
            <DialogTitle className="text-base font-bold text-foreground">
              Monthly Financial Report · {formatMonthYear(selectedMonth)}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">Cashflow, savings rate, investments &amp; net worth snapshot</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close report"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-3 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground block">Income</span>
              <span className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{formatINR(summary.totalIncome)}</span>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground block">Expenses</span>
              <span className="text-base font-bold font-mono tabular-nums text-foreground">{formatINR(summary.totalSpent)}</span>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground block">SIP / Invest</span>
              <span className="text-base font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400">{formatINR(summary.totalInvested)}</span>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground block">Savings Rate</span>
              <span className="text-base font-bold font-mono tabular-nums text-foreground">{summary.savingsRate}%</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Net Worth ({formatINR(netWorth.totalAssets)} assets − {formatINR(netWorth.totalLiabilities)} debt)
            </span>
            <span className="text-sm font-bold font-mono tabular-nums text-foreground">{formatINR(netWorth.netWorth)}</span>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top Expense Categories</h4>
            {categoryBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">No expenses logged this month.</p>
            ) : (
              <div className="space-y-2">
                {categoryBreakdown.slice(0, 6).map((c) => {
                  const pct = summary.totalSpent > 0 ? Math.round((c.spent / summary.totalSpent) * 100) : 0;
                  return (
                    <div key={c.category.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{c.category.name}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          <strong className="text-foreground">{formatINR(c.spent)}</strong> · {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: c.category.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-border bg-background flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCopySummary} className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold">
            <Copy className="w-3.5 h-3.5" />
            Copy Summary
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold">
            <Printer className="w-3.5 h-3.5" />
            Print
          </Button>
          <Button type="button" size="sm" onClick={onExportCsv} className="h-9 px-3.5 rounded-xl gap-1.5 text-xs font-semibold">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
