'use client';

import React, { useState } from 'react';
import {
  HeartHandshake,
  Plus,
  CheckCircle2,
  Receipt,
  ArrowUpRight,
  Link2,
  Unlink,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { CommitmentLedgerSummary } from '@/lib/types';
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

interface CommitmentsTabProps {
  onLogOffsetExpense: (commitmentId: string) => void;
}

export function CommitmentsTab({ onLogOffsetExpense }: CommitmentsTabProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const transactions = useFinanceStore((s) => s.transactions);
  const getAllCommitmentLedgers = useFinanceStore((s) => s.getAllCommitmentLedgers);
  const settleCommitmentBalance = useFinanceStore((s) => s.settleCommitmentBalance);
  const attachTransactionToCommitment = useFinanceStore(
    (s) => s.attachTransactionToCommitment
  );
  const addCommitment = useFinanceStore((s) => s.addCommitment);

  const ledgers = getAllCommitmentLedgers(selectedMonth);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [attachCommitmentId, setAttachCommitmentId] = useState<string | null>(null);
  const [selectedTxToAttach, setSelectedTxToAttach] = useState<string>('');

  // New commitment form state
  const [title, setTitle] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [relationship, setRelationship] = useState('Mother');
  const [monthlyTargetAmount, setMonthlyTargetAmount] = useState('3000');
  const [dueDayOfMonth, setDueDayOfMonth] = useState('10');
  const [autoRollover, setAutoRollover] = useState(true);

  const categoriesMap = new Map(categories.map((c) => [c.id, c]));

  // Unlinked expenses in current month that can be attached as offsets
  const unlinkedMonthExpenses = transactions.filter(
    (t) =>
      t.monthKey === selectedMonth &&
      t.type === 'expense' &&
      !t.linkedCommitmentId
  );

  const handleSettleBalance = async (ledger: CommitmentLedgerSummary) => {
    const tx = await settleCommitmentBalance(ledger.commitment.id, undefined, selectedMonth);
    if (tx) {
      toast.success(
        `Settled remaining ${formatINR(ledger.remainingBalance)} for ${
          ledger.commitment.recipientName
        } (+50 XP)`
      );
    }
  };

  const handleAttachExisting = async () => {
    if (!attachCommitmentId || !selectedTxToAttach) return;
    await attachTransactionToCommitment(
      selectedTxToAttach,
      attachCommitmentId,
      'offset_expense'
    );
    toast.success('Expense linked as an offset deduction');
    setAttachCommitmentId(null);
    setSelectedTxToAttach('');
  };

  const handleCreateCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetNum = parseFloat(monthlyTargetAmount);
    if (!title.trim() || !recipientName.trim() || isNaN(targetNum) || targetNum <= 0) {
      toast.error('Please fill in recipient name and valid monthly target amount');
      return;
    }

    const familyCat = categories.find((c) => c.slug === 'family-commitments');
    await addCommitment({
      title: title.trim(),
      recipientName: recipientName.trim(),
      relationship: relationship.trim() || 'Family',
      monthlyTargetAmount: targetNum,
      dueDayOfMonth: Math.min(31, Math.max(1, parseInt(dueDayOfMonth, 10) || 10)),
      category: 'family_support',
      defaultCategoryId: familyCat?.id,
      autoRolloverOverpayment: autoRollover,
      icon: 'HeartHandshake',
      color: '#ec4899',
      isActive: true,
    });

    toast.success(`Added monthly commitment for ${recipientName}`);
    setIsNewModalOpen(false);
    setTitle('');
    setRecipientName('');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner Explaining In-Kind / Bill Deduction Offset Engine */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-pink-500/25 bg-gradient-to-r from-pink-500/10 via-purple-500/5 to-transparent p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-pink-500" />
            <h3 className="text-base font-semibold text-foreground">
              Monthly Commitments &amp; In-Kind Bill Deduction Engine
            </h3>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Track fixed monthly support obligations (like{' '}
            <strong className="text-foreground">₹3,000/month to Mother</strong>). Any online
            orders (lipstick, medicines) or bills (electricity) you pay on their behalf stay in
            their true expense categories while automatically deducting from this month&apos;s
            remaining payout.
          </p>
        </div>

        <Button
          onClick={() => setIsNewModalOpen(true)}
          size="sm"
          className="shrink-0 gap-1.5"
        >
          <Plus className="w-4 h-4" />
          New Commitment
        </Button>
      </div>

      {/* Commitment Ledger Cards */}
      <div className="grid grid-cols-1 gap-6">
        {ledgers.map((ledger) => {
          const directPct =
            ledger.effectiveTargetAmount > 0
              ? Math.min(
                  100,
                  (ledger.directPaidAmount / ledger.effectiveTargetAmount) * 100
                )
              : 0;
          const offsetPct =
            ledger.effectiveTargetAmount > 0
              ? Math.min(
                  100 - directPct,
                  (ledger.offsetExpensesAmount / ledger.effectiveTargetAmount) * 100
                )
              : 0;

          return (
            <div
              key={ledger.commitment.id}
              className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-5"
            >
              {/* Top Row: Title + Status + Quick Actions */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-pink-500/15 text-pink-500">
                      <HeartHandshake className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-bold text-foreground">
                          {ledger.commitment.title}
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground font-medium">
                          Recipient: {ledger.commitment.recipientName}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-md font-semibold capitalize ${
                            ledger.status === 'settled' || ledger.status === 'overpaid'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : ledger.status === 'in_progress'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {ledger.status === 'in_progress'
                            ? `${formatINR(ledger.remainingBalance)} Remaining`
                            : ledger.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Due on Day {ledger.commitment.dueDayOfMonth} of {selectedMonth}
                        {ledger.rolloverFromPreviousMonth > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            • Includes {formatINR(ledger.rolloverFromPreviousMonth)} rollover
                            credit from last month
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onLogOffsetExpense(ledger.commitment.id)}
                    className="gap-1.5 text-xs"
                  >
                    <Receipt className="w-3.5 h-3.5 text-pink-500" />
                    Log Offset Purchase / Bill
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAttachCommitmentId(ledger.commitment.id)}
                    className="gap-1.5 text-xs"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Link Existing Expense
                  </Button>

                  {ledger.remainingBalance > 0 && (
                    <Button
                      size="sm"
                      onClick={() => handleSettleBalance(ledger)}
                      className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Settle Remaining {formatINR(ledger.remainingBalance)}
                    </Button>
                  )}
                </div>
              </div>

              {/* 4-Metric Ledger Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3.5">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Monthly Target
                  </p>
                  <p className="text-xl font-bold font-mono tabular-nums text-foreground mt-1">
                    {formatINR(ledger.effectiveTargetAmount)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Base: {formatINR(ledger.baseTargetAmount)}/mo
                  </p>
                </div>

                <div className="rounded-lg border border-pink-500/25 bg-pink-500/5 p-3.5">
                  <p className="text-[11px] uppercase tracking-wider text-pink-600 dark:text-pink-400 font-semibold">
                    Offset Purchases &amp; Bills
                  </p>
                  <p className="text-xl font-bold font-mono tabular-nums text-pink-600 dark:text-pink-400 mt-1">
                    -{formatINR(ledger.offsetExpensesAmount)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {ledger.offsetTransactions.length} item(s) ordered/paid for{' '}
                    {ledger.commitment.recipientName}
                  </p>
                </div>

                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3.5">
                  <p className="text-[11px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
                    Direct Cash / UPI Sent
                  </p>
                  <p className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                    -{formatINR(ledger.directPaidAmount)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {ledger.directTransactions.length} direct transfer(s)
                  </p>
                </div>

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5">
                  <p className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-300 font-semibold">
                    Net Remaining to Pay
                  </p>
                  <p className="text-xl font-bold font-mono tabular-nums text-foreground mt-1">
                    {formatINR(ledger.remainingBalance)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {ledger.overpaidAmount > 0
                      ? `+${formatINR(ledger.overpaidAmount)} advance rolls to next month`
                      : `${ledger.progressPercentage}% fulfilled this month`}
                  </p>
                </div>
              </div>

              {/* Multi-Segment Stacked Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-pink-500" />
                      <span className="text-muted-foreground">
                        Offsets/Bills:{' '}
                        <strong className="text-foreground font-mono tabular-nums">
                          {formatINR(ledger.offsetExpensesAmount)}
                        </strong>
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                      <span className="text-muted-foreground">
                        Direct Transfers:{' '}
                        <strong className="text-foreground font-mono tabular-nums">
                          {formatINR(ledger.directPaidAmount)}
                        </strong>
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/30" />
                      <span className="text-muted-foreground">
                        Remaining:{' '}
                        <strong className="text-foreground font-mono tabular-nums">
                          {formatINR(ledger.remainingBalance)}
                        </strong>
                      </span>
                    </span>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-foreground">
                    {formatINR(ledger.totalFulfilledAmount)} /{' '}
                    {formatINR(ledger.effectiveTargetAmount)}
                  </span>
                </div>

                <div className="h-3 w-full rounded-full bg-secondary overflow-hidden flex">
                  {offsetPct > 0 && (
                    <div
                      style={{ width: `${offsetPct}%` }}
                      className="h-full bg-pink-500 transition-all duration-300"
                      title={`Offset Purchases & Bills: ${formatINR(
                        ledger.offsetExpensesAmount
                      )}`}
                    />
                  )}
                  {directPct > 0 && (
                    <div
                      style={{ width: `${directPct}%` }}
                      className="h-full bg-emerald-500 transition-all duration-300"
                      title={`Direct Transfers: ${formatINR(ledger.directPaidAmount)}`}
                    />
                  )}
                </div>
              </div>

              {/* Itemized Mini-Statement of Deductions & Transfers */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Itemized Deductions &amp; Payments ({ledger.transactions.length})
                  </h5>
                </div>

                {ledger.transactions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    No offset purchases or transfers logged for {ledger.commitment.recipientName}{' '}
                    in {selectedMonth} yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-background/50">
                    {ledger.transactions.map((tx) => {
                      const cat = categoriesMap.get(tx.categoryId);
                      const isDirect = tx.commitmentContributionType === 'direct_payment';
                      return (
                        <div
                          key={tx.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">
                                {tx.title}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                  isDirect
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-pink-500/15 text-pink-600 dark:text-pink-400'
                                }`}
                              >
                                {isDirect ? 'Direct Transfer' : 'Offset Deduction'}
                              </span>
                              {cat && (
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-medium border"
                                  style={{
                                    borderColor: `${cat.color}40`,
                                    color: cat.color,
                                  }}
                                >
                                  Categorized in: {cat.name}
                                  {tx.subcategory ? ` (${tx.subcategory})` : ''}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {tx.date} {tx.notes ? `• ${tx.notes}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3">
                            <span className="font-mono tabular-nums font-bold text-sm text-foreground">
                              -{formatINR(tx.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                attachTransactionToCommitment(tx.id, null)
                              }
                              title="Unlink from monthly commitment (keeps expense in category)"
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Attach Existing Expense as Offset */}
      <Dialog
        open={!!attachCommitmentId}
        onOpenChange={(open) => !open && setAttachCommitmentId(null)}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Link Existing Expense as Commitment Offset</DialogTitle>
            <DialogDescription>
              Select an expense from {selectedMonth} to deduct from this monthly
              commitment. The expense will remain in its original category for analytics.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {unlinkedMonthExpenses.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                All expenses in {selectedMonth} are already linked or no unlinked expenses
                exist.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="select-unlinked-tx">Select Expense</Label>
                <select
                  id="select-unlinked-tx"
                  value={selectedTxToAttach}
                  onChange={(e) => setSelectedTxToAttach(e.target.value)}
                  className="w-full h-10 px-3 text-xs rounded-md border border-input bg-background"
                >
                  <option value="">-- Choose an expense --</option>
                  {unlinkedMonthExpenses.map((tx) => (
                    <option key={tx.id} value={tx.id}>
                      {tx.date} — {tx.title} ({formatINR(tx.amount)})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachCommitmentId(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAttachExisting}
              disabled={!selectedTxToAttach}
            >
              Link as Offset Deduction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Create New Monthly Commitment */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Add Monthly Commitment</DialogTitle>
            <DialogDescription>
              Set up a recurring monthly allowance or support target where in-kind
              purchases and bills can be deducted.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCommitment} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="comm-title">Commitment Title</Label>
              <Input
                id="comm-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Mother's Monthly Support, Father's Medical Allowance"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="comm-recipient">Recipient Name</Label>
                <Input
                  id="comm-recipient"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Mother"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comm-relation">Relationship</Label>
                <Input
                  id="comm-relation"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  placeholder="Mother / Father / Family"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="comm-amount">Monthly Target (₹)</Label>
                <Input
                  id="comm-amount"
                  type="number"
                  min="100"
                  value={monthlyTargetAmount}
                  onChange={(e) => setMonthlyTargetAmount(e.target.value)}
                  className="font-mono tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comm-dueday">Due Day of Month (1–31)</Label>
                <Input
                  id="comm-dueday"
                  type="number"
                  min="1"
                  max="31"
                  value={dueDayOfMonth}
                  onChange={(e) => setDueDayOfMonth(e.target.value)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={autoRollover}
                onChange={(e) => setAutoRollover(e.target.checked)}
                className="rounded border-input"
              />
              <span>
                Auto-deduct any overpayment from next month&apos;s obligation
              </span>
            </label>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create Commitment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
