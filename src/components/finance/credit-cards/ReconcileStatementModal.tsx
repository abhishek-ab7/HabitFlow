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

function resolveInitialStatementAmount(params: {
  statement?: CreditCardStatement | null;
  calculatedSpend: number;
  cardBalance?: number;
}): string {
  if (params.statement) return String(params.statement.totalDue);
  if (params.calculatedSpend > 0) return String(params.calculatedSpend);
  const absBal = Math.abs(params.cardBalance || 0);
  return absBal > 0 ? String(absBal) : '';
}

async function submitReconcileStatementAction(params: {
  cardId: string;
  cycleKey: string;
  numActual: number;
  note: string;
  reconcileCreditCardStatement: ReturnType<typeof useFinanceStore.getState>['reconcileCreditCardStatement'];
  onOpenChange: (open: boolean) => void;
}) {
  await params.reconcileCreditCardStatement({
    cardAccountId: params.cardId,
    cycleKey: params.cycleKey,
    actualStatementAmount: params.numActual,
    note: params.note.trim() || undefined,
  });
  toast.success(`Statement for ${params.cycleKey} saved successfully!`);
  params.onOpenChange(false);
}

function computeCycleAndSpend(params: {
  card: FinanceAccount;
  cycleKey: string;
  currentMonthKey: string;
  transactions: ReturnType<typeof useFinanceStore.getState>['transactions'];
}) {
  const { card, cycleKey, currentMonthKey, transactions } = params;
  const billingDay = card.billingDay ?? card.statementDay ?? 1;
  const dueDay = card.dueDay ?? 20;
  const [cYear, cMonth] = (cycleKey || currentMonthKey).split('-').map(Number);
  const cycleWindow = getCycleWindowForMonth(billingDay, dueDay, cYear, cMonth - 1, card.gracePeriodDays);
  const calculatedSpend = computeCycleTrackedSpend({ transactions, cardId: card.id, cycleKey, billingDay, dueDay });
  return { cycleWindow, calculatedSpend };
}

async function executeReconcileWithFeedback(params: {
  cardId: string;
  cycleKey: string;
  numActual: number;
  note: string;
  reconcileCreditCardStatement: ReturnType<typeof useFinanceStore.getState>['reconcileCreditCardStatement'];
  onOpenChange: (open: boolean) => void;
  setIsSubmitting: (v: boolean) => void;
}) {
  params.setIsSubmitting(true);
  try {
    await submitReconcileStatementAction(params);
  } catch (err) {
    console.error(err);
    toast.error(err instanceof Error ? err.message : 'Failed to reconcile statement');
  } finally {
    params.setIsSubmitting(false);
  }
}

function useReconcileResetEffect(params: {
  open: boolean;
  statement?: CreditCardStatement | null;
  defaultCycleKey?: string;
  currentMonthKey: string;
  calculatedSpend: number;
  cardBalance?: number;
  setCycleKey: (v: string) => void;
  setActualAmount: (v: string) => void;
  setNote: (v: string) => void;
}) {
  const { open, statement, defaultCycleKey, currentMonthKey, calculatedSpend, cardBalance, setCycleKey, setActualAmount, setNote } = params;
  useEffect(() => {
    if (!open) return;
    setCycleKey(statement?.cycleKey || defaultCycleKey || currentMonthKey);
    setActualAmount(resolveInitialStatementAmount({ statement, calculatedSpend, cardBalance }));
    setNote(statement?.notes || '');
  }, [open, statement, defaultCycleKey, currentMonthKey, calculatedSpend, cardBalance, setCycleKey, setActualAmount, setNote]);
}

function createReconcileSubmitHandler(params: {
  cardId: string;
  cycleKey: string;
  numActual: number;
  note: string;
  reconcileCreditCardStatement: ReturnType<typeof useFinanceStore.getState>['reconcileCreditCardStatement'];
  onOpenChange: (open: boolean) => void;
  setIsSubmitting: (v: boolean) => void;
}) {
  return async (e: React.FormEvent) => {
    e.preventDefault();
    if (params.numActual < 0) {
      toast.error('Statement amount cannot be negative');
      return;
    }
    await executeReconcileWithFeedback(params);
  };
}

function useReconcileStatementForm(params: {
  open: boolean;
  card: FinanceAccount;
  statement?: CreditCardStatement | null;
  defaultCycleKey?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { open, card, statement, defaultCycleKey, onOpenChange } = params;
  const transactions = useFinanceStore((s) => s.transactions);
  const reconcileCreditCardStatement = useFinanceStore((s) => s.reconcileCreditCardStatement);

  const currentMonthKey = getLocalIsoDate().slice(0, 7);
  const [cycleKey, setCycleKey] = useState(statement?.cycleKey || defaultCycleKey || currentMonthKey);
  const [actualAmount, setActualAmount] = useState('');
  const [note, setNote] = useState(statement?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { cycleWindow, calculatedSpend } = computeCycleAndSpend({ card, cycleKey, currentMonthKey, transactions });

  useReconcileResetEffect({
    open, statement, defaultCycleKey, currentMonthKey, calculatedSpend, cardBalance: card.balance, setCycleKey, setActualAmount, setNote,
  });

  const numActual = parseFloat(actualAmount) || 0;
  const handleSave = createReconcileSubmitHandler({
    cardId: card.id, cycleKey, numActual, note, reconcileCreditCardStatement, onOpenChange, setIsSubmitting,
  });

  return {
    actualAmount, setActualAmount,
    note, setNote,
    isSubmitting,
    cycleWindow,
    calculatedSpend,
    adjustment: roundCurrency(numActual - calculatedSpend),
    handleSave,
  };
}

export function ReconcileStatementModal({
  open,
  onOpenChange,
  card,
  statement,
  defaultCycleKey,
}: ReconcileStatementModalProps) {
  const form = useReconcileStatementForm({ open, card, statement, defaultCycleKey, onOpenChange });

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

        <form onSubmit={form.handleSave} className="space-y-4 pt-2">
          <ReconcileCycleBanner
            periodStart={form.cycleWindow.periodStart}
            periodEnd={form.cycleWindow.periodEnd}
            dueDate={form.cycleWindow.dueDate}
            calculatedSpend={form.calculatedSpend}
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
                value={form.actualAmount}
                onChange={(e) => form.setActualAmount(e.target.value)}
                className="pl-7 bg-background border-border text-foreground text-base font-semibold tabular-nums focus-visible:ring-primary h-11"
                required
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Enter the exact amount generated by the bank (e.g. ₹22,000 for your Slice bill).</p>
          </div>

          {form.actualAmount !== '' && <StatementAdjustmentBanner adjustment={form.adjustment} />}

          <div className="space-y-1.5">
            <Label htmlFor="note" className="text-xs font-semibold text-foreground">Note (Optional)</Label>
            <Input
              id="note"
              type="text"
              placeholder="e.g., Nov 21 Slice opening statement"
              value={form.note}
              onChange={(e) => form.setNote(e.target.value)}
              className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9"
            />
          </div>

          <DialogFooter className="pt-2 sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border text-foreground hover:bg-muted text-xs font-medium">Cancel</Button>
            <Button type="submit" disabled={form.isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold">
              {form.isSubmitting ? 'Saving...' : 'Save Statement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
