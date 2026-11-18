'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFinanceStore } from '@/lib/stores/finance-store';
import type {
  FinanceTransaction,
  FinanceTransactionType,
  CommitmentContributionType,
} from '@/lib/types';
import { Delete, ChevronDown, ChevronUp, Trash2, X, MessageSquareText } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import { SmsImportModal } from './SmsImportModal';
import { toast } from 'sonner';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTransaction?: FinanceTransaction | null;
  defaultCommitmentId?: string | null;
  defaultDebtId?: string | null;
  onOpenSmsImport?: () => void;
}

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'] as const;

export function AddTransactionModal({
  open,
  onOpenChange,
  editingTransaction,
  defaultCommitmentId,
  defaultDebtId,
  onOpenSmsImport,
}: AddTransactionModalProps) {
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const commitments = useFinanceStore((s) => s.commitments);
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);

  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);

  const todayStr = new Date().toISOString().split('T')[0];

  const [type, setType] = useState<FinanceTransactionType>('expense');
  const [amountStr, setAmountStr] = useState('0');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayStr);
  const [linkedCommitmentId, setLinkedCommitmentId] = useState<string>('none');
  const [commitmentContributionType, setCommitmentContributionType] =
    useState<CommitmentContributionType>('offset_expense');
  const [linkedDebtId, setLinkedDebtId] = useState<string>('none');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isLocalSmsOpen, setIsLocalSmsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && categories.length === 0) {
      loadFinanceData();
    }
  }, [open, categories.length, loadFinanceData]);

  useEffect(() => {
    if (!open) {
      setIsCategorySheetOpen(false);
      return;
    }

    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmountStr(String(editingTransaction.amount));
      setCategoryId(editingTransaction.categoryId);
      setAccountId(editingTransaction.accountId);
      setToAccountId(editingTransaction.toAccountId || '');
      setTitle(editingTransaction.title);
      setDate(editingTransaction.date);
      setLinkedCommitmentId(editingTransaction.linkedCommitmentId || 'none');
      setCommitmentContributionType(
        editingTransaction.commitmentContributionType || 'offset_expense'
      );
      setLinkedDebtId(editingTransaction.linkedDebtId || 'none');
      setShowMoreOptions(
        Boolean(editingTransaction.linkedCommitmentId || editingTransaction.linkedDebtId)
      );
      return;
    }

    const defaultCat = categories[0];
    const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
    const secondAcc = accounts.find((a) => a.id !== defaultAcc?.id) || accounts[0];

    setType('expense');
    setAmountStr('0');
    setCategoryId(defaultCat?.id || '');
    setAccountId(defaultAcc?.id || '');
    setToAccountId(secondAcc?.id || '');
    setTitle('');
    setDate(todayStr);
    setLinkedCommitmentId(defaultCommitmentId || 'none');
    setCommitmentContributionType('offset_expense');
    setLinkedDebtId(defaultDebtId || 'none');
    setShowMoreOptions(Boolean(defaultCommitmentId || defaultDebtId));
  }, [
    open,
    editingTransaction,
    defaultCommitmentId,
    defaultDebtId,
    categories,
    accounts,
    todayStr,
  ]);

  const handleKeypadPress = useCallback((key: string) => {
    setAmountStr((prev) => {
      if (key === 'backspace') {
        if (prev.length <= 1) return '0';
        return prev.slice(0, -1);
      }
      if (key === '.') {
        if (prev.includes('.')) return prev;
        return `${prev}.`;
      }
      // Limit to 2 decimal places
      const dotIdx = prev.indexOf('.');
      if (dotIdx !== -1 && prev.length - dotIdx > 2) return prev;
      // Limit total length
      if (prev.length >= 9) return prev;
      if (prev === '0') return key;
      return `${prev}${key}`;
    });
  }, []);

  // Support physical keyboard numbers when modal is open & user isn't typing in a text input
  useEffect(() => {
    if (!open || isCategorySheetOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeypadPress(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleKeypadPress('.');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeypadPress('backspace');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isCategorySheetOpen, handleKeypadPress]);

  const selectedCategory = categories.find((c) => c.id === categoryId) || categories[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amountStr);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Tap the keypad to enter an amount');
      return;
    }

    const fallbackCat = categories[0]?.id || 'uncategorized';
    const fallbackAcc = accounts[0]?.id || 'default';
    const resolvedCategoryId = categoryId || fallbackCat;
    const resolvedAccountId = accountId || fallbackAcc;

    const autoTitle =
      title.trim() ||
      (type === 'transfer'
        ? 'Account Transfer'
        : type === 'income'
        ? 'Income'
        : selectedCategory?.name || 'Expense');

    setIsSaving(true);
    try {
      const payload = {
        title: autoTitle,
        amount: numericAmount,
        type,
        categoryId: resolvedCategoryId,
        accountId: resolvedAccountId,
        toAccountId: type === 'transfer' ? toAccountId || undefined : undefined,
        date,
        linkedCommitmentId:
          linkedCommitmentId !== 'none' ? linkedCommitmentId : null,
        commitmentContributionType:
          linkedCommitmentId !== 'none' ? commitmentContributionType : null,
        linkedDebtId: linkedDebtId !== 'none' ? linkedDebtId : null,
      };

      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, payload);
        toast.success('Updated entry');
      } else {
        await addTransaction(payload);
        if (linkedCommitmentId !== 'none') {
          toast.success('Saved and linked to commitment');
        } else {
          toast.success(type === 'income' ? 'Income logged' : 'Expense saved');
        }
      }
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTransaction) return;
    await deleteTransaction(editingTransaction.id);
    toast.success('Transaction deleted');
    onOpenChange(false);
  };

  const activeCommitments = commitments.filter((c) => c.isActive);
  const activeDebts = debtRecords.filter((d) => d.status === 'active');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-[430px] w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col border-border bg-background"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Accessible Hidden/Visual Header with Type Switcher */}
        <div className="px-4 pt-2 pb-3 border-b border-border/60 flex items-center justify-between gap-2 shrink-0">
          <DialogTitle className="sr-only">
            {editingTransaction ? 'Edit Transaction' : 'Quick Add Transaction'}
          </DialogTitle>

          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted flex-1">
            {(['expense', 'income', 'transfer'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`min-h-[40px] px-2 text-xs sm:text-sm font-semibold rounded-lg capitalize transition-all whitespace-nowrap ${
                  type === t
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {!editingTransaction && (
            <button
              type="button"
              onClick={() => {
                if (onOpenSmsImport) {
                  onOpenSmsImport();
                } else {
                  onOpenChange(false);
                  setIsLocalSmsOpen(true);
                }
              }}
              aria-label="Fetch from SMS or Notification"
              title="Fetch from SMS or Notification"
              className="min-h-[44px] px-2.5 flex items-center justify-center gap-1 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-primary transition-colors shrink-0"
            >
              <MessageSquareText className="w-4 h-4" />
              <span className="hidden sm:inline">SMS</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Sheet Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-4 py-3 space-y-4">
            {/* Hero Amount Display */}
            <div className="text-center py-2">
              <div className="inline-flex items-baseline justify-center gap-1">
                <span className="text-2xl font-semibold text-muted-foreground">₹</span>
                <span
                  className={`text-4xl sm:text-5xl font-bold font-mono tabular-nums tracking-tight ${
                    type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-foreground'
                  }`}
                >
                  {amountStr}
                </span>
              </div>
            </div>

            {/* Description + Clickable Category Picker Row (opens Select Category sheet) */}
            {type !== 'transfer' ? (
              <div className="grid grid-cols-12 gap-2.5 items-end">
                <div className="col-span-7 space-y-1">
                  <label
                    htmlFor="tx-description"
                    className="text-xs font-medium text-muted-foreground block"
                  >
                    Description
                  </label>
                  <Input
                    id="tx-description"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Add a description"
                    className="h-12 text-sm rounded-xl"
                  />
                </div>

                <div className="col-span-5 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground block">
                    Category
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCategorySheetOpen(true)}
                    className="w-full h-12 px-2.5 rounded-xl border border-input bg-card hover:bg-muted/60 flex items-center justify-between gap-1.5 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          borderWidth: '1.5px',
                          borderStyle: 'solid',
                          borderColor: `${selectedCategory?.color || '#64748b'}80`,
                          backgroundColor: `${selectedCategory?.color || '#64748b'}15`,
                          color: selectedCategory?.color || 'currentColor',
                        }}
                      >
                        <CategoryIcon
                          name={selectedCategory?.icon}
                          className="w-3.5 h-3.5"
                        />
                      </span>
                      <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                        {selectedCategory?.name || 'Select'}
                      </span>
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    To Account
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-swipe">
                    {accounts.map((acc) => {
                      const isSelected = toAccountId === acc.id;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setToAccountId(acc.id)}
                          className={`shrink-0 min-h-[44px] px-3 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card text-foreground border-border hover:bg-muted'
                          }`}
                        >
                          {acc.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Transfer note (optional)"
                    className="h-11 text-sm rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Payment Account Selector */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {type === 'transfer' ? 'From Account' : 'Paid via'}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {accounts.map((acc) => {
                  const isSelected = accountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setAccountId(acc.id)}
                      className={`min-h-[44px] px-2.5 rounded-xl border text-xs font-medium truncate transition-colors ${
                        isSelected
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-card text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {acc.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Collapsible Commitment / Friend / Date Linking */}
            <div>
              <button
                type="button"
                onClick={() => setShowMoreOptions((v) => !v)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-border/70 bg-muted/30 flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>
                  {linkedCommitmentId !== 'none' || linkedDebtId !== 'none'
                    ? 'Linked to commitment or friend · Edit'
                    : 'Link to Commitment, Friend, or Date'}
                </span>
                {showMoreOptions ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showMoreOptions && (
                <div className="mt-2 p-3 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="tx-date"
                      className="text-xs font-medium text-muted-foreground block"
                    >
                      Date
                    </label>
                    <Input
                      id="tx-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-11 text-sm"
                    />
                  </div>

                  {type === 'expense' && activeCommitments.length > 0 && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="tx-commitment"
                        className="text-xs font-medium text-muted-foreground block"
                      >
                        Deduct from Monthly Commitment
                      </label>
                      <select
                        id="tx-commitment"
                        value={linkedCommitmentId}
                        onChange={(e) => setLinkedCommitmentId(e.target.value)}
                        className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background"
                      >
                        <option value="none">None</option>
                        {activeCommitments.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title} ({c.recipientName})
                          </option>
                        ))}
                      </select>

                      {linkedCommitmentId !== 'none' && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setCommitmentContributionType('offset_expense')
                            }
                            className={`min-h-[40px] px-2 text-xs font-medium rounded-lg border ${
                              commitmentContributionType === 'offset_expense'
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border'
                            }`}
                          >
                            Offset Purchase
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCommitmentContributionType('direct_payment')
                            }
                            className={`min-h-[40px] px-2 text-xs font-medium rounded-lg border ${
                              commitmentContributionType === 'direct_payment'
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border'
                            }`}
                          >
                            Direct Transfer
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeDebts.length > 0 && (
                    <div className="space-y-1">
                      <label
                        htmlFor="tx-debt"
                        className="text-xs font-medium text-muted-foreground block"
                      >
                        Link to Friend Debt
                      </label>
                      <select
                        id="tx-debt"
                        value={linkedDebtId}
                        onChange={(e) => setLinkedDebtId(e.target.value)}
                        className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background"
                      >
                        <option value="none">None</option>
                        {activeDebts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.personName} ({d.direction === 'borrowed' ? 'I owe' : 'Owes me'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tactile 3x4 Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {KEYPAD_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKeypadPress(key)}
                  aria-label={key === 'backspace' ? 'Backspace' : `Digit ${key}`}
                  className="h-12 rounded-xl bg-muted/60 hover:bg-muted active:scale-95 transition-transform flex items-center justify-center text-lg font-semibold font-mono tabular-nums text-foreground select-none"
                >
                  {key === 'backspace' ? <Delete className="w-5 h-5" /> : key}
                </button>
              ))}
            </div>
          </div>

          {/* Sticky Action Footer */}
          <div className="px-4 py-3 border-t border-border bg-background flex items-center gap-2 shrink-0">
            {editingTransaction && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                aria-label="Delete transaction"
                className="h-12 w-12 shrink-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSaving}
              className="w-full h-12 rounded-xl text-sm font-semibold"
            >
              {isSaving
                ? 'Saving...'
                : editingTransaction
                ? 'Update Entry'
                : 'Save Entry'}
            </Button>
          </div>
        </form>
      </DialogContent>

      <CategoryPickerSheet
        open={isCategorySheetOpen}
        onOpenChange={setIsCategorySheetOpen}
        selectedCategoryId={categoryId || selectedCategory?.id || ''}
        onSelectCategory={(id) => setCategoryId(id)}
      />

      {!onOpenSmsImport && (
        <SmsImportModal
          open={isLocalSmsOpen}
          onOpenChange={setIsLocalSmsOpen}
        />
      )}
    </Dialog>
  );
}
