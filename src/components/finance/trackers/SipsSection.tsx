'use client';

import React, { useMemo, useState } from 'react';
import { Plus, TrendingUp, CheckCircle2, Trash2, Edit3 } from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { FinanceSipPlan, SipAssetClass } from '@/lib/types';
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
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { useFeedback } from '@/hooks/use-feedback';
import { toast } from 'sonner';

const ASSET_CLASS_LABELS: Record<SipAssetClass, string> = {
  equity_mf: 'Equity MF',
  debt_mf: 'Debt MF',
  stocks: 'Stocks',
  gold: 'Gold / SGB',
  fd_rd: 'FD / RD',
  crypto: 'Crypto',
  other: 'Other',
};

function PortfolioSummaryStrip({ totals }: { totals: { monthlyTarget: number; totalInvested: number; totalCurrent: number; gain: number; gainPct: number } }) {
  const gainTone = totals.gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div>
        <span className="text-xs text-muted-foreground block">Monthly SIP Target</span>
        <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-foreground">{formatINR(totals.monthlyTarget)}</span>
      </div>
      <div>
        <span className="text-xs text-muted-foreground block">Total Invested</span>
        <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-foreground">{formatINR(totals.totalInvested)}</span>
      </div>
      <div>
        <span className="text-xs text-muted-foreground block">Current Corpus</span>
        <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400">{formatINR(totals.totalCurrent)}</span>
      </div>
      <div>
        <span className="text-xs text-muted-foreground block">Est. Gains</span>
        <span className={`text-base sm:text-lg font-bold font-mono tabular-nums ${gainTone}`}>
          {totals.gain >= 0 ? '+' : ''}{formatINR(totals.gain)}
          {totals.totalInvested > 0 ? ` (${totals.gainPct}%)` : ''}
        </span>
      </div>
    </div>
  );
}

