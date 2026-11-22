'use client';

import React, { useState, useEffect } from 'react';
import type {
  DebtBucketType,
  DebtDirection,
  DebtRecord,
  DebtRepaymentSchedule,
} from '@/lib/types';
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

interface AddDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingDebt: DebtRecord | null;
  defaultBucket?: DebtBucketType;
  prefilledFriend?: string;
  existingFriendNames: string[];
  onSave: (data: {
    personName: string;
    direction: DebtDirection;
    title: string;
    principalAmount: number;
    startDate: string;
    bucketType: DebtBucketType;
    repaymentSchedule: DebtRepaymentSchedule;
    plannedMonthlyInstallment?: number;
    dueDayOfMonth?: number;
    isEmi?: boolean;
    emiAmount?: number;
    emiDueDay?: number;
    totalInstallments?: number;
    paidInstallments?: number;
    notes?: string;
    color: string;
  }) => Promise<unknown>;
}

export function AddDebtModal({
  isOpen,
  onClose,
  editingDebt,
  defaultBucket = 'everyday_split',
  prefilledFriend = '',
  existingFriendNames,
  onSave,
}: AddDebtModalProps) {
  const [entryBucketType, setEntryBucketType] = useState<DebtBucketType>(defaultBucket);
  const [personName, setPersonName] = useState(prefilledFriend);
  const [direction, setDirection] = useState<DebtDirection>('lent');
  const [title, setTitle] = useState('');
  const [principal, setPrincipal] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Loan/EMI specific fields
  const [plannedMonthly, setPlannedMonthly] = useState('');
  const [dueDay, setDueDay] = useState('15');
  const [repaymentSchedule, setRepaymentSchedule] = useState<DebtRepaymentSchedule>('flexible');
  const [isEmi, setIsEmi] = useState(false);
  const [emiAmount, setEmiAmount] = useState('');
  const [emiDueDay, setEmiDueDay] = useState('5');
  const [totalInstallments, setTotalInstallments] = useState('');
  const [paidInstallments, setPaidInstallments] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingDebt) {
      setEntryBucketType(editingDebt.bucketType || 'long_term_loan');
      setPersonName(editingDebt.personName);
      setDirection(editingDebt.direction);
      setTitle(editingDebt.title);
      setPrincipal(String(editingDebt.principalAmount));
      setStartDate(editingDebt.startDate || new Date().toISOString().split('T')[0]);
      setPlannedMonthly(editingDebt.plannedMonthlyInstallment ? String(editingDebt.plannedMonthlyInstallment) : '');
      setDueDay(String(editingDebt.dueDayOfMonth || 15));
      setRepaymentSchedule(editingDebt.repaymentSchedule || 'flexible');
      setIsEmi(!!editingDebt.isEmi);
      setEmiAmount(editingDebt.emiAmount ? String(editingDebt.emiAmount) : '');
      setEmiDueDay(String(editingDebt.emiDueDay || 5));
      setTotalInstallments(editingDebt.totalInstallments ? String(editingDebt.totalInstallments) : '');
      setPaidInstallments(String(editingDebt.paidInstallments || 0));
      setNotes(editingDebt.notes || '');
    } else {
      setEntryBucketType(defaultBucket);
      setPersonName(prefilledFriend || '');
      setDirection(defaultBucket === 'everyday_split' ? 'lent' : 'borrowed');
      setTitle('');
      setPrincipal('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setPlannedMonthly('');
      setDueDay('15');
      setRepaymentSchedule('flexible');
      setIsEmi(false);
      setEmiAmount('');
      setEmiDueDay('5');
      setTotalInstallments('');
      setPaidInstallments('0');
      setNotes('');
    }
  }, [editingDebt, defaultBucket, prefilledFriend, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(principal);
    if (!personName.trim() || isNaN(amt) || amt <= 0) {
      toast.error('Enter a person name and valid amount');
      return;
    }

    const isLoan = entryBucketType === 'long_term_loan';
    const monthly = isLoan && plannedMonthly ? parseFloat(plannedMonthly) : undefined;
    const parsedDay = isLoan ? Math.min(31, Math.max(1, parseInt(dueDay, 10) || 15)) : undefined;

    const parsedEmiAmount = isLoan && isEmi && emiAmount ? parseFloat(emiAmount) : undefined;
    const parsedEmiDueDay = isLoan && isEmi ? Math.min(31, Math.max(1, parseInt(emiDueDay, 10) || 5)) : undefined;
    const parsedTotalInstallments =
      isLoan && isEmi && totalInstallments ? parseInt(totalInstallments, 10) : undefined;
    const parsedPaidInstallments =
      isLoan && isEmi ? Math.max(0, parseInt(paidInstallments, 10) || 0) : undefined;

    const resolvedTitle =
      title.trim() ||
      (entryBucketType === 'everyday_split'
        ? `${direction === 'borrowed' ? 'Split from' : 'Split for'} ${personName.trim()}`
        : `${direction === 'borrowed' ? 'Borrowed from' : 'Lent to'} ${personName.trim()}`);

    try {
      setIsSubmitting(true);
      await onSave({
        personName: personName.trim(),
        direction,
        title: resolvedTitle,
        principalAmount: amt,
        startDate: startDate || new Date().toISOString().split('T')[0],
        bucketType: entryBucketType,
        repaymentSchedule: monthly && monthly > 0 ? 'monthly_partial' : repaymentSchedule,
        plannedMonthlyInstallment: monthly,
        dueDayOfMonth: parsedDay,
        isEmi: isLoan ? isEmi : false,
        emiAmount: parsedEmiAmount,
        emiDueDay: parsedEmiDueDay,
        totalInstallments: parsedTotalInstallments,
        paidInstallments: parsedPaidInstallments,
        notes: notes.trim() || undefined,
        color: direction === 'borrowed' ? '#f43f5e' : '#10b981',
      });
      onClose();
    } catch {
      toast.error('Failed to save debt entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingDebt ? 'Edit Ledger Entry' : 'New Friend Entry'}
          </DialogTitle>
          <DialogDescription>
            Record an everyday split (food, chai, cab) or a formal personal loan / EMI schedule.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Bucket Switcher */}
          <div className="space-y-1.5">
            <Label className="text-xs">Entry Bucket</Label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => setEntryBucketType('everyday_split')}
                className={`min-h-[36px] text-xs font-semibold rounded-lg transition-colors ${
                  entryBucketType === 'everyday_split'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Everyday Split
              </button>
              <button
                type="button"
                onClick={() => setEntryBucketType('long_term_loan')}
                className={`min-h-[36px] text-xs font-semibold rounded-lg transition-colors ${
                  entryBucketType === 'long_term_loan'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Long-Term Loan / EMI
              </button>
            </div>
          </div>

          {/* Direction */}
          <div className="space-y-1.5">
            <Label className="text-xs">Direction</Label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => setDirection('borrowed')}
                className={`min-h-[36px] text-xs font-semibold rounded-lg transition-colors ${
                  direction === 'borrowed'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {entryBucketType === 'everyday_split' ? 'They Paid (I Owe)' : 'I Borrowed (I Owe)'}
              </button>
              <button
                type="button"
                onClick={() => setDirection('lent')}
                className={`min-h-[36px] text-xs font-semibold rounded-lg transition-colors ${
                  direction === 'lent'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {entryBucketType === 'everyday_split' ? 'I Paid (They Owe)' : 'I Lent (Owes Me)'}
              </button>
            </div>
          </div>

          {/* Friend Name with suggestions */}
          <div className="space-y-1.5">
            <Label htmlFor="friend-name-modal" className="text-xs">
              Friend Name
            </Label>
            <Input
              id="friend-name-modal"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="e.g., Rahul Sharma"
              required
              className="rounded-xl"
            />
            {existingFriendNames.length > 0 && !editingDebt && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {existingFriendNames.slice(0, 5).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setPersonName(name)}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground hover:text-foreground"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title / Description */}
          <div className="space-y-1.5">
            <Label htmlFor="friend-title-modal" className="text-xs">
              {entryBucketType === 'everyday_split' ? 'Split Description' : 'Loan Title'}
            </Label>
            <Input
              id="friend-title-modal"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                entryBucketType === 'everyday_split'
                  ? 'e.g., Dinner at Social, Cab to airport'
                  : 'e.g., Laptop purchase loan, Emergency loan'
              }
              className="rounded-xl"
            />
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="friend-principal-modal" className="text-xs">
                Amount (₹)
              </Label>
              <Input
                id="friend-principal-modal"
                type="number"
                step="any"
                min="1"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="₹ 1,000"
                required
                className="rounded-xl font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="friend-start-date-modal" className="text-xs">
                Date
              </Label>
              <Input
                id="friend-start-date-modal"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Long-Term Loan Specific Details */}
          {entryBucketType === 'long_term_loan' && (
            <div className="space-y-3.5 pt-2 border-t border-border/50">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="loan-schedule-modal" className="text-xs">
                    Repayment Schedule
                  </Label>
                  <select
                    id="loan-schedule-modal"
                    value={repaymentSchedule}
                    onChange={(e) =>
                      setRepaymentSchedule(e.target.value as DebtRepaymentSchedule)
                    }
                    className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
                  >
                    <option value="flexible">Flexible / Ad-hoc</option>
                    <option value="monthly_partial">Monthly Installment</option>
                    <option value="lump_sum">Lump Sum Due</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="loan-due-day-modal" className="text-xs">
                    Due Day (1–31)
                  </Label>
                  <Input
                    id="loan-due-day-modal"
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="rounded-xl font-mono text-xs"
                  />
                </div>
              </div>

              {/* EMI Checkbox */}
              <div className="rounded-xl border border-border p-3 space-y-3 bg-muted/20">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={isEmi}
                    onChange={(e) => setIsEmi(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  Enable Fixed Monthly EMI Schedule
                </label>

                {isEmi && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label htmlFor="emi-amt-modal" className="text-[11px] text-muted-foreground">
                        EMI Amount (₹)
                      </Label>
                      <Input
                        id="emi-amt-modal"
                        type="number"
                        step="any"
                        value={emiAmount}
                        onChange={(e) => setEmiAmount(e.target.value)}
                        placeholder="₹ 2,000"
                        className="rounded-xl font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="emi-day-modal" className="text-[11px] text-muted-foreground">
                        Billing Day
                      </Label>
                      <Input
                        id="emi-day-modal"
                        type="number"
                        min="1"
                        max="31"
                        value={emiDueDay}
                        onChange={(e) => setEmiDueDay(e.target.value)}
                        className="rounded-xl font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="emi-total-modal" className="text-[11px] text-muted-foreground">
                        Total EMIs
                      </Label>
                      <Input
                        id="emi-total-modal"
                        type="number"
                        min="1"
                        value={totalInstallments}
                        onChange={(e) => setTotalInstallments(e.target.value)}
                        placeholder="e.g. 12"
                        className="rounded-xl font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="emi-paid-modal" className="text-[11px] text-muted-foreground">
                        Paid EMIs
                      </Label>
                      <Input
                        id="emi-paid-modal"
                        type="number"
                        min="0"
                        value={paidInstallments}
                        onChange={(e) => setPaidInstallments(e.target.value)}
                        className="rounded-xl font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="friend-notes-modal" className="text-xs">
              Notes
            </Label>
            <Input
              id="friend-notes-modal"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes or details"
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
              {isSubmitting ? 'Saving...' : editingDebt ? 'Save Changes' : 'Create Entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
