'use client';

import React, { useState } from 'react';
import {
  Landmark,
  Plus,
  CheckCircle2,
  CalendarClock,
  TrendingDown,
  ShieldCheck,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
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

export function EmiTrackerTab() {
  const emiTrackers = useFinanceStore((s) => s.emiTrackers);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const payMonthlyEmi = useFinanceStore((s) => s.payMonthlyEmi);
  const addEmiTracker = useFinanceStore((s) => s.addEmiTracker);

  const [isNewEmiOpen, setIsNewEmiOpen] = useState(false);
  const [loanName, setLoanName] = useState('');
  const [lenderName, setLenderName] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('60000');
  const [interestRateAnnual, setInterestRateAnnual] = useState('0');
  const [emiAmount, setEmiAmount] = useState('5000');
  const [tenureMonths, setTenureMonths] = useState('12');
  const [paidMonths, setPaidMonths] = useState('0');
  const [billingDayOfMonth, setBillingDayOfMonth] = useState('5');

  const activeEmis = emiTrackers.filter((e) => e.status === 'active');
  const totalMonthlyEmiOutflow = activeEmis.reduce((s, e) => s + e.emiAmount, 0);
  const totalRemainingPayable = activeEmis.reduce(
    (s, e) => s + Math.max(0, e.tenureMonths - e.paidMonths) * e.emiAmount,
    0
  );

  const handlePayEmi = async (emiId: string, name: string, amount: number) => {
    const tx = await payMonthlyEmi(emiId);
    if (tx) {
      toast.success(`Marked ${name} EMI (${formatINR(amount)}) as paid! (+50 XP)`);
    }
  };

  const handleCreateEmi = async (e: React.FormEvent) => {
    e.preventDefault();
    const principal = parseFloat(principalAmount);
    const emiVal = parseFloat(emiAmount);
    const tenure = parseInt(tenureMonths, 10);
    const paid = parseInt(paidMonths, 10) || 0;

    if (!loanName.trim() || !lenderName.trim() || isNaN(emiVal) || emiVal <= 0 || isNaN(tenure)) {
      toast.error('Please fill in loan name, lender, EMI amount, and tenure');
      return;
    }

    const emiCat =
      categories.find((c) => c.slug === 'emis-debt-repayment') || categories[0];
    const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];

    await addEmiTracker({
      loanName: loanName.trim(),
      lenderName: lenderName.trim(),
      principalAmount: principal || emiVal * tenure,
      interestRateAnnual: parseFloat(interestRateAnnual) || 0,
      emiAmount: emiVal,
      tenureMonths: tenure,
      paidMonths: paid,
      startDate: new Date().toISOString().split('T')[0],
      billingDayOfMonth: Math.min(31, Math.max(1, parseInt(billingDayOfMonth, 10) || 5)),
      categoryId: emiCat?.id || '',
      accountId: defaultAcc?.id,
      autoCreateTaskReminder: true,
      status: paid >= tenure ? 'completed' : 'active',
    });

    toast.success(`Added EMI tracker for ${loanName}`);
    setIsNewEmiOpen(false);
    setLoanName('');
    setLenderName('');
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Monthly EMI Commitment
          </span>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">
            {formatINR(totalMonthlyEmiOutflow)}
            <span className="text-xs font-normal text-muted-foreground">/mo</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Across {activeEmis.length} active loan(s)
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Remaining Payable
          </span>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">
            {formatINR(totalRemainingPayable)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sum of remaining monthly installments
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Add New Loan / Card EMI
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              Auto-syncs with Safe-to-Spend &amp; Today&apos;s Tasks
            </p>
          </div>
          <Button onClick={() => setIsNewEmiOpen(true)} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add EMI
          </Button>
        </div>
      </div>

      {/* EMI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {emiTrackers.map((emi) => {
          const remainingMonths = Math.max(0, emi.tenureMonths - emi.paidMonths);
          const remainingPayable = remainingMonths * emi.emiAmount;
          const pct =
            emi.tenureMonths > 0
              ? Math.min(100, Math.round((emi.paidMonths / emi.tenureMonths) * 100))
              : 100;

          const isPaidThisMonth =
            emi.lastPaidMonthKey === selectedMonth ||
            transactions.some(
              (t) => t.linkedEmiId === emi.id && t.monthKey === selectedMonth
            );

          return (
            <div
              key={emi.id}
              className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                      <Landmark className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-base font-bold text-foreground">
                        {emi.loanName}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {emi.lenderName} •{' '}
                        {emi.interestRateAnnual === 0
                          ? 'No-Cost EMI (0% APR)'
                          : `${emi.interestRateAnnual}% p.a.`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold font-mono tabular-nums text-foreground">
                    {formatINR(emi.emiAmount)}
                    <span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </p>
                  <span
                    className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium ${
                      emi.status === 'completed' || isPaidThisMonth
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {emi.status === 'completed'
                      ? 'Completed'
                      : isPaidThisMonth
                      ? `Paid for ${selectedMonth}`
                      : `Due Day ${emi.billingDayOfMonth}`}
                  </span>
                </div>
              </div>

              {/* Amortization Progress */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Tenure Progress:{' '}
                    <strong className="text-foreground font-mono tabular-nums">
                      {emi.paidMonths} / {emi.tenureMonths} months
                    </strong>
                  </span>
                  <span className="font-mono tabular-nums font-semibold">{pct}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    style={{ width: `${pct}%` }}
                    className="h-full bg-primary transition-all duration-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">
                    Principal
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatINR(emi.principalAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">
                    Remaining Months
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {remainingMonths} mo
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">
                    Balance Payable
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatINR(remainingPayable)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" />
                  Billing Day: {emi.billingDayOfMonth}th of every month
                </span>

                {emi.status === 'active' && !isPaidThisMonth && (
                  <Button
                    size="sm"
                    onClick={() => handlePayEmi(emi.id, emi.loanName, emi.emiAmount)}
                    className="gap-1.5 text-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Mark Month&apos;s EMI Paid (+50 XP)
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add New EMI */}
      <Dialog open={isNewEmiOpen} onOpenChange={setIsNewEmiOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Add Loan / Credit Card EMI Tracker</DialogTitle>
            <DialogDescription>
              Track monthly EMIs, remaining tenure, and automatically reserve unpaid EMIs
              in your Safe-to-Spend allowance.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEmi} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="emi-name">Loan / Item Name</Label>
                <Input
                  id="emi-name"
                  value={loanName}
                  onChange={(e) => setLoanName(e.target.value)}
                  placeholder="e.g., iPhone 16 EMI, Bike Loan"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emi-lender">Bank / Lender</Label>
                <Input
                  id="emi-lender"
                  value={lenderName}
                  onChange={(e) => setLenderName(e.target.value)}
                  placeholder="HDFC Bank / Bajaj Finserv"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="emi-monthly">Monthly EMI (₹)</Label>
                <Input
                  id="emi-monthly"
                  type="number"
                  min="1"
                  value={emiAmount}
                  onChange={(e) => setEmiAmount(e.target.value)}
                  className="font-mono tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emi-principal">Total Loan Principal (₹)</Label>
                <Input
                  id="emi-principal"
                  type="number"
                  min="1"
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(e.target.value)}
                  className="font-mono tabular-nums"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="emi-tenure">Tenure (Months)</Label>
                <Input
                  id="emi-tenure"
                  type="number"
                  min="1"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(e.target.value)}
                  className="font-mono tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emi-paid">Already Paid</Label>
                <Input
                  id="emi-paid"
                  type="number"
                  min="0"
                  value={paidMonths}
                  onChange={(e) => setPaidMonths(e.target.value)}
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emi-day">Billing Day</Label>
                <Input
                  id="emi-day"
                  type="number"
                  min="1"
                  max="31"
                  value={billingDayOfMonth}
                  onChange={(e) => setBillingDayOfMonth(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewEmiOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add EMI Tracker</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
