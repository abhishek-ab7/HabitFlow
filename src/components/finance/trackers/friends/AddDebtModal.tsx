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
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';

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

function LoanScheduleSection(props: {
  repaymentSchedule: DebtRepaymentSchedule;
  onRepaymentScheduleChange: (v: DebtRepaymentSchedule) => void;
  dueDay: string;
  onDueDayChange: (v: string) => void;
  isEmi: boolean;
  onIsEmiChange: (v: boolean) => void;
  emiAmount: string;
  onEmiAmountChange: (v: string) => void;
  emiDueDay: string;
  onEmiDueDayChange: (v: string) => void;
  totalInstallments: string;
  onTotalInstallmentsChange: (v: string) => void;
  paidInstallments: string;
  onPaidInstallmentsChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3.5 pt-2 border-t border-border/50">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="loan-schedule-modal" className="text-xs">Repayment Schedule</Label>
          <select
            id="loan-schedule-modal"
            value={props.repaymentSchedule}
            onChange={(e) => props.onRepaymentScheduleChange(e.target.value as DebtRepaymentSchedule)}
            className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
          >
            <option value="flexible">Flexible / Ad-hoc</option>
            <option value="monthly_partial">Monthly Installment</option>
            <option value="lump_sum">Lump Sum Due</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loan-due-day-modal" className="text-xs">Due Day (1–31)</Label>
          <Input id="loan-due-day-modal" type="number" min="1" max="31" value={props.dueDay} onChange={(e) => props.onDueDayChange(e.target.value)} className="rounded-xl font-mono text-xs" />
        </div>
      </div>

      <div className="rounded-xl border border-border p-3 space-y-3 bg-muted/20">
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-foreground">
          <input type="checkbox" checked={props.isEmi} onChange={(e) => props.onIsEmiChange(e.target.checked)} className="rounded border-input text-primary focus:ring-primary" />
          Enable Fixed Monthly EMI Schedule
        </label>
        {props.isEmi && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="emi-amt-modal" className="text-[11px] text-muted-foreground">EMI Amount (₹)</Label>
              <Input id="emi-amt-modal" type="number" step="any" value={props.emiAmount} onChange={(e) => props.onEmiAmountChange(e.target.value)} placeholder="₹ 2,000" className="rounded-xl font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="emi-day-modal" className="text-[11px] text-muted-foreground">Billing Day</Label>
              <Input id="emi-day-modal" type="number" min="1" max="31" value={props.emiDueDay} onChange={(e) => props.onEmiDueDayChange(e.target.value)} className="rounded-xl font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="emi-total-modal" className="text-[11px] text-muted-foreground">Total EMIs</Label>
              <Input id="emi-total-modal" type="number" min="1" value={props.totalInstallments} onChange={(e) => props.onTotalInstallmentsChange(e.target.value)} placeholder="e.g. 12" className="rounded-xl font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="emi-paid-modal" className="text-[11px] text-muted-foreground">Paid EMIs</Label>
              <Input id="emi-paid-modal" type="number" min="0" value={props.paidInstallments} onChange={(e) => props.onPaidInstallmentsChange(e.target.value)} className="rounded-xl font-mono text-xs" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function resolveDefaultTitle(bucketType: DebtBucketType, direction: DebtDirection, personName: string): string {
  if (bucketType === 'everyday_split') {
    return `${direction === 'borrowed' ? 'Split from' : 'Split for'} ${personName}`;
  }
  return `${direction === 'borrowed' ? 'Borrowed from' : 'Lent to'} ${personName}`;
}

function clampDay(raw: string, fallback: number): number {
  return Math.min(31, Math.max(1, parseInt(raw, 10) || fallback));
}

const optFloat = (raw: string): number | undefined => (raw ? parseFloat(raw) : undefined);
const optInt = (raw: string): number | undefined => (raw ? parseInt(raw, 10) : undefined);
const numStr = (val?: number | null): string => (val ? String(val) : '');

function resolveEmiFields(fields: {
  isLoan: boolean;
  isEmi: boolean;
  emiAmount: string;
  emiDueDay: string;
  totalInstallments: string;
  paidInstallments: string;
}) {
  const { isLoan, isEmi, emiAmount, emiDueDay, totalInstallments, paidInstallments } = fields;
  const active = isLoan && isEmi;
  if (!active) {
    return { isEmi: false, emiAmount: undefined, emiDueDay: undefined, totalInstallments: undefined, paidInstallments: undefined };
  }
  return {
    isEmi: true,
    emiAmount: optFloat(emiAmount),
    emiDueDay: clampDay(emiDueDay, 5),
    totalInstallments: optInt(totalInstallments),
    paidInstallments: Math.max(0, parseInt(paidInstallments, 10) || 0),
  };
}

function buildSaveDebtPayload(fields: {
  entryBucketType: DebtBucketType;
  personName: string;
  direction: DebtDirection;
  title: string;
  amt: number;
  startDate: string;
  notes: string;
  plannedMonthly: string;
  dueDay: string;
  repaymentSchedule: DebtRepaymentSchedule;
  isEmi: boolean;
  emiAmount: string;
  emiDueDay: string;
  totalInstallments: string;
  paidInstallments: string;
}) {
  const { entryBucketType, personName, direction, title, amt, startDate, notes, plannedMonthly, dueDay, repaymentSchedule } = fields;
  const isLoan = entryBucketType === 'long_term_loan';
  const monthly = isLoan ? optFloat(plannedMonthly) : undefined;

  return {
    personName,
    direction,
    title: title.trim() || resolveDefaultTitle(entryBucketType, direction, personName),
    principalAmount: amt,
    startDate: startDate || getLocalIsoDate(),
    bucketType: entryBucketType,
    repaymentSchedule: monthly && monthly > 0 ? ('monthly_partial' as const) : repaymentSchedule,
    plannedMonthlyInstallment: monthly,
    dueDayOfMonth: isLoan ? clampDay(dueDay, 15) : undefined,
    ...resolveEmiFields({ isLoan, ...fields }),
    notes: notes.trim() || undefined,
    color: direction === 'borrowed' ? '#f43f5e' : '#10b981',
  };
}

function getInitialDebtDefaults(
  editingDebt: DebtRecord | null,
  defaultBucket: DebtBucketType,
  prefilledFriend: string
) {
  return {
    entryBucketType: editingDebt?.bucketType || defaultBucket,
    personName: editingDebt?.personName ?? (prefilledFriend || ''),
    direction: editingDebt?.direction ?? (defaultBucket === 'everyday_split' ? ('lent' as const) : ('borrowed' as const)),
    title: editingDebt?.title || '',
    principal: numStr(editingDebt?.principalAmount),
    startDate: editingDebt?.startDate || getLocalIsoDate(),
    plannedMonthly: numStr(editingDebt?.plannedMonthlyInstallment),
    dueDay: String(editingDebt?.dueDayOfMonth || 15),
    repaymentSchedule: editingDebt?.repaymentSchedule || ('flexible' as const),
    isEmi: Boolean(editingDebt?.isEmi),
    emiAmount: numStr(editingDebt?.emiAmount),
    emiDueDay: String(editingDebt?.emiDueDay || 5),
    totalInstallments: numStr(editingDebt?.totalInstallments),
    paidInstallments: String(editingDebt?.paidInstallments || 0),
    notes: editingDebt?.notes || '',
  };
}

function useAddDebtFormState(params: {
  isOpen: boolean;
  editingDebt: DebtRecord | null;
  defaultBucket: DebtBucketType;
  prefilledFriend: string;
}) {
  const { isOpen, editingDebt, defaultBucket, prefilledFriend } = params;
  const [entryBucketType, setEntryBucketType] = useState<DebtBucketType>(defaultBucket);
  const [personName, setPersonName] = useState(prefilledFriend);
  const [direction, setDirection] = useState<DebtDirection>('lent');
  const [title, setTitle] = useState('');
  const [principal, setPrincipal] = useState('');
  const [startDate, setStartDate] = useState(() => getLocalIsoDate());
  const [notes, setNotes] = useState('');
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
    const d = getInitialDebtDefaults(editingDebt, defaultBucket, prefilledFriend);
    setEntryBucketType(d.entryBucketType);
    setPersonName(d.personName);
    setDirection(d.direction);
    setTitle(d.title);
    setPrincipal(d.principal);
    setStartDate(d.startDate);
    setPlannedMonthly(d.plannedMonthly);
    setDueDay(d.dueDay);
    setRepaymentSchedule(d.repaymentSchedule);
    setIsEmi(d.isEmi);
    setEmiAmount(d.emiAmount);
    setEmiDueDay(d.emiDueDay);
    setTotalInstallments(d.totalInstallments);
    setPaidInstallments(d.paidInstallments);
    setNotes(d.notes);
  }, [editingDebt, defaultBucket, prefilledFriend, isOpen]);

  return {
    entryBucketType, setEntryBucketType,
    personName, setPersonName,
    direction, setDirection,
    title, setTitle,
    principal, setPrincipal,
    startDate, setStartDate,
    notes, setNotes,
    plannedMonthly, setPlannedMonthly,
    dueDay, setDueDay,
    repaymentSchedule, setRepaymentSchedule,
    isEmi, setIsEmi,
    emiAmount, setEmiAmount,
    emiDueDay, setEmiDueDay,
    totalInstallments, setTotalInstallments,
    paidInstallments, setPaidInstallments,
    isSubmitting, setIsSubmitting,
  };
}

function DirectionSelector({
  entryBucketType,
  direction,
  onSelect,
}: {
  entryBucketType: DebtBucketType;
  direction: DebtDirection;
  onSelect: (dir: DebtDirection) => void;
}) {
  const isSplit = entryBucketType === 'everyday_split';
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Direction</Label>
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
        <button
          type="button"
          onClick={() => onSelect('borrowed')}
          className={`min-h-[36px] text-xs font-semibold rounded-lg transition-colors ${
            direction === 'borrowed' ? 'bg-rose-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {isSplit ? 'They Paid (I Owe)' : 'I Borrowed (I Owe)'}
        </button>
        <button
          type="button"
          onClick={() => onSelect('lent')}
          className={`min-h-[36px] text-xs font-semibold rounded-lg transition-colors ${
            direction === 'lent' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {isSplit ? 'I Paid (They Owe)' : 'I Lent (Owes Me)'}
        </button>
      </div>
    </div>
  );
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
  const f = useAddDebtFormState({ isOpen, editingDebt, defaultBucket, prefilledFriend });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(f.principal);
    const trimmedName = f.personName.trim();
    const invalidAmt = isNaN(amt) || amt <= 0;
    if (!trimmedName || invalidAmt) {
      toast.error('Enter a person name and valid amount');
      return;
    }

    try {
      f.setIsSubmitting(true);
      await onSave(
        buildSaveDebtPayload({
          entryBucketType: f.entryBucketType,
          personName: trimmedName,
          direction: f.direction,
          title: f.title,
          amt,
          startDate: f.startDate,
          notes: f.notes,
          plannedMonthly: f.plannedMonthly,
          dueDay: f.dueDay,
          repaymentSchedule: f.repaymentSchedule,
          isEmi: f.isEmi,
          emiAmount: f.emiAmount,
          emiDueDay: f.emiDueDay,
          totalInstallments: f.totalInstallments,
          paidInstallments: f.paidInstallments,
        })
      );
      onClose();
    } catch {
      toast.error('Failed to save debt entry');
    } finally {
      f.setIsSubmitting(false);
    }
  };

  const isSplit = f.entryBucketType === 'everyday_split';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingDebt ? 'Edit Ledger Entry' : 'New Friend Entry'}</DialogTitle>
          <DialogDescription>Record an everyday split (food, chai, cab) or a formal personal loan / EMI schedule.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Entry Bucket</Label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
              {([['everyday_split', 'Everyday Split'], ['long_term_loan', 'Long-Term Loan / EMI']] as const).map(([bucket, label]) => (
                <button
                  key={bucket}
                  type="button"
                  onClick={() => f.setEntryBucketType(bucket)}
                  className={`min-h-[36px] text-xs font-semibold rounded-lg transition-colors ${
                    f.entryBucketType === bucket ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <DirectionSelector entryBucketType={f.entryBucketType} direction={f.direction} onSelect={f.setDirection} />

          <div className="space-y-1.5">
            <Label htmlFor="friend-name-modal" className="text-xs">Friend Name</Label>
            <Input id="friend-name-modal" value={f.personName} onChange={(e) => f.setPersonName(e.target.value)} placeholder="e.g., Rahul Sharma" required className="rounded-xl" />
            {existingFriendNames.length > 0 && !editingDebt && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {existingFriendNames.slice(0, 5).map((name) => (
                  <button key={name} type="button" onClick={() => f.setPersonName(name)} className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground hover:text-foreground">
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="friend-title-modal" className="text-xs">{isSplit ? 'Split Description' : 'Loan Title'}</Label>
            <Input
              id="friend-title-modal"
              value={f.title}
              onChange={(e) => f.setTitle(e.target.value)}
              placeholder={isSplit ? 'e.g., Dinner at Social, Cab to airport' : 'e.g., Laptop purchase loan, Emergency loan'}
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="friend-principal-modal" className="text-xs">Amount (₹)</Label>
              <Input id="friend-principal-modal" type="number" step="any" min="1" value={f.principal} onChange={(e) => f.setPrincipal(e.target.value)} placeholder="₹ 1,000" required className="rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="friend-start-date-modal" className="text-xs">Date</Label>
              <Input id="friend-start-date-modal" type="date" value={f.startDate} onChange={(e) => f.setStartDate(e.target.value)} required className="rounded-xl" />
            </div>
          </div>

          {!isSplit && (
            <LoanScheduleSection
              repaymentSchedule={f.repaymentSchedule}
              onRepaymentScheduleChange={f.setRepaymentSchedule}
              dueDay={f.dueDay}
              onDueDayChange={f.setDueDay}
              isEmi={f.isEmi}
              onIsEmiChange={f.setIsEmi}
              emiAmount={f.emiAmount}
              onEmiAmountChange={f.setEmiAmount}
              emiDueDay={f.emiDueDay}
              onEmiDueDayChange={f.setEmiDueDay}
              totalInstallments={f.totalInstallments}
              onTotalInstallmentsChange={f.setTotalInstallments}
              paidInstallments={f.paidInstallments}
              onPaidInstallmentsChange={f.setPaidInstallments}
            />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="friend-notes-modal" className="text-xs">Notes</Label>
            <Input id="friend-notes-modal" value={f.notes} onChange={(e) => f.setNotes(e.target.value)} placeholder="Optional notes or details" className="rounded-xl text-xs" />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={f.isSubmitting} className="rounded-xl text-xs">Cancel</Button>
            <Button type="submit" disabled={f.isSubmitting} className="rounded-xl text-xs">
              {f.isSubmitting ? 'Saving...' : editingDebt ? 'Save Changes' : 'Create Entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
