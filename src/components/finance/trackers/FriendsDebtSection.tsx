'use client';

import React, { useMemo, useState } from 'react';
import {
  Plus,
  Users,
  ChevronDown,
  ChevronUp,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Trash2,
  Pencil,
  PlusCircle,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { DebtDirection, DebtInstallment, DebtPaymentMethod, DebtRecord, DebtRepaymentSchedule } from '@/lib/types';
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
import { toast } from 'sonner';

export function FriendsDebtSection() {
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const accounts = useFinanceStore((s) => s.accounts);
  const getDebtSummary = useFinanceStore((s) => s.getDebtSummary);
  const getDebtInstallments = useFinanceStore((s) => s.getDebtInstallments);
  const addDebtRecord = useFinanceStore((s) => s.addDebtRecord);
  const updateDebtRecord = useFinanceStore((s) => s.updateDebtRecord);
  const recordDebtInstallment = useFinanceStore((s) => s.recordDebtInstallment);
  const updateDebtInstallment = useFinanceStore((s) => s.updateDebtInstallment);
  const deleteDebtInstallment = useFinanceStore((s) => s.deleteDebtInstallment);
  const topUpDebt = useFinanceStore((s) => s.topUpDebt);
  const deleteDebtRecord = useFinanceStore((s) => s.deleteDebtRecord);

  const [filterDir, setFilterDir] = useState<'all' | DebtDirection>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // New / Edit Friend Ledger dialog
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtRecord | null>(null);
  const [personName, setPersonName] = useState('');
  const [direction, setDirection] = useState<DebtDirection>('borrowed');
  const [title, setTitle] = useState('');
  const [principal, setPrincipal] = useState('');
  const [plannedMonthly, setPlannedMonthly] = useState('');
  const [dueDay, setDueDay] = useState('15');
  const [repaymentSchedule, setRepaymentSchedule] = useState<DebtRepaymentSchedule>('flexible');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Installment dialog (Create or Edit)
  const [installmentDebt, setInstallmentDebt] = useState<DebtRecord | null>(null);
  const [editingInstallment, setEditingInstallment] = useState<DebtInstallment | null>(null);
  const [instAmount, setInstAmount] = useState('');
  const [instDate, setInstDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [instMethod, setInstMethod] = useState<DebtPaymentMethod>('upi');
  const [instAccountId, setInstAccountId] = useState('');
  const [instNote, setInstNote] = useState('');

  // Top-up dialog
  const [topUpTarget, setTopUpTarget] = useState<DebtRecord | null>(null);
  const [topUpAmt, setTopUpAmt] = useState('');
  const [topUpNote, setTopUpNote] = useState('');

  const summary = getDebtSummary();

  const visibleDebts = useMemo(() => {
    return debtRecords
      .filter((d) => !d.deletedAt && d.status !== 'archived')
      .filter((d) => (filterDir === 'all' ? true : d.direction === filterDir))
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return b.remainingAmount - a.remainingAmount;
      });
  }, [debtRecords, filterDir]);

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  const openNewDebtDialog = () => {
    setEditingDebt(null);
    setPersonName('');
    setDirection('borrowed');
    setTitle('');
    setPrincipal('');
    setPlannedMonthly('');
    setDueDay('15');
    setRepaymentSchedule('flexible');
    setStartDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setIsNewOpen(true);
  };

  const openEditDebtDialog = (debt: DebtRecord) => {
    setEditingDebt(debt);
    setPersonName(debt.personName);
    setDirection(debt.direction);
    setTitle(debt.title);
    setPrincipal(String(debt.principalAmount));
    setPlannedMonthly(debt.plannedMonthlyInstallment ? String(debt.plannedMonthlyInstallment) : '');
    setDueDay(String(debt.dueDayOfMonth || 15));
    setRepaymentSchedule(debt.repaymentSchedule || 'flexible');
    setStartDate(debt.startDate || new Date().toISOString().split('T')[0]);
    setNotes(debt.notes || '');
    setIsNewOpen(true);
  };

  const handleSaveDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(principal);
    if (!personName.trim() || isNaN(amt) || amt <= 0) {
      toast.error('Enter person name and valid principal amount');
      return;
    }
    const monthly = parseFloat(plannedMonthly);
    const parsedDay = Math.min(31, Math.max(1, parseInt(dueDay, 10) || 15));
    const resolvedTitle =
      title.trim() ||
      (direction === 'borrowed'
        ? `Borrowed from ${personName.trim()}`
        : `Lent to ${personName.trim()}`);

    if (editingDebt) {
      await updateDebtRecord(editingDebt.id, {
        personName: personName.trim(),
        direction,
        title: resolvedTitle,
        principalAmount: amt,
        startDate: startDate || editingDebt.startDate,
        repaymentSchedule: monthly > 0 ? 'monthly_partial' : repaymentSchedule,
        plannedMonthlyInstallment: monthly > 0 ? monthly : undefined,
        dueDayOfMonth: parsedDay,
        notes: notes.trim() || undefined,
      });
      toast.success(`Updated ledger for ${personName.trim()}`);
    } else {
      await addDebtRecord({
        personName: personName.trim(),
        direction,
        title: resolvedTitle,
        principalAmount: amt,
        startDate: startDate || new Date().toISOString().split('T')[0],
        repaymentSchedule: monthly > 0 ? 'monthly_partial' : repaymentSchedule,
        plannedMonthlyInstallment: monthly > 0 ? monthly : undefined,
        dueDayOfMonth: parsedDay,
        notes: notes.trim() || undefined,
        color: direction === 'borrowed' ? '#f43f5e' : '#10b981',
      });
      toast.success(`Added ledger for ${personName.trim()}`);
    }

    setIsNewOpen(false);
    setEditingDebt(null);
  };

  const handleSaveInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(instAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    if (editingInstallment) {
      await updateDebtInstallment(editingInstallment.id, {
        amount: amt,
        date: instDate || editingInstallment.date,
        paymentMethod: instMethod,
        note: instNote.trim() || undefined,
      });
      toast.success('Updated installment log');
      setEditingInstallment(null);
      setInstallmentDebt(null);
      setInstAmount('');
      setInstNote('');
      return;
    }

    if (!installmentDebt) return;
    await recordDebtInstallment({
      debtId: installmentDebt.id,
      amount: amt,
      date: instDate || undefined,
      paymentMethod: instMethod,
      accountId: instAccountId || undefined,
      note: instNote.trim() || undefined,
    });
    toast.success(
      installmentDebt.direction === 'borrowed'
        ? `Recorded ${formatINR(amt)} paid to ${installmentDebt.personName}`
        : `Recorded ${formatINR(amt)} received from ${installmentDebt.personName}`
    );
    setInstallmentDebt(null);
    setInstAmount('');
    setInstNote('');
  };

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpTarget) return;
    const amt = parseFloat(topUpAmt);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid top-up amount');
      return;
    }
    await topUpDebt(topUpTarget.id, amt, topUpNote.trim() || undefined);
    toast.success(`Added ${formatINR(amt)} to ${topUpTarget.personName}'s ledger`);
    setTopUpTarget(null);
    setTopUpAmt('');
    setTopUpNote('');
  };

  const handleCopyReminder = async (debt: DebtRecord) => {
    const text =
      debt.direction === 'lent'
        ? `Hey ${debt.personName}, quick reminder on our ${debt.title} balance of ${formatINR(debt.remainingAmount)}. Feel free to UPI whenever convenient!`
        : `Hey ${debt.personName}, tracking my ${debt.title} balance — remaining ${formatINR(debt.remainingAmount)}. Will transfer the next installment soon.`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied UPI reminder message');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <section className="space-y-4">
      {/* Net Position Summary Strip */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 grid grid-cols-3 gap-4">
        <div>
          <span className="text-xs text-muted-foreground block">I Owe Friends</span>
          <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {formatINR(summary.totalBorrowedRemaining)}
          </span>
        </div>
        <div>
          <span className="text-xs text-muted-foreground block">Friends Owe Me</span>
          <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatINR(summary.totalLentRemaining)}
          </span>
        </div>
        <div>
          <span className="text-xs text-muted-foreground block">Net Friend Position</span>
          <span
            className={`text-base sm:text-lg font-bold font-mono tabular-nums ${
              summary.netPosition >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {summary.netPosition >= 0 ? '+' : ''}
            {formatINR(summary.netPosition)}
          </span>
        </div>
      </div>

      {/* Header & Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div
          role="tablist"
          aria-label="Filter friend ledgers"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted"
        >
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'borrowed', label: 'I Owe' },
              { id: 'lent', label: 'Owes Me' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterDir(f.id)}
              className={`min-h-[34px] px-3 text-xs font-semibold rounded-lg transition-colors ${
                filterDir === f.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={openNewDebtDialog}
          className="min-h-[40px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New Friend Ledger
        </Button>
      </div>

      {visibleDebts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center space-y-2.5">
          <p className="text-xs text-muted-foreground">
            No friend balances found. Track shared trips, IOUs, and partial repayments cleanly here.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={openNewDebtDialog}
            className="min-h-[40px] px-4 text-xs rounded-xl"
          >
            Add Friend Ledger
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleDebts.map((debt) => {
            const isOpen = !!expandedIds[debt.id];
            const installments = getDebtInstallments(debt.id);
            const pct =
              debt.principalAmount > 0
                ? Math.min(
                    100,
                    Math.round((debt.totalRepaidAmount / debt.principalAmount) * 100)
                  )
                : 100;
            const isBorrowed = debt.direction === 'borrowed';

            return (
              <div
                key={debt.id}
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(debt.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(debt.id);
                    }
                  }}
                  className="p-4 flex flex-col gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isBorrowed
                            ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isBorrowed ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : (
                          <ArrowDownLeft className="w-5 h-5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {debt.personName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {debt.title} · {isBorrowed ? 'I owe' : 'Owes me'} · Principal{' '}
                          {formatINR(debt.principalAmount)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p
                          className={`text-sm sm:text-base font-bold font-mono tabular-nums ${
                            debt.remainingAmount <= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isBorrowed
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {debt.remainingAmount > 0
                            ? formatINR(debt.remainingAmount)
                            : 'Settled'}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {pct}% repaid
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDebtDialog(debt);
                        }}
                        aria-label={`Edit ${debt.personName} ledger`}
                        title={`Edit ${debt.personName}`}
                        className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full transition-all duration-300 ${
                          isBorrowed ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                    {debt.remainingAmount > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingInstallment(null);
                          setInstallmentDebt(debt);
                          setInstAmount(
                            String(
                              Math.min(
                                debt.remainingAmount,
                                debt.plannedMonthlyInstallment || debt.remainingAmount
                              )
                            )
                          );
                          setInstDate(new Date().toISOString().split('T')[0]);
                          setInstMethod('upi');
                          setInstNote('');
                          const defAcc = accounts.find((a) => a.isDefault) || accounts[0];
                          setInstAccountId(defAcc?.id || '');
                        }}
                        className="min-h-[36px] px-3 text-xs rounded-lg whitespace-nowrap shrink-0"
                      >
                        {isBorrowed ? 'Pay Part' : 'Mark Received'}
                      </Button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 pt-2 border-t border-border/70 space-y-3.5">
                    {installments.length > 0 ? (
                      <div className="divide-y divide-border/60 border-b border-border/60">
                        {installments.map((inst) => (
                          <div
                            key={inst.id}
                            className="py-2 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {inst.note || `Installment (${inst.paymentMethod.toUpperCase()})`}
                              </p>
                              <p className="text-muted-foreground font-mono">
                                {inst.date} · Bal after: {formatINR(inst.balanceAfterPayment)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 mr-1">
                                {formatINR(inst.amount)}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingInstallment(inst);
                                  setInstallmentDebt(debt);
                                  setInstAmount(String(inst.amount));
                                  setInstDate(inst.date);
                                  setInstMethod(inst.paymentMethod);
                                  setInstNote(inst.note || '');
                                }}
                                aria-label="Edit installment log"
                                title="Edit installment"
                                className="min-h-[30px] min-w-[30px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteDebtInstallment(inst.id);
                                  toast.success('Removed installment log');
                                }}
                                aria-label="Delete installment log"
                                title="Delete installment"
                                className="min-h-[30px] min-w-[30px] flex items-center justify-center rounded-md text-muted-foreground hover:text-rose-500 hover:bg-muted transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No installments logged yet.
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDebtDialog(debt)}
                        className="min-h-[38px] px-3 text-xs gap-1.5 rounded-xl"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit Details
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTopUpTarget(debt);
                          setTopUpAmt('');
                          setTopUpNote('');
                        }}
                        className="min-h-[38px] px-3 text-xs gap-1.5 rounded-xl"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Top Up
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyReminder(debt)}
                        className="min-h-[38px] px-3 text-xs gap-1.5 rounded-xl"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy UPI Reminder
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await deleteDebtRecord(debt.id);
                          toast.success(`Archived ${debt.personName}'s ledger`);
                        }}
                        className="min-h-[38px] px-3 text-xs gap-1.5 text-rose-500 hover:text-rose-600 ml-auto rounded-xl"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog: New / Edit Friend Ledger */}
      <Dialog
        open={isNewOpen}
        onOpenChange={(open) => {
          setIsNewOpen(open);
          if (!open) setEditingDebt(null);
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {editingDebt ? 'Edit Friend Debt / IOU Ledger' : 'New Friend Debt / IOU Ledger'}
            </DialogTitle>
            <DialogDescription>
              {editingDebt
                ? 'Update friend details, direction, principal, schedule, or notes.'
                : 'Track money borrowed from or lent to a friend with partial installment history.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveDebt} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted">
              <button
                type="button"
                onClick={() => setDirection('borrowed')}
                className={`min-h-[38px] text-xs font-semibold rounded-lg transition-colors ${
                  direction === 'borrowed'
                    ? 'bg-background text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                I Borrowed (I Owe)
              </button>
              <button
                type="button"
                onClick={() => setDirection('lent')}
                className={`min-h-[38px] text-xs font-semibold rounded-lg transition-colors ${
                  direction === 'lent'
                    ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                I Lent (Owes Me)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-person">Friend Name</Label>
                <Input
                  id="d-person"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="e.g., Rahul"
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-amt">Principal Amount (₹)</Label>
                <Input
                  id="d-amt"
                  type="number"
                  min="1"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="d-title">Reason / Description</Label>
              <Input
                id="d-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Goa trip split, Laptop advance"
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-plan">Monthly Plan (₹)</Label>
                <Input
                  id="d-plan"
                  type="number"
                  min="0"
                  value={plannedMonthly}
                  onChange={(e) => setPlannedMonthly(e.target.value)}
                  placeholder="Optional"
                  className="h-11 font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-day">Due Day (1–31)</Label>
                <Input
                  id="d-day"
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-date">Start Date</Label>
                <Input
                  id="d-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-11 font-mono tabular-nums text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="d-notes">Notes (optional)</Label>
              <Input
                id="d-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note or UPI ID"
                className="h-11"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsNewOpen(false);
                  setEditingDebt(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">{editingDebt ? 'Update Ledger' : 'Save Ledger'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Record / Edit Installment */}
      <Dialog
        open={!!installmentDebt || !!editingInstallment}
        onOpenChange={(open) => {
          if (!open) {
            setInstallmentDebt(null);
            setEditingInstallment(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {editingInstallment
                ? `Edit Installment Log`
                : installmentDebt?.direction === 'borrowed'
                ? `Pay ${installmentDebt?.personName}`
                : `Receive from ${installmentDebt?.personName}`}
            </DialogTitle>
            <DialogDescription>
              {editingInstallment
                ? 'Adjusting amount or date automatically recalculates remaining balance and synced transaction.'
                : `Remaining balance: ${formatINR(installmentDebt?.remainingAmount || 0)}. Logs a synced ledger entry automatically.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveInstallment} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inst-amt">Amount (₹)</Label>
                <Input
                  id="inst-amt"
                  type="number"
                  min="1"
                  value={instAmount}
                  onChange={(e) => setInstAmount(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inst-date">Date</Label>
                <Input
                  id="inst-date"
                  type="date"
                  value={instDate}
                  onChange={(e) => setInstDate(e.target.value)}
                  className="h-11 font-mono tabular-nums text-xs"
                  required
                />
              </div>
            </div>

            <div className={`grid gap-3 ${editingInstallment ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <div className="space-y-1.5">
                <Label htmlFor="inst-method">Method</Label>
                <select
                  id="inst-method"
                  value={instMethod}
                  onChange={(e) => setInstMethod(e.target.value as DebtPaymentMethod)}
                  className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background"
                >
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="offset_expense">Offset Expense</option>
                </select>
              </div>

              {!editingInstallment && (
                <div className="space-y-1.5">
                  <Label htmlFor="inst-acc">Account</Label>
                  <select
                    id="inst-acc"
                    value={instAccountId}
                    onChange={(e) => setInstAccountId(e.target.value)}
                    className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background"
                  >
                    {accounts
                      .filter((a) => !a.archived && !a.deletedAt)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatINR(a.balance)})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-note">Note (optional)</Label>
              <Input
                id="inst-note"
                value={instNote}
                onChange={(e) => setInstNote(e.target.value)}
                placeholder="e.g., GPay transfer"
                className="h-11"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setInstallmentDebt(null);
                  setEditingInstallment(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingInstallment ? 'Update Installment' : 'Record Installment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Top Up Debt */}
      <Dialog
        open={!!topUpTarget}
        onOpenChange={(open) => !open && setTopUpTarget(null)}
      >
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Top Up {topUpTarget?.personName}&apos;s Balance</DialogTitle>
            <DialogDescription>
              Add an extra amount to this existing running friend ledger.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTopUp} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tu-amt">Additional Amount (₹)</Label>
              <Input
                id="tu-amt"
                type="number"
                min="1"
                value={topUpAmt}
                onChange={(e) => setTopUpAmt(e.target.value)}
                className="h-11 font-mono tabular-nums"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tu-note">Reason (optional)</Label>
              <Input
                id="tu-note"
                value={topUpNote}
                onChange={(e) => setTopUpNote(e.target.value)}
                placeholder="e.g., Dinner split"
                className="h-11"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTopUpTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Add to Balance</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
