'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type {
  CommitmentLedgerSummary,
  DebtRecord,
  DebtDirection,
  DebtPaymentMethod,
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

export function TrackersTab({ onLogOffsetExpense }: TrackersTabProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const emiTrackers = useFinanceStore((s) => s.emiTrackers);

  const getAllCommitmentLedgers = useFinanceStore((s) => s.getAllCommitmentLedgers);
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

  const commitmentLedgers = getAllCommitmentLedgers(selectedMonth);

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

  // EMI modal
  const [isNewEmiOpen, setIsNewEmiOpen] = useState(false);
  const [emiName, setEmiName] = useState('');
  const [emiLender, setEmiLender] = useState('');
  const [emiMonthly, setEmiMonthly] = useState('');
  const [emiTenure, setEmiTenure] = useState('12');
  const [emiPaid, setEmiPaid] = useState('0');
  const [emiDay, setEmiDay] = useState('5');

  const unlinkedMonthExpenses = transactions.filter(
    (t) => t.monthKey === selectedMonth && t.type === 'expense' && !t.linkedCommitmentId
  );

  const filteredDebts = debtRecords.filter((d) => {
    if (debtFilter === 'borrowed') return d.direction === 'borrowed';
    if (debtFilter === 'lent') return d.direction === 'lent';
    return true;
  });

  const handleSettleCommitment = async (
    e: React.MouseEvent,
    ledger: CommitmentLedgerSummary
  ) => {
    e.stopPropagation();
    const tx = await settleCommitmentBalance(ledger.commitment.id, undefined, selectedMonth);
    if (tx) {
      toast.success(
        `Settled ${formatINR(ledger.remainingBalance)} for ${ledger.commitment.recipientName}`
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
    if (!emiName.trim() || isNaN(monthly) || monthly <= 0 || isNaN(tenure) || tenure <= 0) {
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
      interestRateAnnual: 0,
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

  return (
    <div className="space-y-8">
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
            className="min-h-[44px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap"
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
              className="min-h-[44px] px-4 text-xs rounded-xl"
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
                  {/* Collapsed Card Row */}
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

                    {/* Slim Progress Bar + Quick Action */}
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
                          className="min-h-[38px] px-3 text-xs rounded-lg whitespace-nowrap shrink-0"
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

                  {/* Expanded Body */}
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
                                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
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
                          className="min-h-[44px] px-3 text-xs gap-1.5 rounded-xl"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          Log Offset
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setAttachCommitmentId(ledger.commitment.id)}
                          className="min-h-[44px] px-3 text-xs gap-1.5 rounded-xl"
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
                          className="min-h-[44px] px-3 text-xs gap-1.5 text-rose-500 hover:text-rose-600 ml-auto rounded-xl"
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

      {/* 2. Friends Lend & Borrow (Expandable Cards) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Friends (Lend &amp; Borrow)
            </h2>
            <p className="text-xs text-muted-foreground">
              Track balances and partial monthly repayments
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsNewDebtOpen(true)}
            className="min-h-[44px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>

        {debtRecords.length > 0 && (
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
                className={`min-h-[38px] px-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
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
              className="min-h-[44px] px-4 text-xs rounded-xl"
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
                          className="min-h-[38px] px-3 text-xs rounded-lg whitespace-nowrap shrink-0"
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

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setTopUpTargetDebt(debt)}
                          className="min-h-[44px] px-3 text-xs gap-1.5 rounded-xl"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          Top Up
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await deleteDebtRecord(debt.id);
                            toast.success('Deleted friend record');
                          }}
                          className="min-h-[44px] px-3 text-xs gap-1.5 text-rose-500 hover:text-rose-600 ml-auto rounded-xl"
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

      {/* 3. EMIs & Loans (Expandable Cards) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">EMIs &amp; Loans</h2>
            <p className="text-xs text-muted-foreground">
              Fixed monthly installments with 1-tap payment tracking
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsNewEmiOpen(true)}
            className="min-h-[44px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>

        {emiTrackers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              No active EMIs or loans tracked yet.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setIsNewEmiOpen(true)}
              className="min-h-[44px] px-4 text-xs rounded-xl"
            >
              Add Loan / EMI
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {emiTrackers.map((emi) => {
              const isOpen = !!expandedIds[`emi-${emi.id}`];
              const remainingMonths = Math.max(0, emi.tenureMonths - emi.paidMonths);
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
                          className="min-h-[38px] px-3 text-xs rounded-lg gap-1 whitespace-nowrap shrink-0"
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
                          className="min-h-[44px] px-3 text-xs gap-1.5 text-rose-500 hover:text-rose-600 rounded-xl"
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
            <label className="flex items-center gap-2.5 text-xs min-h-[44px] cursor-pointer">
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
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button type="submit" className="min-h-[44px]">
                Save Commitment
              </Button>
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
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAttachExisting}
              disabled={!selectedTxToAttach}
              className="min-h-[44px]"
            >
              Link Offset
            </Button>
          </DialogFooter>
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
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button type="submit" className="min-h-[44px]">
                Save Record
              </Button>
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
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button type="submit" className="min-h-[44px]">
                Save Payment
              </Button>
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
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button type="submit" className="min-h-[44px]">
                Add Amount
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: New EMI Tracker */}
      <Dialog open={isNewEmiOpen} onOpenChange={setIsNewEmiOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add EMI / Loan</DialogTitle>
            <DialogDescription>
              Track monthly loan or card installments cleanly.
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewEmiOpen(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button type="submit" className="min-h-[44px]">
                Save EMI
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
