'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  HeartHandshake,
  Users,
  Landmark,
  Receipt,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Edit2,
} from 'lucide-react';
import {
  useFinanceStore,
  formatINR,
  getCurrentMonthKey,
} from '@/lib/stores/finance-store';
import type { FinanceTransaction } from '@/lib/types';
import type { ExpenseParseOutput } from '@/lib/ai/types';
import { SmartExpenseBar } from './SmartExpenseBar';
import { AddTransactionModal } from './AddTransactionModal';
import { CommitmentsTab } from './CommitmentsTab';
import { LendBorrowTab } from './LendBorrowTab';
import { EmiTrackerTab } from './EmiTrackerTab';
import { TransactionsAnalyticsTab } from './TransactionsAnalyticsTab';
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

type ActiveTab = 'overview' | 'commitments' | 'debts' | 'emis';

function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const date = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1 + deltaMonths, 1);
  return getCurrentMonthKey(date);
}

function formatMonthDisplay(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const date = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function FinancePageContent() {
  const isLoading = useFinanceStore((s) => s.isLoading);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const setSelectedMonth = useFinanceStore((s) => s.setSelectedMonth);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getAllCommitmentLedgers = useFinanceStore((s) => s.getAllCommitmentLedgers);
  const getDebtSummary = useFinanceStore((s) => s.getDebtSummary);
  const setMonthlyBudget = useFinanceStore((s) => s.setMonthlyBudget);
  const accounts = useFinanceStore((s) => s.accounts);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinanceTransaction | null>(null);
  const [prefillData, setPrefillData] = useState<Partial<ExpenseParseOutput> | null>(
    null
  );
  const [defaultCommitmentId, setDefaultCommitmentId] = useState<string | null>(null);

  // Edit Monthly Budget Modal
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [incomeInput, setIncomeInput] = useState('');

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const summary = getMonthlySummary(selectedMonth);
  const commitmentLedgers = getAllCommitmentLedgers(selectedMonth);
  const debtSummary = getDebtSummary();

  const handleOpenNewTx = (prefill?: Partial<ExpenseParseOutput>) => {
    setEditingTx(null);
    setDefaultCommitmentId(null);
    setPrefillData(prefill || null);
    setIsAddTxModalOpen(true);
  };

  const handleOpenOffsetForCommitment = (commitmentId: string) => {
    setEditingTx(null);
    setPrefillData(null);
    setDefaultCommitmentId(commitmentId);
    setIsAddTxModalOpen(true);
  };

  const handleOpenEditTx = (tx: FinanceTransaction) => {
    setPrefillData(null);
    setDefaultCommitmentId(null);
    setEditingTx(tx);
    setIsAddTxModalOpen(true);
  };

  const handleSaveMonthlyBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const bVal = parseFloat(budgetInput);
    const iVal = parseFloat(incomeInput);
    if (isNaN(bVal) || bVal <= 0) {
      toast.error('Please enter a valid monthly budget');
      return;
    }
    await setMonthlyBudget(
      selectedMonth,
      bVal,
      !isNaN(iVal) && iVal > 0 ? iVal : undefined
    );
    toast.success(`Updated monthly budget for ${formatMonthDisplay(selectedMonth)}`);
    setIsBudgetModalOpen(false);
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/15 text-primary">
              <Wallet className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                FlowFinance Command Center
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Envelope Budgets • Monthly Commitment Offset Ledger • Friend Partial
                Debts • EMI Tracker
              </p>
            </div>
          </div>
        </div>

        {/* Month Selector & Primary CTA */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center rounded-lg border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, -1))}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-foreground min-w-[125px] text-center">
              {formatMonthDisplay(selectedMonth)}
            </span>
            <button
              type="button"
              onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, 1))}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Button onClick={() => handleOpenNewTx()} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Log Expense / Income
          </Button>
        </div>
      </div>

      {/* AI / Deterministic Natural-Language Smart Expense Bar */}
      <SmartExpenseBar onOpenDetailedModal={handleOpenNewTx} />

      {/* 4-Card Bento KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Safe-to-Spend Engine */}
        <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Safe-to-Spend Left
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="my-2">
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground">
              {formatINR(summary.safeToSpendMonthly)}
            </p>
            <p className="text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              {formatINR(summary.safeToSpendDaily)} / day ({summary.remainingDaysInMonth}{' '}
              days left)
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            After deducting unpaid EMIs ({formatINR(summary.remainingUnpaidEmis)}) &amp;
            Commitment balances ({formatINR(summary.remainingUnpaidCommitments)})
          </p>
        </div>

        {/* KPI 2: Total Spent vs Monthly Budget */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Spent vs Monthly Budget
            </span>
            <button
              type="button"
              onClick={() => {
                setBudgetInput(String(summary.monthlyBudget));
                setIncomeInput(String(summary.expectedIncome));
                setIsBudgetModalOpen(true);
              }}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Edit monthly budget"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="my-2">
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground">
              {formatINR(summary.totalSpent)}
            </p>
            <p className="text-xs text-muted-foreground font-mono tabular-nums mt-0.5">
              of {formatINR(summary.monthlyBudget)} budget (
              {Math.round((summary.totalSpent / (summary.monthlyBudget || 1)) * 100)}%)
            </p>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div
              style={{
                width: `${Math.min(
                  100,
                  Math.round((summary.totalSpent / (summary.monthlyBudget || 1)) * 100)
                )}%`,
              }}
              className="h-full bg-primary transition-all duration-300"
            />
          </div>
        </div>

        {/* KPI 3: Monthly Commitments ("Mother's ₹3,000 Tracker") */}
        <div
          onClick={() => setActiveTab('commitments')}
          className="cursor-pointer rounded-xl border border-pink-500/30 bg-pink-500/5 hover:bg-pink-500/10 transition-colors p-4 shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-pink-600 dark:text-pink-400">
              Monthly Commitments
            </span>
            <HeartHandshake className="w-4 h-4 text-pink-500" />
          </div>
          {commitmentLedgers[0] ? (
            <>
              <div className="my-2">
                <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground">
                  {formatINR(commitmentLedgers[0].remainingBalance)}
                  <span className="text-xs font-normal text-muted-foreground ml-1.5">
                    left to pay
                  </span>
                </p>
                <p className="text-xs text-pink-600 dark:text-pink-400 font-medium mt-0.5">
                  {commitmentLedgers[0].commitment.recipientName}:{' '}
                  {formatINR(commitmentLedgers[0].offsetExpensesAmount)} deducted via
                  offsets
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Target: {formatINR(commitmentLedgers[0].effectiveTargetAmount)}/mo • Click
                to view itemized offsets →
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground my-4">
              No active monthly commitments
            </p>
          )}
        </div>

        {/* KPI 4: Friend Debts & EMIs */}
        <div
          onClick={() => setActiveTab('debts')}
          className="cursor-pointer rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors p-4 shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Friend Debts &amp; EMIs
            </span>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <div className="my-2">
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground">
              {formatINR(debtSummary.totalBorrowedRemaining)}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">
                I owe
              </span>
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
              +{formatINR(debtSummary.totalLentRemaining)} owed to me • Unpaid EMIs:{' '}
              {formatINR(summary.remainingUnpaidEmis)}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Planned debt installments: {formatINR(summary.plannedDebtInstallmentsDue)} due
            →
          </p>
        </div>
      </div>

      {/* Accounts Strip */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="shrink-0 rounded-lg border border-border/70 bg-card px-3.5 py-2 flex items-center gap-3"
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: acc.color }}
            />
            <div>
              <span className="text-xs font-medium text-muted-foreground block">
                {acc.name}
              </span>
              <span className="text-sm font-bold font-mono tabular-nums text-foreground">
                {formatINR(acc.balance)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="border-b border-border flex items-center gap-1 overflow-x-auto">
        {(
          [
            {
              id: 'overview',
              label: 'Transactions & Budgets',
              icon: Receipt,
            },
            {
              id: 'commitments',
              label: "Monthly Commitments (Mother's ₹3k Offset)",
              icon: HeartHandshake,
              badge:
                summary.remainingUnpaidCommitments > 0
                  ? formatINR(summary.remainingUnpaidCommitments)
                  : 'Settled',
            },
            {
              id: 'debts',
              label: 'Lend & Borrow (Friends ₹2k Partial)',
              icon: Users,
              badge: formatINR(debtSummary.totalBorrowedRemaining),
            },
            {
              id: 'emis',
              label: 'EMI & Loan Amortization',
              icon: Landmark,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {'badge' in tab && tab.badge && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded font-mono tabular-nums ${
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-8">
          <div className="h-64 rounded-xl bg-muted/50 animate-pulse" />
          <div className="h-64 rounded-xl bg-muted/50 animate-pulse" />
        </div>
      ) : (
        <div className="pt-1">
          {activeTab === 'overview' && (
            <TransactionsAnalyticsTab onEditTransaction={handleOpenEditTx} />
          )}
          {activeTab === 'commitments' && (
            <CommitmentsTab onLogOffsetExpense={handleOpenOffsetForCommitment} />
          )}
          {activeTab === 'debts' && <LendBorrowTab />}
          {activeTab === 'emis' && <EmiTrackerTab />}
        </div>
      )}

      {/* Add / Edit Transaction Modal */}
      <AddTransactionModal
        open={isAddTxModalOpen}
        onOpenChange={setIsAddTxModalOpen}
        editingTransaction={editingTx}
        prefill={prefillData}
        defaultCommitmentId={defaultCommitmentId}
      />

      {/* Edit Monthly Budget Modal */}
      <Dialog open={isBudgetModalOpen} onOpenChange={setIsBudgetModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              Monthly Budget ({formatMonthDisplay(selectedMonth)})
            </DialogTitle>
            <DialogDescription>
              Set your overall monthly spending budget and expected income for
              Safe-to-Spend calculations.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveMonthlyBudget} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="monthly-budget-input">Total Monthly Budget (₹)</Label>
              <Input
                id="monthly-budget-input"
                type="number"
                min="1000"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="font-mono tabular-nums"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monthly-income-input">Expected Monthly Income (₹)</Label>
              <Input
                id="monthly-income-input"
                type="number"
                min="0"
                value={incomeInput}
                onChange={(e) => setIncomeInput(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBudgetModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Budget</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
