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

async function saveInstallmentSubmission(params: {
  amt: number;
  instDate: string;
  instMethod: DebtPaymentMethod;
  instAccountId: string;
  instNote: string;
  debt: DebtRecord | null;
  editingInstallment: DebtInstallment | null;
  onRecordInstallment: InstallmentDialogProps['onRecordInstallment'];
  onUpdateInstallment: InstallmentDialogProps['onUpdateInstallment'];
}) {
  const { amt, instDate, instMethod, instAccountId, instNote, debt, editingInstallment } = params;
  if (editingInstallment) {
    await params.onUpdateInstallment(editingInstallment.id, {
      amount: amt,
      date: instDate || editingInstallment.date,
      paymentMethod: instMethod,
      note: instNote.trim() || undefined,
    });
    toast.success('Updated installment log');
    return;
  }
  if (!debt) return;
  await params.onRecordInstallment({
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

function getDefaultInstallmentForDebt(debt: DebtRecord, accounts: FinanceAccount[]) {
  const suggestedAmt = debt.emiAmount || debt.plannedMonthlyInstallment || debt.remainingAmount;
  const defaultAccId = accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || '';
  return {
    amount: String(suggestedAmt),
    date: getLocalIsoDate(),
    method: 'upi' as DebtPaymentMethod,
    accountId: defaultAccId,
    note: '',
  };
}

function getInitialInstallmentValues(
  editingInstallment: DebtInstallment | null,
  debt: DebtRecord | null,
  accounts: FinanceAccount[]
) {
  if (editingInstallment) {
    return {
      amount: String(editingInstallment.amount),
      date: editingInstallment.date,
      method: editingInstallment.paymentMethod,
      accountId: '',
      note: editingInstallment.note || '',
    };
  }
  if (debt) return getDefaultInstallmentForDebt(debt, accounts);
  return { amount: '', date: getLocalIsoDate(), method: 'upi' as DebtPaymentMethod, accountId: '', note: '' };
}

function useInstallmentForm(params: {
  debt: DebtRecord | null;
  editingInstallment: DebtInstallment | null;
  isOpen: boolean;
  accounts: FinanceAccount[];
  onRecordInstallment: InstallmentDialogProps['onRecordInstallment'];
  onUpdateInstallment: InstallmentDialogProps['onUpdateInstallment'];
  onClose: () => void;
}) {
  const { debt, editingInstallment, isOpen, accounts, onRecordInstallment, onUpdateInstallment, onClose } = params;
  const [instAmount, setInstAmount] = useState('');
  const [instDate, setInstDate] = useState(() => getLocalIsoDate());
  const [instMethod, setInstMethod] = useState<DebtPaymentMethod>('upi');
  const [instAccountId, setInstAccountId] = useState('');
  const [instNote, setInstNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (!editingInstallment && !debt) return;
    const init = getInitialInstallmentValues(editingInstallment, debt, accounts);
    setInstAmount(init.amount);
    setInstDate(init.date);
    setInstMethod(init.method);
    setInstAccountId(init.accountId);
    setInstNote(init.note);
  }, [isOpen, editingInstallment, debt, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(instAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setIsSubmitting(true);
    try {
      await saveInstallmentSubmission({
        amt, instDate, instMethod, instAccountId, instNote,
        debt, editingInstallment, onRecordInstallment, onUpdateInstallment,
      });
      onClose();
    } catch {
      toast.error('Failed to save installment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    instAmount, setInstAmount,
    instDate, setInstDate,
    instMethod, setInstMethod,
    instAccountId, setInstAccountId,
    instNote, setInstNote,
    isSubmitting,
    handleSubmit,
  };
}

function InstallmentFormFields(props: {
  form: ReturnType<typeof useInstallmentForm>;
  accounts: FinanceAccount[];
  showAccountSync: boolean;
}) {
  const { form, accounts, showAccountSync } = props;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inst-amount-modal" className="text-xs">Amount (₹)</Label>
          <Input id="inst-amount-modal" type="number" step="any" min="1" value={form.instAmount} onChange={(e) => form.setInstAmount(e.target.value)} required className="rounded-xl font-mono text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inst-date-modal" className="text-xs">Date</Label>
          <Input id="inst-date-modal" type="date" value={form.instDate} onChange={(e) => form.setInstDate(e.target.value)} required className="rounded-xl text-xs" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inst-method-modal" className="text-xs">Payment Method</Label>
        <select
          id="inst-method-modal"
          value={form.instMethod}
          onChange={(e) => form.setInstMethod(e.target.value as DebtPaymentMethod)}
          className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
        >
          <option value="upi">UPI</option>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="offset_expense">Offset Adjustment</option>
        </select>
      </div>

      {showAccountSync && (
        <div className="space-y-1.5">
          <Label htmlFor="inst-account-modal" className="text-xs">Paid via Account (Optional Sync)</Label>
          <select
            id="inst-account-modal"
            value={form.instAccountId}
            onChange={(e) => form.setInstAccountId(e.target.value)}
            className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
          >
            <option value="">No account transaction</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({formatINR(a.balance)})</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="inst-note-modal" className="text-xs">Note</Label>
        <Input id="inst-note-modal" value={form.instNote} onChange={(e) => form.setInstNote(e.target.value)} placeholder="e.g. Monthly installment payment" className="rounded-xl text-xs" />
      </div>
    </>
  );
}

function getInstallmentDialogMeta(editingInstallment: DebtInstallment | null, debt: DebtRecord | null) {
  if (editingInstallment) {
    return {
      title: 'Edit Installment Log',
      description: 'Update previously recorded repayment entry.',
      submitLabel: 'Update Log',
    };
  }
  return {
    title: 'Record Loan Repayment',
    description: `Log repayment towards ${debt?.title} (${debt?.personName}).`,
    submitLabel: 'Save Repayment',
  };
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
  const form = useInstallmentForm({
    debt, editingInstallment, isOpen, accounts, onRecordInstallment, onUpdateInstallment, onClose,
  });

  if (!debt && !editingInstallment) return null;

  const showAccountSync = !editingInstallment && form.instMethod !== 'cash' && form.instMethod !== 'offset_expense';
  const meta = getInstallmentDialogMeta(editingInstallment, debt);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit} className="space-y-4 pt-2">
          <InstallmentFormFields form={form} accounts={accounts} showAccountSync={showAccountSync} />
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={form.isSubmitting} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button type="submit" disabled={form.isSubmitting} className="rounded-xl text-xs">
              {form.isSubmitting ? 'Saving...' : meta.submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
