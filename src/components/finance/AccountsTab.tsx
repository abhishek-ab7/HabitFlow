'use client';

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Download,
  RotateCcw,
  Pencil,
  CreditCard,
  Sparkles,
  Trash2,
  ArrowRightLeft,
  Scale,
  SlidersHorizontal,
  TrendingUp,
  Power,
  Tag,
  Star,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type {
  FinanceAccount,
  FinanceAccountType,
  FinanceCategorizationRule,
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
import { CreditCardItem } from './credit-cards/CreditCardItem';
import { getCycleWindowForMonth, getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { toast } from 'sonner';

interface AccountsTabProps {
  onOpenBudgetModal?: (focusCategoryId?: string) => void;
}

function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs === 0) return '₹0';
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${sign}₹${Math.round(abs)}`;
}

function getDaysUntilDueDay(dueDay?: number): number | null {
  if (!dueDay || dueDay < 1 || dueDay > 31) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), now.getMonth(), Math.min(dueDay, 28));
  if (target < today) {
    target = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(dueDay, 28));
  }
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function AccountsTab({ onOpenBudgetModal }: AccountsTabProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const accounts = useFinanceStore((s) => s.accounts);
  const categories = useFinanceStore((s) => s.categories);
  const transactions = useFinanceStore((s) => s.transactions);
  const categorizationRules = useFinanceStore((s) => s.categorizationRules);

  const addAccount = useFinanceStore((s) => s.addAccount);
  const updateAccount = useFinanceStore((s) => s.updateAccount);
  const setDefaultAccount = useFinanceStore((s) => s.setDefaultAccount);
  const deleteAccount = useFinanceStore((s) => s.deleteAccount);
  const reconcileAccountBalance = useFinanceStore((s) => s.reconcileAccountBalance);
  const addTransaction = useFinanceStore((s) => s.addTransaction);

  const addCategory = useFinanceStore((s) => s.addCategory);

  const addCategorizationRule = useFinanceStore((s) => s.addCategorizationRule);
  const updateCategorizationRule = useFinanceStore((s) => s.updateCategorizationRule);
  const deleteCategorizationRule = useFinanceStore((s) => s.deleteCategorizationRule);

  const getNetWorthSummary = useFinanceStore((s) => s.getNetWorthSummary);
  const getNetWorthHistory = useFinanceStore((s) => s.getNetWorthHistory);
  const exportTransactionsCsv = useFinanceStore((s) => s.exportTransactionsCsv);
  const resetAllFinanceData = useFinanceStore((s) => s.resetAllFinanceData);

  const netWorth = getNetWorthSummary();
  const netWorthHistory = useMemo(
    () => getNetWorthHistory(6),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getNetWorthHistory, accounts, transactions]
  );

  const activeAccounts = accounts.filter((a) => !a.deletedAt && !a.archived);
  const assetAccounts = activeAccounts.filter((a) => a.type !== 'credit_card');
  const creditCards = activeAccounts.filter((a) => a.type === 'credit_card');
  const activeCategories = categories.filter((c) => !c.deletedAt);
  const activeRules = categorizationRules.filter((r) => !r.deletedAt);

  // Match counts per smart rule across historical transactions
  const ruleMatchCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const rule of activeRules) {
      const pattern = rule.matchPattern.toLowerCase();
      let count = 0;
      for (const tx of transactions) {
        if (tx.deletedAt) continue;
        const hay = `${tx.rawMerchant || ''} ${tx.merchantName || ''} ${tx.title}`.toLowerCase();
        if (hay.includes(pattern)) count += 1;
      }
      map.set(rule.id, count);
    }
    return map;
  }, [activeRules, transactions]);

  // Edit / Create Account dialog
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false);
  const [accName, setAccName] = useState('');
  const [accBalance, setAccBalance] = useState('0');
  const [accType, setAccType] = useState<FinanceAccountType>('upi');
  const [accCreditLimit, setAccCreditLimit] = useState('100000');
  const [accDueDay, setAccDueDay] = useState('15');
  const [accBillingDay, setAccBillingDay] = useState('1');
  const [accIsDefault, setAccIsDefault] = useState(false);

  // Reconcile Balance dialog
  const [reconcilingAccount, setReconcilingAccount] = useState<FinanceAccount | null>(
    null
  );
  const [reconcileTargetStr, setReconcileTargetStr] = useState('');
  const [reconcileMode, setReconcileMode] = useState<'adjustment_tx' | 'silent'>(
    'adjustment_tx'
  );
  const [isReconciling, setIsReconciling] = useState(false);

  // Pay Credit Card Bill dialog
  const [payingCard, setPayingCard] = useState<FinanceAccount | null>(null);
  const [payCardAmount, setPayCardAmount] = useState('');
  const [payCardFromAccId, setPayCardFromAccId] = useState('');

  // New Custom Category dialog
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
    setAccBillingDay(String(acc.billingDay ?? acc.statementDay ?? 1));
    setAccIsDefault(Boolean(acc.isDefault));
  };

  const openReconcileDialog = (acc: FinanceAccount) => {
    setReconcilingAccount(acc);
    setReconcileTargetStr(String(acc.balance));
    setReconcileMode('adjustment_tx');
  };

  const handleConfirmReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcilingAccount) return;
    const actualBal = parseFloat(reconcileTargetStr);
    if (isNaN(actualBal)) {
      toast.error('Enter a valid balance amount');
      return;
    }
    setIsReconciling(true);
    try {
      const res = await reconcileAccountBalance(
        reconcilingAccount.id,
        actualBal,
        reconcileMode === 'adjustment_tx'
      );
      if (Math.abs(res.variance) < 0.01) {
        toast.info('Account balance already matches');
      } else {
        toast.success(
          reconcileMode === 'adjustment_tx'
            ? `Reconciled ${reconcilingAccount.name} (${res.variance > 0 ? '+' : '-'}${formatINR(
                Math.abs(res.variance)
              )} logged)`
            : `Updated ${reconcilingAccount.name} balance silently`
        );
      }
      setReconcilingAccount(null);
    } finally {
      setIsReconciling(false);
    }
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
      isDefault: accIsDefault,
      creditLimit:
        accType === 'credit_card'
          ? parseFloat(accCreditLimit) || 100000
          : undefined,
      billingDay:
        accType === 'credit_card'
          ? Math.min(31, Math.max(1, parseInt(accBillingDay, 10) || 1))
          : undefined,
      statementDay:
        accType === 'credit_card'
          ? Math.min(31, Math.max(1, parseInt(accBillingDay, 10) || 1))
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
      billingDay:
        accType === 'credit_card'
          ? Math.min(31, Math.max(1, parseInt(accBillingDay, 10) || 1))
          : undefined,
      statementDay:
        accType === 'credit_card'
          ? Math.min(31, Math.max(1, parseInt(accBillingDay, 10) || 1))
          : undefined,
      dueDay:
        accType === 'credit_card'
          ? Math.min(31, Math.max(1, parseInt(accDueDay, 10) || 15))
          : undefined,
      includeInNetWorth: true,
      currency: 'INR',
      color: colorMap[accType],
      icon: iconMap[accType],
      isDefault: activeAccounts.length === 0 || accIsDefault,
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
    const fallbackCat = activeCategories[0]?.id || 'uncategorized';
    await addTransaction({
      title: `Credit Card Bill Settlement (${payingCard.name})`,
      amount: amt,
      type: 'transfer',
      categoryId: fallbackCat,
      accountId: payCardFromAccId,
      toAccountId: payingCard.id,
      date: getLocalIsoDate(),
    });
    toast.success(`Paid ${formatINR(amt)} toward ${payingCard.name}`);
    setPayingCard(null);
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
    const targetCatId = ruleCategoryId || activeCategories[0]?.id;
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

  const handleToggleRule = async (rule: FinanceCategorizationRule) => {
    await updateCategorizationRule(rule.id, { isActive: !rule.isActive });
    toast.success(rule.isActive ? 'Rule paused' : 'Rule enabled');
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
    toast.success('All accounts reset to ₹0 and logged entries cleared');
  };

  const totalAssetsAndLiabilities =
    netWorth.totalAssets + netWorth.totalLiabilities || 1;
  const assetsSharePct = Math.round(
    (netWorth.totalAssets / totalAssetsAndLiabilities) * 100
  );

  const reconcileVariance = reconcilingAccount
    ? Math.round(
        ((parseFloat(reconcileTargetStr) || 0) - reconcilingAccount.balance) * 100
      ) / 100
    : 0;

  return (
    <div className="space-y-6">
      {/* 1. True Net Worth Hero Card + 6-Month Net Worth Trajectory Chart */}
      <section className="surface-hero p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-6 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
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
                  Liquid Cash + Investments &amp; SIPs + Receivables − Cards, EMIs &amp; Payables
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setAccName('');
                  setAccBalance('0');
                  setAccType('upi');
                  setAccIsDefault(false);
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
          </div>

          {/* 6-Month Net Worth Area Chart */}
          <div className="lg:col-span-6 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground inline-flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                6-Month Net Worth Trend
              </span>
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                {netWorthHistory.length} months tracked
              </span>
            </div>
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={netWorthHistory}
                  margin={{ top: 6, right: 8, left: -14, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="currentColor"
                    className="text-border/50"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatCompactINR}
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                    className="text-muted-foreground font-mono"
                    width={52}
                  />
                  <Tooltip
                    formatter={(val: unknown) => [formatINR(Number(val) || 0), 'Net Worth']}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--popover)',
                      color: 'var(--popover-foreground)',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="netWorth"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#netWorthGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
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
        {/* Left Column: Asset Accounts (with Reconcile) + Credit Card Cycle Intelligence */}
        <div className="lg:col-span-5 space-y-5">
          {/* Liquid & Investment Accounts */}
          <section className="space-y-2.5">
            <h2 className="text-sm font-bold text-foreground">
              Liquid &amp; Investment Accounts ({assetAccounts.length})
            </h2>
            <div className="rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden">
              {assetAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => openEditAccount(acc)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
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
                      <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                        <span className="truncate">{acc.name}</span>
                        {acc.isDefault && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/12 text-primary text-[10px] font-semibold shrink-0">
                            <Star className="w-2.5 h-2.5 fill-primary" />
                            Default
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {acc.type.replace('_', ' ')}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-foreground mr-1">
                      {formatINR(acc.balance)}
                    </span>
                    {!acc.isDefault && (
                      <button
                        type="button"
                        onClick={async () => {
                          await setDefaultAccount(acc.id);
                          toast.success(`${acc.name} set as default payment method`);
                        }}
                        title="Set as default Paid via account"
                        aria-label={`Set ${acc.name} as default`}
                        className="h-8 px-2 rounded-lg border border-border bg-background hover:bg-muted text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                      >
                        <Star className="w-3 h-3" />
                        <span className="hidden sm:inline">Default</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openReconcileDialog(acc)}
                      title="Reconcile actual bank balance"
                      aria-label={`Reconcile ${acc.name} balance`}
                      className="h-8 px-2 rounded-lg border border-border bg-background hover:bg-muted text-[11px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                    >
                      <Scale className="w-3.5 h-3.5 text-primary" />
                      <span className="hidden sm:inline">Reconcile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditAccount(acc)}
                      aria-label={`Edit ${acc.name}`}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Credit Cards with Statement Cycle & Utilization Intelligence */}
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
                  setAccIsDefault(false);
                  setIsNewAccountOpen(true);
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Add Credit Card
              </button>
            </div>

            {creditCards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                Add a Credit Card account to track credit utilization %, statement close day, and bill due countdown.
              </div>
            ) : (
              <div className="space-y-4">
                {creditCards.map((card) => (
                  <CreditCardItem
                    key={card.id}
                    card={card}
                    onEdit={openEditAccount}
                    onSetDefault={async (cardId) => {
                      await setDefaultAccount(cardId);
                      toast.success(`${card.name} set as default payment method`);
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Smart Merchant Auto-Categorization Rules + Custom Category Directory */}
        <div className="lg:col-span-7 space-y-5">
          {/* Smart Merchant Auto-Categorization Rules Engine */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    Smart Merchant Rules ({activeRules.length})
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Auto-categorize SMS imports, receipt scans, and manual entries
                  </p>
                </div>
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
                  value={ruleCategoryId || activeCategories[0]?.id || ''}
                  onChange={(e) => setRuleCategoryId(e.target.value)}
                  className="w-full h-9 px-2 text-xs rounded-lg border border-input bg-background"
                >
                  {activeCategories.map((c) => (
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

            {activeRules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground text-center">
                No custom rules yet. Add a keyword above or recategorize an SMS import to build rules automatically.
              </div>
            ) : (
              <div className="divide-y divide-border/60 border-t border-border/60 pt-1">
                {activeRules.map((rule) => {
                  const cat = activeCategories.find((c) => c.id === rule.categoryId);
                  const matches = ruleMatchCounts.get(rule.id) || 0;
                  return (
                    <div
                      key={rule.id}
                      className={`py-2.5 flex items-center justify-between gap-2 text-xs ${
                        !rule.isActive ? 'opacity-55' : ''
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="truncate">
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
                        <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
                          Matched {matches} historical {matches === 1 ? 'entry' : 'entries'} ·{' '}
                          {rule.isActive ? 'Active' : 'Paused'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleRule(rule)}
                          title={rule.isActive ? 'Pause rule' : 'Enable rule'}
                          aria-label={rule.isActive ? 'Pause rule' : 'Enable rule'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            rule.isActive
                              ? 'text-emerald-600 hover:bg-emerald-500/10'
                              : 'text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteCategorizationRule(rule.id);
                            toast.success('Rule deleted');
                          }}
                          className="text-muted-foreground hover:text-rose-500 p-1.5 rounded-lg"
                          aria-label="Delete rule"
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

          {/* Streamlined Categories Directory (Envelope budgets centralized in MonthlyBudgetModal) */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0">
                  <Tag className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    Categories Directory ({activeCategories.length})
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Create custom categories or configure monthly limits in Budgets
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onOpenBudgetModal && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenBudgetModal()}
                    className="h-9 px-3 rounded-xl gap-1.5 text-xs"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Edit Envelopes
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsNewCatOpen(true)}
                  className="h-9 px-3 rounded-xl gap-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Category
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onOpenBudgetModal?.(cat.id)}
                  className="px-3 py-2 rounded-xl border border-border/70 bg-background hover:bg-muted/40 flex items-center gap-2 text-left transition-colors"
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${cat.color}18`,
                      color: cat.color,
                    }}
                  >
                    <CategoryIcon name={cat.icon} className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {cat.name}
                    </p>
                    <p className="text-[10px] font-mono tabular-nums text-muted-foreground">
                      {cat.monthlyBudgetLimit > 0
                        ? formatINR(cat.monthlyBudgetLimit)
                        : 'No limit'}
                      {cat.rolloverEnabled ? ' · Rollover' : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Bottom Utility: Data Export & Fresh Start */}
      <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Data Management &amp; Fresh Start
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Export all transactions to a CSV spreadsheet or reset all accounts to ₹0 for a fresh financial cycle.
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            className="min-h-[40px] flex-1 sm:flex-initial gap-2 text-xs font-semibold rounded-xl"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsResetDialogOpen(true)}
            className="min-h-[40px] flex-1 sm:flex-initial gap-2 text-xs font-semibold text-rose-500 hover:text-rose-600 border-rose-200/50 hover:border-rose-300 dark:border-rose-900/40 rounded-xl"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset to ₹0</span>
          </Button>
        </div>
      </section>

      {/* Dialog: 1-Tap Account Balance Reconciliation */}
      <Dialog
        open={!!reconcilingAccount}
        onOpenChange={(o) => !o && setReconcilingAccount(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reconcile {reconcilingAccount?.name}</DialogTitle>
            <DialogDescription>
              Enter the real balance shown in your bank/wallet app. Current app balance:{' '}
              <strong className="font-mono text-foreground">
                {formatINR(reconcilingAccount?.balance || 0)}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmReconcile} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rec-actual">Actual Bank / App Balance (₹)</Label>
              <Input
                id="rec-actual"
                type="number"
                step="0.01"
                value={reconcileTargetStr}
                onChange={(e) => setReconcileTargetStr(e.target.value)}
                className="h-11 font-mono tabular-nums text-base"
                required
              />
              {Math.abs(reconcileVariance) >= 0.01 && (
                <p
                  className={`text-xs font-mono tabular-nums font-semibold ${
                    reconcileVariance > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  Variance: {reconcileVariance > 0 ? '+' : '-'}
                  {formatINR(Math.abs(reconcileVariance))}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground block">
                How should we adjust this difference?
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReconcileMode('adjustment_tx')}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                    reconcileMode === 'adjustment_tx'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  <p className="font-semibold text-foreground">Log Adjustment Tx</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Creates a clear ledger entry
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setReconcileMode('silent')}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                    reconcileMode === 'silent'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  <p className="font-semibold text-foreground">Silent Update</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Updates balance without a tx
                  </p>
                </button>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReconcilingAccount(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isReconciling}>
                {isReconciling ? 'Reconciling...' : 'Confirm Balance'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Account */}
      <Dialog
        open={!!editingAccount}
        onOpenChange={(o) => !o && setEditingAccount(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Update balance, account type, or credit card cycle details.
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
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="ea-limit" className="text-xs">
                    Limit (₹)
                  </Label>
                  <Input
                    id="ea-limit"
                    type="number"
                    min="1000"
                    value={accCreditLimit}
                    onChange={(e) => setAccCreditLimit(e.target.value)}
                    className="h-10 font-mono tabular-nums text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ea-cycle" className="text-xs">
                    Close Day
                  </Label>
                  <Input
                    id="ea-cycle"
                    type="number"
                    min="1"
                    max="31"
                    value={accBillingDay}
                    onChange={(e) => setAccBillingDay(e.target.value)}
                    className="h-10 font-mono tabular-nums text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ea-due" className="text-xs">
                    Due Day
                  </Label>
                  <Input
                    id="ea-due"
                    type="number"
                    min="1"
                    max="31"
                    value={accDueDay}
                    onChange={(e) => setAccDueDay(e.target.value)}
                    className="h-10 font-mono tabular-nums text-xs"
                  />
                </div>
                {(() => {
                  const bDay = Math.min(31, Math.max(1, parseInt(accBillingDay, 10) || 1));
                  const dDay = Math.min(31, Math.max(1, parseInt(accDueDay, 10) || 15));
                  const now = new Date();
                  const win = getCycleWindowForMonth(bDay, dDay, now.getFullYear(), now.getMonth());
                  return (
                    <div className="col-span-3 text-[11px] text-primary bg-primary/10 border border-primary/20 p-2.5 rounded-xl">
                      Next bill generates on <strong className="text-foreground">{win.periodEnd}</strong> · Due on{' '}
                      <strong className="text-amber-600 dark:text-amber-400">{win.dueDate}</strong>
                    </div>
                  );
                })()}
              </div>
            )}
            <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={accIsDefault}
                onChange={(e) => setAccIsDefault(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <span className="text-xs font-medium text-foreground">
                Use as default payment method (Paid via)
              </span>
            </label>
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
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="na-limit" className="text-xs">
                    Limit (₹)
                  </Label>
                  <Input
                    id="na-limit"
                    type="number"
                    min="1000"
                    value={accCreditLimit}
                    onChange={(e) => setAccCreditLimit(e.target.value)}
                    className="h-10 font-mono tabular-nums text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="na-cycle" className="text-xs">
                    Close Day
                  </Label>
                  <Input
                    id="na-cycle"
                    type="number"
                    min="1"
                    max="31"
                    value={accBillingDay}
                    onChange={(e) => setAccBillingDay(e.target.value)}
                    className="h-10 font-mono tabular-nums text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="na-due" className="text-xs">
                    Due Day
                  </Label>
                  <Input
                    id="na-due"
                    type="number"
                    min="1"
                    max="31"
                    value={accDueDay}
                    onChange={(e) => setAccDueDay(e.target.value)}
                    className="h-10 font-mono tabular-nums text-xs"
                  />
                </div>
                {(() => {
                  const bDay = Math.min(31, Math.max(1, parseInt(accBillingDay, 10) || 1));
                  const dDay = Math.min(31, Math.max(1, parseInt(accDueDay, 10) || 15));
                  const now = new Date();
                  const win = getCycleWindowForMonth(bDay, dDay, now.getFullYear(), now.getMonth());
                  return (
                    <div className="col-span-3 text-[11px] text-primary bg-primary/10 border border-primary/20 p-2.5 rounded-xl">
                      Next bill generates on <strong className="text-foreground">{win.periodEnd}</strong> · Due on{' '}
                      <strong className="text-amber-600 dark:text-amber-400">{win.dueDate}</strong>
                    </div>
                  );
                })()}
              </div>
            )}
            <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={accIsDefault}
                onChange={(e) => setAccIsDefault(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <span className="text-xs font-medium text-foreground">
                Set as default payment method (Paid via)
              </span>
            </label>
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

      {/* Dialog: Add Custom Category */}
      <Dialog open={isNewCatOpen} onOpenChange={setIsNewCatOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>New Expense Category</DialogTitle>
            <DialogDescription>
              Create a custom category with an optional monthly budget limit.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCustomCategory} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nc-name">Category Name</Label>
              <Input
                id="nc-name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g., Pet Care, Side Hustle, Hobbies"
                className="h-11"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nc-limit">Monthly Limit (₹)</Label>
                <Input
                  id="nc-limit"
                  type="number"
                  min="0"
                  value={newCatLimit}
                  onChange={(e) => setNewCatLimit(e.target.value)}
                  className="h-11 font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-color">Accent Color</Label>
                <Input
                  id="nc-color"
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

      {/* Dialog: Fresh Start Reset Confirmation */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reset All Finance Data to ₹0?</DialogTitle>
            <DialogDescription>
              This clears all logged transactions and resets account balances to ₹0. Export a CSV backup first if you want to keep a copy.
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
              Reset Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
