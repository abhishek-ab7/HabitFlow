'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  HeartHandshake,
  Users,
  Landmark,
  CheckCircle2,
  Receipt,
  Link2,
  Unlink,
  Trash2,
  PlusCircle,
  TrendingUp,
  CalendarClock,
  Repeat,
  Copy,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type {
  CommitmentLedgerSummary,
  DebtRecord,
  DebtDirection,
  DebtPaymentMethod,
  SipAssetClass,
} from '@/lib/types';
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

interface TrackersTabProps {
  onLogOffsetExpense: (commitmentId: string) => void;
}

const ASSET_CLASS_LABELS: Record<SipAssetClass, string> = {
  equity_mf: 'Equity Mutual Fund',
  debt_mf: 'Debt Mutual Fund',
  stocks: 'Direct Stocks / ETF',
  gold: 'Digital Gold / SGB',
  fd_rd: 'FD / Recurring Deposit',
  crypto: 'Crypto',
  other: 'Other Investment',
};

export function TrackersTab({ onLogOffsetExpense }: TrackersTabProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const emiTrackers = useFinanceStore((s) => s.emiTrackers);
  const sipPlans = useFinanceStore((s) => s.sipPlans);
  const recurringBills = useFinanceStore((s) => s.recurringBills);

  const getAllCommitmentLedgers = useFinanceStore((s) => s.getAllCommitmentLedgers);
  const getUpcomingFinancialObligations = useFinanceStore(
    (s) => s.getUpcomingFinancialObligations
  );
  const settleCommitmentBalance = useFinanceStore((s) => s.settleCommitmentBalance);
  const attachTransactionToCommitment = useFinanceStore(
    (s) => s.attachTransactionToCommitment
  );
  const addCommitment = useFinanceStore((s) => s.addCommitment);
  const deleteCommitment = useFinanceStore((s) => s.deleteCommitment);

  const getDebtInstallments = useFinanceStore((s) => s.getDebtInstallments);
  const addDebtRecord = useFinanceStore((s) => s.addDebtRecord);
  const recordDebtInstallment = useFinanceStore((s) => s.recordDebtInstallment);
  const topUpDebt = useFinanceStore((s) => s.topUpDebt);
  const deleteDebtRecord = useFinanceStore((s) => s.deleteDebtRecord);

  const addEmiTracker = useFinanceStore((s) => s.addEmiTracker);
  const payMonthlyEmi = useFinanceStore((s) => s.payMonthlyEmi);
  const deleteEmiTracker = useFinanceStore((s) => s.deleteEmiTracker);

  const addSipPlan = useFinanceStore((s) => s.addSipPlan);
  const payMonthlySip = useFinanceStore((s) => s.payMonthlySip);
  const deleteSipPlan = useFinanceStore((s) => s.deleteSipPlan);

  const addRecurringBill = useFinanceStore((s) => s.addRecurringBill);
  const payRecurringBill = useFinanceStore((s) => s.payRecurringBill);
  const deleteRecurringBill = useFinanceStore((s) => s.deleteRecurringBill);

  const commitmentLedgers = getAllCommitmentLedgers(selectedMonth);
  const upcomingObligations = getUpcomingFinancialObligations(31);

  // Expanded state by card ID
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  // Commitment modals
  const [isNewCommOpen, setIsNewCommOpen] = useState(false);
  const [commTitle, setCommTitle] = useState('');
  const [commRecipient, setCommRecipient] = useState('');
  const [commTarget, setCommTarget] = useState('3000');
  const [commDueDay, setCommDueDay] = useState('10');
  const [commRollover, setCommRollover] = useState(true);

  const [attachCommitmentId, setAttachCommitmentId] = useState<string | null>(null);
  const [selectedTxToAttach, setSelectedTxToAttach] = useState('');

  // Debt modals
  const [debtFilter, setDebtFilter] = useState<'all' | 'borrowed' | 'lent'>('all');
  const [isNewDebtOpen, setIsNewDebtOpen] = useState(false);
  const [debtDirection, setDebtDirection] = useState<DebtDirection>('borrowed');
  const [debtPerson, setDebtPerson] = useState('');
  const [debtTitle, setDebtTitle] = useState('');
  const [debtPrincipal, setDebtPrincipal] = useState('');
  const [debtPlannedMonthly, setDebtPlannedMonthly] = useState('');

  const [payingDebt, setPayingDebt] = useState<DebtRecord | null>(null);
  const [instAmount, setInstAmount] = useState('');
  const [instMethod, setInstMethod] = useState<DebtPaymentMethod>('upi');
  const [instNote, setInstNote] = useState('');

  const [topUpTargetDebt, setTopUpTargetDebt] = useState<DebtRecord | null>(null);
  const [topUpVal, setTopUpVal] = useState('');

  // EMI modal & Debt Payoff Simulator state
  const [isNewEmiOpen, setIsNewEmiOpen] = useState(false);
  const [emiName, setEmiName] = useState('');
  const [emiLender, setEmiLender] = useState('');
  const [emiMonthly, setEmiMonthly] = useState('');
  const [emiRate, setEmiRate] = useState('12');
  const [emiTenure, setEmiTenure] = useState('12');
  const [emiPaid, setEmiPaid] = useState('0');
  const [emiDay, setEmiDay] = useState('5');
  const [extraMonthlyPayment, setExtraMonthlyPayment] = useState(2000);
  const [payoffStrategy, setPayoffStrategy] = useState<'avalanche' | 'snowball'>(
    'avalanche'
  );

  // SIP modal
  const [isNewSipOpen, setIsNewSipOpen] = useState(false);
  const [sipName, setSipName] = useState('');
  const [sipPlatform, setSipPlatform] = useState('');
  const [sipAssetClass, setSipAssetClass] = useState<SipAssetClass>('equity_mf');
  const [sipMonthly, setSipMonthly] = useState('5000');
  const [sipDay, setSipDay] = useState('5');
  const [sipCorpus, setSipCorpus] = useState('0');

  // Recurring Bill modal
  const [isNewBillOpen, setIsNewBillOpen] = useState(false);
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billPrevAmount, setBillPrevAmount] = useState('');
  const [billDueDay, setBillDueDay] = useState('10');

  const unlinkedMonthExpenses = transactions.filter(
    (t) =>
      !t.deletedAt &&
      t.monthKey === selectedMonth &&
      t.type === 'expense' &&
      !t.linkedCommitmentId
  );

  const activeDebts = debtRecords.filter((d) => !d.deletedAt);
  const filteredDebts = activeDebts.filter((d) => {
    if (debtFilter === 'borrowed') return d.direction === 'borrowed';
    if (debtFilter === 'lent') return d.direction === 'lent';
    return true;
  });

  const activeEmis = emiTrackers.filter((e) => !e.deletedAt);
  const activeSips = sipPlans.filter((s) => s.isActive && !s.deletedAt);
  const activeBills = recurringBills.filter((b) => b.isActive && !b.deletedAt);

  // Debt Payoff Simulator Calculation (Avalanche vs Snowball)
  const debtSimulation = useMemo(() => {
    const loans = [
      ...activeEmis
        .filter((e) => e.status === 'active')
        .map((e) => {
          const remMonths = Math.max(1, e.tenureMonths - e.paidMonths);
          return {
            id: e.id,
            name: e.loanName,
            balance: remMonths * e.emiAmount,
            minPayment: e.emiAmount,
            rate: e.interestRateAnnual || 12,
          };
        }),
      ...activeDebts
        .filter((d) => d.direction === 'borrowed' && d.status === 'active' && d.remainingAmount > 0)
        .map((d) => ({
          id: d.id,
          name: `${d.personName} (${d.title})`,
          balance: d.remainingAmount,
          minPayment:
            d.plannedMonthlyInstallment ||
            Math.max(1000, Math.round(d.remainingAmount / 6)),
          rate: 0,
        })),
    ];

    if (loans.length === 0) return null;

    const simulate = (
      mode: 'baseline' | 'avalanche' | 'snowball',
      extra: number
    ) => {
      const items = loans.map((l) => ({ ...l }));
      let months = 0;
      let totalInterest = 0;
      let firstClearedMonth = 0;

      while (items.some((i) => i.balance > 0.5) && months < 240) {
        months++;
        let availableExtra = mode === 'baseline' ? 0 : extra;

        // Sort priority target for extra prepayment
        const ordered = [...items].filter((i) => i.balance > 0.5);
        if (mode === 'avalanche') {
          ordered.sort((a, b) => b.rate - a.rate || a.balance - b.balance);
        } else if (mode === 'snowball') {
          ordered.sort((a, b) => a.balance - b.balance);
        }

        // Apply monthly interest + minimum payment
        for (const item of items) {
          if (item.balance <= 0.5) continue;
          const monthlyInterest = item.balance * (item.rate / 100 / 12);
          totalInterest += monthlyInterest;
          item.balance += monthlyInterest;

          const pay = Math.min(item.balance, item.minPayment);
          item.balance -= pay;
          if (item.balance <= 0.5 && firstClearedMonth === 0) {
            firstClearedMonth = months;
          }
        }

        // Apply extra payment in strategy order
        for (const target of ordered) {
          if (availableExtra <= 0) break;
          if (target.balance <= 0.5) continue;
          const pay = Math.min(target.balance, availableExtra);
          target.balance -= pay;
          availableExtra -= pay;
          if (target.balance <= 0.5 && firstClearedMonth === 0) {
            firstClearedMonth = months;
          }
        }
      }

      return {
        months,
        totalInterest: Math.round(totalInterest),
        firstClearedMonth: firstClearedMonth || months,
        topTargetName:
          mode === 'avalanche'
            ? [...loans].sort((a, b) => b.rate - a.rate)[0]?.name
            : [...loans].sort((a, b) => a.balance - b.balance)[0]?.name,
      };
    };

    const base = simulate('baseline', 0);
    const strat = simulate(payoffStrategy, extraMonthlyPayment);

    return {
      totalDebtBalance: loans.reduce((s, l) => s + l.balance, 0),
      loanCount: loans.length,
      baselineMonths: base.months,
      strategyMonths: strat.months,
      monthsSaved: Math.max(0, base.months - strat.months),
      interestSaved: Math.max(0, base.totalInterest - strat.totalInterest),
      firstClearedMonth: strat.firstClearedMonth,
      topTargetName: strat.topTargetName,
    };
  }, [activeEmis, activeDebts, extraMonthlyPayment, payoffStrategy]);

  const handleSettleCommitment = async (
    e: React.MouseEvent,
    ledger: CommitmentLedgerSummary
  ) => {
    e.stopPropagation();
    const tx = await settleCommitmentBalance(
      ledger.commitment.id,
      undefined,
      selectedMonth
    );
    if (tx) {
      toast.success(
        `Settled ${formatINR(ledger.remainingBalance)} for ${
          ledger.commitment.recipientName
        }`
      );
    }
  };

  const handleCreateCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(commTarget);
    if (!commTitle.trim() || !commRecipient.trim() || isNaN(amt) || amt <= 0) {
      toast.error('Please enter title, recipient, and monthly target');
      return;
    }
    const familyCat = categories.find((c) => c.slug === 'family-commitments');
    await addCommitment({
      title: commTitle.trim(),
      recipientName: commRecipient.trim(),
      relationship: commRecipient.trim(),
      monthlyTargetAmount: amt,
      dueDayOfMonth: Math.min(31, Math.max(1, parseInt(commDueDay, 10) || 10)),
      category: 'family_support',
      defaultCategoryId: familyCat?.id,
      autoRolloverOverpayment: commRollover,
      icon: 'HeartHandshake',
      color: '#ec4899',
      isActive: true,
    });
    toast.success(`Added ${commTitle.trim()}`);
    setIsNewCommOpen(false);
    setCommTitle('');
    setCommRecipient('');
  };

  const handleAttachExisting = async () => {
    if (!attachCommitmentId || !selectedTxToAttach) return;
    await attachTransactionToCommitment(
      selectedTxToAttach,
      attachCommitmentId,
      'offset_expense'
    );
    toast.success('Linked expense as offset deduction');
    setAttachCommitmentId(null);
    setSelectedTxToAttach('');
  };

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const principal = parseFloat(debtPrincipal);
    const planned = parseFloat(debtPlannedMonthly) || undefined;
    if (!debtPerson.trim() || isNaN(principal) || principal <= 0) {
      toast.error('Enter person name and amount');
      return;
    }
    await addDebtRecord({
      personName: debtPerson.trim(),
      direction: debtDirection,
      title: debtTitle.trim() || (debtDirection === 'borrowed' ? 'Borrowed' : 'Lent'),
      principalAmount: principal,
      startDate: new Date().toISOString().split('T')[0],
      repaymentSchedule: planned ? 'monthly_partial' : 'flexible',
      plannedMonthlyInstallment: planned,
      dueDayOfMonth: 15,
      color: debtDirection === 'borrowed' ? '#f59e0b' : '#10b981',
    });
    toast.success(`Added ${debtPerson.trim()}`);
    setIsNewDebtOpen(false);
    setDebtPerson('');
    setDebtTitle('');
    setDebtPrincipal('');
    setDebtPlannedMonthly('');
  };

  const handleCopyFriendReminder = async (debt: DebtRecord) => {
    const msg = `Hey ${debt.personName}! Quick reminder for ${formatINR(
      debt.remainingAmount
    )} remaining for "${debt.title}". You can UPI whenever convenient!`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(msg);
      toast.success(`Copied reminder for ${debt.personName}`);
    } else {
      toast.info(msg);
    }
  };

  const handleLogInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingDebt) return;
    const amt = parseFloat(instAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    await recordDebtInstallment({
      debtId: payingDebt.id,
      amount: amt,
      paymentMethod: instMethod,
      note: instNote.trim() || undefined,
    });
    toast.success(`Recorded ${formatINR(amt)} for ${payingDebt.personName}`);
    setPayingDebt(null);
    setInstAmount('');
    setInstNote('');
  };

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpTargetDebt) return;
    const amt = parseFloat(topUpVal);
    if (isNaN(amt) || amt <= 0) return;
    await topUpDebt(topUpTargetDebt.id, amt);
    toast.success(`Added ${formatINR(amt)} to ${topUpTargetDebt.personName}`);
    setTopUpTargetDebt(null);
    setTopUpVal('');
  };

  const handleCreateEmi = async (e: React.FormEvent) => {
    e.preventDefault();
    const monthly = parseFloat(emiMonthly);
    const tenure = parseInt(emiTenure, 10);
    const paid = parseInt(emiPaid, 10) || 0;
    const rate = parseFloat(emiRate) || 0;
    if (
      !emiName.trim() ||
      isNaN(monthly) ||
      monthly <= 0 ||
      isNaN(tenure) ||
      tenure <= 0
    ) {
      toast.error('Enter loan name, monthly EMI, and tenure');
      return;
    }
    const emiCat =
      categories.find((c) => c.slug === 'emis-debt-repayment') || categories[0];
    const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
    await addEmiTracker({
      loanName: emiName.trim(),
      lenderName: emiLender.trim() || 'Bank / Card',
      principalAmount: monthly * tenure,
      interestRateAnnual: rate,
      emiAmount: monthly,
      tenureMonths: tenure,
      paidMonths: paid,
      startDate: new Date().toISOString().split('T')[0],
      billingDayOfMonth: Math.min(31, Math.max(1, parseInt(emiDay, 10) || 5)),
      categoryId: emiCat?.id || '',
      accountId: defaultAcc?.id,
      autoCreateTaskReminder: true,
      status: paid >= tenure ? 'completed' : 'active',
    });
    toast.success(`Added ${emiName.trim()} EMI`);
    setIsNewEmiOpen(false);
    setEmiName('');
    setEmiLender('');
    setEmiMonthly('');
  };

  const handleCreateSip = async (e: React.FormEvent) => {
    e.preventDefault();
    const monthly = parseFloat(sipMonthly);
    const corpus = parseFloat(sipCorpus) || 0;
    if (!sipName.trim() || isNaN(monthly) || monthly <= 0) {
      toast.error('Enter fund/plan name and monthly SIP amount');
      return;
    }
    const invCat =
      categories.find((c) => c.slug === 'savings-investments') || categories[0];
    const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
    await addSipPlan({
      name: sipName.trim(),
      platform: sipPlatform.trim() || 'Groww / Zerodha',
      assetClass: sipAssetClass,
      monthlyAmount: monthly,
      sipDayOfMonth: Math.min(31, Math.max(1, parseInt(sipDay, 10) || 5)),
      startDate: new Date().toISOString().split('T')[0],
      totalInvested: corpus,
      currentValue: corpus,
      accountId: defaultAcc?.id,
      categoryId: invCat?.id,
      isActive: true,
      color: '#8b5cf6',
    });
    toast.success(`Added ${sipName.trim()} SIP`);
    setIsNewSipOpen(false);
    setSipName('');
    setSipPlatform('');
    setSipCorpus('0');
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(billAmount);
    const prev = parseFloat(billPrevAmount) || undefined;
    if (!billName.trim() || isNaN(amt) || amt <= 0) {
      toast.error('Enter bill name and amount');
      return;
    }
    const utilCat =
      categories.find((c) => c.slug === 'bills-utilities') || categories[0];
    const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
    await addRecurringBill({
      name: billName.trim(),
      amount: amt,
      previousAmount: prev,
      cadence: 'monthly',
      dueDayOfMonth: Math.min(31, Math.max(1, parseInt(billDueDay, 10) || 10)),
      categoryId: utilCat?.id || '',
      accountId: defaultAcc?.id,
      autoLog: false,
      isActive: true,
      color: '#06b6d4',
      icon: 'Zap',
    });
    toast.success(`Added ${billName.trim()} bill`);
    setIsNewBillOpen(false);
    setBillName('');
    setBillAmount('');
    setBillPrevAmount('');
  };

  const totalSipPortfolio = activeSips.reduce(
    (sum, s) => sum + (s.currentValue || s.totalInvested || 0),
    0
  );
  const totalMonthlySipTarget = activeSips.reduce(
    (sum, s) => sum + s.monthlyAmount,
    0
  );

  return (
    <div className="space-y-8">
      {/* 0. Monthly Obligation Timeline Strip */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <CalendarClock className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Upcoming Monthly Obligations ({upcomingObligations.length})
              </h2>
              <p className="text-xs text-muted-foreground font-mono tabular-nums">
                Total pending next 30 days:{' '}
                <strong className="text-foreground">
                  {formatINR(
                    upcomingObligations.reduce((s, o) => s + o.amount, 0)
                  )}
                </strong>
              </p>
            </div>
          </div>
        </div>

        {upcomingObligations.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            All scheduled commitments, EMIs, SIPs, and recurring bills for this cycle are settled!
          </p>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto pb-1 no-swipe">
            {upcomingObligations.map((item) => (
              <div
                key={item.id}
                className={`min-w-[185px] rounded-xl border p-3 space-y-1 shrink-0 ${
                  item.isOverdue
                    ? 'border-rose-500/40 bg-rose-500/5'
                    : item.daysUntilDue <= 3
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-border bg-background/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                  <span
                    className={`font-semibold uppercase ${
                      item.isOverdue
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {item.isOverdue
                      ? 'Overdue'
                      : item.daysUntilDue === 0
                      ? 'Due Today'
                      : `In ${item.daysUntilDue}d`}
                  </span>
                  <span className="text-muted-foreground">{item.dueDate.slice(5)}</span>
                </div>
                <p className="text-xs font-bold text-foreground truncate">
                  {item.title}
                </p>
                <p className="text-sm font-bold font-mono tabular-nums text-foreground">
                  {formatINR(item.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 1. Monthly Commitments (Expandable Cards) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Monthly Commitments
            </h2>
            <p className="text-xs text-muted-foreground">
              Fixed monthly allowances with automatic bill &amp; order offsets
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsNewCommOpen(true)}
            className="min-h-[40px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>

        {commitmentLedgers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              No monthly commitments added yet (e.g., Mother&apos;s monthly allowance).
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setIsNewCommOpen(true)}
              className="min-h-[40px] px-4 text-xs rounded-xl"
            >
              Add Monthly Commitment
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {commitmentLedgers.map((ledger) => {
              const isOpen = !!expandedIds[`comm-${ledger.commitment.id}`];
              return (
                <div
                  key={ledger.commitment.id}
                  className="rounded-2xl border border-border bg-card overflow-hidden"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpand(`comm-${ledger.commitment.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpand(`comm-${ledger.commitment.id}`);
                      }
                    }}
                    className="w-full p-4 flex flex-col gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-xl bg-pink-500/12 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
                          <HeartHandshake className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">
                            {ledger.commitment.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {ledger.commitment.recipientName} · Target{' '}
                            {formatINR(ledger.effectiveTargetAmount)} · Due Day{' '}
                            {ledger.commitment.dueDayOfMonth}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-sm sm:text-base font-bold font-mono tabular-nums text-foreground">
                            {ledger.remainingBalance > 0
                              ? formatINR(ledger.remainingBalance)
                              : 'Settled'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {ledger.remainingBalance > 0
                              ? 'left to pay'
                              : `${ledger.progressPercentage}% done`}
                          </p>
                        </div>
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
                          style={{ width: `${ledger.progressPercentage}%` }}
                          className="h-full bg-pink-500 transition-all duration-300"
                        />
                      </div>
                      {ledger.remainingBalance > 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => handleSettleCommitment(e, ledger)}
                          className="min-h-[36px] px-3 text-xs rounded-lg whitespace-nowrap shrink-0"
                        >
                          Settle {formatINR(ledger.remainingBalance)}
                        </Button>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                          Settled
                        </span>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-2 border-t border-border/70 space-y-4">
                      <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-muted-foreground block">Offsets</span>
                          <span className="font-bold font-mono tabular-nums text-foreground">
                            {formatINR(ledger.offsetExpensesAmount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Direct Sent</span>
                          <span className="font-bold font-mono tabular-nums text-foreground">
                            {formatINR(ledger.directPaidAmount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">
                            {ledger.overpaidAmount > 0 ? 'Next Rollover' : 'Remaining'}
                          </span>
                          <span className="font-bold font-mono tabular-nums text-foreground">
                            {ledger.overpaidAmount > 0
                              ? `-${formatINR(ledger.overpaidAmount)}`
                              : formatINR(ledger.remainingBalance)}
                          </span>
                        </div>
                      </div>

                      {ledger.transactions.length > 0 && (
                        <div className="divide-y divide-border/60 border-t border-b border-border/60">
                          {ledger.transactions.map((tx) => (
                            <div
                              key={tx.id}
                              className="py-2.5 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-foreground truncate">
                                  {tx.title}
                                </p>
                                <p className="text-muted-foreground">
                                  {tx.date} ·{' '}
                                  {tx.commitmentContributionType === 'direct_payment'
                                    ? 'Direct transfer'
                                    : 'Offset deduction'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="font-mono tabular-nums font-semibold">
                                  -{formatINR(tx.amount)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    attachTransactionToCommitment(tx.id, null)
                                  }
                                  aria-label="Unlink transaction"
                                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                                >
                                  <Unlink className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onLogOffsetExpense(ledger.commitment.id)}
                          className="min-h-[40px] px-3 text-xs gap-1.5 rounded-xl"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          Log Offset
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setAttachCommitmentId(ledger.commitment.id)}
                          className="min-h-[40px] px-3 text-xs gap-1.5 rounded-xl"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          Link Expense
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await deleteCommitment(ledger.commitment.id);
                            toast.success('Deleted commitment');
                          }}
                          className="min-h-[40px] px-3 text-xs gap-1.5 text-rose-500 hover:text-rose-600 ml-auto rounded-xl"
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
      </section>

      {/* 2. Investments & SIP Tracker */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Investments &amp; SIP Plans
            </h2>
            <p className="text-xs text-muted-foreground font-mono tabular-nums">
              Monthly SIP target: {formatINR(totalMonthlySipTarget)} · Portfolio Corpus:{' '}
              <strong className="text-violet-600 dark:text-violet-400">
                {formatINR(totalSipPortfolio)}
              </strong>
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsNewSipOpen(true)}
            className="min-h-[40px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add SIP
          </Button>
        </div>

        {activeSips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Track Mutual Fund SIPs, Stocks, Gold, or Recurring Deposits and auto-complete your monthly investment habits.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setIsNewSipOpen(true)}
              className="min-h-[40px] px-4 text-xs rounded-xl"
            >
              Add First SIP Plan
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeSips.map((sip) => {
              const isPaidThisMonth =
                sip.lastInvestedMonthKey === selectedMonth ||
                transactions.some(
                  (t) =>
                    !t.deletedAt &&
                    t.linkedSipId === sip.id &&
                    t.monthKey === selectedMonth
                );

              return (
                <div
                  key={sip.id}
                  className="rounded-2xl border border-border bg-card p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-5 h-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {sip.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {ASSET_CLASS_LABELS[sip.assetClass]} · Day {sip.sipDayOfMonth}
                        </p>
                      </div>
                    </div>

                    <div className="text-right font-mono tabular-nums shrink-0">
                      <p className="text-sm font-bold text-foreground">
                        {formatINR(sip.monthlyAmount)}/mo
                      </p>
                      <p className="text-[11px] text-violet-600 dark:text-violet-400">
                        Corpus {formatINR(sip.currentValue || sip.totalInvested)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                    {!isPaidThisMonth ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={async () => {
                          const tx = await payMonthlySip(sip.id);
                          if (tx) {
                            toast.success(`Invested ${formatINR(sip.monthlyAmount)} in ${sip.name}`);
                          }
                        }}
                        className="h-8 px-3 text-xs rounded-lg gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Invest for {selectedMonth}</span>
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Invested this month</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        await deleteSipPlan(sip.id);
                        toast.success('Removed SIP plan');
                      }}
                      className="text-xs text-muted-foreground hover:text-rose-500 p-1.5"
                      aria-label="Delete SIP plan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Recurring Bills & Subscriptions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Recurring Bills &amp; Subscriptions
            </h2>
            <p className="text-xs text-muted-foreground">
              Utilities, rent, Wi-Fi, and streaming with price-hike alerts
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsNewBillOpen(true)}
            className="min-h-[40px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Bill
          </Button>
        </div>

        {activeBills.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              No recurring bills or subscriptions added yet.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setIsNewBillOpen(true)}
              className="min-h-[40px] px-4 text-xs rounded-xl"
            >
              Add Recurring Bill
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeBills.map((bill) => {
              const isPaid = bill.lastPaidMonthKey === selectedMonth;
              const hasPriceHike =
                bill.previousAmount && bill.amount > bill.previousAmount;

              return (
                <div
                  key={bill.id}
                  className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-cyan-500/12 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                      <Repeat className="w-5 h-5" />
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-foreground truncate">
                          {bill.name}
                        </p>
                        {hasPriceHike && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-0.5 shrink-0">
                            <AlertTriangle className="w-3 h-3" />
                            +{formatINR(bill.amount - (bill.previousAmount || 0))}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        Due Day {bill.dueDayOfMonth} · {formatINR(bill.amount)}/mo
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isPaid ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={async () => {
                          const tx = await payRecurringBill(bill.id);
                          if (tx) toast.success(`Paid ${bill.name}`);
                        }}
                        className="h-8 px-3 text-xs rounded-lg"
                      >
                        Mark Paid
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Paid
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteRecurringBill(bill.id);
                        toast.success('Removed recurring bill');
                      }}
                      className="text-muted-foreground hover:text-rose-500 p-1.5"
                      aria-label="Delete recurring bill"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Friends Lend & Borrow (Expandable Cards) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Friends (Lend &amp; Borrow)
            </h2>
            <p className="text-xs text-muted-foreground">
              Track balances, split bills, and 1-tap UPI reminders
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsNewDebtOpen(true)}
            className="min-h-[40px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>

        {activeDebts.length > 0 && (
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted max-w-xs">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'borrowed', label: 'I Owe' },
                { id: 'lent', label: 'Owed to Me' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDebtFilter(f.id)}
                className={`min-h-[36px] px-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  debtFilter === f.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {filteredDebts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              No friend lend or borrow records yet.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setIsNewDebtOpen(true)}
              className="min-h-[40px] px-4 text-xs rounded-xl"
            >
              Add Friend Record
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDebts.map((debt) => {
              const isOpen = !!expandedIds[`debt-${debt.id}`];
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
                    onClick={() => toggleExpand(`debt-${debt.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpand(`debt-${debt.id}`);
                      }
                    }}
                    className="w-full p-4 flex flex-col gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isBorrowed
                              ? 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          <Users className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">
                            {debt.personName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {isBorrowed ? 'I owe' : 'Owes me'} · {debt.title}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-sm sm:text-base font-bold font-mono tabular-nums text-foreground">
                            {debt.remainingAmount > 0
                              ? formatINR(debt.remainingAmount)
                              : 'Settled'}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
                            of {formatINR(debt.principalAmount)}
                          </p>
                        </div>
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
                            isBorrowed ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                      {debt.remainingAmount > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPayingDebt(debt);
                            setInstAmount(
                              String(
                                Math.min(
                                  debt.remainingAmount,
                                  debt.plannedMonthlyInstallment || debt.remainingAmount
                                )
                              )
                            );
                          }}
                          className="min-h-[36px] px-3 text-xs rounded-lg whitespace-nowrap shrink-0"
                        >
                          {isBorrowed ? 'Pay Part' : 'Received'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-2 border-t border-border/70 space-y-3">
                      {installments.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-1">
                          No partial payments recorded yet.
                        </p>
                      ) : (
                        <div className="divide-y divide-border/60 border-b border-border/60">
                          {installments.map((inst) => (
                            <div
                              key={inst.id}
                              className="py-2 flex items-center justify-between text-xs"
                            >
                              <span className="text-muted-foreground">
                                {inst.date} · {inst.note || inst.paymentMethod.toUpperCase()}
                              </span>
                              <span className="font-mono tabular-nums font-semibold text-foreground">
                                -{formatINR(inst.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setTopUpTargetDebt(debt)}
                          className="min-h-[40px] px-3 text-xs gap-1.5 rounded-xl"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          Top Up
                        </Button>

                        {!isBorrowed && debt.remainingAmount > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyFriendReminder(debt)}
                            className="min-h-[40px] px-3 text-xs gap-1.5 rounded-xl"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy UPI Reminder
                          </Button>
                        )}

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await deleteDebtRecord(debt.id);
                            toast.success('Deleted friend record');
                          }}
                          className="min-h-[40px] px-3 text-xs gap-1.5 text-rose-500 hover:text-rose-600 ml-auto rounded-xl"
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
      </section>

      {/* 5. EMIs & Loans + Interactive Debt Payoff Simulator */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">
              EMIs, Loans &amp; Payoff Simulator
            </h2>
            <p className="text-xs text-muted-foreground">
              Fixed monthly installments with Avalanche vs. Snowball prepayment modeling
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsNewEmiOpen(true)}
            className="min-h-[40px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add EMI
          </Button>
        </div>

        {/* Interactive Avalanche vs Snowball Simulator Card */}
        {debtSimulation && (
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Debt Payoff Accelerator ({debtSimulation.loanCount}{' '}
                    {debtSimulation.loanCount === 1 ? 'obligation' : 'obligations'})
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono tabular-nums">
                    Total active balance:{' '}
                    {formatINR(debtSimulation.totalDebtBalance)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-muted shrink-0">
                {(
                  [
                    { id: 'avalanche', label: 'Avalanche (Max Interest)' },
                    { id: 'snowball', label: 'Snowball (Quick Win)' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPayoffStrategy(s.id)}
                    className={`min-h-[32px] px-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      payoffStrategy === s.id
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Extra Monthly Prepayment Slider
                </span>
                <span className="font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                  +{formatINR(extraMonthlyPayment)} / month
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={25000}
                step={500}
                value={extraMonthlyPayment}
                onChange={(e) =>
                  setExtraMonthlyPayment(parseInt(e.target.value, 10) || 0)
                }
                aria-label="Extra monthly debt prepayment"
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60 text-xs">
              <div>
                <span className="text-muted-foreground block">Debt-Free In</span>
                <span className="text-sm font-bold font-mono tabular-nums text-foreground">
                  {debtSimulation.strategyMonths} mo
                </span>
                {debtSimulation.monthsSaved > 0 && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-mono">
                    Saves {debtSimulation.monthsSaved} mo
                  </span>
                )}
              </div>

              <div>
                <span className="text-muted-foreground block">Est. Interest Saved</span>
                <span className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatINR(debtSimulation.interestSaved)}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block">Priority Target</span>
                <span className="text-xs font-semibold text-foreground truncate block">
                  {debtSimulation.topTargetName || 'Primary Loan'}
                </span>
                <span className="text-[11px] text-muted-foreground font-mono block">
                  Clears in {debtSimulation.firstClearedMonth} mo
                </span>
              </div>
            </div>
          </div>
        )}

        {activeEmis.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              No active EMIs or loans tracked yet.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setIsNewEmiOpen(true)}
              className="min-h-[40px] px-4 text-xs rounded-xl"
            >
              Add Loan / EMI
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeEmis.map((emi) => {
              const isOpen = !!expandedIds[`emi-${emi.id}`];
              const remainingMonths = Math.max(0, emi.tenureMonths - emi.paidMonths);
              const pct =
                emi.tenureMonths > 0
                  ? Math.min(100, Math.round((emi.paidMonths / emi.tenureMonths) * 100))
                  : 100;
              const isPaidThisMonth =
                emi.lastPaidMonthKey === selectedMonth ||
                transactions.some(
                  (t) =>
                    !t.deletedAt &&
                    t.linkedEmiId === emi.id &&
                    t.monthKey === selectedMonth
                );

              return (
                <div
                  key={emi.id}
                  className="rounded-2xl border border-border bg-card overflow-hidden"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpand(`emi-${emi.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpand(`emi-${emi.id}`);
                      }
                    }}
                    className="w-full p-4 flex flex-col gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
                          <Landmark className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">
                            {emi.loanName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {emi.lenderName} · {emi.paidMonths}/{emi.tenureMonths} paid · Day{' '}
                            {emi.billingDayOfMonth}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-sm sm:text-base font-bold font-mono tabular-nums text-foreground">
                            {formatINR(emi.emiAmount)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">per month</p>
                        </div>
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
                          className="h-full bg-primary transition-all duration-300"
                        />
                      </div>
                      {emi.status === 'active' && !isPaidThisMonth ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const tx = await payMonthlyEmi(emi.id);
                            if (tx) {
                              toast.success(`Paid ${emi.loanName} EMI`);
                            }
                          }}
                          className="min-h-[36px] px-3 text-xs rounded-lg gap-1 whitespace-nowrap shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Paid
                        </Button>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                          {emi.status === 'completed' ? 'Completed' : 'Paid'}
                        </span>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-2 border-t border-border/70 space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-muted-foreground block">Principal</span>
                          <span className="font-bold font-mono tabular-nums">
                            {formatINR(emi.principalAmount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Months Left</span>
                          <span className="font-bold font-mono tabular-nums">
                            {remainingMonths} mo
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Balance Due</span>
                          <span className="font-bold font-mono tabular-nums">
                            {formatINR(remainingMonths * emi.emiAmount)}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await deleteEmiTracker(emi.id);
                            toast.success('Deleted EMI tracker');
                          }}
                          className="min-h-[40px] px-3 text-xs gap-1.5 text-rose-500 hover:text-rose-600 rounded-xl"
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
      </section>

      {/* Dialog: New Monthly Commitment */}
      <Dialog open={isNewCommOpen} onOpenChange={setIsNewCommOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>New Monthly Commitment</DialogTitle>
            <DialogDescription>
              Set a fixed monthly target where purchases or bills paid on someone&apos;s behalf
              automatically deduct.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCommitment} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-title">Title</Label>
              <Input
                id="c-title"
                value={commTitle}
                onChange={(e) => setCommTitle(e.target.value)}
                placeholder="e.g., Mother's Monthly Allowance"
                className="h-11"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-rec">Recipient</Label>
                <Input
                  id="c-rec"
                  value={commRecipient}
                  onChange={(e) => setCommRecipient(e.target.value)}
                  placeholder="Mother"
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-amt">Monthly Target (₹)</Label>
                <Input
                  id="c-amt"
                  type="number"
                  min="1"
                  value={commTarget}
                  onChange={(e) => setCommTarget(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-day">Due Day of Month (1–31)</Label>
              <Input
                id="c-day"
                type="number"
                min="1"
                max="31"
                value={commDueDay}
                onChange={(e) => setCommDueDay(e.target.value)}
                className="h-11 font-mono tabular-nums"
              />
            </div>
            <label className="flex items-center gap-2.5 text-xs min-h-[40px] cursor-pointer">
              <input
                type="checkbox"
                checked={commRollover}
                onChange={(e) => setCommRollover(e.target.checked)}
                className="w-4 h-4 rounded border-input"
              />
              <span>Auto-deduct extra overpayment from next month</span>
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewCommOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Commitment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Link Existing Expense to Commitment */}
      <Dialog
        open={!!attachCommitmentId}
        onOpenChange={(open) => !open && setAttachCommitmentId(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Link Existing Expense as Offset</DialogTitle>
            <DialogDescription>
              Pick an expense from {selectedMonth} to deduct from this commitment.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {unlinkedMonthExpenses.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No unlinked expenses found for {selectedMonth}.
              </p>
            ) : (
              <select
                value={selectedTxToAttach}
                onChange={(e) => setSelectedTxToAttach(e.target.value)}
                className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background"
              >
                <option value="">Choose an expense...</option>
                {unlinkedMonthExpenses.map((tx) => (
                  <option key={tx.id} value={tx.id}>
                    {tx.date} — {tx.title} ({formatINR(tx.amount)})
                  </option>
                ))}
              </select>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAttachCommitmentId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAttachExisting}
              disabled={!selectedTxToAttach}
            >
              Link Offset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: New SIP Plan */}
      <Dialog open={isNewSipOpen} onOpenChange={setIsNewSipOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>New SIP / Investment Plan</DialogTitle>
            <DialogDescription>
              Track monthly wealth building and include corpus in your Net Worth.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSip} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="sip-name">Fund / Plan Name</Label>
              <Input
                id="sip-name"
                value={sipName}
                onChange={(e) => setSipName(e.target.value)}
                placeholder="e.g., Parag Parikh Flexi Cap, Nifty 50"
                className="h-11"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sip-class">Asset Class</Label>
                <select
                  id="sip-class"
                  value={sipAssetClass}
                  onChange={(e) => setSipAssetClass(e.target.value as SipAssetClass)}
                  className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background"
                >
                  {Object.entries(ASSET_CLASS_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sip-platform">Platform</Label>
                <Input
                  id="sip-platform"
                  value={sipPlatform}
                  onChange={(e) => setSipPlatform(e.target.value)}
                  placeholder="Groww, Coin, Kuvera"
                  className="h-11"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sip-amt">Monthly (₹)</Label>
                <Input
                  id="sip-amt"
                  type="number"
                  min="100"
                  value={sipMonthly}
                  onChange={(e) => setSipMonthly(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sip-day">SIP Day</Label>
                <Input
                  id="sip-day"
                  type="number"
                  min="1"
                  max="31"
                  value={sipDay}
                  onChange={(e) => setSipDay(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sip-corpus">Existing (₹)</Label>
                <Input
                  id="sip-corpus"
                  type="number"
                  min="0"
                  value={sipCorpus}
                  onChange={(e) => setSipCorpus(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewSipOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save SIP Plan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: New Recurring Bill */}
      <Dialog open={isNewBillOpen} onOpenChange={setIsNewBillOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>New Recurring Bill / Subscription</DialogTitle>
            <DialogDescription>
              Reserve recurring bills in your Safe-to-Spend formula and spot price hikes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateBill} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="b-name">Bill or Subscription Name</Label>
              <Input
                id="b-name"
                value={billName}
                onChange={(e) => setBillName(e.target.value)}
                placeholder="e.g., Airtel Fiber, Electricity, Netflix"
                className="h-11"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="b-amt">Amount (₹)</Label>
                <Input
                  id="b-amt"
                  type="number"
                  min="1"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-prev">Old Price (₹)</Label>
                <Input
                  id="b-prev"
                  type="number"
                  min="0"
                  value={billPrevAmount}
                  onChange={(e) => setBillPrevAmount(e.target.value)}
                  placeholder="Optional"
                  className="h-11 font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-day">Due Day</Label>
                <Input
                  id="b-day"
                  type="number"
                  min="1"
                  max="31"
                  value={billDueDay}
                  onChange={(e) => setBillDueDay(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewBillOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Bill</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: New Friend Lend / Borrow */}
      <Dialog open={isNewDebtOpen} onOpenChange={setIsNewDebtOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>New Friend Ledger</DialogTitle>
            <DialogDescription>
              Track money borrowed from or lent to someone with partial repayments.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateDebt} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted">
              <button
                type="button"
                onClick={() => setDebtDirection('borrowed')}
                className={`min-h-[40px] text-xs font-semibold rounded-lg ${
                  debtDirection === 'borrowed'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                I Borrowed (I Owe)
              </button>
              <button
                type="button"
                onClick={() => setDebtDirection('lent')}
                className={`min-h-[40px] text-xs font-semibold rounded-lg ${
                  debtDirection === 'lent'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                I Lent (Owes Me)
              </button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-person">Person Name</Label>
              <Input
                id="d-person"
                value={debtPerson}
                onChange={(e) => setDebtPerson(e.target.value)}
                placeholder="Friend's name"
                className="h-11"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-title">Note (Optional)</Label>
              <Input
                id="d-title"
                value={debtTitle}
                onChange={(e) => setDebtTitle(e.target.value)}
                placeholder="Dinner split, trip, etc."
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-amt">Amount (₹)</Label>
                <Input
                  id="d-amt"
                  type="number"
                  min="1"
                  value={debtPrincipal}
                  onChange={(e) => setDebtPrincipal(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-monthly">Monthly Plan (₹)</Label>
                <Input
                  id="d-monthly"
                  type="number"
                  min="0"
                  value={debtPlannedMonthly}
                  onChange={(e) => setDebtPlannedMonthly(e.target.value)}
                  placeholder="Optional"
                  className="h-11 font-mono tabular-nums"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewDebtOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Record</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Record Friend Partial Payment */}
      <Dialog open={!!payingDebt} onOpenChange={(o) => !o && setPayingDebt(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {payingDebt?.direction === 'borrowed'
                ? `Pay ${payingDebt?.personName}`
                : `Received from ${payingDebt?.personName}`}
            </DialogTitle>
            <DialogDescription>
              Remaining balance:{' '}
              {payingDebt ? formatINR(payingDebt.remainingAmount) : ''}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogInstallment} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="i-amt">Amount (₹)</Label>
              <Input
                id="i-amt"
                type="number"
                min="1"
                max={payingDebt?.remainingAmount || 999999}
                value={instAmount}
                onChange={(e) => setInstAmount(e.target.value)}
                className="h-11 font-mono tabular-nums"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-method">Method</Label>
              <select
                id="i-method"
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
            <div className="space-y-1.5">
              <Label htmlFor="i-note">Note (Optional)</Label>
              <Input
                id="i-note"
                value={instNote}
                onChange={(e) => setInstNote(e.target.value)}
                placeholder="Partial repayment"
                className="h-11"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPayingDebt(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Top-Up Debt */}
      <Dialog
        open={!!topUpTargetDebt}
        onOpenChange={(o) => !o && setTopUpTargetDebt(null)}
      >
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Top Up {topUpTargetDebt?.personName}</DialogTitle>
            <DialogDescription>
              Add another borrowed or lent amount to this ledger.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTopUp} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="topup-val">Additional Amount (₹)</Label>
              <Input
                id="topup-val"
                type="number"
                min="1"
                value={topUpVal}
                onChange={(e) => setTopUpVal(e.target.value)}
                className="h-11 font-mono tabular-nums"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTopUpTargetDebt(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Add Amount</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: New EMI Tracker */}
      <Dialog open={isNewEmiOpen} onOpenChange={setIsNewEmiOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add EMI / Loan</DialogTitle>
            <DialogDescription>
              Track monthly loan or card installments with interest rate for payoff modeling.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEmi} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-name">Item / Loan Name</Label>
                <Input
                  id="e-name"
                  value={emiName}
                  onChange={(e) => setEmiName(e.target.value)}
                  placeholder="Phone / Bike Loan"
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-lender">Bank / Lender</Label>
                <Input
                  id="e-lender"
                  value={emiLender}
                  onChange={(e) => setEmiLender(e.target.value)}
                  placeholder="HDFC / Bajaj"
                  className="h-11"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-amt">Monthly (₹)</Label>
                <Input
                  id="e-amt"
                  type="number"
                  min="1"
                  value={emiMonthly}
                  onChange={(e) => setEmiMonthly(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-ten">Months</Label>
                <Input
                  id="e-ten"
                  type="number"
                  min="1"
                  value={emiTenure}
                  onChange={(e) => setEmiTenure(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-paid">Paid</Label>
                <Input
                  id="e-paid"
                  type="number"
                  min="0"
                  value={emiPaid}
                  onChange={(e) => setEmiPaid(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-rate">Interest Rate (% p.a.)</Label>
                <Input
                  id="e-rate"
                  type="number"
                  min="0"
                  step="0.1"
                  value={emiRate}
                  onChange={(e) => setEmiRate(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-day">Billing Day (1–31)</Label>
                <Input
                  id="e-day"
                  type="number"
                  min="1"
                  max="31"
                  value={emiDay}
                  onChange={(e) => setEmiDay(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewEmiOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save EMI</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
