'use client';

import React, { useState, useMemo } from 'react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { FinanceAccount, FinanceAccountType } from '@/lib/types';
import { getCycleWindowForMonth, getLocalIsoDate, getActiveUnbilledCycle, parseIsoDate } from '@/lib/finance/credit-card-cycles';
import { toast } from 'sonner';
import { NetWorthHeroSection } from './accounts/NetWorthHeroSection';
import { AccountsLeftColumn, CategoriesDirectorySection, DataManagementFooter } from './accounts/AccountSections';
import { AccountFormDialog } from './accounts/AccountFormDialog';
import { NewCategoryDialog, PayCreditCardDialog, ReconcileAccountDialog, ResetFinanceDialog } from './accounts/AccountUtilityDialogs';

interface AccountsTabProps {
  onOpenBudgetModal?: (focusCategoryId?: string) => void;
}

const ACCOUNT_ICON_MAP: Record<FinanceAccountType, string> = {
  upi: 'Smartphone', bank: 'Landmark', cash: 'Banknote', credit_card: 'CreditCard', wallet: 'Wallet', investment: 'TrendingUp',
};

const ACCOUNT_COLOR_MAP: Record<FinanceAccountType, string> = {
  upi: '#10b981', bank: '#3b82f6', cash: '#f59e0b', credit_card: '#f43f5e', wallet: '#06b6d4', investment: '#8b5cf6',
};

const toSignedAccountBalance = (type: FinanceAccountType, bal: number): number => {
  if (type !== 'credit_card') return bal;
  return bal === 0 ? 0 : -Math.abs(bal);
};

const clampDay = (raw: string, fallback: number): number => Math.min(31, Math.max(1, parseInt(raw, 10) || fallback));

function buildCreditCardFields(accType: FinanceAccountType, accCreditLimit: string, accBillingDay: string, accDueDay: string) {
  if (accType !== 'credit_card') return { creditLimit: undefined, billingDay: undefined, statementDay: undefined, dueDay: undefined };
  const billingDay = clampDay(accBillingDay, 1);
  return {
    creditLimit: parseFloat(accCreditLimit) || 100000,
    billingDay,
    statementDay: billingDay,
    dueDay: clampDay(accDueDay, 15),
  };
}

