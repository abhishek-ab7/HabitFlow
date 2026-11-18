'use client';

import React, { useState } from 'react';
import { Plus, Download, RotateCcw, Pencil } from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { FinanceAccount, FinanceAccountType, FinanceCategory } from '@/lib/types';
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
  const addAccount = useFinanceStore((s) => s.addAccount);
  const updateAccount = useFinanceStore((s) => s.updateAccount);
  const updateCategoryBudget = useFinanceStore((s) => s.updateCategoryBudget);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const exportTransactionsCsv = useFinanceStore((s) => s.exportTransactionsCsv);
  const resetAllFinanceData = useFinanceStore((s) => s.resetAllFinanceData);

  const summary = getMonthlySummary(selectedMonth);
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  // Edit / Create Account dialog
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false);
  const [accName, setAccName] = useState('');
  const [accBalance, setAccBalance] = useState('0');
  const [accType, setAccType] = useState<FinanceAccountType>('upi');

  // Edit Category Limit dialog
  const [editingCategory, setEditingCategory] = useState<FinanceCategory | null>(null);
  const [catLimitInput, setCatLimitInput] = useState('0');

  // Fresh Start Reset Confirmation
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const openEditAccount = (acc: FinanceAccount) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccBalance(String(acc.balance));
    setAccType(acc.type);
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
    };
    const colorMap: Record<FinanceAccountType, string> = {
      upi: '#10b981',
      bank: '#3b82f6',
      cash: '#f59e0b',
      credit_card: '#8b5cf6',
      wallet: '#06b6d4',
    };
    await addAccount({
      name: accName.trim(),
      type: accType,
      balance: bal,
      currency: 'INR',
      color: colorMap[accType],
      icon: iconMap[accType],
      isDefault: accounts.length === 0,
      archived: false,
    });
    toast.success(`Added ${accName.trim()}`);
    setIsNewAccountOpen(false);
    setAccName('');
    setAccBalance('0');
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
    toast.success(`Updated ${editingCategory.name} limit`);
    setEditingCategory(null);
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Payment Accounts */}
      <section className="lg:col-span-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">Accounts</h2>
            <p className="text-xs text-muted-foreground font-mono tabular-nums">
              Total Balance: {formatINR(totalBalance)}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setAccName('');
              setAccBalance('0');
              setAccType('upi');
              setIsNewAccountOpen(true);
            }}
            className="min-h-[44px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden">
          {accounts.map((acc) => (
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

        {/* Tools & Fresh Start Reset */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
          <p className="text-xs font-medium text-muted-foreground">
            Data &amp; Fresh Start
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
              className="min-h-[44px] flex-1 gap-2 text-xs rounded-xl"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsResetDialogOpen(true)}
              className="min-h-[44px] flex-1 gap-2 text-xs text-rose-500 hover:text-rose-600 rounded-xl"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to ₹0
            </Button>
          </div>
        </div>
      </section>

      {/* Right: Category Monthly Limits */}
      <section className="lg:col-span-7 space-y-3">
        <div>
          <h2 className="text-base font-bold text-foreground">
            Category Limits ({selectedMonth})
          </h2>
          <p className="text-xs text-muted-foreground">
            Tap any category to set an optional monthly spending limit
          </p>
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
                  setCatLimitInput(String(item.budgetLimit));
                }}
                className="w-full min-h-[60px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-muted/40 transition-colors"
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
                      <span className="text-sm font-medium text-foreground truncate">
                        {item.category.name}
                      </span>
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
                              : 'bg-primary'
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

      {/* Dialog: Edit Account */}
      <Dialog
        open={!!editingAccount}
        onOpenChange={(o) => !o && setEditingAccount(null)}
      >
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Set your starting balance or rename this payment account.
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
            <div className="space-y-1.5">
              <Label htmlFor="ea-bal">Current Balance (₹)</Label>
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingAccount(null)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button type="submit" className="min-h-[44px]">
                Save Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add Account */}
      <Dialog open={isNewAccountOpen} onOpenChange={setIsNewAccountOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
            <DialogDescription>
              Create a clean account starting at ₹0 or with an opening balance.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAccount} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="na-name">Account Name</Label>
              <Input
                id="na-name"
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                placeholder="e.g., SBI Savings, Paytm"
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
                  <option value="credit_card">Credit Card</option>
                  <option value="wallet">Wallet</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="na-bal">Opening Balance (₹)</Label>
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewAccountOpen(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button type="submit" className="min-h-[44px]">
                Add Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Category Limit */}
      <Dialog
        open={!!editingCategory}
        onOpenChange={(o) => !o && setEditingCategory(null)}
      >
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>{editingCategory?.name} Limit</DialogTitle>
            <DialogDescription>
              Set a monthly budget limit (enter 0 to turn off the limit).
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingCategory(null)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button type="submit" className="min-h-[44px]">
                Save Limit
              </Button>
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
              This clears all transactions, budgets, commitments, friend debts, and EMIs,
              and resets every account balance to ₹0 while keeping your 10 categories.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsResetDialogOpen(false)}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmReset}
              className="min-h-[44px]"
            >
              Reset Everything to ₹0
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
