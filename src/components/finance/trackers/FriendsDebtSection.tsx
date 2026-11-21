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
  CheckCircle2,
  ArrowLeftRight,
  Receipt,
  Calendar,
  Wallet,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type {
  DebtBucketType,
  DebtDirection,
  DebtInstallment,
  DebtPaymentMethod,
  DebtRecord,
  DebtRepaymentSchedule,
  FriendLedgerGroup,
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

export function FriendsDebtSection() {
  const accounts = useFinanceStore((s) => s.accounts);
  const getDebtSummary = useFinanceStore((s) => s.getDebtSummary);
  const getFriendLedgerGroups = useFinanceStore((s) => s.getFriendLedgerGroups);
  const getDebtInstallments = useFinanceStore((s) => s.getDebtInstallments);
  const addDebtRecord = useFinanceStore((s) => s.addDebtRecord);
  const updateDebtRecord = useFinanceStore((s) => s.updateDebtRecord);
  const recordDebtInstallment = useFinanceStore((s) => s.recordDebtInstallment);
  const updateDebtInstallment = useFinanceStore((s) => s.updateDebtInstallment);
  const deleteDebtInstallment = useFinanceStore((s) => s.deleteDebtInstallment);
  const topUpDebt = useFinanceStore((s) => s.topUpDebt);
  const deleteDebtRecord = useFinanceStore((s) => s.deleteDebtRecord);
  const settleEverydayTab = useFinanceStore((s) => s.settleEverydayTab);
  const offsetSplitAgainstLoan = useFinanceStore((s) => s.offsetSplitAgainstLoan);

  // Filters
  const [bucketFilter, setBucketFilter] = useState<'all' | DebtBucketType>('all');
  const [filterDir, setFilterDir] = useState<'all' | DebtDirection>('all');
  const [expandedFriends, setExpandedFriends] = useState<Record<string, boolean>>({});
  const [expandedLoanIds, setExpandedLoanIds] = useState<Record<string, boolean>>({});

  // Unified Add / Edit Dialog
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtRecord | null>(null);
  const [entryBucketType, setEntryBucketType] = useState<DebtBucketType>('everyday_split');
  const [personName, setPersonName] = useState('');
  const [direction, setDirection] = useState<DebtDirection>('borrowed');
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

  // Settle Tab Dialog
  const [settleFriend, setSettleFriend] = useState<FriendLedgerGroup | null>(null);
  const [settleAccountId, setSettleAccountId] = useState('');
  const [settleMethod, setSettleMethod] = useState<DebtPaymentMethod>('upi');
  const [settleDate, setSettleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [settleNote, setSettleNote] = useState('');

  // Offset Dialog
  const [offsetFriend, setOffsetFriend] = useState<FriendLedgerGroup | null>(null);
  const [offsetTargetLoanId, setOffsetTargetLoanId] = useState('');
  const [offsetAmount, setOffsetAmount] = useState('');

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
  const allFriendGroups = getFriendLedgerGroups();

  // Known friend names for autocomplete
  const existingFriendNames = useMemo(() => {
    return Array.from(new Set(allFriendGroups.map((g) => g.friendName)));
  }, [allFriendGroups]);

  // Filtered friend groups
  const visibleGroups = useMemo(() => {
    return allFriendGroups.filter((g) => {
      // Bucket filter
      if (bucketFilter === 'everyday_split' && g.everydayRecords.length === 0) return false;
      if (bucketFilter === 'long_term_loan' && g.longTermLoans.length === 0) return false;

      // Direction filter
      if (filterDir === 'borrowed') {
        const owesOnEveryday = g.everydayNet < 0;
        const owesOnLoans = g.longTermBorrowedRemaining > 0;
        if (!owesOnEveryday && !owesOnLoans) return false;
      }
      if (filterDir === 'lent') {
        const owedOnEveryday = g.everydayNet > 0;
        const owedOnLoans = g.longTermLentRemaining > 0;
        if (!owedOnEveryday && !owedOnLoans) return false;
      }

      return true;
    });
  }, [allFriendGroups, bucketFilter, filterDir]);

  const toggleFriendExpand = (friendKey: string) => {
    setExpandedFriends((prev) => ({ ...prev, [friendKey]: !prev[friendKey] }));
  };

  const toggleLoanExpand = (loanId: string) => {
    setExpandedLoanIds((prev) => ({ ...prev, [loanId]: !prev[loanId] }));
  };

  // Open Add Dialog
  const openNewEntryDialog = (
    defaultBucket: DebtBucketType = 'everyday_split',
    prefilledFriend?: string
  ) => {
    setEditingDebt(null);
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
    setIsNewOpen(true);
  };

  // Open Edit Dialog
  const openEditDebtDialog = (debt: DebtRecord) => {
    setEditingDebt(debt);
    setEntryBucketType(debt.bucketType || 'long_term_loan');
    setPersonName(debt.personName);
    setDirection(debt.direction);
    setTitle(debt.title);
    setPrincipal(String(debt.principalAmount));
    setStartDate(debt.startDate || new Date().toISOString().split('T')[0]);
    setPlannedMonthly(debt.plannedMonthlyInstallment ? String(debt.plannedMonthlyInstallment) : '');
    setDueDay(String(debt.dueDayOfMonth || 15));
    setRepaymentSchedule(debt.repaymentSchedule || 'flexible');
    setIsEmi(!!debt.isEmi);
    setEmiAmount(debt.emiAmount ? String(debt.emiAmount) : '');
    setEmiDueDay(String(debt.emiDueDay || 5));
    setTotalInstallments(debt.totalInstallments ? String(debt.totalInstallments) : '');
    setPaidInstallments(String(debt.paidInstallments || 0));
    setNotes(debt.notes || '');
    setIsNewOpen(true);
  };

  const handleSaveDebt = async (e: React.FormEvent) => {
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

    if (editingDebt) {
      await updateDebtRecord(editingDebt.id, {
        personName: personName.trim(),
        direction,
        title: resolvedTitle,
        principalAmount: amt,
        startDate: startDate || editingDebt.startDate,
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
      });
      toast.success(`Updated entry for ${personName.trim()}`);
    } else {
      await addDebtRecord({
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
      toast.success(
        `Added ${entryBucketType === 'everyday_split' ? 'everyday split' : 'loan'} for ${personName.trim()}`
      );
    }

    setIsNewOpen(false);
    setEditingDebt(null);
  };

  // Open Settle Tab Dialog
  const openSettleTabDialog = (group: FriendLedgerGroup) => {
    setSettleFriend(group);
    setSettleAccountId(accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || '');
    setSettleMethod('upi');
    setSettleDate(new Date().toISOString().split('T')[0]);
    setSettleNote('');
  };

  const handleConfirmSettleTab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleFriend) return;

    await settleEverydayTab(settleFriend.friendKey, {
      accountId: settleAccountId || undefined,
      paymentMethod: settleMethod,
      date: settleDate,
      note: settleNote.trim() || undefined,
    });

    toast.success(`Settled everyday tab with ${settleFriend.friendName}`);
    setSettleFriend(null);
  };

  // Open Offset Dialog
  const openOffsetDialog = (group: FriendLedgerGroup) => {
    setOffsetFriend(group);
    // Find first eligible opposing loan
    const opposingLoans = group.longTermLoans.filter((l) => {
      if (group.everydayNet > 0) {
        // Friend owes me on everyday tab -> target borrowed loan (I owe friend)
        return l.direction === 'borrowed' && l.status === 'active' && l.remainingAmount > 0;
      } else {
        // I owe friend on everyday tab -> target lent loan (friend owes me)
        return l.direction === 'lent' && l.status === 'active' && l.remainingAmount > 0;
      }
    });

    const defaultLoan = opposingLoans[0];
    setOffsetTargetLoanId(defaultLoan?.id || '');
    if (defaultLoan) {
      const maxOffset = Math.min(Math.abs(group.everydayNet), defaultLoan.remainingAmount);
      setOffsetAmount(String(maxOffset));
    } else {
      setOffsetAmount('');
    }
  };

  const handleConfirmOffset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offsetFriend || !offsetTargetLoanId) return;
    const amt = parseFloat(offsetAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid offset amount');
      return;
    }

    const success = await offsetSplitAgainstLoan(
      offsetFriend.friendKey,
      offsetTargetLoanId,
      amt
    );

    if (success) {
      toast.success(`Offset ${formatINR(amt)} against loan successfully`);
      setOffsetFriend(null);
      setOffsetTargetLoanId('');
      setOffsetAmount('');
    } else {
      toast.error('Could not complete offset. Check available balance.');
    }
  };

  // Installment handling
  const openRecordInstallmentDialog = (debt: DebtRecord) => {
    setInstallmentDebt(debt);
    setEditingInstallment(null);
    const suggestedAmt = debt.emiAmount || debt.plannedMonthlyInstallment || debt.remainingAmount;
    setInstAmount(String(suggestedAmt));
    setInstDate(new Date().toISOString().split('T')[0]);
    setInstMethod('upi');
    setInstAccountId(accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || '');
    setInstNote('');
  };

  const openEditInstallmentDialog = (debt: DebtRecord, inst: DebtInstallment) => {
    setInstallmentDebt(debt);
    setEditingInstallment(inst);
    setInstAmount(String(inst.amount));
    setInstDate(inst.date);
    setInstMethod(inst.paymentMethod);
    setInstAccountId('');
    setInstNote(inst.note || '');
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

  // Top Up handling
  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpTarget) return;
    const amt = parseFloat(topUpAmt);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid top-up amount');
      return;
    }
    await topUpDebt(topUpTarget.id, amt, topUpNote.trim() || undefined);
    toast.success(`Added ${formatINR(amt)} to ${topUpTarget.personName}'s loan`);
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
      {/* Decision 1: Isolated Summary Totals (Everyday Tab vs. Long-Term Loans side-by-side) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* Everyday Tab Summary */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-primary" />
              Everyday Splits Tab
            </span>
            <span
              className={`text-xs font-bold font-mono tabular-nums px-2 py-0.5 rounded-full ${
                summary.everydayNetPosition > 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : summary.everydayNetPosition < 0
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              Net:{' '}
              {summary.everydayNetPosition > 0
                ? `+${formatINR(summary.everydayNetPosition)}`
                : summary.everydayNetPosition < 0
                ? `-${formatINR(Math.abs(summary.everydayNetPosition))}`
                : 'Settled'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <span className="text-[11px] text-muted-foreground block">I Owe (Tabs)</span>
              <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                {formatINR(summary.everydayBorrowedRemaining)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block">Owes Me (Tabs)</span>
              <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatINR(summary.everydayLentRemaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Long-Term Loans Summary */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-blue-500" />
              Long-Term Loans & EMIs
            </span>
            <span
              className={`text-xs font-bold font-mono tabular-nums px-2 py-0.5 rounded-full ${
                summary.longTermNetPosition > 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : summary.longTermNetPosition < 0
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              Net:{' '}
              {summary.longTermNetPosition > 0
                ? `+${formatINR(summary.longTermNetPosition)}`
                : summary.longTermNetPosition < 0
                ? `-${formatINR(Math.abs(summary.longTermNetPosition))}`
                : 'Balanced'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <span className="text-[11px] text-muted-foreground block">I Owe (Loans)</span>
              <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                {formatINR(summary.longTermBorrowedRemaining)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block">Owes Me (Loans)</span>
              <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatINR(summary.longTermLentRemaining)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Decision 3: Dual Filtering Controls (Bucket Filter & Direction Toggle) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Bucket Filter */}
          <div
            role="tablist"
            aria-label="Filter ledger buckets"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted"
          >
            {(
              [
                { id: 'all', label: 'All Buckets' },
                { id: 'everyday_split', label: 'Everyday Splits' },
                { id: 'long_term_loan', label: 'Long-Term Loans' },
              ] as const
            ).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBucketFilter(b.id)}
                className={`min-h-[34px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  bucketFilter === b.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Direction Toggle */}
          <div
            role="tablist"
            aria-label="Filter direction"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/60"
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'borrowed', label: 'I Owe' },
                { id: 'lent', label: 'Owes Me' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setFilterDir(d.id)}
                className={`min-h-[34px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  filterDir === d.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => openNewEntryDialog('everyday_split')}
            className="min-h-[38px] px-3.5 gap-1.5 text-xs rounded-xl"
          >
            <Plus className="w-4 h-4" />
            New Entry
          </Button>
        </div>
      </div>

      {/* Per-Friend Grouped Cards */}
      {visibleGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-3">
          <Users className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            No friend balances match the selected filters. Track shared meals, trip splits, and personal loans with isolated accounting.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openNewEntryDialog('everyday_split')}
              className="text-xs rounded-xl"
            >
              Add Everyday Split
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openNewEntryDialog('long_term_loan')}
              className="text-xs rounded-xl"
            >
              Add Long-Term Loan
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {visibleGroups.map((group) => {
            const isExpanded = !!expandedFriends[group.friendKey];
            const hasEveryday = group.everydayRecords.length > 0;
            const hasLoans = group.longTermLoans.length > 0;

            const showEverydaySection = bucketFilter !== 'long_term_loan' && hasEveryday;
            const showLoansSection = bucketFilter !== 'everyday_split' && hasLoans;

            return (
              <div
                key={group.friendKey}
                className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs transition-all"
              >
                {/* Friend Card Header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleFriendExpand(group.friendKey)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleFriendExpand(group.friendKey);
                    }
                  }}
                  className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-muted/20 transition-colors select-none"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-foreground">
                        {group.friendName}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span>
                        {group.everydayRecords.length}{' '}
                        {group.everydayRecords.length === 1 ? 'Everyday Split' : 'Everyday Splits'}
                      </span>
                      <span>·</span>
                      <span>
                        {group.longTermLoans.length}{' '}
                        {group.longTermLoans.length === 1 ? 'Loan' : 'Loans'}
                      </span>
                    </div>
                  </div>

                  {/* Summary indicators */}
                  <div className="flex items-center gap-3 ml-auto sm:ml-0">
                    <div className="text-right text-xs">
                      {/* Everyday Tab indicator */}
                      <div className="font-mono tabular-nums">
                        {group.everydayNet > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Tab: Owes you {formatINR(group.everydayNet)}
                          </span>
                        ) : group.everydayNet < 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            Tab: You owe {formatINR(Math.abs(group.everydayNet))}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Tab: Settled</span>
                        )}
                      </div>

                      {/* Loan indicator */}
                      <div className="font-mono tabular-nums text-[11px] text-muted-foreground">
                        {group.longTermBorrowedRemaining > 0 && group.longTermLentRemaining > 0 ? (
                          <span>
                            Loans: -{formatINR(group.longTermBorrowedRemaining)} / +
                            {formatINR(group.longTermLentRemaining)}
                          </span>
                        ) : group.longTermBorrowedRemaining > 0 ? (
                          <span className="text-rose-600/90 dark:text-rose-400/90">
                            Loan: You owe {formatINR(group.longTermBorrowedRemaining)}
                          </span>
                        ) : group.longTermLentRemaining > 0 ? (
                          <span className="text-emerald-600/90 dark:text-emerald-400/90">
                            Loan: Owes you {formatINR(group.longTermLentRemaining)}
                          </span>
                        ) : (
                          <span>No Active Loans</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label="Toggle details"
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Friend Card Body */}
                {isExpanded && (
                  <div className="border-t border-border/60 divide-y divide-border/60 bg-muted/10">
                    {/* 1. Everyday Tab Subsection */}
                    {showEverydaySection && (
                      <div className="p-4 sm:p-5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                          <div>
                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <Receipt className="w-3.5 h-3.5 text-primary" />
                              Everyday Running Tab
                            </span>
                            <p className="text-[11px] text-muted-foreground">
                              {group.everydayNet > 0
                                ? `${group.friendName} owes you ${formatINR(group.everydayNet)} net on everyday splits`
                                : group.everydayNet < 0
                                ? `You owe ${group.friendName} ${formatINR(
                                    Math.abs(group.everydayNet)
                                  )} net on everyday splits`
                                : 'Everyday tab is fully settled'}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openNewEntryDialog('everyday_split', group.friendName)}
                              className="h-8 px-2.5 text-xs rounded-lg gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Split
                            </Button>

                            {group.everydayRecords.some((r) => r.status === 'active') && (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => openSettleTabDialog(group)}
                                className="h-8 px-2.5 text-xs rounded-lg gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                Settle Tab
                              </Button>
                            )}

                            {group.canOffsetAgainstLoan && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openOffsetDialog(group)}
                                className="h-8 px-2.5 text-xs rounded-lg gap-1 text-primary border-primary/30 hover:bg-primary/5"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                                Offset vs Loan
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* List of Everyday Split records */}
                        <div className="space-y-1.5 pt-1">
                          {group.everydayRecords.map((split) => {
                            const isLent = split.direction === 'lent';
                            const isSettled = split.status === 'settled';

                            return (
                              <div
                                key={split.id}
                                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                                  isSettled
                                    ? 'bg-muted/30 border-border/40 opacity-70'
                                    : 'bg-background border-border/70'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground">
                                      {split.title}
                                    </span>
                                    <span
                                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${
                                        isLent
                                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                      }`}
                                    >
                                      {isLent ? 'They owe you' : 'You owe'}
                                    </span>
                                    {isSettled && (
                                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded-md">
                                        Settled
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                                    <span>{split.startDate}</span>
                                    {split.notes && (
                                      <>
                                        <span>·</span>
                                        <span className="truncate max-w-[200px]">{split.notes}</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5">
                                  <div className="text-right font-mono tabular-nums">
                                    <span
                                      className={`font-bold ${
                                        isLent
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-rose-600 dark:text-rose-400'
                                      }`}
                                    >
                                      {formatINR(split.remainingAmount)}
                                    </span>
                                    {split.totalRepaidAmount > 0 && !isSettled && (
                                      <span className="block text-[10px] text-muted-foreground">
                                        Repaid: {formatINR(split.totalRepaidAmount)}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      aria-label="Edit split"
                                      onClick={() => openEditDebtDialog(split)}
                                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Delete split"
                                      onClick={async () => {
                                        if (confirm(`Delete split "${split.title}"?`)) {
                                          await deleteDebtRecord(split.id);
                                          toast.success('Deleted split entry');
                                        }
                                      }}
                                      className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 2. Long-Term Loans / EMIs Subsection */}
                    {showLoansSection && (
                      <div className="p-4 sm:p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5 text-blue-500" />
                            Long-Term Loans & EMIs
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openNewEntryDialog('long_term_loan', group.friendName)}
                            className="h-8 px-2.5 text-xs rounded-lg gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Loan
                          </Button>
                        </div>

                        {/* List of Long-Term Loan records */}
                        <div className="space-y-3 pt-1">
                          {group.longTermLoans.map((loan) => {
                            const isBorrowed = loan.direction === 'borrowed';
                            const isLoanOpen = !!expandedLoanIds[loan.id];
                            const installments = getDebtInstallments(loan.id);
                            const pct =
                              loan.principalAmount > 0
                                ? Math.min(
                                    100,
                                    Math.round(
                                      (loan.totalRepaidAmount / loan.principalAmount) * 100
                                    )
                                  )
                                : 100;

                            return (
                              <div
                                key={loan.id}
                                className="rounded-xl border border-border/80 bg-background p-3.5 space-y-3"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-xs sm:text-sm text-foreground">
                                        {loan.title}
                                      </span>
                                      <span
                                        className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${
                                          isBorrowed
                                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                        }`}
                                      >
                                        {isBorrowed ? 'I Borrowed' : 'I Lent'}
                                      </span>
                                      {loan.isEmi && (
                                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                          EMI Schedule
                                        </span>
                                      )}
                                      {loan.status === 'settled' && (
                                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.2 rounded-md">
                                          Settled
                                        </span>
                                      )}
                                    </div>

                                    {/* Unboxed Metadata: EMI Schedule / Due Day */}
                                    <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5">
                                      <span>Started {loan.startDate}</span>
                                      {loan.isEmi && loan.emiAmount ? (
                                        <>
                                          <span>·</span>
                                          <span className="font-mono tabular-nums">
                                            {formatINR(loan.emiAmount)}/mo · Due day {loan.emiDueDay || 5} ·{' '}
                                            {loan.paidInstallments || 0}/
                                            {loan.totalInstallments || '∞'} EMIs
                                          </span>
                                        </>
                                      ) : loan.plannedMonthlyInstallment ? (
                                        <>
                                          <span>·</span>
                                          <span className="font-mono tabular-nums">
                                            {formatINR(loan.plannedMonthlyInstallment)}/mo · Due day{' '}
                                            {loan.dueDayOfMonth || 15}
                                          </span>
                                        </>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="text-right font-mono tabular-nums">
                                    <div className="text-xs text-muted-foreground">
                                      Remaining / Principal
                                    </div>
                                    <div className="text-sm font-bold text-foreground">
                                      <span
                                        className={
                                          isBorrowed
                                            ? 'text-rose-600 dark:text-rose-400'
                                            : 'text-emerald-600 dark:text-emerald-400'
                                        }
                                      >
                                        {formatINR(loan.remainingAmount)}
                                      </span>{' '}
                                      <span className="text-muted-foreground font-normal text-xs">
                                        / {formatINR(loan.principalAmount)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] font-mono tabular-nums text-muted-foreground">
                                    <span>Repaid: {formatINR(loan.totalRepaidAmount)}</span>
                                    <span>{pct}% complete</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        pct >= 100
                                          ? 'bg-emerald-500'
                                          : isBorrowed
                                          ? 'bg-rose-500'
                                          : 'bg-emerald-500'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Action Buttons for Loan */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                                  <div className="flex items-center gap-1.5">
                                    {loan.status === 'active' && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => openRecordInstallmentDialog(loan)}
                                        className="h-7 px-2.5 text-xs rounded-lg gap-1"
                                      >
                                        <ArrowDownLeft className="w-3.5 h-3.5" />
                                        Record Payment
                                      </Button>
                                    )}
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setTopUpTarget(loan);
                                        setTopUpAmt('');
                                        setTopUpNote('');
                                      }}
                                      className="h-7 px-2.5 text-xs rounded-lg gap-1"
                                    >
                                      <PlusCircle className="w-3.5 h-3.5" />
                                      Top Up
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleCopyReminder(loan)}
                                      className="h-7 px-2 text-xs rounded-lg gap-1 text-muted-foreground"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                      UPI Msg
                                    </Button>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      aria-label="Toggle installment log"
                                      onClick={() => toggleLoanExpand(loan.id)}
                                      className="px-2 py-1 text-[11px] font-medium rounded-lg text-muted-foreground hover:bg-muted"
                                    >
                                      {installments.length} logs{' '}
                                      {isLoanOpen ? '▲' : '▼'}
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Edit loan"
                                      onClick={() => openEditDebtDialog(loan)}
                                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Delete loan"
                                      onClick={async () => {
                                        if (confirm(`Delete loan "${loan.title}"?`)) {
                                          await deleteDebtRecord(loan.id);
                                          toast.success('Deleted loan');
                                        }
                                      }}
                                      className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Installment history log */}
                                {isLoanOpen && (
                                  <div className="pt-2 border-t border-border/40 space-y-1.5">
                                    {installments.length === 0 ? (
                                      <p className="text-[11px] text-muted-foreground text-center py-2">
                                        No repayments logged yet.
                                      </p>
                                    ) : (
                                      installments.map((inst) => (
                                        <div
                                          key={inst.id}
                                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40 font-mono tabular-nums"
                                        >
                                          <div>
                                            <span className="font-semibold text-foreground">
                                              {formatINR(inst.amount)}
                                            </span>
                                            <span className="text-[11px] text-muted-foreground ml-2">
                                              {inst.date} · {inst.paymentMethod.toUpperCase()}
                                            </span>
                                            {inst.note && (
                                              <p className="text-[10px] text-muted-foreground font-sans truncate max-w-xs">
                                                {inst.note}
                                              </p>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              aria-label="Edit installment"
                                              onClick={() =>
                                                openEditInstallmentDialog(loan, inst)
                                              }
                                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              aria-label="Delete installment"
                                              onClick={async () => {
                                                if (confirm('Delete this installment log?')) {
                                                  await deleteDebtInstallment(inst.id);
                                                  toast.success('Deleted installment log');
                                                }
                                              }}
                                              className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unified Add / Edit Dialog */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDebt ? 'Edit Ledger Entry' : 'New Friend Entry'}
            </DialogTitle>
            <DialogDescription>
              Record an everyday split (food, chai, cab) or a formal personal loan / EMI schedule.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveDebt} className="space-y-4 pt-2">
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
              <Label htmlFor="friend-name" className="text-xs">
                Friend Name
              </Label>
              <Input
                id="friend-name"
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
              <Label htmlFor="friend-title" className="text-xs">
                {entryBucketType === 'everyday_split' ? 'Split Description' : 'Loan Title'}
              </Label>
              <Input
                id="friend-title"
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
                <Label htmlFor="friend-principal" className="text-xs">
                  Amount (₹)
                </Label>
                <Input
                  id="friend-principal"
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
                <Label htmlFor="friend-start-date" className="text-xs">
                  Date
                </Label>
                <Input
                  id="friend-start-date"
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
                    <Label htmlFor="loan-schedule" className="text-xs">
                      Repayment Schedule
                    </Label>
                    <select
                      id="loan-schedule"
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
                    <Label htmlFor="loan-due-day" className="text-xs">
                      Due Day (1–31)
                    </Label>
                    <Input
                      id="loan-due-day"
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
                        <Label htmlFor="emi-amt" className="text-[11px] text-muted-foreground">
                          EMI Amount (₹)
                        </Label>
                        <Input
                          id="emi-amt"
                          type="number"
                          step="any"
                          value={emiAmount}
                          onChange={(e) => setEmiAmount(e.target.value)}
                          placeholder="₹ 2,000"
                          className="rounded-xl font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="emi-day" className="text-[11px] text-muted-foreground">
                          Billing Day
                        </Label>
                        <Input
                          id="emi-day"
                          type="number"
                          min="1"
                          max="31"
                          value={emiDueDay}
                          onChange={(e) => setEmiDueDay(e.target.value)}
                          className="rounded-xl font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="emi-total" className="text-[11px] text-muted-foreground">
                          Total EMIs
                        </Label>
                        <Input
                          id="emi-total"
                          type="number"
                          min="1"
                          value={totalInstallments}
                          onChange={(e) => setTotalInstallments(e.target.value)}
                          placeholder="e.g. 12"
                          className="rounded-xl font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="emi-paid" className="text-[11px] text-muted-foreground">
                          Paid EMIs
                        </Label>
                        <Input
                          id="emi-paid"
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
              <Label htmlFor="friend-notes" className="text-xs">
                Notes
              </Label>
              <Input
                id="friend-notes"
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
                onClick={() => setIsNewOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl text-xs">
                {editingDebt ? 'Save Changes' : 'Create Entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Settle Everyday Tab Dialog */}
      <Dialog open={!!settleFriend} onOpenChange={(open) => !open && setSettleFriend(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Settle Everyday Tab</DialogTitle>
            <DialogDescription>
              Mark all active everyday splits with {settleFriend?.friendName} as settled and record
              one synced net transaction.
            </DialogDescription>
          </DialogHeader>

          {settleFriend && (
            <form onSubmit={handleConfirmSettleTab} className="space-y-4 pt-2">
              {/* Net banner */}
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                  settleFriend.everydayNet > 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                    : settleFriend.everydayNet < 0
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                    : 'bg-muted border-border'
                }`}
              >
                <div className="font-semibold text-sm">
                  {settleFriend.everydayNet > 0
                    ? `${settleFriend.friendName} owes you ${formatINR(settleFriend.everydayNet)}`
                    : settleFriend.everydayNet < 0
                    ? `You owe ${settleFriend.friendName} ${formatINR(
                        Math.abs(settleFriend.everydayNet)
                      )}`
                    : 'Tab is fully balanced (₹0)'}
                </div>
                <p className="text-[11px] opacity-90">
                  {settleFriend.everydayNet > 0
                    ? 'Logging settlement will record income into your selected account.'
                    : settleFriend.everydayNet < 0
                    ? 'Logging settlement will record an expense from your selected account.'
                    : 'Active split items will be marked as settled.'}
                </p>
              </div>

              {Math.abs(settleFriend.everydayNet) > 0 && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="settle-account" className="text-xs">
                      Account
                    </Label>
                    <select
                      id="settle-account"
                      value={settleAccountId}
                      onChange={(e) => setSettleAccountId(e.target.value)}
                      className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
                      required
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatINR(a.balance)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="settle-method" className="text-xs">
                        Payment Method
                      </Label>
                      <select
                        id="settle-method"
                        value={settleMethod}
                        onChange={(e) => setSettleMethod(e.target.value as DebtPaymentMethod)}
                        className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
                      >
                        <option value="upi">UPI</option>
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="settle-date" className="text-xs">
                        Date
                      </Label>
                      <Input
                        id="settle-date"
                        type="date"
                        value={settleDate}
                        onChange={(e) => setSettleDate(e.target.value)}
                        className="rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="settle-note" className="text-xs">
                      Note
                    </Label>
                    <Input
                      id="settle-note"
                      value={settleNote}
                      onChange={(e) => setSettleNote(e.target.value)}
                      placeholder="e.g. Settled via GPay after dinner"
                      className="rounded-xl text-xs"
                    />
                  </div>
                </>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSettleFriend(null)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl text-xs">
                  Confirm Settlement
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Offset Split vs Loan Dialog */}
      <Dialog open={!!offsetFriend} onOpenChange={(open) => !open && setOffsetFriend(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Offset Tab against Long-Term Loan</DialogTitle>
            <DialogDescription>
              Apply Everyday Tab balance directly against an active Long-Term Loan with{' '}
              {offsetFriend?.friendName}. Cash will not leave your bank account twice.
            </DialogDescription>
          </DialogHeader>

          {offsetFriend && (
            <form onSubmit={handleConfirmOffset} className="space-y-4 pt-2">
              <div className="p-3 rounded-xl bg-muted/60 text-xs space-y-1">
                <div className="font-semibold text-foreground">
                  Current Everyday Net:{' '}
                  <span className="font-mono tabular-nums">
                    {offsetFriend.everydayNet > 0
                      ? `+${formatINR(offsetFriend.everydayNet)} (Rahul owes you)`
                      : `-${formatINR(Math.abs(offsetFriend.everydayNet))} (You owe Rahul)`}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Zero bank cash is moved. This marks a loan payment with method &quot;offset&quot; and settles
                  the corresponding everyday split items.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="offset-loan-target" className="text-xs">
                  Target Long-Term Loan
                </Label>
                <select
                  id="offset-loan-target"
                  value={offsetTargetLoanId}
                  onChange={(e) => {
                    setOffsetTargetLoanId(e.target.value);
                    const l = offsetFriend.longTermLoans.find((x) => x.id === e.target.value);
                    if (l) {
                      setOffsetAmount(
                        String(Math.min(Math.abs(offsetFriend.everydayNet), l.remainingAmount))
                      );
                    }
                  }}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
                  required
                >
                  {offsetFriend.longTermLoans
                    .filter((l) => {
                      if (offsetFriend.everydayNet > 0) {
                        return l.direction === 'borrowed' && l.status === 'active' && l.remainingAmount > 0;
                      } else {
                        return l.direction === 'lent' && l.status === 'active' && l.remainingAmount > 0;
                      }
                    })
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title} (Remaining: {formatINR(l.remainingAmount)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="offset-amount" className="text-xs">
                  Offset Amount (₹)
                </Label>
                <Input
                  id="offset-amount"
                  type="number"
                  step="any"
                  min="1"
                  value={offsetAmount}
                  onChange={(e) => setOffsetAmount(e.target.value)}
                  className="rounded-xl font-mono text-xs"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOffsetFriend(null)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl text-xs">
                  Apply Offset
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Record / Edit Installment Dialog */}
      <Dialog
        open={!!installmentDebt}
        onOpenChange={(open) => {
          if (!open) {
            setInstallmentDebt(null);
            setEditingInstallment(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingInstallment ? 'Edit Installment Log' : 'Record Loan Repayment'}
            </DialogTitle>
            <DialogDescription>
              {editingInstallment
                ? 'Update previously recorded repayment entry.'
                : `Log repayment towards ${installmentDebt?.title} (${installmentDebt?.personName}).`}
            </DialogDescription>
          </DialogHeader>

          {installmentDebt && (
            <form onSubmit={handleSaveInstallment} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inst-amount" className="text-xs">
                    Amount (₹)
                  </Label>
                  <Input
                    id="inst-amount"
                    type="number"
                    step="any"
                    min="1"
                    value={instAmount}
                    onChange={(e) => setInstAmount(e.target.value)}
                    required
                    className="rounded-xl font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inst-date" className="text-xs">
                    Date
                  </Label>
                  <Input
                    id="inst-date"
                    type="date"
                    value={instDate}
                    onChange={(e) => setInstDate(e.target.value)}
                    required
                    className="rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inst-method" className="text-xs">
                  Payment Method
                </Label>
                <select
                  id="inst-method"
                  value={instMethod}
                  onChange={(e) => setInstMethod(e.target.value as DebtPaymentMethod)}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
                >
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="offset_expense">Offset Adjustment</option>
                </select>
              </div>

              {!editingInstallment && instMethod !== 'cash' && instMethod !== 'offset_expense' && (
                <div className="space-y-1.5">
                  <Label htmlFor="inst-account" className="text-xs">
                    Paid via Account (Optional Sync)
                  </Label>
                  <select
                    id="inst-account"
                    value={instAccountId}
                    onChange={(e) => setInstAccountId(e.target.value)}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
                  >
                    <option value="">No account transaction</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatINR(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="inst-note" className="text-xs">
                  Note
                </Label>
                <Input
                  id="inst-note"
                  value={instNote}
                  onChange={(e) => setInstNote(e.target.value)}
                  placeholder="e.g. October monthly installment"
                  className="rounded-xl text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setInstallmentDebt(null);
                    setEditingInstallment(null);
                  }}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl text-xs">
                  {editingInstallment ? 'Update Log' : 'Save Repayment'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Top Up Dialog */}
      <Dialog open={!!topUpTarget} onOpenChange={(open) => !open && setTopUpTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Top Up Loan Balance</DialogTitle>
            <DialogDescription>
              Increase the loan balance for {topUpTarget?.title} ({topUpTarget?.personName}).
            </DialogDescription>
          </DialogHeader>

          {topUpTarget && (
            <form onSubmit={handleTopUp} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="topup-amount" className="text-xs">
                  Additional Amount (₹)
                </Label>
                <Input
                  id="topup-amount"
                  type="number"
                  step="any"
                  min="1"
                  value={topUpAmt}
                  onChange={(e) => setTopUpAmt(e.target.value)}
                  required
                  className="rounded-xl font-mono text-xs"
                  placeholder="₹ 5,000"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="topup-note" className="text-xs">
                  Reason / Note
                </Label>
                <Input
                  id="topup-note"
                  value={topUpNote}
                  onChange={(e) => setTopUpNote(e.target.value)}
                  placeholder="e.g., Added extra amount for medical bill"
                  className="rounded-xl text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTopUpTarget(null)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl text-xs">
                  Add Top-Up
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