export function AccountsTab({ onOpenBudgetModal }: AccountsTabProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const accounts = useFinanceStore((s) => s.accounts);
  const categories = useFinanceStore((s) => s.categories);
  const transactions = useFinanceStore((s) => s.transactions);
  const addAccount = useFinanceStore((s) => s.addAccount);
  const updateAccount = useFinanceStore((s) => s.updateAccount);
  const setDefaultAccount = useFinanceStore((s) => s.setDefaultAccount);
  const deleteAccount = useFinanceStore((s) => s.deleteAccount);
  const reconcileAccountBalance = useFinanceStore((s) => s.reconcileAccountBalance);
  const reconcileCreditCardStatement = useFinanceStore((s) => s.reconcileCreditCardStatement);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const addCategory = useFinanceStore((s) => s.addCategory);
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

  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false);
  const [accName, setAccName] = useState('');
  const [accBalance, setAccBalance] = useState('0');
  const [accType, setAccType] = useState<FinanceAccountType>('upi');
  const [accCreditLimit, setAccCreditLimit] = useState('100000');
  const [accDueDay, setAccDueDay] = useState('15');
  const [accBillingDay, setAccBillingDay] = useState('1');
  const [accIsDefault, setAccIsDefault] = useState(false);

  const [reconcilingAccount, setReconcilingAccount] = useState<FinanceAccount | null>(null);
  const [reconcileTargetStr, setReconcileTargetStr] = useState('');
  const [reconcileMode, setReconcileMode] = useState<'adjustment_tx' | 'silent'>('adjustment_tx');
  const [isReconciling, setIsReconciling] = useState(false);

  const [payingCard, setPayingCard] = useState<FinanceAccount | null>(null);
  const [payCardAmount, setPayCardAmount] = useState('');
  const [payCardFromAccId, setPayCardFromAccId] = useState('');

  const [isNewCatOpen, setIsNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatLimit, setNewCatLimit] = useState('0');
  const [newCatColor, setNewCatColor] = useState('#3b82f6');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const openNewAccountModal = (defaultType: FinanceAccountType) => {
    setAccName('');
    setAccBalance('0');
    setAccType(defaultType);
    setAccIsDefault(false);
    setIsNewAccountOpen(true);
  };

  const openEditAccount = (acc: FinanceAccount) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccBalance(String(acc.type === 'credit_card' ? Math.abs(acc.balance) : acc.balance));
    setAccType(acc.type);
    setAccCreditLimit(String(acc.creditLimit ?? 100000));
    setAccDueDay(String(acc.dueDay ?? 15));
    setAccBillingDay(String(acc.billingDay ?? acc.statementDay ?? 1));
    setAccIsDefault(Boolean(acc.isDefault));
  };

  const openReconcileDialog = (acc: FinanceAccount) => {
    setReconcilingAccount(acc);
    setReconcileTargetStr(String(acc.type === 'credit_card' ? Math.abs(acc.balance) : acc.balance));
    setReconcileMode('adjustment_tx');
  };

  const maybeReconcileCardStatement = async (cardAccountId: string, absBalance: number, note: string) => {
    if (accType !== 'credit_card' || absBalance <= 0) return;
    try {
      const bDay = clampDay(accBillingDay, 1);
      const dDay = clampDay(accDueDay, 15);
      const todayStr = getLocalIsoDate();
      const unbilledWin = getActiveUnbilledCycle(bDay, dDay, todayStr);
      const { year: uY, month: uM } = parseIsoDate(unbilledWin.periodEnd);
      const prevCycle = getCycleWindowForMonth(bDay, dDay, uY, uM - 2);
      if (prevCycle.periodEnd <= todayStr) {
        await reconcileCreditCardStatement({ cardAccountId, cycleKey: prevCycle.cycleKey, actualStatementAmount: absBalance, note });
      }
    } catch (err) {
      console.error('Failed to auto-reconcile statement from account dues:', err);
    }
  };

  const handleConfirmReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcilingAccount) return;
    const actualBal = parseFloat(reconcileTargetStr);
    if (Number.isNaN(actualBal)) {
      toast.error('Enter a valid balance amount');
      return;
    }
    const signedTarget = toSignedAccountBalance(reconcilingAccount.type, actualBal);
    setIsReconciling(true);
    try {
      const res = await reconcileAccountBalance(reconcilingAccount.id, signedTarget, reconcileMode === 'adjustment_tx');
      if (Math.abs(res.variance) < 0.01) toast.info('Account balance already matches');
      else {
        const signPrefix = res.variance > 0 ? '+' : '-';
        toast.success(
          reconcileMode === 'adjustment_tx'
            ? `Reconciled ${reconcilingAccount.name} (${signPrefix}${formatINR(Math.abs(res.variance))} logged)`
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
    if (!accName.trim() || Number.isNaN(bal)) {
      toast.error('Enter a valid name and balance');
      return;
    }
    await updateAccount(editingAccount.id, {
      name: accName.trim(),
      balance: toSignedAccountBalance(accType, bal),
      type: accType,
      isDefault: accIsDefault,
      ...buildCreditCardFields(accType, accCreditLimit, accBillingDay, accDueDay),
    });
    await maybeReconcileCardStatement(editingAccount.id, Math.abs(bal), 'Updated via Edit Account current dues');
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
    const newAccount = await addAccount({
      name: accName.trim(),
      type: accType,
      balance: toSignedAccountBalance(accType, bal),
      ...buildCreditCardFields(accType, accCreditLimit, accBillingDay, accDueDay),
      includeInNetWorth: true,
      currency: 'INR',
      color: ACCOUNT_COLOR_MAP[accType],
      icon: ACCOUNT_ICON_MAP[accType],
      isDefault: activeAccounts.length === 0 || accIsDefault,
      archived: false,
    });
    if (newAccount) await maybeReconcileCardStatement(newAccount.id, Math.abs(bal), 'Opening bill statement');
    toast.success(`Added ${accName.trim()}`);
    setIsNewAccountOpen(false);
    setAccName('');
    setAccBalance('0');
  };

  const handlePayCreditCardBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCard) return;
    const amt = parseFloat(payCardAmount);
    const hasValidAmt = !Number.isNaN(amt) && amt > 0;
    if (!hasValidAmt || !payCardFromAccId) {
      toast.error('Select source account and amount');
      return;
    }
    await addTransaction({
      title: `Credit Card Bill Settlement (${payingCard.name})`,
      amount: amt,
      type: 'transfer',
      categoryId: activeCategories[0]?.id ?? 'uncategorized',
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
    await addCategory({
      name: newCatName.trim(),
      slug: newCatName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      type: 'expense',
      icon: 'Tag',
      color: newCatColor,
      monthlyBudgetLimit: parseFloat(newCatLimit) || 0,
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

  const parsedRecTarget = parseFloat(reconcileTargetStr) || 0;
  const reconcileVariance = reconcilingAccount
    ? Math.round((toSignedAccountBalance(reconcilingAccount.type, parsedRecTarget) - reconcilingAccount.balance) * 100) / 100
    : 0;

  return (
    <div className="space-y-6">
      <NetWorthHeroSection netWorth={netWorth} netWorthHistory={netWorthHistory} onAddAccount={() => openNewAccountModal('upi')} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <AccountsLeftColumn
          assetAccounts={assetAccounts}
          creditCards={creditCards}
          onEdit={openEditAccount}
          onReconcile={openReconcileDialog}
          onSetDefault={async (acc) => {
            await setDefaultAccount(acc.id);
            toast.success(`${acc.name} set as default payment method`);
          }}
          onAddCreditCard={() => openNewAccountModal('credit_card')}
        />
        <CategoriesDirectorySection activeCategories={activeCategories} onOpenBudgetModal={onOpenBudgetModal} onNewCategory={() => setIsNewCatOpen(true)} />
      </div>
      <DataManagementFooter onExportCsv={handleExportCsv} onOpenReset={() => setIsResetDialogOpen(true)} />

      <ReconcileAccountDialog
        reconcilingAccount={reconcilingAccount}
        onClose={() => setReconcilingAccount(null)}
        reconcileTargetStr={reconcileTargetStr}
        setReconcileTargetStr={setReconcileTargetStr}
        reconcileVariance={reconcileVariance}
        reconcileMode={reconcileMode}
        setReconcileMode={setReconcileMode}
        isReconciling={isReconciling}
        onConfirm={handleConfirmReconcile}
      />
      <AccountFormDialog
        mode={editingAccount ? 'edit' : 'create'}
        open={Boolean(editingAccount) || isNewAccountOpen}
        onOpenChange={(o) => {
          if (!o) {
            setEditingAccount(null);
            setIsNewAccountOpen(false);
          }
        }}
        editingAccount={editingAccount}
        canDelete={activeAccounts.length > 1}
        onDelete={async (id) => {
          await deleteAccount(id);
          toast.success('Deleted account');
          setEditingAccount(null);
        }}
        onSubmit={editingAccount ? handleSaveAccountEdit : handleCreateAccount}
        accName={accName}
        setAccName={setAccName}
        accType={accType}
        setAccType={setAccType}
        accBalance={accBalance}
        setAccBalance={setAccBalance}
        accCreditLimit={accCreditLimit}
        setAccCreditLimit={setAccCreditLimit}
        accBillingDay={accBillingDay}
        setAccBillingDay={setAccBillingDay}
        accDueDay={accDueDay}
        setAccDueDay={setAccDueDay}
        accIsDefault={accIsDefault}
        setAccIsDefault={setAccIsDefault}
      />
      <PayCreditCardDialog
        payingCard={payingCard}
        onClose={() => setPayingCard(null)}
        assetAccounts={assetAccounts}
        payCardFromAccId={payCardFromAccId}
        setPayCardFromAccId={setPayCardFromAccId}
        payCardAmount={payCardAmount}
        setPayCardAmount={setPayCardAmount}
        onSubmit={handlePayCreditCardBill}
      />
      <NewCategoryDialog
        open={isNewCatOpen}
        onOpenChange={setIsNewCatOpen}
        newCatName={newCatName}
        setNewCatName={setNewCatName}
        newCatLimit={newCatLimit}
        setNewCatLimit={setNewCatLimit}
        newCatColor={newCatColor}
        setNewCatColor={setNewCatColor}
        onSubmit={handleCreateCustomCategory}
      />
      <ResetFinanceDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen} onConfirm={handleConfirmReset} />
    </div>
  );
}
