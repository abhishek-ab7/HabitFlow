'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type {
  FinanceTransaction,
  FinanceTransactionType,
  CommitmentContributionType,
} from '@/lib/types';
import type { ExpenseParseOutput } from '@/lib/ai/types';
import { HeartHandshake, Users, Landmark } from 'lucide-react';
import { toast } from 'sonner';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTransaction?: FinanceTransaction | null;
  prefill?: Partial<ExpenseParseOutput> | null;
  defaultCommitmentId?: string | null;
  defaultDebtId?: string | null;
}

export function AddTransactionModal({
  open,
  onOpenChange,
  editingTransaction,
  prefill,
  defaultCommitmentId,
  defaultDebtId,
}: AddTransactionModalProps) {
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const commitments = useFinanceStore((s) => s.commitments);
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);

  const todayStr = new Date().toISOString().split('T')[0];

  const [type, setType] = useState<FinanceTransactionType>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(todayStr);
  const [notes, setNotes] = useState('');
  const [linkedCommitmentId, setLinkedCommitmentId] = useState<string>('none');
  const [commitmentContributionType, setCommitmentContributionType] =
    useState<CommitmentContributionType>('offset_expense');
  const [linkedDebtId, setLinkedDebtId] = useState<string>('none');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (editingTransaction) {
      setType(editingTransaction.type);
      setTitle(editingTransaction.title);
      setAmount(String(editingTransaction.amount));
      setCategoryId(editingTransaction.categoryId);
      setSubcategory(editingTransaction.subcategory || '');
      setAccountId(editingTransaction.accountId);
      setDate(editingTransaction.date);
      setNotes(editingTransaction.notes || '');
      setLinkedCommitmentId(editingTransaction.linkedCommitmentId || 'none');
      setCommitmentContributionType(
        editingTransaction.commitmentContributionType || 'offset_expense'
      );
      setLinkedDebtId(editingTransaction.linkedDebtId || 'none');
      return;
    }

    const defaultCat =
      (prefill?.categorySlug &&
        categories.find((c) => c.slug === prefill.categorySlug)) ||
      categories[0];
    const defaultAcc =
      (prefill?.paymentMethodType &&
        accounts.find((a) => a.type === prefill.paymentMethodType)) ||
      accounts.find((a) => a.isDefault) ||
      accounts[0];

    setType(prefill?.type || 'expense');
    setTitle(prefill?.title || '');
    setAmount(prefill?.amount && prefill.amount > 0 ? String(prefill.amount) : '');
    setCategoryId(defaultCat?.id || '');
    setSubcategory(prefill?.subcategory || defaultCat?.subcategories?.[0] || '');
    setAccountId(defaultAcc?.id || '');
    setDate(todayStr);
    setNotes(prefill?.notes || '');
    setLinkedCommitmentId(
      defaultCommitmentId || prefill?.matchedCommitmentId || 'none'
    );
    setCommitmentContributionType(
      prefill?.commitmentContributionType || 'offset_expense'
    );
    setLinkedDebtId(defaultDebtId || prefill?.matchedDebtId || 'none');
  }, [
    open,
    editingTransaction,
    prefill,
    defaultCommitmentId,
    defaultDebtId,
    categories,
    accounts,
    todayStr,
  ]);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!title.trim() || isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Please enter a valid title and positive amount');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        amount: numericAmount,
        type,
        categoryId: categoryId || categories[0]?.id,
        subcategory: subcategory || undefined,
        accountId: accountId || accounts[0]?.id,
        date,
        notes: notes.trim() || undefined,
        tags: [],
        linkedCommitmentId:
          linkedCommitmentId !== 'none' ? linkedCommitmentId : null,
        commitmentContributionType:
          linkedCommitmentId !== 'none' ? commitmentContributionType : null,
        linkedDebtId: linkedDebtId !== 'none' ? linkedDebtId : null,
      };

      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, payload);
        toast.success('Transaction updated');
      } else {
        await addTransaction(payload);
        toast.success(`Logged ${formatINR(numericAmount)} transaction`);
      }
      onOpenChange(false);
    } catch {
      toast.error('Failed to save transaction');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingTransaction ? 'Edit Transaction' : 'Log Expense / Income'}
          </DialogTitle>
          <DialogDescription>
            Categorize your transaction and optionally deduct it from a Monthly
            Commitment (like Mother&apos;s allowance) or link it to a Friend Debt.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Type Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-1.5 text-xs font-semibold rounded-md capitalize transition-all ${
                  type === t
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="tx-title">Title / Item Description</Label>
              <Input
                id="tx-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Lakme Lipstick for Mother, Whey Protein..."
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Amount (₹)</Label>
              <Input
                id="tx-amount"
                type="number"
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="450"
                className="font-mono tabular-nums"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-category">Category</Label>
              <select
                id="tx-category"
                value={categoryId}
                onChange={(e) => {
                  const newCatId = e.target.value;
                  setCategoryId(newCatId);
                  const cat = categories.find((c) => c.id === newCatId);
                  setSubcategory(cat?.subcategories?.[0] || '');
                }}
                className="w-full h-10 px-3 text-sm rounded-md border border-input bg-background"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tx-subcategory">Subcategory</Label>
              <select
                id="tx-subcategory"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-md border border-input bg-background"
              >
                <option value="">General</option>
                {selectedCategory?.subcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-account">Paid Via Account</Label>
              <select
                id="tx-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-md border border-input bg-background"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatINR(acc.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tx-date">Date</Label>
              <Input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Monthly Commitment Offset Selector ("Mother's ₹3,000 Tracker") */}
          {type === 'expense' && commitments.length > 0 && (
            <div className="rounded-lg border border-pink-500/30 bg-pink-500/5 p-3.5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-pink-600 dark:text-pink-400">
                <HeartHandshake className="w-4 h-4" />
                <span>Deduct from Monthly Commitment? (In-Kind / Bill Offset)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <select
                    value={linkedCommitmentId}
                    onChange={(e) => setLinkedCommitmentId(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs rounded-md border border-input bg-background"
                  >
                    <option value="none">No — Regular personal expense</option>
                    {commitments
                      .filter((c) => c.isActive)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.recipientName} — {c.title} ({formatINR(c.monthlyTargetAmount)}/mo)
                        </option>
                      ))}
                  </select>
                </div>

                {linkedCommitmentId !== 'none' && (
                  <div>
                    <select
                      value={commitmentContributionType}
                      onChange={(e) =>
                        setCommitmentContributionType(
                          e.target.value as CommitmentContributionType
                        )
                      }
                      className="w-full h-9 px-2.5 text-xs rounded-md border border-input bg-background"
                    >
                      <option value="offset_expense">
                        Offset Purchase / Bill Paid for Them
                      </option>
                      <option value="direct_payment">
                        Direct Cash / UPI Allowance Transfer
                      </option>
                    </select>
                  </div>
                )}
              </div>
              {linkedCommitmentId !== 'none' && (
                <p className="text-[11px] text-muted-foreground">
                  This expense stays in <strong>{selectedCategory?.name}</strong> for your
                  spending analytics AND automatically deducts{' '}
                  <strong>{amount ? formatINR(Number(amount)) : '₹0'}</strong> from this
                  month&apos;s commitment obligation.
                </p>
              )}
            </div>
          )}

          {/* Friend Debt Partial Installment Link */}
          {!editingTransaction && debtRecords.filter((d) => d.status === 'active').length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Users className="w-4 h-4" />
                <span>Count as Partial Friend Debt Repayment?</span>
              </div>
              <select
                value={linkedDebtId}
                onChange={(e) => setLinkedDebtId(e.target.value)}
                className="w-full h-9 px-2.5 text-xs rounded-md border border-input bg-background"
              >
                <option value="none">No — Not linked to a friend debt</option>
                {debtRecords
                  .filter((d) => d.status === 'active')
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.personName} ({d.direction === 'borrowed' ? 'I Owe' : 'Owes Me'}{' '}
                      {formatINR(d.remainingAmount)} remaining)
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tx-notes">Notes (Optional)</Label>
            <Input
              id="tx-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Merchant, order details, or context..."
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {editingTransaction ? 'Save Changes' : 'Save Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
