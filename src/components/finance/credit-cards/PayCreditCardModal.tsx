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
import { Landmark, ArrowRight, ShieldCheck, Calendar, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface PayCreditCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: FinanceAccount;
  statement?: CreditCardStatement | null;
  defaultAmount?: number;
}

export function PayCreditCardModal({
  open,
  onOpenChange,
  card,
  statement,
  defaultAmount,
}: PayCreditCardModalProps) {
  const accounts = useFinanceStore((s) => s.accounts);
  const payCreditCardBill = useFinanceStore((s) => s.payCreditCardBill);

  const bankAccounts = accounts.filter(
    (a) =>
      (a.type === 'bank' || a.type === 'upi' || a.type === 'wallet' || a.type === 'cash') &&
      !a.archived &&
      !a.deletedAt
  );

  const defaultBank = bankAccounts.find((a) => a.isDefault) || bankAccounts[0];

  const suggestedAmount =
    defaultAmount !== undefined
      ? defaultAmount
      : statement?.remainingDue !== undefined
      ? statement.remainingDue
      : Math.abs(card.balance || 0);

  const [fromAccountId, setFromAccountId] = useState(defaultBank?.id || '');
  const [amount, setAmount] = useState(String(suggestedAmount || ''));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (defaultBank && !fromAccountId) {
        setFromAccountId(defaultBank.id);
      }
      setAmount(String(suggestedAmount > 0 ? suggestedAmount : ''));
      setDate(new Date().toISOString().slice(0, 10));
      setNote('');
    }
  }, [open, suggestedAmount, defaultBank]);

  const selectedBank = accounts.find((a) => a.id === fromAccountId);
  const numAmount = parseFloat(amount) || 0;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId) {
      toast.error('Please select a payment account');
      return;
    }
    if (numAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await payCreditCardBill({
        cardAccountId: card.id,
        fromAccountId,
        amount: numAmount,
        date,
        statementId: statement?.id,
        note: note.trim() || undefined,
      });

      toast.success(`Paid ${formatINR(numAmount)} towards ${card.name}!`);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border text-card-foreground shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4" />
            </span>
            <span>Pay {card.name}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {statement
              ? `Statement (${statement.periodStart} – ${statement.periodEnd}) · Due ${statement.dueDate}`
              : `Current outstanding balance: ${formatINR(suggestedAmount)}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handlePay} className="space-y-4 pt-2">
          {/* Quick Pay From Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Pay From (Bank / UPI)</Label>
            <div className="grid grid-cols-1 gap-2">
              {bankAccounts.map((acc) => {
                const isSelected = acc.id === fromAccountId;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setFromAccountId(acc.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                        <Landmark className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{acc.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
                          Balance: {formatINR(acc.balance)}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cc-pay-amount" className="text-xs font-semibold text-muted-foreground">
                Payment Amount (₹)
              </Label>
              {suggestedAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(suggestedAmount))}
                  className="text-[11px] text-primary font-semibold hover:underline"
                >
                  Pay Full ({formatINR(suggestedAmount)})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                ₹
              </span>
              <Input
                id="cc-pay-amount"
                type="number"
                step="0.01"
                min="1"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8 text-base font-bold font-mono tabular-nums"
                required
              />
            </div>
          </div>

          {/* Date & Note */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cc-pay-date" className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Date
              </Label>
              <Input
                id="cc-pay-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-pay-note" className="text-xs text-muted-foreground">
                Optional Note
              </Label>
              <Input
                id="cc-pay-note"
                type="text"
                placeholder="e.g. Cred / GPay"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Transfer Info Pill */}
          <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
              <span className="font-medium text-foreground truncate">{selectedBank?.name || 'Bank'}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium text-foreground truncate">{card.name}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Not double-counted</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || numAmount <= 0}
              className="font-semibold"
            >
              {isSubmitting ? 'Processing...' : `Pay ${formatINR(numAmount)}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
