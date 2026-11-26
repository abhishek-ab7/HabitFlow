'use client';

import React from 'react';
import { formatINR } from '@/lib/stores/finance-store';
import type { CommitmentLedgerSummary, FinanceAccount, FinanceTransaction } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export interface NewCommitmentFormState {
  title: string;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  recipient: string;
  setRecipient: React.Dispatch<React.SetStateAction<string>>;
  target: string;
  setTarget: React.Dispatch<React.SetStateAction<string>>;
  dueDay: string;
  setDueDay: React.Dispatch<React.SetStateAction<string>>;
  rollover: boolean;
  setRollover: React.Dispatch<React.SetStateAction<boolean>>;
}

export function NewCommitmentDialog(params: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: NewCommitmentFormState;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const { open, onOpenChange, form, onSubmit } = params;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>New Monthly Commitment</DialogTitle>
          <DialogDescription>
            Set a fixed monthly target where purchases or bills paid on someone&apos;s behalf automatically deduct.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-title">Title</Label>
            <Input id="c-title" value={form.title} onChange={(e) => form.setTitle(e.target.value)} placeholder="e.g., Mother's Monthly Allowance" className="h-11" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-rec">Recipient</Label>
              <Input id="c-rec" value={form.recipient} onChange={(e) => form.setRecipient(e.target.value)} placeholder="Mother" className="h-11" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-amt">Monthly Target (₹)</Label>
              <Input id="c-amt" type="number" min="1" value={form.target} onChange={(e) => form.setTarget(e.target.value)} className="h-11 font-mono tabular-nums" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-day">Due Day of Month (1–31)</Label>
            <Input id="c-day" type="number" min="1" max="31" value={form.dueDay} onChange={(e) => form.setDueDay(e.target.value)} className="h-11 font-mono tabular-nums" />
          </div>
          <label className="flex items-center gap-2.5 text-xs min-h-[40px] cursor-pointer">
            <input type="checkbox" checked={form.rollover} onChange={(e) => form.setRollover(e.target.checked)} className="w-4 h-4 rounded border-input" />
            <span>Auto-deduct extra overpayment from next month</span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save Commitment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface ReimburseFormState {
  amount: string;
  setAmount: React.Dispatch<React.SetStateAction<string>>;
  accountId: string;
  setAccountId: React.Dispatch<React.SetStateAction<string>>;
  date: string;
  setDate: React.Dispatch<React.SetStateAction<string>>;
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;
}

export function ReimburseCommitmentDialog(params: {
  reimburseComm: CommitmentLedgerSummary | null;
  onClose: () => void;
  liquidAccounts: FinanceAccount[];
  form: ReimburseFormState;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const { reimburseComm, onClose, liquidAccounts, form, onSubmit } = params;
  return (
    <Dialog open={!!reimburseComm} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Money Received Back ({reimburseComm?.commitment.recipientName})</DialogTitle>
          <DialogDescription>
            Log extra money returned to you. This adds to your selected account balance and reduces overpayment rollover.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3.5 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rb-amt">Amount Received (₹)</Label>
              <Input id="rb-amt" type="number" min="1" step="1" value={form.amount} onChange={(e) => form.setAmount(e.target.value)} className="h-11 font-mono tabular-nums" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rb-date">Date</Label>
              <Input id="rb-date" type="date" value={form.date} onChange={(e) => form.setDate(e.target.value)} className="h-11" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rb-acc">Deposited Into</Label>
            <select id="rb-acc" value={form.accountId} onChange={(e) => form.setAccountId(e.target.value)} className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background" required>
              {liquidAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name} ({formatINR(acc.balance)})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rb-note">Note (optional)</Label>
            <Input id="rb-note" value={form.note} onChange={(e) => form.setNote(e.target.value)} placeholder="e.g., Mummy sent extra expenses back" className="h-11" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Record Received</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LinkExpenseCommitmentDialog(params: {
  open: boolean;
  onClose: () => void;
  selectedMonth: string;
  unlinkedMonthExpenses: FinanceTransaction[];
  selectedTxId: string;
  setSelectedTxId: React.Dispatch<React.SetStateAction<string>>;
  onAttach: () => void;
}) {
  const { open, onClose, selectedMonth, unlinkedMonthExpenses, selectedTxId, setSelectedTxId, onAttach } = params;
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Link Existing Expense as Offset</DialogTitle>
          <DialogDescription>Pick an expense from {selectedMonth} to deduct from this commitment.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          {unlinkedMonthExpenses.length === 0 ? (
            <p className="text-xs text-muted-foreground">No unlinked expenses found for {selectedMonth}.</p>
          ) : (
            <select value={selectedTxId} onChange={(e) => setSelectedTxId(e.target.value)} className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background">
              <option value="">Choose an expense...</option>
              {unlinkedMonthExpenses.map((tx) => (
                <option key={tx.id} value={tx.id}>{tx.date} — {tx.title} ({formatINR(tx.amount)})</option>
              ))}
            </select>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={onAttach} disabled={!selectedTxId}>Link Offset</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
