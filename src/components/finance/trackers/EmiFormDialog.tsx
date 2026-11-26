'use client';

import React from 'react';
import type { EmiStatus, EmiTracker, FinanceAccount } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface EmiFormState {
  loanName: string;
  lenderName: string;
  principal: string;
  apr: string;
  emiAmt: string;
  tenure: string;
  paidMonths: string;
  billingDay: string;
  emiAccountId: string;
  emiStatus: EmiStatus;
  emiNotes: string;
}

export function EmiFormDialog(params: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEmi: EmiTracker | null;
  form: EmiFormState;
  setForm: React.Dispatch<React.SetStateAction<EmiFormState>>;
  accounts: FinanceAccount[];
  onSubmit: (e: React.FormEvent) => void;
}) {
  const { open, onOpenChange, editingEmi, form, setForm, accounts, onSubmit } = params;
  const setField = <K extends keyof EmiFormState>(key: K, val: EmiFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{editingEmi ? 'Edit Loan / EMI Tracker' : 'New Loan / EMI Tracker'}</DialogTitle>
          <DialogDescription>
            {editingEmi
              ? 'Update loan terms, paid installments, linked account, or status.'
              : 'Track monthly EMIs and optimize payoff with Avalanche or Snowball projections.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3.5 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emi-name">Loan Name</Label>
              <Input id="emi-name" value={form.loanName} onChange={(e) => setField('loanName', e.target.value)} placeholder="e.g., Bike Loan" className="h-11" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emi-lender">Lender</Label>
              <Input id="emi-lender" value={form.lenderName} onChange={(e) => setField('lenderName', e.target.value)} placeholder="e.g., HDFC Bank" className="h-11" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emi-prin">Principal (₹)</Label>
              <Input id="emi-prin" type="number" min="1" value={form.principal} onChange={(e) => setField('principal', e.target.value)} className="h-11 font-mono tabular-nums" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emi-amt">Monthly EMI (₹)</Label>
              <Input id="emi-amt" type="number" min="1" value={form.emiAmt} onChange={(e) => setField('emiAmt', e.target.value)} className="h-11 font-mono tabular-nums" required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emi-apr">APR (%)</Label>
              <Input id="emi-apr" type="number" step="0.1" min="0" value={form.apr} onChange={(e) => setField('apr', e.target.value)} className="h-11 font-mono tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emi-ten">Tenure (mo)</Label>
              <Input id="emi-ten" type="number" min="1" value={form.tenure} onChange={(e) => setField('tenure', e.target.value)} className="h-11 font-mono tabular-nums" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emi-paid">Paid (mo)</Label>
              <Input id="emi-paid" type="number" min="0" value={form.paidMonths} onChange={(e) => setField('paidMonths', e.target.value)} className="h-11 font-mono tabular-nums" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emi-day">Billing Day (1–31)</Label>
              <Input id="emi-day" type="number" min="1" max="31" value={form.billingDay} onChange={(e) => setField('billingDay', e.target.value)} className="h-11 font-mono tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emi-acc">Payment Account</Label>
              <select id="emi-acc" value={form.emiAccountId} onChange={(e) => setField('emiAccountId', e.target.value)} className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background">
                <option value="">Default account</option>
                {accounts.filter((a) => !a.archived && !a.deletedAt).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          {editingEmi && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="emi-status">Status</Label>
                <select id="emi-status" value={form.emiStatus} onChange={(e) => setField('emiStatus', e.target.value as EmiStatus)} className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background">
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="foreclosed">Foreclosed</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emi-notes">Notes (optional)</Label>
                <Input id="emi-notes" value={form.emiNotes} onChange={(e) => setField('emiNotes', e.target.value)} placeholder="Optional note" className="h-11" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{editingEmi ? 'Update EMI' : 'Save EMI Tracker'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
