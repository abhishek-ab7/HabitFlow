'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatINR } from '@/lib/stores/finance/helpers';
import { useFinanceStore } from '@/lib/stores/finance-store';
import type { CreditCardStatement, FinanceAccount } from '@/lib/types';
import {
  getCycleWindowForMonth,
  getLocalIsoDate,
  formatShortDate,
  resolveTransactionCycle,
  roundCurrency,
} from '@/lib/finance/credit-card-cycles';
import { Calculator, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ReconcileStatementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: FinanceAccount;
  statement?: CreditCardStatement | null;
  defaultCycleKey?: string;
}

function isTrackableCardExpense(tx: ReturnType<typeof useFinanceStore.getState>['transactions'][number], cardId: string): boolean {
  if (tx.accountId !== cardId || tx.deletedAt) return false;
  return !tx.isCreditCardPayment && tx.type !== 'transfer';
}

function computeCycleTrackedSpend(params: {
  transactions: ReturnType<typeof useFinanceStore.getState>['transactions'];
  cardId: string;
  cycleKey: string;
  billingDay: number;
  dueDay: number;
}): number {
  const { transactions, cardId, cycleKey, billingDay, dueDay } = params;
  let total = 0;
  for (const tx of transactions) {
    if (!isTrackableCardExpense(tx, cardId)) continue;
    if (resolveTransactionCycle(tx.date, billingDay, dueDay, tx.statementCycleKey) !== cycleKey) continue;
    total = roundCurrency(tx.type === 'income' ? total - tx.amount : total + tx.amount);
  }
  return total;
}

function ReconcileCycleBanner(props: {
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  calculatedSpend: number;
}) {
  return (
    <div className="rounded-xl bg-muted/50 border border-border/70 p-3.5 space-y-2 text-xs">
      <div className="flex justify-between items-center text-foreground">
        <span className="text-muted-foreground">Billing Cycle:</span>
        <span className="font-semibold text-foreground whitespace-nowrap">
          {formatShortDate(props.periodStart)} – {formatShortDate(props.periodEnd)}
        </span>
      </div>
      <div className="flex justify-between items-center text-foreground">
        <span className="text-muted-foreground">Payment Due Date:</span>
        <span className="font-bold text-warning whitespace-nowrap">{formatShortDate(props.dueDate)}</span>
      </div>
      <div className="flex justify-between items-center text-foreground pt-1.5 border-t border-border/60">
        <span className="text-muted-foreground">Tracked Spends in HabitFlow:</span>
        <span className="font-semibold text-foreground tabular-nums">{formatINR(props.calculatedSpend)}</span>
      </div>
    </div>
  );
}

function StatementAdjustmentBanner({ adjustment }: { adjustment: number }) {
  if (Math.abs(adjustment) < 0.01) {
    return (
      <div className="rounded-xl p-3 text-xs bg-muted/40 border border-border/60">
        <div className="flex items-center gap-1.5 text-success font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Exact match! No manual adjustment needed.</span>
        </div>
      </div>
    );
  }
  const isPositive = adjustment > 0;
  return (
    <div className="rounded-xl p-3 text-xs bg-muted/40 border border-border/60">
      <div className={`flex items-start gap-2 ${isPositive ? 'text-primary' : 'text-warning'}`}>
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold tabular-nums">
            Adjustment: {isPositive ? '+' : '-'}{formatINR(Math.abs(adjustment))}
          </span>
          <p className="text-muted-foreground text-[11px] mt-0.5">
            {isPositive
              ? 'Accounted as untracked historical spend or opening balance.'
              : 'Accounted as credits, refunds, or cashback discounts.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ReconcileStatementModal({
  open,
  onOpenChange,
  card,
  statement,
  defaultCycleKey,
}: ReconcileStatementModalProps) {
  const transactions = useFinanceStore((s) => s.transactions);
  const reconcileCreditCardStatement = useFinanceStore((s) => s.reconcileCreditCardStatement);

  const billingDay = card.billingDay ?? card.statementDay ?? 1;
  const dueDay = card.dueDay ?? 20;
  const currentMonthKey = getLocalIsoDate().slice(0, 7);
  const initialCycleKey = statement?.cycleKey || defaultCycleKey || currentMonthKey;

  const [cycleKey, setCycleKey] = useState(initialCycleKey);
  const [actualAmount, setActualAmount] = useState('');
  const [note, setNote] = useState(statement?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [cYear, cMonth] = (cycleKey || currentMonthKey).split('-').map(Number);
  const cycleWindow = getCycleWindowForMonth(billingDay, dueDay, cYear, cMonth - 1, card.gracePeriodDays);
  const calculatedSpend = computeCycleTrackedSpend({ transactions, cardId: card.id, cycleKey, billingDay, dueDay });

  useEffect(() => {
    if (!open) return;
    setCycleKey(statement?.cycleKey || defaultCycleKey || currentMonthKey);
    const cardBal = Math.abs(card.balance || 0);
    const fallbackTotal = calculatedSpend > 0 ? calculatedSpend : cardBal > 0 ? cardBal : '';
    const initialTotal = statement ? statement.totalDue : fallbackTotal;
    setActualAmount(initialTotal ? String(initialTotal) : '');
    setNote(statement?.notes || '');
  }, [open, statement, defaultCycleKey, currentMonthKey, calculatedSpend, card.balance]);

  const numActual = parseFloat(actualAmount) || 0;
  const adjustment = roundCurrency(numActual - calculatedSpend);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numActual < 0) {
      toast.error('Statement amount cannot be negative');
      return;
    }
    setIsSubmitting(true);
    try {
      await reconcileCreditCardStatement({
        cardAccountId: card.id,
        cycleKey,
        actualStatementAmount: numActual,
        note: note.trim() || undefined,
      });
      toast.success(`Statement for ${cycleKey} saved successfully!`);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to reconcile statement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border border-border text-card-foreground shadow-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">Reconcile Statement / Set Opening Bill</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Set or adjust the official bank statement amount for {card.name}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <ReconcileCycleBanner
            periodStart={cycleWindow.periodStart}
            periodEnd={cycleWindow.periodEnd}
            dueDate={cycleWindow.dueDate}
            calculatedSpend={calculatedSpend}
          />

          <div className="space-y-1.5">
            <Label htmlFor="actualAmount" className="text-xs font-semibold text-foreground">Official Statement Bill Amount (₹) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">₹</span>
              <Input
                id="actualAmount"
                type="number"
                step="any"
                min="0"
                placeholder="22000"
                value={actualAmount}
                onChange={(e) => setActualAmount(e.target.value)}
                className="pl-7 bg-background border-border text-foreground text-base font-semibold tabular-nums focus-visible:ring-primary h-11"
                required
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Enter the exact amount generated by the bank (e.g. ₹22,000 for your Slice bill).</p>
          </div>

          {actualAmount !== '' && <StatementAdjustmentBanner adjustment={adjustment} />}

          <div className="space-y-1.5">
            <Label htmlFor="note" className="text-xs font-semibold text-foreground">Note (Optional)</Label>
            <Input
              id="note"
              type="text"
              placeholder="e.g., Nov 21 Slice opening statement"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9"
            />
          </div>

          <DialogFooter className="pt-2 sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border text-foreground hover:bg-muted text-xs font-medium">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold">
              {isSubmitting ? 'Saving...' : 'Save Statement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
