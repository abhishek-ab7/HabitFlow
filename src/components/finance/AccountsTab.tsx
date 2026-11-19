'use client';

import React, { useState } from 'react';
import {
  Plus,
  Download,
  RotateCcw,
  Pencil,
  CreditCard,
  Sparkles,
  Trash2,
  RefreshCw,
  ArrowRightLeft,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type {
  FinanceAccount,
  FinanceAccountType,
  FinanceCategory,
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
import { CategoryIcon } from './CategoryIcon';
import { toast } from 'sonner';

export function AccountsTab() {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const accounts = useFinanceStore((s) => s.accounts);
  const categories = useFinanceStore((s) => s.categories);
  const categorizationRules = useFinanceStore((s) => s.categorizationRules);

  const addAccount = useFinanceStore((s) => s.addAccount);
  const updateAccount = useFinanceStore((s) => s.updateAccount);
  const deleteAccount = useFinanceStore((s) => s.deleteAccount);
  const addTransaction = useFinanceStore((s) => s.addTransaction);

  const addCategory = useFinanceStore((s) => s.addCategory);
  const updateCategory = useFinanceStore((s) => s.updateCategory);
  const updateCategoryBudget = useFinanceStore((s) => s.updateCategoryBudget);

  const addCategorizationRule = useFinanceStore((s) => s.addCategorizationRule);
  const deleteCategorizationRule = useFinanceStore(
    (s) => s.deleteCategorizationRule
  );

  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getNetWorthSummary = useFinanceStore((s) => s.getNetWorthSummary);
  const exportTransactionsCsv = useFinanceStore((s) => s.exportTransactionsCsv);
  const resetAllFinanceData = useFinanceStore((s) => s.resetAllFinanceData);

  const summary = getMonthlySummary(selectedMonth);
  const netWorth = getNetWorthSummary();

  const activeAccounts = accounts.filter((a) => !a.deletedAt && !a.archived);
  const assetAccounts = activeAccounts.filter((a) => a.type !== 'credit_card');
  const creditCards = activeAccounts.filter((a) => a.type === 'credit_card');
  const activeRules = categorizationRules.filter((r) => !r.deletedAt);

  // Edit / Create Account dialog
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false);
  const [accName, setAccName] = useState('');
  const [accBalance, setAccBalance] = useState('0');
  const [accType, setAccType] = useState<FinanceAccountType>('upi');
  const [accCreditLimit, setAccCreditLimit] = useState('100000');
  const [accDueDay, setAccDueDay] = useState('15');

  // Pay Credit Card Bill dialog
  const [payingCard, setPayingCard] = useState<FinanceAccount | null>(null);
  const [payCardAmount, setPayCardAmount] = useState('');
  const [payCardFromAccId, setPayCardFromAccId] = useState('');

  // Edit Category Limit dialog & New Custom Category dialog
  const [editingCategory, setEditingCategory] = useState<FinanceCategory | null>(null);
  const [catLimitInput, setCatLimitInput] = useState('0');
  const [catRolloverInput, setCatRolloverInput] = useState(false);

  const [isNewCatOpen, setIsNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatLimit, setNewCatLimit] = useState('0');
  const [newCatColor, setNewCatColor] = useState('#3b82f6');

  // Smart Merchant Rule form
  const [rulePattern, setRulePattern] = useState('');
  const [ruleCleanName, setRuleCleanName] = useState('');
  const [ruleCategoryId, setRuleCategoryId] = useState('');

  // Fresh Start Reset Confirmation
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const openEditAccount = (acc: FinanceAccount) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccBalance(String(acc.balance));
    setAccType(acc.type);
    setAccCreditLimit(String(acc.creditLimit || 100000));
    setAccDueDay(String(acc.dueDay || 15));
  };

  const handleSaveAccountEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    const bal = parseFloat(accBalance);
    if (!accName.trim() || isNaN(bal)) {
      toast.error('Enter a valid name and balance');
      return;
    }
    await updateAccount(editingAccount.id, {
      name: accName.trim(),
      balance: bal,
      type: accType,
      creditLimit:
        accType === 'credit_card'
          ? parseFloat(accCreditLimit) || 100000
          : undefined,
      dueDay:
        accType === 'credit_card'
          ? Math.min(31, Math.max(1, parseInt(accDueDay, 10) || 15))
          : undefined,
    });
    toast.success(`Updated ${accName.trim()}`);
    setEditingAccount(null);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const bal = parseFloat(accBalance) || 0;
    if (!accName.trim()) {
      toast.error('Enter an account name');
      return;
    }
    const iconMap: Record<FinanceAccountType, string> = {
      upi: 'Smartphone',
      bank: 'Landmark',
      cash: 'Banknote',
      credit_card: 'CreditCard',
      wallet: 'Wallet',
      investment: 'TrendingUp',
    };
    const colorMap: Record<FinanceAccountType, string> = {
      upi: '#10b981',
      bank: '#3b82f6',
      cash: '#f59e0b',
      credit_card: '#f43f5e',
      wallet: '#06b6d4',
      investment: '#8b5cf6',
    };
    await addAccount({
      name: accName.trim(),
      type: accType,
      balance: bal,
      creditLimit:
        accType === 'credit_card'
          ? parseFloat(accCreditLimit) || 100000
          : undefined,
      dueDay:
        accType === 'credit_card'
          ? Math.min(31, Math.max(1, parseInt(accDueDay, 10) || 15))
          : undefined,
      includeInNetWorth: true,
      currency: 'INR',
      color: colorMap[accType],
      icon: iconMap[accType],
      isDefault: activeAccounts.length === 0,
      archived: false,
    });
    toast.success(`Added ${accName.trim()}`);
    setIsNewAccountOpen(false);
    setAccName('');
    setAccBalance('0');
  };

  const handlePayCreditCardBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCard) return;
    const amt = parseFloat(payCardAmount);
    if (isNaN(amt) || amt <= 0 || !payCardFromAccId) {
      toast.error('Select source account and amount');
      return;
    }
    const fallbackCat = categories[0]?.id || 'uncategorized';
    await addTransaction({
      title: `Credit Card Bill Settlement (${payingCard.name})`,
      amount: amt,
      type: 'transfer',
      categoryId: fallbackCat,
      accountId: payCardFromAccId,
      toAccountId: payingCard.id,
      date: new Date().toISOString().split('T')[0],
    });
    toast.success(`Paid ${formatINR(amt)} toward ${payingCard.name}`);
    setPayingCard(null);
  };

  const handleSaveCategoryLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    const limit = parseFloat(catLimitInput);
    if (isNaN(limit) || limit < 0) {
      toast.error('Enter 0 or a positive budget limit');
      return;
    }
    await updateCategoryBudget(editingCategory.id, limit);
    await updateCategory(editingCategory.id, {
      rolloverEnabled: catRolloverInput,
    });
    toast.success(`Updated ${editingCategory.name}`);
    setEditingCategory(null);
  };

  const handleCreateCustomCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      toast.error('Enter a category name');
      return;
    }
    const limit = parseFloat(newCatLimit) || 0;
    const slug = newCatName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    await addCategory({
      name: newCatName.trim(),
      slug,
      type: 'expense',
      icon: 'Tag',
      color: newCatColor,
      monthlyBudgetLimit: limit,
      rolloverEnabled: false,
      subcategories: [],
      order: categories.length + 1,
      isSystem: false,
      archived: false,
    });
    toast.success(`Added category "${newCatName.trim()}"`);
    setIsNewCatOpen(false);
    setNewCatName('');
    setNewCatLimit('0');
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCatId = ruleCategoryId || categories[0]?.id;
    if (!rulePattern.trim() || !targetCatId) {
      toast.error('Enter a merchant keyword and select a category');
      return;
    }
    await addCategorizationRule({
      matchPattern: rulePattern.trim(),
      cleanMerchantName: ruleCleanName.trim() || rulePattern.trim(),
      categoryId: targetCatId,
      isActive: true,
    });
    toast.success(`Added rule for "${rulePattern.trim()}"`);
    setRulePattern('');
    setRuleCleanName('');
  };

  const handleExportCsv = () => {
    const csv = exportTransactionsCsv(selectedMonth);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `finance-${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported CSV');
  };

  const handleConfirmReset = async () => {
    await resetAllFinanceData(true);
    setIsResetDialogOpen(false);
    toast.success('All accounts reset to ₹0 and sample/logged entries cleared');
  };

  const totalAssetsAndLiabilities =
    netWorth.totalAssets + netWorth.totalLiabilities || 1;
  const assetsSharePct = Math.round(
    (netWorth.totalAssets / totalAssetsAndLiabilities) * 100
  );

  return (
    <div className="space-y-6">
      {/* 1. True Net Worth Header Card (Assets vs Liabilities) */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              True Net Worth
            </p>
            <p
              className={`text-3xl sm:text-4xl font-bold font-mono tabular-nums mt-1 ${
                netWorth.netWorth >= 0
                  ? 'text-foreground'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatINR(netWorth.netWorth)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Liquid Cash + Investments &amp; SIPs + Friend Receivables − Credit Cards, EMIs &amp; Payables
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              setAccName('');
              setAccBalance('0');
              setAccType('upi');
              setIsNewAccountOpen(true);
            }}
            className="min-h-[40px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Account / Card
          </Button>
        </div>

        {/* Assets vs Liabilities Proportion Bar */}
        <div className="space-y-1.5">
          <div className="h-2.5 w-full rounded-full bg-rose-500/25 overflow-hidden flex">
            <div
              style={{ width: `${assetsSharePct}%` }}
              className="h-full bg-emerald-500 transition-all duration-300"
            />
          </div>
          <div className="flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              Assets: {formatINR(netWorth.totalAssets)}
            </span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              Liabilities: {formatINR(netWorth.totalLiabilities)}
            </span>
          </div>
        </div>

        {/* 6-Bucket Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-border/70 text-xs">
          <div>
            <span className="text-muted-foreground block">Liquid Cash/Bank</span>
            <span className="font-bold font-mono tabular-nums text-foreground">
              {formatINR(netWorth.liquidAssets)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Investments/SIPs</span>
            <span className="font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400">
              {formatINR(netWorth.investmentAssets)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Friends Owe Me</span>
            <span className="font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatINR(netWorth.friendReceivables)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Credit Card Dues</span>
            <span className="font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
              {formatINR(netWorth.creditCardLiabilities)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Loan/EMI Balance</span>
            <span className="font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
              {formatINR(netWorth.emiRemainingPrincipal)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">I Owe Friends</span>
            <span className="font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
              {formatINR(netWorth.friendPayables)}
            </span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Asset Accounts + Credit Card Liabilities + Data Reset */}
        <div className="lg:col-span-5 space-y-5">
          {/* Liquid & Investment Accounts */}
          <section className="space-y-2.5">
            <h2 className="text-sm font-bold text-foreground">
              Liquid &amp; Investment Accounts ({assetAccounts.length})
            </h2>
            <div className="rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden">
              {assetAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => openEditAccount(acc)}
                  className="w-full min-h-[60px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${acc.color}18`,
                        color: acc.color,
                      }}
                    >
                      <CategoryIcon name={acc.icon} className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {acc.name}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {acc.type.replace('_', ' ')} · Tap to edit balance
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-foreground">
                      {formatINR(acc.balance)}
                    </span>
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground/60" />
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Credit Card Liabilities with Utilization Bar & 1-Tap Bill Settlement */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">
                Credit Cards ({creditCards.length})
              </h2>
              <button
                type="button"
                onClick={() => {
                  setAccName('');
                  setAccBalance('0');
                  setAccType('credit_card');
                  setIsNewAccountOpen(true);
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Add Credit Card
              </button>
            </div>

            {creditCards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                Add a Credit Card account to track credit utilization % and statement due dates.
              </div>
            ) : (
              <div className="space-y-3">
                {creditCards.map((card) => {
                  const used =
                    card.balance < 0
                      ? Math.abs(card.balance)
                      : card.balance;
                  const limit = card.creditLimit || 100000;
                  const utilPct = Math.min(100, Math.round((used / limit) * 100));

                  return (
                    <div
                      key={card.id}
                      className="rounded-2xl border border-border bg-card p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openEditAccount(card)}
                          className="flex items-center gap-3 min-w-0 text-left"
                        >
                          <span className="w-10 h-10 rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                            <CreditCard className="w-5 h-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">
                              {card.name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              Limit {formatINR(limit)}
                              {card.dueDay ? ` · Due Day ${card.dueDay}` : ''}
                            </p>
                          </div>
                        </button>

                        <div className="text-right font-mono tabular-nums shrink-0">
                          <span className="text-sm font-bold text-rose-600 dark:text-rose-400 block">
                            {formatINR(used)} due
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {utilPct}% utilization
                          </span>
                        </div>
                      </div>

                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          style={{ width: `${utilPct}%` }}
                          className={`h-full rounded-full transition-all ${
                            utilPct > 50
                              ? 'bg-rose-500'
                              : utilPct > 30
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                      </div>

                      {used > 0 && (
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPayingCard(card);
                              setPayCardAmount(String(used));
                              setPayCardFromAccId(assetAccounts[0]?.id || '');
                            }}
                            className="h-8 px-3 text-xs rounded-lg gap-1.5"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>Pay Card Bill</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Tools & Fresh Start Reset */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground">
              Data Export &amp; Fresh Start
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleExportCsv}
                className="min-h-[40px] flex-1 gap-2 text-xs rounded-xl"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsResetDialogOpen(true)}
                className="min-h-[40px] flex-1 gap-2 text-xs text-rose-500 hover:text-rose-600 rounded-xl"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to ₹0
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Categories + Rollover + Smart Merchant Auto-Categorization Rules */}
        <div className="lg:col-span-7 space-y-5">
          {/* Categories & Rollover Settings */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Categories &amp; Monthly Envelopes ({selectedMonth})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Tap any category to edit its monthly limit or unused rollover
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsNewCatOpen(true)}
                className="h-9 px-3 rounded-xl gap-1.5 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                New Category
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden">
              {summary.categoryBreakdown.map((item) => {
                const hasLimit = item.budgetLimit > 0;
                return (
                  <button
                    key={item.category.id}
                    type="button"
                    onClick={() => {
                      setEditingCategory(item.category);
                      setCatLimitInput(String(item.category.monthlyBudgetLimit || 0));
                      setCatRolloverInput(Boolean(item.category.rolloverEnabled));
                    }}
                    className="w-full min-h-[56px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${item.category.color}18`,
                          color: item.category.color,
                        }}
                      >
                        <CategoryIcon name={item.category.icon} className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm font-medium text-foreground truncate">
                              {item.category.name}
                            </span>
                            {item.category.rolloverEnabled && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 shrink-0">
                                <RefreshCw className="w-2.5 h-2.5" />
                                Rollover
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-mono tabular-nums text-foreground shrink-0">
                            {formatINR(item.spent)}
                            {hasLimit && (
                              <span className="text-muted-foreground">
                                {' '}
                                / {formatINR(item.budgetLimit)}
                              </span>
                            )}
                          </span>
                        </div>
                        {hasLimit && (
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              style={{
                                width: `${Math.min(100, item.percentageOfBudget)}%`,
                              }}
                              className={`h-full rounded-full ${
                                item.status === 'exceeded'
                                  ? 'bg-rose-500'
                                  : item.status === 'warning'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Smart Merchant Auto-Categorization Rules Engine */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Smart Merchant Categorization Rules ({activeRules.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Automatically clean raw UPI/SMS merchant strings and assign categories
                </p>
              </div>
            </div>

            <form
              onSubmit={handleAddRule}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
            >
              <div className="sm:col-span-4 space-y-1">
                <Label htmlFor="r-pat" className="text-[11px] text-muted-foreground">
                  Keyword (e.g. SWIGGY)
                </Label>
                <Input
                  id="r-pat"
                  value={rulePattern}
                  onChange={(e) => setRulePattern(e.target.value)}
                  placeholder="SWIGGY"
                  className="h-9 text-xs"
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label htmlFor="r-clean" className="text-[11px] text-muted-foreground">
                  Clean Name
                </Label>
                <Input
                  id="r-clean"
                  value={ruleCleanName}
                  onChange={(e) => setRuleCleanName(e.target.value)}
                  placeholder="Swiggy"
                  className="h-9 text-xs"
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label htmlFor="r-cat" className="text-[11px] text-muted-foreground">
                  Category
                </Label>
                <select
                  id="r-cat"
                  value={ruleCategoryId || categories[0]?.id || ''}
                  onChange={(e) => setRuleCategoryId(e.target.value)}
                  className="w-full h-9 px-2 text-xs rounded-lg border border-input bg-background"
                >
                  {categories
                    .filter((c) => !c.deletedAt)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" size="sm" className="w-full h-9 text-xs rounded-lg">
                  Add Rule
                </Button>
              </div>
            </form>

            {activeRules.length > 0 && (
              <div className="divide-y divide-border/60 border-t border-border/60 pt-1">
                {activeRules.map((rule) => {
                  const cat = categories.find((c) => c.id === rule.categoryId);
                  return (
                    <div
                      key={rule.id}
                      className="py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-semibold text-foreground">
                          &ldquo;{rule.matchPattern}&rdquo;
                        </span>
                        <span className="text-muted-foreground">
                          {' '}
                          → {rule.cleanMerchantName} ·{' '}
                        </span>
                        <span className="font-semibold text-primary">
                          {cat?.name || 'Category'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteCategorizationRule(rule.id);
                          toast.success('Rule deleted');
                        }}
                        className="text-muted-foreground hover:text-rose-500 p-1"
                        aria-label="Delete rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Dialog: Edit Account */}
      <Dialog
        open={!!editingAccount}
        onOpenChange={(o) => !o && setEditingAccount(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Update balance, account type, or credit card limit.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveAccountEdit} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ea-name">Account Name</Label>
              <Input
                id="ea-name"
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ea-type">Type</Label>
                <select
                  id="ea-type"
                  value={accType}
                  onChange={(e) => setAccType(e.target.value as FinanceAccountType)}
                  className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background"
                >
                  <option value="upi">UPI</option>
                  <option value="bank">Bank</option>
                  <option value="cash">Cash</option>
                  <option value="wallet">Wallet</option>
                  <option value="investment">Investment</option>
                  <option value="credit_card">Credit Card</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ea-bal">
                  {accType === 'credit_card' ? 'Current Dues (₹)' : 'Balance (₹)'}
                </Label>
                <Input
                  id="ea-bal"
                  type="number"
                  step="0.01"
                  value={accBalance}
                  onChange={(e) => setAccBalance(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                  required
                />
              </div>
            </div>
            {accType === 'credit_card' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ea-limit">Credit Limit (₹)</Label>
                  <Input
                    id="ea-limit"
                    type="number"
                    min="1000"
                    value={accCreditLimit}
                    onChange={(e) => setAccCreditLimit(e.target.value)}
                    className="h-11 font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ea-due">Due Day (1–31)</Label>
                  <Input
                    id="ea-due"
                    type="number"
                    min="1"
                    max="31"
                    value={accDueDay}
                    onChange={(e) => setAccDueDay(e.target.value)}
                    className="h-11 font-mono tabular-nums"
                  />
                </div>
              </div>
            )}
            <DialogFooter className="flex items-center justify-between gap-2">
              {activeAccounts.length > 1 && editingAccount && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    await deleteAccount(editingAccount.id);
                    toast.success('Deleted account');
                    setEditingAccount(null);
                  }}
                  className="text-rose-500 hover:text-rose-600 mr-auto"
                >
                  Delete
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingAccount(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add Account */}
      <Dialog open={isNewAccountOpen} onOpenChange={setIsNewAccountOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Account or Credit Card</DialogTitle>
            <DialogDescription>
              Track bank accounts, UPI apps, investments, or credit card liabilities.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAccount} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="na-name">Account Name</Label>
              <Input
                id="na-name"
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                placeholder="e.g., HDFC Bank, ICICI Sapphiro Card, Zerodha"
                className="h-11"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="na-type">Type</Label>
                <select
                  id="na-type"
                  value={accType}
                  onChange={(e) => setAccType(e.target.value as FinanceAccountType)}
                  className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background"
                >
                  <option value="upi">UPI</option>
                  <option value="bank">Bank</option>
                  <option value="cash">Cash</option>
                  <option value="wallet">Wallet</option>
                  <option value="investment">Investment</option>
                  <option value="credit_card">Credit Card</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="na-bal">
                  {accType === 'credit_card' ? 'Outstanding Due (₹)' : 'Opening Balance (₹)'}
                </Label>
                <Input
                  id="na-bal"
                  type="number"
                  step="0.01"
                  value={accBalance}
                  onChange={(e) => setAccBalance(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                />
              </div>
            </div>
            {accType === 'credit_card' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="na-limit">Credit Limit (₹)</Label>
                  <Input
                    id="na-limit"
                    type="number"
                    min="1000"
                    value={accCreditLimit}
                    onChange={(e) => setAccCreditLimit(e.target.value)}
                    className="h-11 font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="na-due">Bill Due Day (1–31)</Label>
                  <Input
                    id="na-due"
                    type="number"
                    min="1"
                    max="31"
                    value={accDueDay}
                    onChange={(e) => setAccDueDay(e.target.value)}
                    className="h-11 font-mono tabular-nums"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewAccountOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Pay Credit Card Bill */}
      <Dialog open={!!payingCard} onOpenChange={(o) => !o && setPayingCard(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Pay {payingCard?.name} Bill</DialogTitle>
            <DialogDescription>
              Records an account transfer from your bank/UPI account to settle your card balance.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePayCreditCardBill} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pc-from">Pay From Account</Label>
              <select
                id="pc-from"
                value={payCardFromAccId}
                onChange={(e) => setPayCardFromAccId(e.target.value)}
                className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background"
              >
                {assetAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatINR(a.balance)})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pc-amt">Payment Amount (₹)</Label>
              <Input
                id="pc-amt"
                type="number"
                min="1"
                value={payCardAmount}
                onChange={(e) => setPayCardAmount(e.target.value)}
                className="h-11 font-mono tabular-nums"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPayingCard(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Record Transfer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Category Limit & Rollover */}
      <Dialog
        open={!!editingCategory}
        onOpenChange={(o) => !o && setEditingCategory(null)}
      >
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>{editingCategory?.name} Envelope</DialogTitle>
            <DialogDescription>
              Set a monthly budget limit and choose whether unused budget rolls over.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCategoryLimit} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-lim">Monthly Limit (₹)</Label>
              <Input
                id="cat-lim"
                type="number"
                min="0"
                value={catLimitInput}
                onChange={(e) => setCatLimitInput(e.target.value)}
                className="h-11 font-mono tabular-nums"
                required
              />
            </div>
            <label className="flex items-center gap-2.5 text-xs min-h-[40px] cursor-pointer">
              <input
                type="checkbox"
                checked={catRolloverInput}
                onChange={(e) => setCatRolloverInput(e.target.checked)}
                className="w-4 h-4 rounded border-input"
              />
              <span>Roll over unused budget from previous month</span>
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingCategory(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Envelope</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: New Custom Category */}
      <Dialog open={isNewCatOpen} onOpenChange={setIsNewCatOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>New Custom Category</DialogTitle>
            <DialogDescription>
              Add a custom expense category with its own monthly budget envelope.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCustomCategory} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nc-name">Category Name</Label>
              <Input
                id="nc-name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g., Pet Care, Fitness, Books"
                className="h-11"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nc-lim">Monthly Limit (₹)</Label>
                <Input
                  id="nc-lim"
                  type="number"
                  min="0"
                  value={newCatLimit}
                  onChange={(e) => setNewCatLimit(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-col">Accent Color</Label>
                <Input
                  id="nc-col"
                  type="color"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  className="h-11 p-1 cursor-pointer"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewCatOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create Category</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirm Fresh Start Reset */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Reset All Finance Data?</DialogTitle>
            <DialogDescription>
              This clears all transactions, budgets, commitments, friend debts, EMIs, and SIPs,
              and resets every account balance to ₹0 while keeping your categories.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsResetDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmReset}
            >
              Reset Everything to ₹0
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
