'use client';

import React, { useMemo, useState } from 'react';
import {
  Plus,
  Landmark,
  CheckCircle2,
  Trash2,
  Pencil,
  Zap,
  Snowflake,
  TrendingDown,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { EmiStatus, EmiTracker } from '@/lib/types';
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
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { useFeedback } from '@/hooks/use-feedback';
import { toast } from 'sonner';

interface DebtPayoffItem {
  id: string;
  name: string;
  remainingBalance: number;
  monthlyPayment: number;
  apr: number;
}

function simulatePayoff(
  items: DebtPayoffItem[],
  extraMonthly: number,
  strategy: 'avalanche' | 'snowball'
) {
  if (items.length === 0) {
    return { months: 0, totalInterest: 0, order: [] as string[] };
  }

  const state = items.map((i) => ({ ...i }));
  let months = 0;
  let totalInterest = 0;
  const order: string[] = [];

  while (months < 360 && state.some((s) => s.remainingBalance > 0.5)) {
    months += 1;
    let freedPool = extraMonthly;

    // Sort active debts by strategy
    const active = state.filter((s) => s.remainingBalance > 0.5);
    active.sort((a, b) =>
      strategy === 'avalanche'
        ? b.apr - a.apr || a.remainingBalance - b.remainingBalance
        : a.remainingBalance - b.remainingBalance || b.apr - a.apr
    );

    // Accrue interest & pay minimum monthly payments
    for (const d of state) {
      if (d.remainingBalance <= 0.5) {
        freedPool += d.monthlyPayment;
        continue;
      }
      const monthlyRate = d.apr > 0 ? d.apr / 100 / 12 : 0;
      const interest = d.remainingBalance * monthlyRate;
      totalInterest += interest;
      d.remainingBalance += interest;

      const pay = Math.min(d.remainingBalance, Math.max(d.monthlyPayment, 500));
      d.remainingBalance -= pay;
      if (d.remainingBalance <= 0.5) {
        d.remainingBalance = 0;
        if (!order.includes(d.name)) order.push(d.name);
      }
    }

    // Apply freed + extra snowball/avalanche pool to top-priority active debt
    for (const target of active) {
      if (freedPool <= 0) break;
      if (target.remainingBalance <= 0.5) continue;
      const extraPay = Math.min(target.remainingBalance, freedPool);
      target.remainingBalance -= extraPay;
      freedPool -= extraPay;
      if (target.remainingBalance <= 0.5) {
        target.remainingBalance = 0;
        if (!order.includes(target.name)) order.push(target.name);
      }
    }
  }

  return {
    months,
    totalInterest: Math.round(totalInterest),
    order,
  };
}

export function EmisPayoffSection() {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const emiTrackers = useFinanceStore((s) => s.emiTrackers);
  const accounts = useFinanceStore((s) => s.accounts);
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);

  const addEmiTracker = useFinanceStore((s) => s.addEmiTracker);
  const updateEmiTracker = useFinanceStore((s) => s.updateEmiTracker);
  const payMonthlyEmi = useFinanceStore((s) => s.payMonthlyEmi);
  const deleteEmiTracker = useFinanceStore((s) => s.deleteEmiTracker);

  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [extraPayment, setExtraPayment] = useState<number>(3000);
  const feedback = useFeedback();

  // Add / Edit EMI dialog state
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingEmi, setEditingEmi] = useState<EmiTracker | null>(null);
  const [loanName, setLoanName] = useState('');
  const [lenderName, setLenderName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [apr, setApr] = useState('11');
  const [emiAmt, setEmiAmt] = useState('');
  const [tenure, setTenure] = useState('24');
  const [paidMonths, setPaidMonths] = useState('0');
  const [billingDay, setBillingDay] = useState('5');
  const [emiAccountId, setEmiAccountId] = useState('');
  const [emiStatus, setEmiStatus] = useState<EmiStatus>('active');
  const [emiNotes, setEmiNotes] = useState('');

  const activeEmis = useMemo(
    () => emiTrackers.filter((e) => !e.deletedAt),
    [emiTrackers]
  );

  // Build Debt Payoff Accelerator portfolio (Active EMIs + Credit Cards + Borrowed Friend Debts)
  const payoffItems = useMemo<DebtPayoffItem[]>(() => {
    const list: DebtPayoffItem[] = [];

    for (const emi of activeEmis) {
      if (emi.status !== 'active') continue;
      const remMonths = Math.max(0, emi.tenureMonths - emi.paidMonths);
      if (remMonths <= 0) continue;
      const approxBal =
        emi.tenureMonths > 0
          ? Math.round((remMonths / emi.tenureMonths) * emi.principalAmount)
          : emi.emiAmount * remMonths;
      if (approxBal > 0) {
        list.push({
          id: `emi-${emi.id}`,
          name: emi.loanName,
          remainingBalance: approxBal,
          monthlyPayment: emi.emiAmount,
          apr: emi.interestRateAnnual || 12,
        });
      }
    }

    for (const acc of accounts) {
      if (acc.type !== 'credit_card' || acc.archived || acc.deletedAt) continue;
      const bal = Math.abs(acc.balance);
      if (bal > 0) {
        list.push({
          id: `cc-${acc.id}`,
          name: acc.name,
          remainingBalance: bal,
          monthlyPayment: Math.max(1500, Math.round(bal * 0.1)),
          apr: 36,
        });
      }
    }

    for (const debt of debtRecords) {
      if (
        debt.direction !== 'borrowed' ||
        debt.status !== 'active' ||
        debt.deletedAt ||
        debt.remainingAmount <= 0
      ) {
        continue;
      }
      list.push({
        id: `debt-${debt.id}`,
        name: `${debt.personName} (${debt.title})`,
        remainingBalance: debt.remainingAmount,
        monthlyPayment:
          debt.plannedMonthlyInstallment ||
          Math.max(1000, Math.round(debt.remainingAmount * 0.15)),
        apr: 0,
      });
    }

    return list;
  }, [activeEmis, accounts, debtRecords]);

  const simulation = useMemo(() => {
    const baseline = simulatePayoff(payoffItems, 0, strategy);
    const accelerated = simulatePayoff(payoffItems, extraPayment, strategy);
    const monthsSaved = Math.max(0, baseline.months - accelerated.months);
    const interestSaved = Math.max(
      0,
      baseline.totalInterest - accelerated.totalInterest
    );

    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + accelerated.months);
    const debtFreeLabel =
      accelerated.months > 0
        ? targetDate.toLocaleDateString('en-IN', {
            month: 'short',
            year: 'numeric',
          })
        : 'Debt Free';

    return {
      totalDebt: payoffItems.reduce((s, i) => s + i.remainingBalance, 0),
      baseline,
      accelerated,
      monthsSaved,
      interestSaved,
      debtFreeLabel,
    };
  }, [payoffItems, extraPayment, strategy]);

  const openNewEmiDialog = () => {
    const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
    setEditingEmi(null);
    setLoanName('');
    setLenderName('');
    setPrincipal('');
    setApr('11');
    setEmiAmt('');
    setTenure('24');
    setPaidMonths('0');
    setBillingDay('5');
    setEmiAccountId(defaultAcc?.id || '');
    setEmiStatus('active');
    setEmiNotes('');
    setIsNewOpen(true);
  };

  const openEditEmiDialog = (emi: EmiTracker) => {
    setEditingEmi(emi);
    setLoanName(emi.loanName);
    setLenderName(emi.lenderName);
    setPrincipal(String(emi.principalAmount));
    setApr(String(emi.interestRateAnnual));
    setEmiAmt(String(emi.emiAmount));
    setTenure(String(emi.tenureMonths));
    setPaidMonths(String(emi.paidMonths));
    setBillingDay(String(emi.billingDayOfMonth));
    setEmiAccountId(emi.accountId || '');
    setEmiStatus(emi.status);
    setEmiNotes(emi.notes || '');
    setIsNewOpen(true);
  };

  const handleSaveEmi = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(principal);
    const emi = parseFloat(emiAmt);
    const ten = parseInt(tenure, 10);
    if (!loanName.trim() || isNaN(p) || p <= 0 || isNaN(emi) || emi <= 0 || isNaN(ten) || ten <= 0) {
      toast.error('Please fill loan name, principal, EMI amount, and tenure');
      return;
    }

    const parsedPaid = Math.min(ten, Math.max(0, parseInt(paidMonths, 10) || 0));
    const parsedApr = Math.max(0, parseFloat(apr) || 0);
    const parsedDay = Math.min(31, Math.max(1, parseInt(billingDay, 10) || 5));

    if (editingEmi) {
      await updateEmiTracker(editingEmi.id, {
        loanName: loanName.trim(),
        lenderName: lenderName.trim() || 'Bank / NBFC',
        principalAmount: p,
        interestRateAnnual: parsedApr,
        emiAmount: emi,
        tenureMonths: ten,
        paidMonths: parsedPaid,
        billingDayOfMonth: parsedDay,
        accountId: emiAccountId || undefined,
        status: emiStatus,
        notes: emiNotes.trim() || undefined,
      });
      toast.success(`Updated EMI tracker: ${loanName.trim()}`);
    } else {
      const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
      const emiCat =
        categories.find((c) => c.slug === 'emis-debt-repayment') || categories[0];

      await addEmiTracker({
        loanName: loanName.trim(),
        lenderName: lenderName.trim() || 'Bank / NBFC',
        principalAmount: p,
        interestRateAnnual: parsedApr,
        emiAmount: emi,
        tenureMonths: ten,
        paidMonths: parsedPaid,
        startDate: getLocalIsoDate(),
        billingDayOfMonth: parsedDay,
        categoryId: emiCat?.id || '',
        accountId: emiAccountId || defaultAcc?.id,
        autoCreateTaskReminder: false,
        status: parsedPaid >= ten ? 'completed' : 'active',
        notes: emiNotes.trim() || undefined,
      });
      toast.success(`Added EMI tracker: ${loanName.trim()}`);
    }

    setIsNewOpen(false);
    setEditingEmi(null);
  };

  return (
    <section className="space-y-5">
      {/* Debt Payoff Accelerator Card */}
      {payoffItems.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <TrendingDown className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Debt Payoff Accelerator
                </h2>
                <p className="text-xs text-muted-foreground font-mono tabular-nums">
                  {payoffItems.length} active balances · Total{' '}
                  {formatINR(simulation.totalDebt)}
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted">
              <button
                type="button"
                onClick={() => setStrategy('avalanche')}
                className={`min-h-[34px] px-3 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                  strategy === 'avalanche'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Avalanche (High APR)
              </button>
              <button
                type="button"
                onClick={() => setStrategy('snowball')}
                className={`min-h-[34px] px-3 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                  strategy === 'snowball'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Snowflake className="w-3.5 h-3.5 text-cyan-500" />
                Snowball (Smallest)
              </button>
            </div>
          </div>

          {/* Prepayment Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                Extra monthly prepayment
              </span>
              <span className="font-mono tabular-nums font-bold text-primary">
                +{formatINR(extraPayment)} / mo
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={50000}
              step={500}
              value={extraPayment}
              onChange={(e) => setExtraPayment(parseInt(e.target.value, 10))}
              aria-label="Extra monthly debt prepayment"
              className="w-full accent-primary cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60 text-xs">
            <div>
              <span className="text-muted-foreground block">Debt-Free By</span>
              <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-foreground">
                {simulation.debtFreeLabel}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Time Saved</span>
              <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {simulation.monthsSaved} mo
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Interest Saved</span>
              <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatINR(simulation.interestSaved)}
              </span>
            </div>
          </div>

          {simulation.accelerated.order.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Payoff sequence:{' '}
              <strong className="text-foreground">
                {simulation.accelerated.order.join(' → ')}
              </strong>
            </p>
          )}
        </div>
      )}

      {/* EMIs Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-foreground">Loans &amp; EMIs</h2>
          <p className="text-xs text-muted-foreground">
            Track tenure progress and reserve monthly EMIs automatically in Safe-to-Spend
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={openNewEmiDialog}
          className="min-h-[40px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add EMI
        </Button>
      </div>

      {activeEmis.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center space-y-2.5">
          <p className="text-xs text-muted-foreground">
            No active loans or EMIs tracked. Add car, education, phone, or personal loans here.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={openNewEmiDialog}
            className="min-h-[40px] px-4 text-xs rounded-xl"
          >
            Add Loan / EMI
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {activeEmis.map((emi) => {
            const pct =
              emi.tenureMonths > 0
                ? Math.min(100, Math.round((emi.paidMonths / emi.tenureMonths) * 100))
                : 0;
            const isPaidThisMonth =
              emi.lastPaidMonthKey === selectedMonth ||
              transactions.some(
                (t) =>
                  !t.deletedAt &&
                  t.linkedEmiId === emi.id &&
                  t.monthKey === selectedMonth
              );
            const remainingMonths = Math.max(0, emi.tenureMonths - emi.paidMonths);

            return (
              <div
                key={emi.id}
                className="rounded-2xl border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Landmark className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">
                        {emi.loanName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {emi.lenderName} · {emi.interestRateAnnual}% APR · Day{' '}
                        {emi.billingDayOfMonth}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold font-mono tabular-nums text-foreground">
                      {formatINR(emi.emiAmount)}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {emi.paidMonths}/{emi.tenureMonths} mo
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-primary transition-all duration-300"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span>Principal {formatINR(emi.principalAmount)}</span>
                    <span>{remainingMonths} EMIs left</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {emi.status === 'completed' || remainingMonths === 0 ? (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Loan Completed
                    </span>
                  ) : isPaidThisMonth ? (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Paid for {selectedMonth}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={async () => {
                        feedback.coin();
                        const tx = await payMonthlyEmi(emi.id);
                        if (tx) toast.success(`Logged EMI payment for ${emi.loanName}`);
                      }}
                      className="min-h-[36px] px-3 text-xs rounded-lg"
                    >
                      Pay {formatINR(emi.emiAmount)} EMI
                    </Button>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditEmiDialog(emi)}
                      aria-label={`Edit ${emi.loanName}`}
                      title={`Edit ${emi.loanName}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        feedback.warning();
                        await deleteEmiTracker(emi.id);
                        toast.success(`Removed ${emi.loanName}`);
                      }}
                      aria-label={`Delete ${emi.loanName}`}
                      title={`Delete ${emi.loanName}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-muted transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog: New / Edit EMI Tracker */}
      <Dialog
        open={isNewOpen}
        onOpenChange={(open) => {
          setIsNewOpen(open);
          if (!open) setEditingEmi(null);
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{editingEmi ? 'Edit Loan / EMI Tracker' : 'New Loan / EMI Tracker'}</DialogTitle>
            <DialogDescription>
              {editingEmi
                ? 'Update loan terms, paid installments, linked account, or status.'
                : 'Track monthly EMIs and optimize payoff with Avalanche or Snowball projections.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEmi} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="emi-name">Loan Name</Label>
                <Input
                  id="emi-name"
                  value={loanName}
                  onChange={(e) => setLoanName(e.target.value)}
                  placeholder="e.g., Bike Loan"
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emi-lender">Lender</Label>
                <Input
                  id="emi-lender"
                  value={lenderName}
                  onChange={(e) => setLenderName(e.target.value)}
                  placeholder="e.g., HDFC Bank"
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="emi-prin">Principal (₹)</Label>
                <Input
                  id="emi-prin"
                  type="number"
                  min="1"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emi-amt">Monthly EMI (₹)</Label>
                <Input
                  id="emi-amt"
                  type="number"
                  min="1"
                  value={emiAmt}
                  onChange={(e) => setEmiAmt(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="emi-apr">APR (%)</Label>
                <Input
                  id="emi-apr"
                  type="number"
                  step="0.1"
                  min="0"
                  value={apr}
                  onChange={(e) => setApr(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emi-ten">Tenure (mo)</Label>
                <Input
                  id="emi-ten"
                  type="number"
                  min="1"
                  value={tenure}
                  onChange={(e) => setTenure(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emi-paid">Paid (mo)</Label>
                <Input
                  id="emi-paid"
                  type="number"
                  min="0"
                  value={paidMonths}
                  onChange={(e) => setPaidMonths(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="emi-day">Billing Day (1–31)</Label>
                <Input
                  id="emi-day"
                  type="number"
                  min="1"
                  max="31"
                  value={billingDay}
                  onChange={(e) => setBillingDay(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emi-acc">Payment Account</Label>
                <select
                  id="emi-acc"
                  value={emiAccountId}
                  onChange={(e) => setEmiAccountId(e.target.value)}
                  className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background"
                >
                  <option value="">Default account</option>
                  {accounts
                    .filter((a) => !a.archived && !a.deletedAt)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {editingEmi && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="emi-status">Status</Label>
                  <select
                    id="emi-status"
                    value={emiStatus}
                    onChange={(e) => setEmiStatus(e.target.value as EmiStatus)}
                    className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="foreclosed">Foreclosed</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emi-notes">Notes (optional)</Label>
                  <Input
                    id="emi-notes"
                    value={emiNotes}
                    onChange={(e) => setEmiNotes(e.target.value)}
                    placeholder="Optional note"
                    className="h-11"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsNewOpen(false);
                  setEditingEmi(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">{editingEmi ? 'Update EMI' : 'Save EMI Tracker'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
