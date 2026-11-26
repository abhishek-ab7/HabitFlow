'use client';

import React from 'react';
import type { FinanceAccount, FinanceAccountType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatShortDate, getActiveUnbilledCycle, getCycleWindowForMonth, getLocalIsoDate, parseIsoDate } from '@/lib/finance/credit-card-cycles';

function CreditCardCyclePreview({ form }: { form: AccountFormDialogProps }) {
  const bDay = Math.min(31, Math.max(1, parseInt(form.accBillingDay, 10) || 1));
  const dDay = Math.min(31, Math.max(1, parseInt(form.accDueDay, 10) || 15));
  const todayStr = getLocalIsoDate();
  const unbilledWin = getActiveUnbilledCycle(bDay, dDay, todayStr);
  const { year: uY, month: uM } = parseIsoDate(unbilledWin.periodEnd);
  const lastBilledWin = getCycleWindowForMonth(bDay, dDay, uY, uM - 2);
  const hasLastBilled = lastBilledWin.periodEnd <= todayStr;

  return (
    <div className="col-span-3 text-[11px] text-primary bg-primary/10 border border-primary/20 p-2.5 rounded-xl space-y-1">
      {hasLastBilled && (
        <div className="flex items-center justify-between text-muted-foreground flex-wrap gap-1">
          <span>Latest bill generated:</span>
          <span className="font-semibold text-foreground">
            {formatShortDate(lastBilledWin.periodEnd)} (Due{' '}
            <strong className="text-amber-600 dark:text-amber-400 font-semibold">{formatShortDate(lastBilledWin.dueDate)}</strong>)
          </span>
        </div>
      )}
      <div className="flex items-center justify-between text-muted-foreground flex-wrap gap-1">
        <span>Next bill generates:</span>
        <span className="font-semibold text-foreground">
          {formatShortDate(unbilledWin.periodEnd)} (Due {formatShortDate(unbilledWin.dueDate)})
        </span>
      </div>
    </div>
  );
}

function CreditCardFieldsSection({ form }: { form: AccountFormDialogProps }) {
  const idPrefix = form.mode === 'edit' ? 'ea' : 'na';
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-limit`} className="text-xs">Limit (₹)</Label>
        <Input id={`${idPrefix}-limit`} type="number" min="1000" value={form.accCreditLimit} onChange={(e) => form.setAccCreditLimit(e.target.value)} className="h-10 font-mono tabular-nums text-xs" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-cycle`} className="text-xs">Close Day</Label>
        <Input id={`${idPrefix}-cycle`} type="number" min="1" max="31" value={form.accBillingDay} onChange={(e) => form.setAccBillingDay(e.target.value)} className="h-10 font-mono tabular-nums text-xs" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-due`} className="text-xs">Due Day</Label>
        <Input id={`${idPrefix}-due`} type="number" min="1" max="31" value={form.accDueDay} onChange={(e) => form.setAccDueDay(e.target.value)} className="h-10 font-mono tabular-nums text-xs" />
      </div>
      <CreditCardCyclePreview form={form} />
    </div>
  );
}

export interface AccountFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAccount: FinanceAccount | null;
  canDelete: boolean;
  onDelete: (id: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  accName: string;
  setAccName: React.Dispatch<React.SetStateAction<string>>;
  accType: FinanceAccountType;
  setAccType: React.Dispatch<React.SetStateAction<FinanceAccountType>>;
  accBalance: string;
  setAccBalance: React.Dispatch<React.SetStateAction<string>>;
  accCreditLimit: string;
  setAccCreditLimit: React.Dispatch<React.SetStateAction<string>>;
  accBillingDay: string;
  setAccBillingDay: React.Dispatch<React.SetStateAction<string>>;
  accDueDay: string;
  setAccDueDay: React.Dispatch<React.SetStateAction<string>>;
  accIsDefault: boolean;
  setAccIsDefault: React.Dispatch<React.SetStateAction<boolean>>;
}

function AccountTypeAndBalanceRow({ isEdit, form }: { isEdit: boolean; form: AccountFormDialogProps }) {
  const idPrefix = isEdit ? 'ea' : 'na';
  const isCard = form.accType === 'credit_card';
  const balanceLabel = isEdit
    ? (isCard ? 'Current Dues (₹)' : 'Balance (₹)')
    : (isCard ? 'Outstanding Due (₹)' : 'Opening Balance (₹)');
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-type`}>Type</Label>
        <select
          id={`${idPrefix}-type`}
          value={form.accType}
          onChange={(e) => form.setAccType(e.target.value as FinanceAccountType)}
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
        <Label htmlFor={`${idPrefix}-bal`}>{balanceLabel}</Label>
        <Input id={`${idPrefix}-bal`} type="number" step="0.01" value={form.accBalance} onChange={(e) => form.setAccBalance(e.target.value)} className="h-11 font-mono tabular-nums" required={isEdit} />
      </div>
    </div>
  );
}

function AccountFormFooter({ isEdit, form }: { isEdit: boolean; form: AccountFormDialogProps }) {
  return (
    <DialogFooter className={isEdit ? 'flex items-center justify-between gap-2' : undefined}>
      {isEdit && form.canDelete && form.editingAccount && (
        <Button type="button" variant="ghost" onClick={() => form.onDelete(form.editingAccount!.id)} className="text-rose-500 hover:text-rose-600 mr-auto">
          Delete
        </Button>
      )}
      <Button type="button" variant="outline" onClick={() => form.onOpenChange(false)}>Cancel</Button>
      <Button type="submit">{isEdit ? 'Save Account' : 'Add Account'}</Button>
    </DialogFooter>
  );
}

export function AccountFormDialog(props: AccountFormDialogProps) {
  const isEdit = props.mode === 'edit';
  const idPrefix = isEdit ? 'ea' : 'na';

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Account' : 'Add Account or Credit Card'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update balance, account type, or credit card cycle details.'
              : 'Track bank accounts, UPI apps, investments, or credit card liabilities.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={props.onSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-name`}>Account Name</Label>
            <Input
              id={`${idPrefix}-name`}
              value={props.accName}
              onChange={(e) => props.setAccName(e.target.value)}
              placeholder={isEdit ? undefined : 'e.g., HDFC Bank, ICICI Sapphiro Card, Zerodha'}
              className="h-11"
              required
            />
          </div>
          <AccountTypeAndBalanceRow isEdit={isEdit} form={props} />
          {props.accType === 'credit_card' && <CreditCardFieldsSection form={props} />}
          <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
            <input type="checkbox" checked={props.accIsDefault} onChange={(e) => props.setAccIsDefault(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
            <span className="text-xs font-medium text-foreground">
              {isEdit ? 'Use as default payment method (Paid via)' : 'Set as default payment method (Paid via)'}
            </span>
          </label>
          <AccountFormFooter isEdit={isEdit} form={props} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
