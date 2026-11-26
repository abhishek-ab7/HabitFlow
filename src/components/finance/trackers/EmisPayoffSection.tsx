'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, Landmark, Pencil, Plus, Trash2 } from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { EmiTracker } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { useFeedback } from '@/hooks/use-feedback';
import { toast } from 'sonner';
import { buildDebtPayoffItems, runPayoffSimulation } from './debt-payoff-sim';
import { DebtPayoffAcceleratorCard } from './DebtPayoffAcceleratorCard';
import { EmiFormDialog, type EmiFormState } from './EmiFormDialog';

const INITIAL_EMI_FORM: EmiFormState = {
  loanName: '', lenderName: '', principal: '', apr: '11', emiAmt: '', tenure: '24',
  paidMonths: '0', billingDay: '5', emiAccountId: '', emiStatus: 'active', emiNotes: '',
};

function isPositiveNum(val: number): boolean {
  return !Number.isNaN(val) && val > 0;
}

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const parsed = parseInt(raw, 10);
  return Math.min(max, Math.max(min, Number.isNaN(parsed) ? fallback : parsed));
}

function parseEmiFormPayload(form: EmiFormState) {
  const principal = parseFloat(form.principal);
  const emiAmount = parseFloat(form.emiAmt);
  const tenureMonths = parseInt(form.tenure, 10);
  if (!form.loanName.trim() || !isPositiveNum(principal)) return null;
  if (!isPositiveNum(emiAmount) || !isPositiveNum(tenureMonths)) return null;

  return {
    loanName: form.loanName.trim(),
    lenderName: form.lenderName.trim() || 'Bank / NBFC',
    principalAmount: principal,
    interestRateAnnual: Math.max(0, parseFloat(form.apr) || 0),
    emiAmount,
    tenureMonths,
    paidMonths: clampInt(form.paidMonths, 0, tenureMonths, 0),
    billingDayOfMonth: clampInt(form.billingDay, 1, 31, 5),
    notes: form.emiNotes.trim() || undefined,
  };
}

