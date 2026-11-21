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
  resolveTransactionCycle,
} from '@/lib/finance/credit-card-cycles';
import { Calculator, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ReconcileStatementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: FinanceAccount;
  statement?: CreditCardStatement | null;
  defaultCycleKey?: string;
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
  const gracePeriodDays = card.gracePeriodDays;

  // Determine cycleKey to reconcile
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const initialCycleKey = statement?.cycleKey || defaultCycleKey || currentMonthKey;

  const [cycleKey, setCycleKey] = useState(initialCycleKey);
  const [actualAmount, setActualAmount] = useState('');
  const [note, setNote] = useState(statement?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute cycle window for the selected cycleKey
  const [cYear, cMonth] = (cycleKey || currentMonthKey).split('-').map(Number);
  const cycleWindow = getCycleWindowForMonth(billingDay, dueDay, cYear, cMonth - 1, gracePeriodDays);

  // Calculate sum of tracked transactions for this cycle
  const trackedTransactions = transactions.filter(
    (t) =>
      t.accountId === card.id &&
      !t.deletedAt &&
      !t.isCreditCardPayment &&
      t.type !== 'transfer'
  );

  let calculatedSpend = 0;
  for (const tx of trackedTransactions) {
    const txCycle = resolveTransactionCycle(tx.date, billingDay, dueDay, tx.statementCycleKey);
    if (txCycle === cycleKey) {
      if (tx.type === 'expense') calculatedSpend += tx.amount;
      else if (tx.type === 'income' || tx.type === 'investment') calculatedSpend -= tx.amount;
    }
  }

  useEffect(() => {
    if (open) {
      const activeKey = statement?.cycleKey || defaultCycleKey || currentMonthKey;
      setCycleKey(activeKey);
      const initialTotal = statement ? statement.totalDue : calculatedSpend > 0 ? calculatedSpend : '';
      setActualAmount(initialTotal ? String(initialTotal) : '');
      setNote(statement?.notes || '');
    }
  }, [open, statement, defaultCycleKey, currentMonthKey, calculatedSpend]);

  const numActual = parseFloat(actualAmount) || 0;
  const adjustment = numActual - calculatedSpend;

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
      <DialogContent className="sm:max-w-md bg-zinc-950 border border-zinc-800 text-zinc-100">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-zinc-100">
                Reconcile Statement / Set Opening Bill
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Set or adjust the official bank statement amount for {card.name}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {/* Cycle Info Banner */}
          <div className="rounded-lg bg-zinc-900/80 border border-zinc-800 p-3 space-y-2 text-xs">
            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-500">Billing Cycle:</span>
              <span className="font-medium text-zinc-200">
                {cycleWindow.periodStart} to {cycleWindow.periodEnd}
              </span>
            </div>
            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-500">Payment Due Date:</span>
              <span className="font-semibold text-amber-400">{cycleWindow.dueDate}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-300 pt-1 border-t border-zinc-800/80">
              <span className="text-zinc-500">Tracked Spends in HabitFlow:</span>
              <span className="font-medium text-zinc-200">{formatINR(calculatedSpend)}</span>
            </div>
          </div>

          {/* Actual Statement Amount Input */}
          <div className="space-y-1.5">
            <Label htmlFor="actualAmount" className="text-xs font-medium text-zinc-300">
              Official Statement Bill Amount (₹) *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">₹</span>
              <Input
                id="actualAmount"
                type="number"
                step="any"
                min="0"
                placeholder="22000"
                value={actualAmount}
                onChange={(e) => setActualAmount(e.target.value)}
                className="pl-7 bg-zinc-900 border-zinc-700 text-zinc-100 text-base font-semibold focus-visible:ring-indigo-500"
                required
                autoFocus
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              Enter the exact amount generated by the bank (e.g. ₹22,000 for your Slice bill).
            </p>
          </div>

          {/* Live Adjustment Calculation */}
          {actualAmount !== '' && (
            <div className="rounded-lg p-2.5 text-xs bg-zinc-900/50 border border-zinc-800/80">
              {Math.abs(adjustment) < 0.01 ? (
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Exact match! No manual adjustment needed.</span>
                </div>
              ) : adjustment > 0 ? (
                <div className="flex items-start gap-1.5 text-blue-400">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">Adjustment: +{formatINR(adjustment)}</span>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Accounted as untracked historical spend or opening balance.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1.5 text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">Adjustment: -{formatINR(Math.abs(adjustment))}</span>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Accounted as credits, refunds, or cashback discounts.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes Input */}
          <div className="space-y-1.5">
            <Label htmlFor="note" className="text-xs font-medium text-zinc-300">
              Note (Optional)
            </Label>
            <Input
              id="note"
              type="text"
              placeholder="e.g., Nov 21 Slice opening statement"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-zinc-200 text-xs focus-visible:ring-indigo-500"
            />
          </div>

          <DialogFooter className="pt-2 sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
            >
              {isSubmitting ? 'Saving...' : 'Save Statement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
