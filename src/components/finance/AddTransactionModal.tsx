'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type {
  FinanceTransaction,
  FinanceTransactionType,
  CommitmentContributionType,
} from '@/lib/types';
import {
  Delete,
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
  MessageSquareText,
  Users,
  Sparkles,
} from 'lucide-react';
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
  const splitTransactionWithFriend = useFinanceStore(
    (s) => s.splitTransactionWithFriend
  );
  const addCategorizationRule = useFinanceStore((s) => s.addCategorizationRule);
  const applyCategorizationRules = useFinanceStore(
    (s) => s.applyCategorizationRules
  );

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

  // Split with Friend state
  const [isSplitEnabled, setIsSplitEnabled] = useState(false);
  const [splitFriendName, setSplitFriendName] = useState('');
  const [splitFriendShareStr, setSplitFriendShareStr] = useState('');

  // Smart Merchant Rule checkbox
  const [saveMerchantRule, setSaveMerchantRule] = useState(false);

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
      setIsSplitEnabled(false);
      setSaveMerchantRule(false);
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
    setIsSplitEnabled(false);
    setSplitFriendName('');
    setSplitFriendShareStr('');
    setSaveMerchantRule(false);
  }, [
    open,
    editingTransaction,
    defaultCommitmentId,
    defaultDebtId,
    categories,
    accounts,
    todayStr,
  ]);

  // Auto-apply smart categorization rule when user types a title/merchant
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!editingTransaction && val.trim().length >= 3) {
      const matched = applyCategorizationRules(val);
      if (matched.categoryId) {
        setCategoryId(matched.categoryId);
      }
    }
  };

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
      const dotIdx = prev.indexOf('.');
      if (dotIdx !== -1 && prev.length - dotIdx > 2) return prev;
      if (prev.length >= 9) return prev;
      if (prev === '0') return key;
      return `${prev}${key}`;
    });
  }, []);

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
  const numericAmount = parseFloat(amountStr) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        : type === 'investment'
        ? 'Investment / SIP'
        : selectedCategory?.name || 'Expense');

    setIsSaving(true);
    try {
      if (saveMerchantRule && title.trim().length >= 2 && resolvedCategoryId) {
        await addCategorizationRule({
          matchPattern: title.trim(),
          cleanMerchantName: title.trim(),
          categoryId: resolvedCategoryId,
          isActive: true,
        });
      }

      if (
        !editingTransaction &&
        type === 'expense' &&
        isSplitEnabled &&
        splitFriendName.trim()
      ) {
        const friendShare =
          parseFloat(splitFriendShareStr) || Math.round(numericAmount / 2);
        const myShare = Math.max(0, numericAmount - friendShare);
        await splitTransactionWithFriend(
          {
            title: autoTitle,
            amount: numericAmount,
            type: 'expense',
            categoryId: resolvedCategoryId,
            accountId: resolvedAccountId,
            date,
          },
          splitFriendName.trim(),
          friendShare,
          myShare
        );
        toast.success(
          `Logged your share (${formatINR(myShare)}) & added ${formatINR(
            friendShare
          )} to ${splitFriendName.trim()}'s Friends Ledger`
        );
        onOpenChange(false);
        return;
      }

      const payload = {
        title: autoTitle,
        merchantName: title.trim() || undefined,
        amount: numericAmount,
        type,
        categoryId: resolvedCategoryId,
        accountId: resolvedAccountId,
        toAccountId: type === 'transfer' ? toAccountId || undefined : undefined,
        date,
        needsReview: false,
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
          toast.success(
            type === 'income'
              ? 'Income logged'
              : type === 'investment'
              ? 'Investment logged'
              : 'Expense saved'
          );
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

  const activeCommitments = commitments.filter((c) => c.isActive && !c.deletedAt);
  const activeDebts = debtRecords.filter((d) => d.status === 'active' && !d.deletedAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-[440px] w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col border-border bg-background"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header with 4-Type Switcher */}
        <div className="px-4 pt-2 pb-3 border-b border-border/60 flex items-center justify-between gap-2 shrink-0">
          <DialogTitle className="sr-only">
            {editingTransaction ? 'Edit Transaction' : 'Quick Add Transaction'}
          </DialogTitle>

          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-muted flex-1">
            {(
              [
                { id: 'expense', label: 'Expense' },
                { id: 'income', label: 'Income' },
                { id: 'investment', label: 'Invest' },
                { id: 'transfer', label: 'Transfer' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={`min-h-[38px] px-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  type === t.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
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
              className="min-h-[42px] px-2.5 flex items-center justify-center gap-1 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-primary transition-colors shrink-0"
            >
              <MessageSquareText className="w-4 h-4" />
              <span className="hidden sm:inline">SMS</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Sheet Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-4 py-3 space-y-3.5">
            {/* Hero Amount Display */}
            <div className="text-center py-1.5">
              <div className="inline-flex items-baseline justify-center gap-1">
                <span className="text-2xl font-semibold text-muted-foreground">₹</span>
                <span
                  className={`text-4xl sm:text-5xl font-bold font-mono tabular-nums tracking-tight ${
                    type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : type === 'investment'
                      ? 'text-violet-600 dark:text-violet-400'
                      : 'text-foreground'
                  }`}
                >
                  {amountStr}
                </span>
              </div>
            </div>

            {/* Description + Clickable Category Picker Row */}
            {type !== 'transfer' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2.5 items-end">
                  <div className="col-span-7 space-y-1">
                    <label
                      htmlFor="tx-description"
                      className="text-xs font-medium text-muted-foreground block"
                    >
                      Merchant or Description
                    </label>
                    <Input
                      id="tx-description"
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder={
                        type === 'investment'
                          ? 'e.g. Nifty 50 Index SIP'
                          : 'e.g. Swiggy, Uber, Grocery'
                      }
                      className="h-11 text-sm rounded-xl"
                    />
                  </div>

                  <div className="col-span-5 space-y-1">
                    <span className="text-xs font-medium text-muted-foreground block">
                      Category
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCategorySheetOpen(true)}
                      className="w-full h-11 px-2.5 rounded-xl border border-input bg-card hover:bg-muted/60 flex items-center justify-between gap-1.5 text-left transition-colors"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
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
                        <span className="text-xs font-medium text-foreground truncate">
                          {selectedCategory?.name || 'Select'}
                        </span>
                      </span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  </div>
                </div>

                {/* Smart Merchant Rule Toggle when user types a merchant name */}
                {title.trim().length >= 3 && !editingTransaction && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none pt-0.5">
                    <input
                      type="checkbox"
                      checked={saveMerchantRule}
                      onChange={(e) => setSaveMerchantRule(e.target.checked)}
                      className="rounded border-input"
                    />
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">
                      Always categorize <strong className="text-foreground">{title.trim()}</strong> as{' '}
                      <strong className="text-foreground">{selectedCategory?.name}</strong>
                    </span>
                  </label>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    To Account
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-swipe">
                    {accounts
                      .filter((a) => !a.deletedAt)
                      .map((acc) => {
                        const isSelected = toAccountId === acc.id;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => setToAccountId(acc.id)}
                            className={`shrink-0 min-h-[40px] px-3 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap ${
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
                    className="h-10 text-sm rounded-xl"
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
                {accounts
                  .filter((a) => !a.deletedAt)
                  .map((acc) => {
                    const isSelected = accountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setAccountId(acc.id)}
                        className={`min-h-[40px] px-2.5 rounded-xl border text-xs font-medium truncate transition-colors ${
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

            {/* Split with Friend Quick Toggle (for new expenses) */}
            {!editingTransaction && type === 'expense' && (
              <div className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isSplitEnabled;
                    setIsSplitEnabled(next);
                    if (next && numericAmount > 0 && !splitFriendShareStr) {
                      setSplitFriendShareStr(String(Math.round(numericAmount / 2)));
                    }
                  }}
                  className="w-full min-h-[40px] px-3 flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      {isSplitEnabled
                        ? 'Splitting bill with a friend'
                        : 'Split this bill with a friend'}
                    </span>
                  </span>
                  <span className="text-[11px] font-semibold text-primary">
                    {isSplitEnabled ? 'Hide' : 'Split 50/50'}
                  </span>
                </button>

                {isSplitEnabled && (
                  <div className="p-3 border-t border-border/60 space-y-2.5">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-7">
                        <Input
                          value={splitFriendName}
                          onChange={(e) => setSplitFriendName(e.target.value)}
                          placeholder="Friend's name (e.g. Rahul)"
                          list="existing-friends-list"
                          className="h-9 text-xs rounded-lg"
                        />
                        <datalist id="existing-friends-list">
                          {activeDebts.map((d) => (
                            <option key={d.id} value={d.personName} />
                          ))}
                        </datalist>
                      </div>
                      <div className="col-span-5">
                        <Input
                          type="number"
                          min="1"
                          value={splitFriendShareStr}
                          onChange={(e) => setSplitFriendShareStr(e.target.value)}
                          placeholder="Friend owes ₹"
                          className="h-9 text-xs font-mono rounded-lg"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Your budget logs{' '}
                      <strong className="text-foreground">
                        {formatINR(
                          Math.max(
                            0,
                            numericAmount -
                              (parseFloat(splitFriendShareStr) ||
                                Math.round(numericAmount / 2))
                          )
                        )}
                      </strong>{' '}
                      · Friends Ledger adds{' '}
                      <strong className="text-indigo-600 dark:text-indigo-400">
                        {formatINR(
                          parseFloat(splitFriendShareStr) ||
                            Math.round(numericAmount / 2)
                        )}
                      </strong>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Collapsible Commitment / Friend / Date Linking */}
            <div>
              <button
                type="button"
                onClick={() => setShowMoreOptions((v) => !v)}
                className="w-full min-h-[40px] px-3 rounded-xl border border-border/70 bg-muted/30 flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
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
                      className="h-10 text-sm"
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
                        className="w-full h-10 px-3 text-sm rounded-xl border border-input bg-background"
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
                            className={`min-h-[38px] px-2 text-xs font-medium rounded-lg border ${
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
                            className={`min-h-[38px] px-2 text-xs font-medium rounded-lg border ${
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
                        className="w-full h-10 px-3 text-sm rounded-xl border border-input bg-background"
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
                  className="h-11 rounded-xl bg-muted/60 hover:bg-muted active:scale-95 transition-transform flex items-center justify-center text-lg font-semibold font-mono tabular-nums text-foreground select-none"
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
                className="h-11 w-11 shrink-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSaving}
              className="w-full h-11 rounded-xl text-sm font-semibold"
            >
              {isSaving
                ? 'Saving...'
                : editingTransaction
                ? 'Update Entry'
                : isSplitEnabled && splitFriendName.trim()
                ? 'Save & Split with Friend'
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
