'use client';

import React, { useState, useEffect } from 'react';
import type { FinanceAccount, FriendLedgerGroup, DebtPaymentMethod } from '@/lib/types';
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
import { useFeedback } from '@/hooks/use-feedback';

interface SettleTabDialogProps {
  group: FriendLedgerGroup | null;
  isOpen: boolean;
  onClose: () => void;
  accounts: FinanceAccount[];
  onConfirmSettle: (
    friendKey: string,
    options: {
      accountId?: string;
      paymentMethod: DebtPaymentMethod;
      date: string;
      note?: string;
    }
  ) => Promise<unknown>;
}

function SettlementNetBanner({ group }: { group: FriendLedgerGroup }) {
  const tone =
    group.everydayNet > 0
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
      : group.everydayNet < 0
      ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
      : 'bg-muted border-border';

  const heading =
    group.everydayNet > 0
      ? `${group.friendName} owes you ${formatINR(group.everydayNet)}`
      : group.everydayNet < 0
      ? `You owe ${group.friendName} ${formatINR(Math.abs(group.everydayNet))}`
      : 'Tab is fully balanced (₹0)';

  const subtext =
    group.everydayNet > 0
      ? 'Logging settlement will record income into your selected account.'
      : group.everydayNet < 0
      ? 'Logging settlement will record an expense from your selected account.'
      : 'Active split items will be marked as settled.';

  return (
    <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${tone}`}>
      <div className="font-semibold text-sm">{heading}</div>
      <p className="text-[11px] opacity-90">{subtext}</p>
    </div>
  );
}

function SettlementAccountFields(props: {
  accounts: FinanceAccount[];
  settleAccountId: string;
  settleMethod: DebtPaymentMethod;
  settleDate: string;
  settleNote: string;
  onAccountChange: (v: string) => void;
  onMethodChange: (v: DebtPaymentMethod) => void;
  onDateChange: (v: string) => void;
  onNoteChange: (v: string) => void;
}) {
  const {
    accounts, settleAccountId, settleMethod, settleDate, settleNote,
    onAccountChange, onMethodChange, onDateChange, onNoteChange,
  } = props;

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="settle-account-sel" className="text-xs">Account</Label>
        <select
          id="settle-account-sel"
          value={settleAccountId}
          onChange={(e) => onAccountChange(e.target.value)}
          className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
          required
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({formatINR(a.balance)})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="settle-method-sel" className="text-xs">Payment Method</Label>
          <select
            id="settle-method-sel"
            value={settleMethod}
            onChange={(e) => onMethodChange(e.target.value as DebtPaymentMethod)}
            className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
          >
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settle-date-in" className="text-xs">Date</Label>
          <Input id="settle-date-in" type="date" value={settleDate} onChange={(e) => onDateChange(e.target.value)} className="rounded-xl text-xs" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settle-note-in" className="text-xs">Note</Label>
        <Input id="settle-note-in" value={settleNote} onChange={(e) => onNoteChange(e.target.value)} placeholder="e.g. Settled via GPay after dinner" className="rounded-xl text-xs" />
      </div>
    </>
  );
}

function getDefaultSettleAccountId(accounts: FinanceAccount[]): string {
  return accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || '';
}

function useSettleTabForm(params: {
  group: FriendLedgerGroup | null;
  isOpen: boolean;
  accounts: FinanceAccount[];
  onConfirmSettle: SettleTabDialogProps['onConfirmSettle'];
  onClose: () => void;
}) {
  const { group, isOpen, accounts, onConfirmSettle, onClose } = params;
  const [settleAccountId, setSettleAccountId] = useState('');
  const [settleMethod, setSettleMethod] = useState<DebtPaymentMethod>('upi');
  const [settleDate, setSettleDate] = useState(() => getLocalIsoDate());
  const [settleNote, setSettleNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const feedback = useFeedback();

  useEffect(() => {
    if (!isOpen || !group) return;
    setSettleAccountId(getDefaultSettleAccountId(accounts));
    setSettleMethod('upi');
    setSettleDate(getLocalIsoDate());
    setSettleNote('');
  }, [isOpen, group, accounts]);

  const submitSettlement = async () => {
    if (!group) return;
    await onConfirmSettle(group.friendKey, {
      accountId: settleAccountId || undefined,
      paymentMethod: settleMethod,
      date: settleDate,
      note: settleNote.trim() || undefined,
    });
    toast.success(`Settled everyday tab with ${group.friendName}`);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;
    feedback.coin();
    setIsSubmitting(true);
    try {
      await submitSettlement();
    } catch {
      toast.error('Failed to settle everyday tab');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    settleAccountId,
    setSettleAccountId,
    settleMethod,
    setSettleMethod,
    settleDate,
    setSettleDate,
    settleNote,
    setSettleNote,
    isSubmitting,
    handleSubmit,
  };
}

export function SettleTabDialog({
  group,
  isOpen,
  onClose,
  accounts,
  onConfirmSettle,
}: SettleTabDialogProps) {
  const form = useSettleTabForm({ group, isOpen, accounts, onConfirmSettle, onClose });

  if (!group) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settle Everyday Tab</DialogTitle>
          <DialogDescription>
            Mark all active everyday splits with {group.friendName} as settled and record one synced net transaction.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit} className="space-y-4 pt-2">
          <SettlementNetBanner group={group} />

          {Math.abs(group.everydayNet) > 0 && (
            <SettlementAccountFields
              accounts={accounts}
              settleAccountId={form.settleAccountId}
              settleMethod={form.settleMethod}
              settleDate={form.settleDate}
              settleNote={form.settleNote}
              onAccountChange={form.setSettleAccountId}
              onMethodChange={form.setSettleMethod}
              onDateChange={form.setSettleDate}
              onNoteChange={form.setSettleNote}
            />
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={form.isSubmitting} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button type="submit" disabled={form.isSubmitting} className="rounded-xl text-xs">
              {form.isSubmitting ? 'Confirming...' : 'Confirm Settlement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