function EmiTrackerCard(params: {
  emi: EmiTracker;
  selectedMonth: string;
  isPaidThisMonth: boolean;
  onPay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { emi, selectedMonth, isPaidThisMonth, onPay, onEdit, onDelete } = params;
  const pct = emi.tenureMonths > 0 ? Math.min(100, Math.round((emi.paidMonths / emi.tenureMonths) * 100)) : 0;
  const remainingMonths = Math.max(0, emi.tenureMonths - emi.paidMonths);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{emi.loanName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {emi.lenderName} · {emi.interestRateAnnual}% APR · Day {emi.billingDayOfMonth}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold font-mono tabular-nums text-foreground">{formatINR(emi.emiAmount)}</p>
          <p className="text-[11px] text-muted-foreground font-mono">{emi.paidMonths}/{emi.tenureMonths} mo</p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div style={{ width: `${pct}%` }} className="h-full bg-primary transition-all duration-300" />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>Principal {formatINR(emi.principalAmount)}</span>
          <span>{remainingMonths} EMIs left</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        {emi.status === 'completed' || remainingMonths === 0 ? (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Loan Completed
          </span>
        ) : isPaidThisMonth ? (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Paid for {selectedMonth}
          </span>
        ) : (
          <Button type="button" size="sm" onClick={onPay} className="min-h-[36px] px-3 text-xs rounded-lg">
            Pay {formatINR(emi.emiAmount)} EMI
          </Button>
        )}

        <div className="flex items-center gap-1">
          <button type="button" onClick={onEdit} aria-label={`Edit ${emi.loanName}`} title={`Edit ${emi.loanName}`} className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onDelete} aria-label={`Delete ${emi.loanName}`} title={`Delete ${emi.loanName}`} className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-muted transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmisPayoffSection() {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const emiTrackers = useFinanceStore((s) => s.emiTrackers);
  const accounts = useFinanceStore((s) => s.accounts);
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const addEmiTracker = useFinanceStore((s) => s.addEmiTracker);
  const updateEmiTracker = useFinanceStore((s) => s.updateEmiTracker);
  const payMonthlyEmi = useFinanceStore((s) => s.payMonthlyEmi);
  const deleteEmiTracker = useFinanceStore((s) => s.deleteEmiTracker);

  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [extraPayment, setExtraPayment] = useState<number>(3000);
  const feedback = useFeedback();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingEmi, setEditingEmi] = useState<EmiTracker | null>(null);
  const [form, setForm] = useState<EmiFormState>(INITIAL_EMI_FORM);

  const activeEmis = useMemo(() => emiTrackers.filter((e) => !e.deletedAt), [emiTrackers]);
  const payoffItems = useMemo(() => buildDebtPayoffItems(activeEmis, accounts, debtRecords), [activeEmis, accounts, debtRecords]);
  const simulation = useMemo(() => runPayoffSimulation(payoffItems, extraPayment, strategy), [payoffItems, extraPayment, strategy]);

  const openNewEmiDialog = () => {
    const defaultAcc = accounts.find((a) => a.isDefault) ?? accounts[0];
    setEditingEmi(null);
    setForm({ ...INITIAL_EMI_FORM, emiAccountId: defaultAcc?.id ?? '' });
    setIsNewOpen(true);
  };

  const openEditEmiDialog = (emi: EmiTracker) => {
    setEditingEmi(emi);
    setForm({
      loanName: emi.loanName,
      lenderName: emi.lenderName,
      principal: String(emi.principalAmount),
      apr: String(emi.interestRateAnnual),
      emiAmt: String(emi.emiAmount),
      tenure: String(emi.tenureMonths),
      paidMonths: String(emi.paidMonths),
      billingDay: String(emi.billingDayOfMonth),
      emiAccountId: emi.accountId ?? '',
      emiStatus: emi.status,
      emiNotes: emi.notes ?? '',
    });
    setIsNewOpen(true);
  };

  const handleSaveEmi = async (e: React.FormEvent) => {
    e.preventDefault();
    const common = parseEmiFormPayload(form);
    if (!common) {
      toast.error('Please fill loan name, principal, EMI amount, and tenure');
      return;
    }

    if (editingEmi) {
      await updateEmiTracker(editingEmi.id, { ...common, accountId: form.emiAccountId || undefined, status: form.emiStatus });
      toast.success(`Updated EMI tracker: ${common.loanName}`);
    } else {
      const defaultAcc = accounts.find((a) => a.isDefault) ?? accounts[0];
      const emiCat = categories.find((c) => c.slug === 'emis-debt-repayment') ?? categories[0];
      await addEmiTracker({
        ...common,
        startDate: getLocalIsoDate(),
        categoryId: emiCat?.id ?? '',
        accountId: form.emiAccountId || defaultAcc?.id,
        autoCreateTaskReminder: false,
        status: common.paidMonths >= common.tenureMonths ? 'completed' : 'active',
      });
      toast.success(`Added EMI tracker: ${common.loanName}`);
    }
    setIsNewOpen(false);
    setEditingEmi(null);
  };

  return (
    <section className="space-y-5">
      {payoffItems.length > 0 && (
        <DebtPayoffAcceleratorCard
          payoffItemsCount={payoffItems.length}
          simulation={simulation}
          strategy={strategy}
          setStrategy={setStrategy}
          extraPayment={extraPayment}
          setExtraPayment={setExtraPayment}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-foreground">Loans &amp; EMIs</h2>
          <p className="text-xs text-muted-foreground">Track tenure progress and reserve monthly EMIs automatically in Safe-to-Spend</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={openNewEmiDialog} className="min-h-[40px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap">
          <Plus className="w-4 h-4" />
          Add EMI
        </Button>
      </div>

      {activeEmis.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center space-y-2.5">
          <p className="text-xs text-muted-foreground">No active loans or EMIs tracked. Add car, education, phone, or personal loans here.</p>
          <Button type="button" size="sm" variant="secondary" onClick={openNewEmiDialog} className="min-h-[40px] px-4 text-xs rounded-xl">
            Add Loan / EMI
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {activeEmis.map((emi) => {
            const isPaidThisMonth =
              emi.lastPaidMonthKey === selectedMonth ||
              transactions.some((t) => !t.deletedAt && t.linkedEmiId === emi.id && t.monthKey === selectedMonth);
            return (
              <EmiTrackerCard
                key={emi.id}
                emi={emi}
                selectedMonth={selectedMonth}
                isPaidThisMonth={isPaidThisMonth}
                onPay={async () => {
                  feedback.coin();
                  if (await payMonthlyEmi(emi.id)) toast.success(`Logged EMI payment for ${emi.loanName}`);
                }}
                onEdit={() => openEditEmiDialog(emi)}
                onDelete={async () => {
                  feedback.warning();
                  await deleteEmiTracker(emi.id);
                  toast.success(`Removed ${emi.loanName}`);
                }}
              />
            );
          })}
        </div>
      )}

      <EmiFormDialog
        open={isNewOpen}
        onOpenChange={(open) => {
          setIsNewOpen(open);
          if (!open) setEditingEmi(null);
        }}
        editingEmi={editingEmi}
        form={form}
        setForm={setForm}
        accounts={accounts}
        onSubmit={handleSaveEmi}
      />
    </section>
  );
}
