'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  HeartHandshake,
  Users,
  Landmark,
  ArrowRight,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { Button } from '@/components/ui/button';

export function FinanceOverviewWidget() {
  const router = useRouter();
  const isLoading = useFinanceStore((s) => s.isLoading);
  const categories = useFinanceStore((s) => s.categories);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getAllCommitmentLedgers = useFinanceStore((s) => s.getAllCommitmentLedgers);
  const getDebtSummary = useFinanceStore((s) => s.getDebtSummary);

  useEffect(() => {
    if (categories.length === 0) {
      loadFinanceData();
    }
  }, [categories.length, loadFinanceData]);

  const summary = getMonthlySummary();
  const commitmentLedgers = getAllCommitmentLedgers();
  const debtSummary = getDebtSummary();
  const primaryCommitment = commitmentLedgers[0];

  if (isLoading && categories.length === 0) {
    return (
      <section className="bg-card/30 backdrop-blur-2xl rounded-3xl border border-white/10 p-6 h-56 animate-pulse" />
    );
  }

  return (
    <section className="bg-card/35 backdrop-blur-2xl backdrop-saturate-150 rounded-3xl border border-white/10 shadow-xl overflow-hidden">
      <div className="p-6 md:p-7 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25">
              <Wallet className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                FlowFinance Pulse
              </h2>
              <p className="text-xs text-muted-foreground">
                Safe-to-Spend • Monthly Commitment Offsets • Friend Partial Debts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => router.push('/finance')}
              className="gap-1.5 text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Expense
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/finance')}
              className="group gap-1.5 text-xs h-8 text-muted-foreground hover:text-primary"
            >
              Open Ledger
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>

        {/* 3-Column Bento Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Safe-to-Spend */}
          <div
            onClick={() => router.push('/finance')}
            className="cursor-pointer rounded-2xl border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all p-4 space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span>Safe-to-Spend Allowance</span>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-foreground">
              {formatINR(summary.safeToSpendMonthly)}
            </p>
            <p className="text-xs text-muted-foreground font-mono tabular-nums">
              {formatINR(summary.safeToSpendDaily)}/day • Spent {formatINR(summary.totalSpent)}{' '}
              of {formatINR(summary.monthlyBudget)}
            </p>
          </div>

          {/* Card 2: Mother's Monthly Commitment & Offsets */}
          <div
            onClick={() => router.push('/finance')}
            className="cursor-pointer rounded-2xl border border-pink-500/25 bg-pink-500/5 hover:bg-pink-500/10 transition-all p-4 space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-pink-600 dark:text-pink-400">
              <span>
                {primaryCommitment
                  ? `${primaryCommitment.commitment.recipientName}'s Monthly Commitment`
                  : 'Monthly Commitments'}
              </span>
              <HeartHandshake className="w-4 h-4" />
            </div>
            {primaryCommitment ? (
              <>
                <p className="text-2xl font-bold font-mono tabular-nums text-foreground">
                  {formatINR(primaryCommitment.remainingBalance)}
                  <span className="text-xs font-normal text-muted-foreground ml-1.5">
                    remaining
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong className="text-pink-600 dark:text-pink-400 font-mono tabular-nums">
                    -{formatINR(primaryCommitment.offsetExpensesAmount)}
                  </strong>{' '}
                  deducted via offset purchases/bills of{' '}
                  {formatINR(primaryCommitment.effectiveTargetAmount)}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground pt-2">
                Track monthly allowances with automatic bill deductions
              </p>
            )}
          </div>

          {/* Card 3: Friend Debts & EMIs */}
          <div
            onClick={() => router.push('/finance')}
            className="cursor-pointer rounded-2xl border border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 transition-all p-4 space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400">
              <span>Friend Debts &amp; EMIs</span>
              <Users className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-foreground">
              {formatINR(debtSummary.totalBorrowedRemaining)}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">
                borrowed balance
              </span>
            </p>
            <p className="text-xs text-muted-foreground font-mono tabular-nums">
              +{formatINR(debtSummary.totalLentRemaining)} owed to me • Unpaid EMIs:{' '}
              {formatINR(summary.remainingUnpaidEmis)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
