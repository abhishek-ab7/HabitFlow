'use client';

import React, { useState } from 'react';
import {
  Users,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  History,
  PlusCircle,
  Wallet,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { DebtRecord, DebtDirection, DebtPaymentMethod } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function LendBorrowTab() {
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const accounts = useFinanceStore((s) => s.accounts);
  const getDebtSummary = useFinanceStore((s) => s.getDebtSummary);
  const getDebtInstallments = useFinanceStore((s) => s.getDebtInstallments);
  const addDebtRecord = useFinanceStore((s) => s.addDebtRecord);
  const recordDebtInstallment = useFinanceStore((s) => s.recordDebtInstallment);
  const topUpDebt = useFinanceStore((s) => s.topUpDebt);

  const summary = getDebtSummary();

  const [filter, setFilter] = useState<'all' | 'borrowed' | 'lent' | 'settled'>('all');
  const [isNewDebtOpen, setIsNewDebtOpen] = useState(false);

  // Partial Installment Modal State
  const [activeDebtForPayment, setActiveDebtForPayment] = useState<DebtRecord | null>(null);
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<DebtPaymentMethod>('upi');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [installmentNote, setInstallmentNote] = useState('');

  // Top-up Debt Modal State
  const [activeDebtForTopUp, setActiveDebtForTopUp] = useState<DebtRecord | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpNote, setTopUpNote] = useState('');

  // New Debt Form State
  const [personName, setPersonName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [direction, setDirection] = useState<DebtDirection>('borrowed');
  const [title, setTitle] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('2000');
  const [plannedMonthlyInstallment, setPlannedMonthlyInstallment] = useState('500');
  const [dueDayOfMonth, setDueDayOfMonth] = useState('15');

  const filteredDebts = debtRecords.filter((d) => {
    if (filter === 'settled') return d.status === 'settled';
    if (filter === 'borrowed') return d.direction === 'borrowed' && d.status === 'active';
    if (filter === 'lent') return d.direction === 'lent' && d.status === 'active';
    return true;
  });

  const openPaymentModal = (debt: DebtRecord) => {
    setActiveDebtForPayment(debt);
    const defaultAmt = Math.min(
      debt.remainingAmount,
      debt.plannedMonthlyInstallment || debt.remainingAmount
    );
    setInstallmentAmount(String(defaultAmt));
    setPaymentMethod('upi');
    setSelectedAccountId(accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || '');
    setInstallmentNote('');
  };

  const handleRecordInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDebtForPayment) return;
    const amt = parseFloat(installmentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid installment amount');
      return;
    }

    await recordDebtInstallment({
      debtId: activeDebtForPayment.id,
      amount: amt,
      paymentMethod,
      accountId: selectedAccountId || undefined,
      note: installmentNote.trim() || undefined,
    });

    const newRem = Math.max(0, activeDebtForPayment.remainingAmount - amt);
    toast.success(
      newRem === 0
        ? `Fully settled ${activeDebtForPayment.personName}'s debt! (+50 XP)`
        : `Logged ${formatINR(amt)} partial installment for ${
            activeDebtForPayment.personName
          }. Remaining: ${formatINR(newRem)}`
    );
    setActiveDebtForPayment(null);
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDebtForTopUp) return;
    const amt = parseFloat(topUpAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid top-up amount');
      return;
    }

    await topUpDebt(activeDebtForTopUp.id, amt, topUpNote.trim() || undefined);
    toast.success(`Added ${formatINR(amt)} to ${activeDebtForTopUp.personName}'s ledger`);
    setActiveDebtForTopUp(null);
    setTopUpAmount('');
    setTopUpNote('');
  };

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const principal = parseFloat(principalAmount);
    const planned = parseFloat(plannedMonthlyInstallment) || undefined;
    if (!personName.trim() || !title.trim() || isNaN(principal) || principal <= 0) {
      toast.error('Please enter person name, title, and principal amount');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    await addDebtRecord({
      personName: personName.trim(),
      contactInfo: contactInfo.trim() || undefined,
      direction,
      title: title.trim(),
      principalAmount: principal,
      startDate: todayStr,
      repaymentSchedule: planned ? 'monthly_partial' : 'flexible',
      plannedMonthlyInstallment: planned,
      dueDayOfMonth: parseInt(dueDayOfMonth, 10) || 15,
      color: direction === 'borrowed' ? '#f59e0b' : '#10b981',
    });

    toast.success(`Created ${direction} ledger for ${personName}`);
    setIsNewDebtOpen(false);
    setPersonName('');
    setTitle('');
  };

  return (
    <div className="space-y-6">
      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              I Owe (Borrowed)
            </span>
            <ArrowDownLeft className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1.5">
            {formatINR(summary.totalBorrowedRemaining)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Across {summary.activeBorrowedCount} active friend loan(s)
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Owed to Me (Lent)
            </span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1.5">
            {formatINR(summary.totalLentRemaining)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Across {summary.activeLentCount} active friend record(s)
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Net Lending Position
          </span>
          <p
            className={`text-2xl font-bold font-mono tabular-nums mt-1.5 ${
              summary.netPosition >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {summary.netPosition >= 0 ? '+' : ''}
            {formatINR(summary.netPosition)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lent minus Borrowed balance
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Planned Monthly Outflow
          </span>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1.5">
            {formatINR(summary.plannedInstallmentsThisMonth)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reserved in Safe-to-Spend
          </p>
        </div>
      </div>

      {/* Filter Bar + New Debt Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All Ledgers' },
              { id: 'borrowed', label: 'I Borrowed (I Owe)' },
              { id: 'lent', label: 'I Lent (They Owe)' },
              { id: 'settled', label: 'Settled' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/70 text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Button onClick={() => setIsNewDebtOpen(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          New Borrow / Lend Record
        </Button>
      </div>

      {/* Debt Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredDebts.map((debt) => {
          const installments = getDebtInstallments(debt.id);
          const pct =
            debt.principalAmount > 0
              ? Math.min(100, Math.round((debt.totalRepaidAmount / debt.principalAmount) * 100))
              : 100;
          const isBorrowed = debt.direction === 'borrowed';

          return (
            <div
              key={debt.id}
              className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          isBorrowed
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isBorrowed ? 'I Borrowed (I Owe)' : 'I Lent (Owes Me)'}
                      </span>
                      {debt.status === 'settled' && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-600">
                          Settled
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-foreground">
                      {debt.personName} — {debt.title}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {debt.plannedMonthlyInstallment
                        ? `Planned partial installment: ${formatINR(
                            debt.plannedMonthlyInstallment
                          )}/month (Due day ${debt.dueDayOfMonth || 15})`
                        : 'Flexible repayment schedule'}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] uppercase text-muted-foreground font-semibold">
                      Remaining
                    </p>
                    <p className="text-xl font-bold font-mono tabular-nums text-foreground">
                      {formatINR(debt.remainingAmount)}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
                      of {formatINR(debt.principalAmount)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Repaid:{' '}
                      <strong className="text-foreground font-mono tabular-nums">
                        {formatINR(debt.totalRepaidAmount)}
                      </strong>
                    </span>
                    <span className="font-mono tabular-nums font-semibold">{pct}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full transition-all duration-300 ${
                        isBorrowed ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Installment History Timeline */}
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Partial Installment History ({installments.length})
                  </p>
                  {installments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No partial repayments logged yet.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {installments.map((inst) => (
                        <div
                          key={inst.id}
                          className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/60 bg-background/60 text-xs"
                        >
                          <div>
                            <span className="font-medium text-foreground">
                              {inst.date}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              {inst.note || inst.paymentMethod.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-right font-mono tabular-nums">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              -{formatINR(inst.amount)}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">
                              Bal: {formatINR(inst.balanceAfterPayment)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
                {debt.remainingAmount > 0 && (
                  <Button
                    size="sm"
                    onClick={() => openPaymentModal(debt)}
                    className="flex-1 gap-1.5 text-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isBorrowed ? 'Log Partial Payment' : 'Record Amount Received'}
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveDebtForTopUp(debt)}
                  className="gap-1.5 text-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Top-up Debt
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Log Partial Installment */}
      <Dialog
        open={!!activeDebtForPayment}
        onOpenChange={(open) => !open && setActiveDebtForPayment(null)}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {activeDebtForPayment?.direction === 'borrowed'
                ? `Log Partial Repayment to ${activeDebtForPayment?.personName}`
                : `Record Repayment from ${activeDebtForPayment?.personName}`}
            </DialogTitle>
            <DialogDescription>
              Current remaining balance:{' '}
              <strong>
                {activeDebtForPayment ? formatINR(activeDebtForPayment.remainingAmount) : ''}
              </strong>
              . This automatically logs a transaction and updates the remaining principal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordInstallment} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inst-amount">Installment Amount (₹)</Label>
                <Input
                  id="inst-amount"
                  type="number"
                  min="1"
                  max={activeDebtForPayment?.remainingAmount || 999999}
                  value={installmentAmount}
                  onChange={(e) => setInstallmentAmount(e.target.value)}
                  className="font-mono tabular-nums"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inst-method">Payment Method</Label>
                <select
                  id="inst-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as DebtPaymentMethod)}
                  className="w-full h-10 px-3 text-xs rounded-md border border-input bg-background"
                >
                  <option value="upi">UPI (GPay / PhonePe)</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="offset_expense">Offset (Paid Expense for Them)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-account">Account</Label>
              <select
                id="inst-account"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-md border border-input bg-background"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatINR(a.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-note">Note (Optional)</Label>
              <Input
                id="inst-note"
                value={installmentNote}
                onChange={(e) => setInstallmentNote(e.target.value)}
                placeholder="e.g., Monthly ₹500 partial installment via GPay"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveDebtForPayment(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Installment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Top-up Existing Debt */}
      <Dialog
        open={!!activeDebtForTopUp}
        onOpenChange={(open) => !open && setActiveDebtForTopUp(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Top-up Debt with {activeDebtForTopUp?.personName}</DialogTitle>
            <DialogDescription>
              Borrowed or lent more money with {activeDebtForTopUp?.personName}? Add to the
              principal balance.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTopUpSubmit} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="topup-amt">Additional Amount (₹)</Label>
              <Input
                id="topup-amt"
                type="number"
                min="1"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="500"
                className="font-mono tabular-nums"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topup-note">Reason / Note</Label>
              <Input
                id="topup-note"
                value={topUpNote}
                onChange={(e) => setTopUpNote(e.target.value)}
                placeholder="e.g., Split cab & dinner bill"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveDebtForTopUp(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Add to Balance</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Create New Friend Borrow / Lend Record */}
      <Dialog open={isNewDebtOpen} onOpenChange={setIsNewDebtOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>New Friend Borrow / Lend Ledger</DialogTitle>
            <DialogDescription>
              Track money borrowed from or lent to friends with partial monthly installment
              support.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateDebt} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted">
              <button
                type="button"
                onClick={() => setDirection('borrowed')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                  direction === 'borrowed'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                I Borrowed (I Owe)
              </button>
              <button
                type="button"
                onClick={() => setDirection('lent')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                  direction === 'lent'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                I Lent (They Owe Me)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="debt-person">Friend / Person Name</Label>
                <Input
                  id="debt-person"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="e.g., Rahul Sharma"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="debt-contact">UPI ID / Phone (Optional)</Label>
                <Input
                  id="debt-contact"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="rahul@okaxis"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="debt-title">Purpose / Description</Label>
              <Input
                id="debt-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Borrowed ₹2,000 for trip & gear"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="debt-principal">Total Amount (₹)</Label>
                <Input
                  id="debt-principal"
                  type="number"
                  min="1"
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(e.target.value)}
                  className="font-mono tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="debt-planned">Monthly Partial (₹)</Label>
                <Input
                  id="debt-planned"
                  type="number"
                  min="0"
                  value={plannedMonthlyInstallment}
                  onChange={(e) => setPlannedMonthlyInstallment(e.target.value)}
                  placeholder="500"
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="debt-dueday">Due Day (1–31)</Label>
                <Input
                  id="debt-dueday"
                  type="number"
                  min="1"
                  max="31"
                  value={dueDayOfMonth}
                  onChange={(e) => setDueDayOfMonth(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewDebtOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create Ledger</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
