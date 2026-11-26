'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatINR } from '@/lib/stores/finance/helpers';
import { useFinanceStore } from '@/lib/stores/finance-store';
import type { CreditCardStatement, FinanceAccount } from '@/lib/types';
import { getLocalIsoDate, formatShortDate } from '@/lib/finance/credit-card-cycles';
import { Landmark, ArrowRight, ShieldCheck, Calendar, CreditCard } from 'lucide-react';
import { useFeedback } from '@/hooks/use-feedback';
import { toast } from 'sonner';

interface PayCreditCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: FinanceAccount;
  statement?: CreditCardStatement | null;
  defaultAmount?: number;
}

const PAYABLE_ACCOUNT_TYPES = new Set(['bank', 'upi', 'wallet', 'cash']);

function PayFromAccountSelector(props: {
  bankAccounts: FinanceAccount[];
  fromAccountId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">Pay From (Bank / UPI)</Label>
      <div className="grid grid-cols-1 gap-2">
        {props.bankAccounts.map((acc) => {
          const isSelected = acc.id === props.fromAccountId;
          return (
            <button
              key={acc.id}
              type="button"
              onClick={() => props.onSelect(acc.id)}
              className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                  <Landmark className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{acc.name}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">Balance: {formatINR(acc.balance)}</p>
                </div>
              </div>
              {isSelected && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getPayableBankAccounts(accounts: FinanceAccount[]): FinanceAccount[] {
  return accounts.filter((a) => PAYABLE_ACCOUNT_TYPES.has(a.type) && !a.archived && !a.deletedAt);
}

async function submitCardPayment(params: {
  card: FinanceAccount;
  fromAccountId: string;
  numAmount: number;
  date: string;
  statementId?: string;
  note: string;
  payCreditCardBill: ReturnType<typeof useFinanceStore.getState>['payCreditCardBill'];
  onOpenChange: (open: boolean) => void;
  setIsSubmitting: (v: boolean) => void;
}) {
  params.setIsSubmitting(true);
  try {
    await params.payCreditCardBill({
      cardAccountId: params.card.id,
      fromAccountId: params.fromAccountId,
      amount: params.numAmount,
      date: params.date,
      statementId: params.statementId,
      note: params.note.trim() || undefined,
    });
    toast.success(`Paid ${formatINR(params.numAmount)} towards ${params.card.name}!`);
    params.onOpenChange(false);
  } catch (err) {
    console.error(err);
    toast.error(err instanceof Error ? err.message : 'Failed to process payment');
  } finally {
    params.setIsSubmitting(false);
  }
}

function usePayCardResetEffect(params: {
  open: boolean;
  defaultBank?: FinanceAccount;
  fromAccountId: string;
  suggestedAmount: number;
  setFromAccountId: (v: string) => void;
  setAmount: (v: string) => void;
  setDate: (v: string) => void;
  setNote: (v: string) => void;
}) {
  const { open, defaultBank, fromAccountId, suggestedAmount, setFromAccountId, setAmount, setDate, setNote } = params;
  useEffect(() => {
    if (!open) return;
    if (defaultBank && !fromAccountId) setFromAccountId(defaultBank.id);
    setAmount(suggestedAmount > 0 ? String(suggestedAmount) : '');
    setDate(getLocalIsoDate());
    setNote('');
  }, [open, suggestedAmount, defaultBank, fromAccountId, setFromAccountId, setAmount, setDate, setNote]);
}

function resolveSuggestedPayAmount(params: {
  defaultAmount?: number;
  statement?: CreditCardStatement | null;
  cardBalance?: number;
}): number {
  return params.defaultAmount ?? params.statement?.remainingDue ?? Math.abs(params.cardBalance || 0);
}

function createPayCardHandler(params: {
  card: FinanceAccount;
  fromAccountId: string;
  numAmount: number;
  date: string;
  statementId?: string;
  note: string;
  payCreditCardBill: ReturnType<typeof useFinanceStore.getState>['payCreditCardBill'];
  onOpenChange: (open: boolean) => void;
  setIsSubmitting: (v: boolean) => void;
  feedback: ReturnType<typeof useFeedback>;
}) {
  return async (e: React.FormEvent) => {
    e.preventDefault();
    if (!params.fromAccountId || params.numAmount <= 0) {
      params.feedback.error();
      toast.error(!params.fromAccountId ? 'Please select a payment account' : 'Please enter a valid payment amount');
      return;
    }
    params.feedback.coin();
    await submitCardPayment(params);
  };
}

function usePayCreditCardForm(params: {
  open: boolean;
  card: FinanceAccount;
  statement?: CreditCardStatement | null;
  defaultAmount?: number;
  onOpenChange: (open: boolean) => void;
}) {
  const { open, card, statement, defaultAmount, onOpenChange } = params;
  const accounts = useFinanceStore((s) => s.accounts);
  const payCreditCardBill = useFinanceStore((s) => s.payCreditCardBill);

  const bankAccounts = getPayableBankAccounts(accounts);
  const defaultBank = bankAccounts.find((a) => a.isDefault) || bankAccounts[0];
  const suggestedAmount = resolveSuggestedPayAmount({ defaultAmount, statement, cardBalance: card.balance });

  const [fromAccountId, setFromAccountId] = useState(defaultBank?.id || '');
  const [amount, setAmount] = useState(suggestedAmount > 0 ? String(suggestedAmount) : '');
  const [date, setDate] = useState(() => getLocalIsoDate());
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const feedback = useFeedback();

  usePayCardResetEffect({
    open, defaultBank, fromAccountId, suggestedAmount, setFromAccountId, setAmount, setDate, setNote,
  });

  const numAmount = parseFloat(amount) || 0;
  const handlePay = createPayCardHandler({
    card, fromAccountId, numAmount, date, statementId: statement?.id, note, payCreditCardBill, onOpenChange, setIsSubmitting, feedback,
  });

  return {
    bankAccounts,
    selectedBank: accounts.find((a) => a.id === fromAccountId),
    suggestedAmount,
    fromAccountId, setFromAccountId,
    amount, setAmount,
    date, setDate,
    note, setNote,
    numAmount,
    isSubmitting,
    handlePay,
  };
}

export function PayCreditCardModal({
  open,
  onOpenChange,
  card,
  statement,
  defaultAmount,
}: PayCreditCardModalProps) {
  const form = usePayCreditCardForm({ open, card, statement, defaultAmount, onOpenChange });
  const description = statement
    ? `Statement (${formatShortDate(statement.periodStart)} – ${formatShortDate(statement.periodEnd)}) · Due ${formatShortDate(statement.dueDate)}`
    : `Current outstanding balance: ${formatINR(form.suggestedAmount)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border text-card-foreground shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4" />
            </span>
            <span>Pay {card.name}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handlePay} className="space-y-4 pt-2">
          <PayFromAccountSelector
            bankAccounts={form.bankAccounts}
            fromAccountId={form.fromAccountId}
            onSelect={form.setFromAccountId}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cc-pay-amount" className="text-xs font-semibold text-muted-foreground">Payment Amount (₹)</Label>
              {form.suggestedAmount > 0 && (
                <button
                  type="button"
                  onClick={() => form.setAmount(String(form.suggestedAmount))}
                  className="text-[11px] text-primary font-semibold hover:underline"
                >
                  Pay Full ({formatINR(form.suggestedAmount)})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
              <Input
                id="cc-pay-amount"
                type="number"
                step="0.01"
                min="1"
                placeholder="0"
                value={form.amount}
                onChange={(e) => form.setAmount(e.target.value)}
                className="pl-8 text-base font-bold tabular-nums"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cc-pay-date" className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Date
              </Label>
              <Input id="cc-pay-date" type="date" value={form.date} onChange={(e) => form.setDate(e.target.value)} className="text-xs tabular-nums" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-pay-note" className="text-xs text-muted-foreground">Optional Note</Label>
              <Input id="cc-pay-note" type="text" placeholder="e.g. Cred / GPay" value={form.note} onChange={(e) => form.setNote(e.target.value)} className="text-xs" />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
              <span className="font-medium text-foreground truncate">{form.selectedBank?.name || 'Bank'}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium text-foreground truncate">{card.name}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-success font-semibold shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Not double-counted</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={form.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={form.isSubmitting || form.numAmount <= 0} className="font-semibold">
              {form.isSubmitting ? 'Processing...' : `Pay ${formatINR(form.numAmount)}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