function SipPlanCard(props: {
  sip: FinanceSipPlan;
  selectedMonth: string;
  isInvestedThisMonth: boolean;
  onLogPayment: (sip: FinanceSipPlan) => Promise<void>;
  onOpenValueModal: (sip: FinanceSipPlan, currentVal: number) => void;
  onDelete: (sip: FinanceSipPlan) => Promise<void>;
}) {
  const { sip, selectedMonth, isInvestedThisMonth, onLogPayment, onOpenValueModal, onDelete } = props;
  const currentVal = Math.max(sip.currentValue || 0, sip.totalInvested || 0);
  const gain = currentVal - (sip.totalInvested || 0);
  const gainTone = gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{sip.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {ASSET_CLASS_LABELS[sip.assetClass]}{sip.platform ? ` · ${sip.platform}` : ''} · Day {sip.sipDayOfMonth}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold font-mono tabular-nums text-foreground">{formatINR(sip.monthlyAmount)}</p>
          <p className="text-[11px] text-muted-foreground">/ month</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs">
        <div>
          <span className="text-muted-foreground block">Invested</span>
          <span className="font-bold font-mono tabular-nums text-foreground">{formatINR(sip.totalInvested || 0)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Value</span>
          <span className="font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400">{formatINR(currentVal)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Gain</span>
          <span className={`font-bold font-mono tabular-nums ${gainTone}`}>{gain >= 0 ? '+' : ''}{formatINR(gain)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        {isInvestedThisMonth ? (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Invested ({selectedMonth})
          </span>
        ) : (
          <Button type="button" size="sm" onClick={() => void onLogPayment(sip)} className="min-h-[36px] px-3 text-xs rounded-lg">
            Log {formatINR(sip.monthlyAmount)} SIP
          </Button>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenValueModal(sip, currentVal)}
            title="Update current market value"
            aria-label={`Update value for ${sip.name}`}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void onDelete(sip)}
            title="Delete SIP"
            aria-label={`Delete ${sip.name}`}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-muted transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function NewSipPlanDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sipName: string;
  onSipNameChange: (v: string) => void;
  sipPlatform: string;
  onSipPlatformChange: (v: string) => void;
  sipAssetClass: SipAssetClass;
  onSipAssetClassChange: (v: SipAssetClass) => void;
  sipMonthly: string;
  onSipMonthlyChange: (v: string) => void;
  sipDay: string;
  onSipDayChange: (v: string) => void;
  sipInvested: string;
  onSipInvestedChange: (v: string) => void;
  sipCurrentVal: string;
  onSipCurrentValChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>New SIP / Recurring Investment</DialogTitle>
          <DialogDescription>Track monthly wealth building and automatically count corpus toward your Net Worth.</DialogDescription>
        </DialogHeader>
        <form onSubmit={props.onSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sip-name">Fund / Plan Name</Label>
            <Input id="sip-name" value={props.sipName} onChange={(e) => props.onSipNameChange(e.target.value)} placeholder="e.g., Nifty 50 Index Fund" className="h-11" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sip-platform">Platform</Label>
              <Input id="sip-platform" value={props.sipPlatform} onChange={(e) => props.onSipPlatformChange(e.target.value)} placeholder="Groww, Coin, Kuvera" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sip-class">Asset Class</Label>
              <select
                id="sip-class"
                value={props.sipAssetClass}
                onChange={(e) => props.onSipAssetClassChange(e.target.value as SipAssetClass)}
                className="w-full h-11 px-3 text-sm rounded-xl border border-input bg-background"
              >
                {Object.entries(ASSET_CLASS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sip-amt">Monthly SIP (₹)</Label>
              <Input id="sip-amt" type="number" min="100" value={props.sipMonthly} onChange={(e) => props.onSipMonthlyChange(e.target.value)} className="h-11 font-mono tabular-nums" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sip-day">SIP Day (1–31)</Label>
              <Input id="sip-day" type="number" min="1" max="31" value={props.sipDay} onChange={(e) => props.onSipDayChange(e.target.value)} className="h-11 font-mono tabular-nums" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sip-inv">Already Invested (₹)</Label>
              <Input id="sip-inv" type="number" min="0" value={props.sipInvested} onChange={(e) => props.onSipInvestedChange(e.target.value)} className="h-11 font-mono tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sip-val">Current Value (₹)</Label>
              <Input id="sip-val" type="number" min="0" value={props.sipCurrentVal} onChange={(e) => props.onSipCurrentValChange(e.target.value)} className="h-11 font-mono tabular-nums" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save SIP Plan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UpdateSipValueDialog(props: {
  sip: FinanceSipPlan | null;
  updatedValue: string;
  onUpdatedValueChange: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={Boolean(props.sip)} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Update Corpus Value</DialogTitle>
          <DialogDescription>Refresh the latest portfolio value for {props.sip?.name} to keep Net Worth accurate.</DialogDescription>
        </DialogHeader>
        <form onSubmit={props.onSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sip-curr-edit">Current Value (₹)</Label>
            <Input id="sip-curr-edit" type="number" min="0" value={props.updatedValue} onChange={(e) => props.onUpdatedValueChange(e.target.value)} className="h-11 font-mono tabular-nums" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={props.onClose}>Cancel</Button>
            <Button type="submit">Update Value</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function computePortfolioTotals(activeSips: FinanceSipPlan[]) {
  const monthlyTarget = activeSips.reduce((s, p) => s + p.monthlyAmount, 0);
  const totalInvested = activeSips.reduce((s, p) => s + (p.totalInvested || 0), 0);
  const totalCurrent = activeSips.reduce((s, p) => s + Math.max(p.currentValue || 0, p.totalInvested || 0), 0);
  const gain = totalCurrent - totalInvested;
  const gainPct = totalInvested > 0 ? Math.round((gain / totalInvested) * 1000) / 10 : 0;
  return { monthlyTarget, totalInvested, totalCurrent, gain, gainPct };
}

function SipsGridOrEmpty(props: {
  activeSips: FinanceSipPlan[];
  selectedMonth: string;
  transactions: ReturnType<typeof useFinanceStore.getState>['transactions'];
  onAddClick: () => void;
  onLogPayment: (target: FinanceSipPlan) => Promise<void>;
  onOpenValueModal: (target: FinanceSipPlan, currentVal: number) => void;
  onDelete: (target: FinanceSipPlan) => Promise<void>;
}) {
  const { activeSips, selectedMonth, transactions, onAddClick, onLogPayment, onOpenValueModal, onDelete } = props;
  if (activeSips.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center space-y-2.5">
        <p className="text-xs text-muted-foreground">
          No active SIPs yet. Add your Nifty 50, Flexi-Cap, Gold, or RD plans to track compounding and log monthly installs in 1 tap.
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={onAddClick} className="min-h-[40px] px-4 text-xs rounded-xl">
          Add First SIP Plan
        </Button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {activeSips.map((sip) => {
        const isInvestedThisMonth =
          sip.lastInvestedMonthKey === selectedMonth ||
          transactions.some((t) => !t.deletedAt && t.linkedSipId === sip.id && t.monthKey === selectedMonth);
        return (
          <SipPlanCard
            key={sip.id}
            sip={sip}
            selectedMonth={selectedMonth}
            isInvestedThisMonth={isInvestedThisMonth}
            onLogPayment={onLogPayment}
            onOpenValueModal={onOpenValueModal}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}

function isInvalidSipInput(sipName: string, monthly: number): boolean {
  if (!sipName.trim()) return true;
  return isNaN(monthly) || monthly <= 0;
}

function resolveSipDefaultIds(
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts'],
  categories: ReturnType<typeof useFinanceStore.getState>['categories']
) {
  const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
  const investCat = categories.find((c) => c.slug === 'investments-savings') || categories[0];
  return { accountId: defaultAcc?.id, categoryId: investCat?.id };
}

function buildNewSipPayload(params: {
  sipName: string;
  sipPlatform: string;
  sipAssetClass: SipAssetClass;
  monthly: number;
  sipDay: string;
  sipInvested: string;
  sipCurrentVal: string;
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts'];
  categories: ReturnType<typeof useFinanceStore.getState>['categories'];
}) {
  const { sipName, sipPlatform, sipAssetClass, monthly, sipDay, sipInvested, sipCurrentVal, accounts, categories } = params;
  const invested = Math.max(0, parseFloat(sipInvested) || 0);
  const current = Math.max(invested, parseFloat(sipCurrentVal) || invested);
  const { accountId, categoryId } = resolveSipDefaultIds(accounts, categories);

  return {
    name: sipName.trim(),
    platform: sipPlatform.trim() || undefined,
    assetClass: sipAssetClass,
    monthlyAmount: monthly,
    sipDayOfMonth: Math.min(31, Math.max(1, parseInt(sipDay, 10) || 5)),
    startDate: getLocalIsoDate(),
    totalInvested: invested,
    currentValue: current,
    expectedReturnAnnual: sipAssetClass === 'equity_mf' ? 12 : 8,
    accountId,
    categoryId,
    isActive: true,
    color: '#8b5cf6',
  };
}

export function SipsSection() {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const sipPlans = useFinanceStore((s) => s.sipPlans);
  const transactions = useFinanceStore((s) => s.transactions);
  const accounts = useFinanceStore((s) => s.accounts);
  const categories = useFinanceStore((s) => s.categories);
  const addSipPlan = useFinanceStore((s) => s.addSipPlan);
  const updateSipPlan = useFinanceStore((s) => s.updateSipPlan);
  const payMonthlySip = useFinanceStore((s) => s.payMonthlySip);
  const deleteSipPlan = useFinanceStore((s) => s.deleteSipPlan);

  const activeSips = useMemo(() => sipPlans.filter((s) => s.isActive && !s.deletedAt), [sipPlans]);
  const totals = useMemo(() => computePortfolioTotals(activeSips), [activeSips]);

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [sipName, setSipName] = useState('');
  const [sipPlatform, setSipPlatform] = useState('Groww');
  const [sipAssetClass, setSipAssetClass] = useState<SipAssetClass>('equity_mf');
  const [sipMonthly, setSipMonthly] = useState('5000');
  const [sipDay, setSipDay] = useState('5');
  const [sipInvested, setSipInvested] = useState('0');
  const [sipCurrentVal, setSipCurrentVal] = useState('0');
  const [valueModalSip, setValueModalSip] = useState<FinanceSipPlan | null>(null);
  const [updatedValue, setUpdatedValue] = useState('');
  const feedback = useFeedback();

  const handleCreateSip = async (e: React.FormEvent) => {
    e.preventDefault();
    const monthly = parseFloat(sipMonthly);
    if (isInvalidSipInput(sipName, monthly)) {
      toast.error('Enter SIP name and valid monthly amount');
      return;
    }

    await addSipPlan(
      buildNewSipPayload({
        sipName,
        sipPlatform,
        sipAssetClass,
        monthly,
        sipDay,
        sipInvested,
        sipCurrentVal,
        accounts,
        categories,
      })
    );

    toast.success(`Added SIP plan: ${sipName.trim()}`);
    setIsNewOpen(false);
    setSipName('');
    setSipMonthly('5000');
    setSipInvested('0');
    setSipCurrentVal('0');
  };

  const handleUpdateCurrentValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valueModalSip) return;
    const val = parseFloat(updatedValue);
    if (isNaN(val) || val < 0) {
      toast.error('Enter a valid portfolio value');
      return;
    }
    await updateSipPlan(valueModalSip.id, { currentValue: val });
    toast.success(`Updated value for ${valueModalSip.name}`);
    setValueModalSip(null);
    setUpdatedValue('');
  };

  return (
    <section className="space-y-4">
      <PortfolioSummaryStrip totals={totals} />

      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-foreground">SIPs &amp; Wealth Plans</h2>
          <p className="text-xs text-muted-foreground">Track mutual funds, index SIPs, gold, and recurring investments in Net Worth</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setIsNewOpen(true)} className="min-h-[40px] px-3.5 gap-1.5 text-xs rounded-xl whitespace-nowrap">
          <Plus className="w-4 h-4" />
          Add SIP
        </Button>
      </div>

      <SipsGridOrEmpty
        activeSips={activeSips}
        selectedMonth={selectedMonth}
        transactions={transactions}
        onAddClick={() => setIsNewOpen(true)}
        onLogPayment={async (target) => {
          feedback.coin();
          const tx = await payMonthlySip(target.id);
          if (tx) toast.success(`Logged ${formatINR(target.monthlyAmount)} SIP for ${target.name}`);
        }}
        onOpenValueModal={(target, currentVal) => {
          setValueModalSip(target);
          setUpdatedValue(String(currentVal));
        }}
        onDelete={async (target) => {
          feedback.warning();
          await deleteSipPlan(target.id);
          toast.success(`Removed ${target.name}`);
        }}
      />

      <NewSipPlanDialog
        open={isNewOpen}
        onOpenChange={setIsNewOpen}
        sipName={sipName}
        onSipNameChange={setSipName}
        sipPlatform={sipPlatform}
        onSipPlatformChange={setSipPlatform}
        sipAssetClass={sipAssetClass}
        onSipAssetClassChange={setSipAssetClass}
        sipMonthly={sipMonthly}
        onSipMonthlyChange={setSipMonthly}
        sipDay={sipDay}
        onSipDayChange={setSipDay}
        sipInvested={sipInvested}
        onSipInvestedChange={setSipInvested}
        sipCurrentVal={sipCurrentVal}
        onSipCurrentValChange={setSipCurrentVal}
        onSubmit={handleCreateSip}
      />

      <UpdateSipValueDialog
        sip={valueModalSip}
        updatedValue={updatedValue}
        onUpdatedValueChange={setUpdatedValue}
        onClose={() => setValueModalSip(null)}
        onSubmit={handleUpdateCurrentValue}
      />
    </section>
  );
}
