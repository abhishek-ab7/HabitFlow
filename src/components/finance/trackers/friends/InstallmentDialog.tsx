'use client';

import React, { useState, useEffect } from 'react';
import type { DebtRecord, DebtInstallment, DebtPaymentMethod, FinanceAccount } from '@/lib/types';
import { formatINR } from '@/lib/stores/finance-store';
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
import { toast } from 'sonner';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';

interface InstallmentDialogProps {
  debt: DebtRecord | null;
  editingInstallment: DebtInstallment | null;
  isOpen: boolean;
  onClose: () => void;
  accounts: FinanceAccount[];
  onRecordInstallment: (data: {
    debtId: string;
    amount: number;
    date?: string;
    paymentMethod: DebtPaymentMethod;
    accountId?: string;
    note?: string;
  }) => Promise<unknown>;
  onUpdateInstallment: (
    id: string,
    updates: Partial<DebtInstallment>
  ) => Promise<unknown>;
}

export function InstallmentDialog({
  debt,
  editingInstallment,
  isOpen,
  onClose,
  accounts,
  onRecordInstallment,
  onUpdateInstallment,
}: InstallmentDialogProps) {
  const [instAmount, setInstAmount] = useState('');
  const [instDate, setInstDate] = useState(() => getLocalIsoDate());
  const [instMethod, setInstMethod] = useState<DebtPaymentMethod>('upi');
  const [instAccountId, setInstAccountId] = useState('');
  const [instNote, setInstNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingInstallment) {
        setInstAmount(String(editingInstallment.amount));
        setInstDate(editingInstallment.date);
        setInstMethod(editingInstallment.paymentMethod);
        setInstAccountId('');
        setInstNote(editingInstallment.note || '');
      } else if (debt) {
        const suggestedAmt = debt.emiAmount || debt.plannedMonthlyInstallment || debt.remainingAmount;
        setInstAmount(String(suggestedAmt));
        setInstDate(getLocalIsoDate());
        setInstMethod('upi');
        setInstAccountId(accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || '');
        setInstNote('');
      }
    }
  }, [isOpen, editingInstallment, debt, accounts]);

  if (!debt && !editingInstallment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(instAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingInstallment) {
        await onUpdateInstallment(editingInstallment.id, {
          amount: amt,
          date: instDate || editingInstallment.date,
          paymentMethod: instMethod,
          note: instNote.trim() || undefined,
        });
        toast.success('Updated installment log');
      } else if (debt) {
        await onRecordInstallment({
          debtId: debt.id,
          amount: amt,
          date: instDate || undefined,
          paymentMethod: instMethod,
          accountId: instAccountId || undefined,
          note: instNote.trim() || undefined,
        });
        toast.success(
          debt.direction === 'borrowed'
            ? `Recorded ${formatINR(amt)} paid to ${debt.personName}`
            : `Recorded ${formatINR(amt)} received from ${debt.personName}`
        );
      }
      onClose();
    } catch {
      toast.error('Failed to save installment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingInstallment ? 'Edit Installment Log' : 'Record Loan Repayment'}
          </DialogTitle>
          <DialogDescription>
            {editingInstallment
              ? 'Update previously recorded repayment entry.'
              : `Log repayment towards ${debt?.title} (${debt?.personName}).`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inst-amount-modal" className="text-xs">
                Amount (₹)
              </Label>
              <Input
                id="inst-amount-modal"
                type="number"
                step="any"
                min="1"
                value={instAmount}
                onChange={(e) => setInstAmount(e.target.value)}
                required
                className="rounded-xl font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-date-modal" className="text-xs">
                Date
              </Label>
              <Input
                id="inst-date-modal"
                type="date"
                value={instDate}
                onChange={(e) => setInstDate(e.target.value)}
                required
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inst-method-modal" className="text-xs">
              Payment Method
            </Label>
            <select
              id="inst-method-modal"
              value={instMethod}
              onChange={(e) => setInstMethod(e.target.value as DebtPaymentMethod)}
              className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
            >
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="offset_expense">Offset Adjustment</option>
            </select>
          </div>

          {!editingInstallment && instMethod !== 'cash' && instMethod !== 'offset_expense' && (
            <div className="space-y-1.5">
              <Label htmlFor="inst-account-modal" className="text-xs">
                Paid via Account (Optional Sync)
              </Label>
              <select
                id="inst-account-modal"
                value={instAccountId}
                onChange={(e) => setInstAccountId(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
              >
                <option value="">No account transaction</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatINR(a.balance)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="inst-note-modal" className="text-xs">
              Note
            </Label>
            <Input
              id="inst-note-modal"
              value={instNote}
              onChange={(e) => setInstNote(e.target.value)}
              placeholder="e.g. Monthly installment payment"
              className="rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl text-xs">
              {isSubmitting ? 'Saving...' : editingInstallment ? 'Update Log' : 'Save Repayment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
