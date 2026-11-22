'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Users, Receipt, Wallet } from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type {
  DebtBucketType,
  DebtDirection,
  DebtInstallment,
  DebtRecord,
  FriendLedgerGroup,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  FriendCard,
  AddDebtModal,
  SettleTabDialog,
  OffsetLoanDialog,
  InstallmentDialog,
  TopUpDialog,
  ShareSettlementDialog,
} from './friends';

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

  // Filters & Accordion State
  const [bucketFilter, setBucketFilter] = useState<'all' | DebtBucketType>('all');
  const [filterDir, setFilterDir] = useState<'all' | DebtDirection>('all');
  const [expandedFriends, setExpandedFriends] = useState<Record<string, boolean>>({});
  const [expandedLoanIds, setExpandedLoanIds] = useState<Record<string, boolean>>({});

  // Unified Add / Edit Dialog state
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtRecord | null>(null);
  const [newDefaultBucket, setNewDefaultBucket] = useState<DebtBucketType>('everyday_split');
  const [newPrefilledFriend, setNewPrefilledFriend] = useState<string>('');

  // Settle Tab Dialog
  const [settleFriend, setSettleFriend] = useState<FriendLedgerGroup | null>(null);

  // Offset Dialog
  const [offsetFriend, setOffsetFriend] = useState<FriendLedgerGroup | null>(null);

  // Installment Dialog (Create or Edit)
  const [installmentDebt, setInstallmentDebt] = useState<DebtRecord | null>(null);
  const [editingInstallment, setEditingInstallment] = useState<DebtInstallment | null>(null);

  // Top-Up Dialog
  const [topUpTarget, setTopUpTarget] = useState<DebtRecord | null>(null);

  // Share Settlement Dialog
  const [shareFriend, setShareFriend] = useState<FriendLedgerGroup | null>(null);

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

  const openNewEntryDialog = (
    defaultBucket: DebtBucketType = 'everyday_split',
    prefilledFriend?: string
  ) => {
    setEditingDebt(null);
    setNewDefaultBucket(defaultBucket);
    setNewPrefilledFriend(prefilledFriend || '');
    setIsNewOpen(true);
  };

  const openEditDebtDialog = (debt: DebtRecord) => {
    setEditingDebt(debt);
    setIsNewOpen(true);
  };

  const handleSaveDebt = async (data: Parameters<typeof addDebtRecord>[0]) => {
    if (editingDebt) {
      await updateDebtRecord(editingDebt.id, data);
      toast.success(`Updated entry for ${data.personName}`);
    } else {
      await addDebtRecord(data);
      toast.success(
        `Added ${data.bucketType === 'everyday_split' ? 'everyday split' : 'loan'} for ${data.personName}`
      );
    }
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

  const handleDeleteDebt = async (debtId: string, title: string) => {
    if (confirm(`Delete "${title}"?`)) {
      await deleteDebtRecord(debtId);
      toast.success('Deleted debt entry');
    }
  };

  const handleDeleteInstallment = async (instId: string) => {
    if (confirm('Delete this installment log?')) {
      await deleteDebtInstallment(instId);
      toast.success('Deleted installment log');
    }
  };

  return (
    <section className="space-y-4">
      {/* 1. Isolated Summary Totals (Everyday Tab vs. Long-Term Loans side-by-side) */}
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

      {/* 2. Dual Filtering Controls (Bucket Filter & Direction Toggle) */}
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

      {/* 3. Per-Friend Grouped Cards */}
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
          {visibleGroups.map((group) => (
            <FriendCard
              key={group.friendKey}
              group={group}
              isExpanded={!!expandedFriends[group.friendKey]}
              onToggleExpand={() => toggleFriendExpand(group.friendKey)}
              bucketFilter={bucketFilter}
              onOpenNewSplit={(name) => openNewEntryDialog('everyday_split', name)}
              onOpenNewLoan={(name) => openNewEntryDialog('long_term_loan', name)}
              onOpenSettleTab={setSettleFriend}
              onOpenOffset={setOffsetFriend}
              onOpenShare={setShareFriend}
              onEditDebt={openEditDebtDialog}
              onDeleteDebt={handleDeleteDebt}
              onRecordPayment={(debt) => {
                setInstallmentDebt(debt);
                setEditingInstallment(null);
              }}
              onTopUp={setTopUpTarget}
              onCopyReminder={handleCopyReminder}
              expandedLoanIds={expandedLoanIds}
              onToggleLoanExpand={toggleLoanExpand}
              getDebtInstallments={getDebtInstallments}
              onEditInstallment={(debt, inst) => {
                setInstallmentDebt(debt);
                setEditingInstallment(inst);
              }}
              onDeleteInstallment={handleDeleteInstallment}
            />
          ))}
        </div>
      )}

      {/* 4. Sub-Component Modals & Dialogs */}
      <AddDebtModal
        isOpen={isNewOpen}
        onClose={() => {
          setIsNewOpen(false);
          setEditingDebt(null);
        }}
        editingDebt={editingDebt}
        defaultBucket={newDefaultBucket}
        prefilledFriend={newPrefilledFriend}
        existingFriendNames={existingFriendNames}
        onSave={handleSaveDebt}
      />

      <SettleTabDialog
        group={settleFriend}
        isOpen={!!settleFriend}
        onClose={() => setSettleFriend(null)}
        accounts={accounts}
        onConfirmSettle={settleEverydayTab}
      />

      <OffsetLoanDialog
        group={offsetFriend}
        isOpen={!!offsetFriend}
        onClose={() => setOffsetFriend(null)}
        onConfirmOffset={offsetSplitAgainstLoan}
      />

      <InstallmentDialog
        debt={installmentDebt}
        editingInstallment={editingInstallment}
        isOpen={!!installmentDebt || !!editingInstallment}
        onClose={() => {
          setInstallmentDebt(null);
          setEditingInstallment(null);
        }}
        accounts={accounts}
        onRecordInstallment={recordDebtInstallment}
        onUpdateInstallment={updateDebtInstallment}
      />

      <TopUpDialog
        target={topUpTarget}
        isOpen={!!topUpTarget}
        onClose={() => setTopUpTarget(null)}
        onTopUp={topUpDebt}
      />

      <ShareSettlementDialog
        group={shareFriend}
        isOpen={!!shareFriend}
        onClose={() => setShareFriend(null)}
      />
    </section>
  );
}
