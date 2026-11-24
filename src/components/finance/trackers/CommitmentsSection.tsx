'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  HeartHandshake,
  Receipt,
  Link2,
  Unlink,
  Trash2,
  RefreshCw,
  ArrowDownLeft,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type { CommitmentLedgerSummary } from '@/lib/types';
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

interface CommitmentsSectionProps {
  onLogOffsetExpense: (commitmentId: string) => void;
}

export function CommitmentsSection({ onLogOffsetExpense }: CommitmentsSectionProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const getAllCommitmentLedgers = useFinanceStore((s) => s.getAllCommitmentLedgers);
  const settleCommitmentBalance = useFinanceStore((s) => s.settleCommitmentBalance);
  const attachTransactionToCommitment = useFinanceStore(
    (s) => s.attachTransactionToCommitment
  );
  const addCommitment = useFinanceStore((s) => s.addCommitment);
  const updateCommitment = useFinanceStore((s) => s.updateCommitment);
  const deleteCommitment = useFinanceStore((s) => s.deleteCommitment);
  const addTransaction = useFinanceStore((s) => s.addTransaction);

  const commitmentLedgers = getAllCommitmentLedgers(selectedMonth);
  const liquidAccounts = accounts.filter(
    (a) => !a.deletedAt && !a.archived && a.type !== 'credit_card'
  );

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  const [isNewCommOpen, setIsNewCommOpen] = useState(false);
  const [commTitle, setCommTitle] = useState('');
  const [commRecipient, setCommRecipient] = useState('');
  const [commTarget, setCommTarget] = useState('3000');
  const [commDueDay, setCommDueDay] = useState('10');
  const [commRollover, setCommRollover] = useState(true);

  const [attachCommitmentId, setAttachCommitmentId] = useState<string | null>(null);
  const [selectedTxToAttach, setSelectedTxToAttach] = useState('');

  const [reimburseComm, setReimburseComm] = useState<CommitmentLedgerSummary | null>(null);
  const [reimburseAmount, setReimburseAmount] = useState('');
  const [reimburseAccountId, setReimburseAccountId] = useState('');
  const [reimburseDate, setReimburseDate] = useState(getLocalIsoDate());
  const [reimburseNote, setReimburseNote] = useState('');

  const unlinkedMonthExpenses = transactions.filter(
    (t) =>
      !t.deletedAt &&
      t.monthKey === selectedMonth &&
      t.type === 'expense' &&
      !t.linkedCommitmentId
  );

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

  const openReimburseDialog = (ledger: CommitmentLedgerSummary) => {
    setReimburseComm(ledger);
    setReimburseAmount(ledger.overpaidAmount > 0 ? String(ledger.overpaidAmount) : '');
    const defaultLiquid =
      liquidAccounts.find((a) => a.isDefault) ||
      liquidAccounts.find((a) => a.type === 'upi') ||
      liquidAccounts[0];
    setReimburseAccountId(defaultLiquid?.id || '');
    setReimburseDate(getLocalIsoDate());
    setReimburseNote('');
  };

  const handleRecordReimbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reimburseComm) return;
    const amt = parseFloat(reimburseAmount);
    if (isNaN(amt) || amt <= 0 || !reimburseAccountId) {
      toast.error('Enter a valid amount and deposit account');
      return;
    }
    const familyCat =
      categories.find((c) => c.slug === 'family-commitments') || categories[0];
    await addTransaction({
      title: `Reimbursement from ${reimburseComm.commitment.recipientName}`,
      merchantName: reimburseComm.commitment.recipientName,
      amount: amt,
      type: 'income',
      categoryId: reimburseComm.commitment.defaultCategoryId || familyCat?.id || 'uncategorized',
      subcategory: 'Commitment Reimbursement',
      accountId: reimburseAccountId,
      date: reimburseDate || getLocalIsoDate(),
      notes:
        reimburseNote.trim() ||
        `Money received back for ${reimburseComm.commitment.title}`,
      tags: [
        'commitment-reimbursement',
        reimburseComm.commitment.recipientName.toLowerCase(),
      ],
      linkedCommitmentId: reimburseComm.commitment.id,
      commitmentContributionType: 'direct_payment',
    });
    toast.success(
      `Recorded ${formatINR(amt)} received back from ${reimburseComm.commitment.recipientName}`
    );
    setReimburseComm(null);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Monthly Commitments</h2>
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
        <div className="rounded-2xl border border-dashed border-border p-6 text-center space-y-2.5">
          <p className="text-xs text-muted-foreground">
            No monthly commitments added yet (e.g., Mother&apos;s monthly allowance or shared household pool).
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
            const isOpen = !!expandedIds[ledger.commitment.id];
            return (
              <div
                key={ledger.commitment.id}
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(ledger.commitment.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(ledger.commitment.id);
                    }
                  }}
                  className="w-full p-4 flex flex-col gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
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
                        className="h-full bg-rose-500 transition-all duration-300"
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
                                {tx.type === 'income'
                                  ? 'Reimbursement received'
                                  : tx.commitmentContributionType === 'direct_payment'
                                  ? 'Direct transfer'
                                  : 'Offset deduction'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`font-mono tabular-nums font-semibold ${
                                  tx.type === 'income'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : ''
                                }`}
                              >
                                {tx.type === 'income' ? '+' : '-'}
                                {formatINR(tx.amount)}
                              </span>
                              <button
                                type="button"
                                onClick={() => attachTransactionToCommitment(tx.id, null)}
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
                        onClick={() => openReimburseDialog(ledger)}
                        className="min-h-[40px] px-3 text-xs gap-1.5 rounded-xl text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        Received Back
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
                      <button
                        type="button"
                        onClick={async () => {
                          const nextVal = !ledger.commitment.autoRolloverOverpayment;
                          await updateCommitment(ledger.commitment.id, {
                            autoRolloverOverpayment: nextVal,
                          });
                          toast.success(
                            nextVal
                              ? 'Overpayment rollover enabled for next month'
                              : 'Overpayment rollover disabled — months reset fresh'
                          );
                        }}
                        className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                          ledger.commitment.autoRolloverOverpayment
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'border-border bg-background text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>
                          Rollover: {ledger.commitment.autoRolloverOverpayment ? 'ON' : 'OFF'}
                        </span>
                      </button>
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

      {/* Dialog: New Monthly Commitment */}
      <Dialog open={isNewCommOpen} onOpenChange={setIsNewCommOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>New Monthly Commitment</DialogTitle>
            <DialogDescription>
              Set a fixed monthly target where purchases or bills paid on someone&apos;s behalf automatically deduct.
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

      {/* Dialog: Record Commitment Reimbursement */}
      <Dialog
        open={!!reimburseComm}
        onOpenChange={(open) => !open && setReimburseComm(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              Money Received Back ({reimburseComm?.commitment.recipientName})
            </DialogTitle>
            <DialogDescription>
              Log extra money returned to you. This adds to your selected account balance and reduces overpayment rollover.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecordReimbursement} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rb-amt">Amount Received (₹)</Label>
                <Input
                  id="rb-amt"
                  type="number"
                  min="1"
                  step="1"
                  value={reimburseAmount}
                  onChange={(e) => setReimburseAmount(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rb-date">Date</Label>
                <Input
                  id="rb-date"
                  type="date"
                  value={reimburseDate}
                  onChange={(e) => setReimburseDate(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rb-acc">Deposited Into</Label>
              <select
                id="rb-acc"
                value={reimburseAccountId}
                onChange={(e) => setReimburseAccountId(e.target.value)}
                className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background"
                required
              >
                {liquidAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatINR(acc.balance)})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rb-note">Note (optional)</Label>
              <Input
                id="rb-note"
                value={reimburseNote}
                onChange={(e) => setReimburseNote(e.target.value)}
                placeholder="e.g., Mummy sent extra expenses back"
                className="h-11"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReimburseComm(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Record Received</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Link Existing Expense */}
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
    </section>
  );
}
