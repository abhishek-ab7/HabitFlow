'use client';

import React from 'react';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinanceAccount } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function ReconcileModeSelector({
  reconcileMode,
  setReconcileMode,
}: {
  reconcileMode: 'adjustment_tx' | 'silent';
  setReconcileMode: (m: 'adjustment_tx' | 'silent') => void;
}) {
  const btnCls = (active: boolean) =>
    `p-2.5 rounded-xl border text-left text-xs transition-colors ${active ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground'}`;
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground block">How should we adjust this difference?</span>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setReconcileMode('adjustment_tx')} className={btnCls(reconcileMode === 'adjustment_tx')}>
          <p className="font-semibold text-foreground">Log Adjustment Tx</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Creates a clear ledger entry</p>
        </button>
        <button type="button" onClick={() => setReconcileMode('silent')} className={btnCls(reconcileMode === 'silent')}>
          <p className="font-semibold text-foreground">Silent Update</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Updates balance without a tx</p>
        </button>
      </div>
    </div>
  );
}

function ReconcileVarianceNotice({ variance }: { variance: number }) {
  if (Math.abs(variance) < 0.01) return null;
  const colorCls = variance > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  return (
    <p className={`text-xs font-mono tabular-nums font-semibold ${colorCls}`}>
      Variance: {variance > 0 ? '+' : '-'}{formatINR(Math.abs(variance))}
    </p>
  );
}

function ReconcileDialogHeader({ accName, isCard, currentBal }: { accName?: string; isCard: boolean; currentBal: number }) {
  return (
    <DialogHeader>
      <DialogTitle>Reconcile {accName}</DialogTitle>
      <DialogDescription>
        {isCard ? 'Enter the real total outstanding due shown in your card app. Current app due: ' : 'Enter the real balance shown in your bank/wallet app. Current app balance: '}
        <strong className="font-mono text-foreground">{formatINR(currentBal)}</strong>.
      </DialogDescription>
    </DialogHeader>
  );
}

function ReconcileBalanceInput(params: {
  isCard: boolean;
  reconcileTargetStr: string;
  setReconcileTargetStr: (v: string) => void;
  reconcileVariance: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="rec-actual">{params.isCard ? 'Actual Total Outstanding Due (₹)' : 'Actual Bank / App Balance (₹)'}</Label>
      <Input id="rec-actual" type="number" step="0.01" value={params.reconcileTargetStr} onChange={(e) => params.setReconcileTargetStr(e.target.value)} className="h-11 font-mono tabular-nums text-base" required />
      <ReconcileVarianceNotice variance={params.reconcileVariance} />
    </div>
  );
}

export function ReconcileAccountDialog(params: {
  reconcilingAccount: FinanceAccount | null;
  onClose: () => void;
  reconcileTargetStr: string;
  setReconcileTargetStr: (v: string) => void;
  reconcileVariance: number;
  reconcileMode: 'adjustment_tx' | 'silent';
  setReconcileMode: (m: 'adjustment_tx' | 'silent') => void;
  isReconciling: boolean;
  onConfirm: (e: React.FormEvent) => void;
}) {
  const { reconcilingAccount: acc, reconcileVariance, reconcileMode, isReconciling } = params;
  const isCard = acc?.type === 'credit_card';
  const currentBal = isCard ? Math.abs(acc?.balance ?? 0) : acc?.balance ?? 0;
  return (
    <Dialog open={!!acc} onOpenChange={(o) => !o && params.onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <ReconcileDialogHeader accName={acc?.name} isCard={isCard} currentBal={currentBal} />
        <form onSubmit={params.onConfirm} className="space-y-4 py-2">
          <ReconcileBalanceInput
            isCard={isCard}
            reconcileTargetStr={params.reconcileTargetStr}
            setReconcileTargetStr={params.setReconcileTargetStr}
            reconcileVariance={reconcileVariance}
          />
          <ReconcileModeSelector reconcileMode={reconcileMode} setReconcileMode={params.setReconcileMode} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={params.onClose}>Cancel</Button>
            <Button type="submit" disabled={isReconciling}>{isReconciling ? 'Reconciling...' : 'Confirm Balance'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PayCreditCardDialog(params: {
  payingCard: FinanceAccount | null;
  onClose: () => void;
  assetAccounts: FinanceAccount[];
  payCardFromAccId: string;
  setPayCardFromAccId: (v: string) => void;
  payCardAmount: string;
  setPayCardAmount: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={!!params.payingCard} onOpenChange={(o) => !o && params.onClose()}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Pay {params.payingCard?.name} Bill</DialogTitle>
          <DialogDescription>Records an account transfer from your bank/UPI account to settle your card balance.</DialogDescription>
        </DialogHeader>
        <form onSubmit={params.onSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pc-from">Pay From Account</Label>
            <select id="pc-from" value={params.payCardFromAccId} onChange={(e) => params.setPayCardFromAccId(e.target.value)} className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background">
              {params.assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({formatINR(a.balance)})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pc-amt">Payment Amount (₹)</Label>
            <Input id="pc-amt" type="number" min="1" value={params.payCardAmount} onChange={(e) => params.setPayCardAmount(e.target.value)} className="h-11 font-mono tabular-nums" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={params.onClose}>Cancel</Button>
            <Button type="submit">Record Transfer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewCategoryDialog(params: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  newCatName: string;
  setNewCatName: (v: string) => void;
  newCatLimit: string;
  setNewCatLimit: (v: string) => void;
  newCatColor: string;
  setNewCatColor: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={params.open} onOpenChange={params.onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>New Expense Category</DialogTitle>
          <DialogDescription>Create a custom category with an optional monthly budget limit.</DialogDescription>
        </DialogHeader>
        <form onSubmit={params.onSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="nc-name">Category Name</Label>
            <Input id="nc-name" value={params.newCatName} onChange={(e) => params.setNewCatName(e.target.value)} placeholder="e.g., Pet Care, Side Hustle, Hobbies" className="h-11" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-limit">Monthly Limit (₹)</Label>
              <Input id="nc-limit" type="number" min="0" value={params.newCatLimit} onChange={(e) => params.setNewCatLimit(e.target.value)} className="h-11 font-mono tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-color">Accent Color</Label>
              <Input id="nc-color" type="color" value={params.newCatColor} onChange={(e) => params.setNewCatColor(e.target.value)} className="h-11 p-1 cursor-pointer" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => params.onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Create Category</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResetFinanceDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Reset All Finance Data to ₹0?</DialogTitle>
          <DialogDescription>
            This clears all logged transactions and resets account balances to ₹0. Export a CSV backup first if you want to keep a copy.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>Reset Everything</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
