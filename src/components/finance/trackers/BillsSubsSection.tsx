'use client';

import React, { useState } from 'react';
import { Plus, Repeat, AlertTriangle, Trash2 } from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { FinanceRecurringBill } from '@/lib/types';
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
import { SubscriptionAuditBanner } from './SubscriptionAuditBanner';
import { useFeedback } from '@/hooks/use-feedback';
import { toast } from 'sonner';

function RecurringBillCard(props: {
  bill: FinanceRecurringBill;
  isPaid: boolean;
  onMarkPaid: (bill: FinanceRecurringBill) => Promise<void>;
  onDelete: (billId: string) => Promise<void>;
}) {
  const { bill, isPaid, onMarkPaid, onDelete } = props;
  const hasPriceHike = Boolean(bill.previousAmount && bill.amount > bill.previousAmount);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-10 h-10 rounded-xl bg-cyan-500/12 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
          <Repeat className="w-5 h-5" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-foreground truncate">{bill.name}</p>
            {hasPriceHike && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 inline-flex items-center gap-0.5 shrink-0">
                <AlertTriangle className="w-3 h-3" />+{formatINR(bill.amount - (bill.previousAmount || 0))}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono tabular-nums capitalize">
            Day {bill.dueDayOfMonth} · {formatINR(bill.amount)} · {bill.cadence}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isPaid ? (
          <Button type="button" size="sm" onClick={() => void onMarkPaid(bill)} className="h-8 px-3 text-xs rounded-lg">
            Mark Paid
          </Button>
        ) : (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Paid</span>
        )}
        <button type="button" onClick={() => void onDelete(bill.id)} className="text-muted-foreground hover:text-rose-500 p-1.5" aria-label="Delete recurring bill">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function NewRecurringBillDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billName: string;
  onBillNameChange: (v: string) => void;
  billAmount: string;
  onBillAmountChange: (v: string) => void;
  billPrevAmount: string;
  onBillPrevAmountChange: (v: string) => void;
  billCadence: 'monthly' | 'quarterly' | 'yearly';
  onBillCadenceChange: (v: 'monthly' | 'quarterly' | 'yearly') => void;
  billDueDay: string;
  onBillDueDayChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>New Recurring Bill / Subscription</DialogTitle>
          <DialogDescription>Reserve recurring bills in your Safe-to-Spend formula and spot price hikes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={props.onSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Bill or Subscription Name</Label>
            <Input id="b-name" value={props.billName} onChange={(e) => props.onBillNameChange(e.target.value)} placeholder="e.g., Airtel Fiber, Electricity, Netflix" className="h-11" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-amt">Amount (₹)</Label>
              <Input id="b-amt" type="number" min="1" value={props.billAmount} onChange={(e) => props.onBillAmountChange(e.target.value)} className="h-11 font-mono tabular-nums" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-prev">Old Price (₹, optional)</Label>
              <Input id="b-prev" type="number" min="0" value={props.billPrevAmount} onChange={(e) => props.onBillPrevAmountChange(e.target.value)} placeholder="Optional" className="h-11 font-mono tabular-nums" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-cad">Cadence</Label>
              <select
                id="b-cad"
                value={props.billCadence}
                onChange={(e) => props.onBillCadenceChange(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
                className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-day">Due Day (1–31)</Label>
              <Input id="b-day" type="number" min="1" max="31" value={props.billDueDay} onChange={(e) => props.onBillDueDayChange(e.target.value)} className="h-11 font-mono tabular-nums" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save Bill</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BillsSubsSection() {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const recurringBills = useFinanceStore((s) => s.recurringBills);
  const addRecurringBill = useFinanceStore((s) => s.addRecurringBill);
  const updateRecurringBill = useFinanceStore((s) => s.updateRecurringBill);
  const payRecurringBill = useFinanceStore((s) => s.payRecurringBill);
  const deleteRecurringBill = useFinanceStore((s) => s.deleteRecurringBill);

  const [isNewBillOpen, setIsNewBillOpen] = useState(false);
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billPrevAmount, setBillPrevAmount] = useState('');
  const [billCadence, setBillCadence] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [billDueDay, setBillDueDay] = useState('10');
  const feedback = useFeedback();

  const activeBills = recurringBills.filter((b) => b.isActive && !b.deletedAt);

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(billAmount);
    const hasInvalidAmt = isNaN(amt) || amt <= 0;
    if (!billName.trim() || hasInvalidAmt) {
      feedback.error();
      toast.error('Enter bill name and amount');
      return;
    }
    feedback.success();
    const utilCat = categories.find((c) => c.slug === 'bills-utilities') || categories[0];
    const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
    await addRecurringBill({
      name: billName.trim(),
      amount: amt,
      previousAmount: parseFloat(billPrevAmount) || undefined,
      cadence: billCadence,
      dueDayOfMonth: Math.min(31, Math.max(1, parseInt(billDueDay, 10) || 10)),
      categoryId: utilCat?.id || '',
      accountId: defaultAcc?.id,
      autoLog: false,
      isActive: true,
      color: '#06b6d4',
      icon: 'Zap',
    });
    toast.success(`Added ${billName.trim()} bill`);
    setIsNewBillOpen(false);
    setBillName('');
    setBillAmount('');
    setBillPrevAmount('');
  };

  const handlePauseBill = async (bill: FinanceRecurringBill) => {
    await updateRecurringBill(bill.id, { isActive: false });
    toast.success(`Paused ${bill.name}`);
  };

  return (
    <section className="space-y-4">
      <SubscriptionAuditBanner bills={activeBills} onPauseBill={handlePauseBill} />

      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-foreground">Recurring Bills &amp; Subscriptions</h2>
          <p className="text-xs text-muted-foreground">Utilities, rent, Wi-Fi, and streaming with price-hike alerts</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setIsNewBillOpen(true)} className="min-h-[40px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap">
          <Plus className="w-4 h-4" />
          Add Bill
        </Button>
      </div>

      {activeBills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center space-y-2.5">
          <p className="text-xs text-muted-foreground">No recurring bills or subscriptions added yet.</p>
          <Button type="button" size="sm" variant="secondary" onClick={() => setIsNewBillOpen(true)} className="min-h-[40px] px-4 text-xs rounded-xl">
            Add Recurring Bill
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeBills.map((bill) => (
            <RecurringBillCard
              key={bill.id}
              bill={bill}
              isPaid={bill.lastPaidMonthKey === selectedMonth}
              onMarkPaid={async (target) => {
                feedback.coin();
                const tx = await payRecurringBill(target.id);
                if (tx) toast.success(`Paid ${target.name}`);
              }}
              onDelete={async (id) => {
                feedback.warning();
                await deleteRecurringBill(id);
                toast.success('Removed recurring bill');
              }}
            />
          ))}
        </div>
      )}

      <NewRecurringBillDialog
        open={isNewBillOpen}
        onOpenChange={setIsNewBillOpen}
        billName={billName}
        onBillNameChange={setBillName}
        billAmount={billAmount}
        onBillAmountChange={setBillAmount}
        billPrevAmount={billPrevAmount}
        onBillPrevAmountChange={setBillPrevAmount}
        billCadence={billCadence}
        onBillCadenceChange={setBillCadence}
        billDueDay={billDueDay}
        onBillDueDayChange={setBillDueDay}
        onSubmit={handleCreateBill}
      />
    </section>
  );
}
