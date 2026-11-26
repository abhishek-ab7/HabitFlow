'use client';

import React from 'react';
import { Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/stores/finance-store';
import type { DebtRecord, EmiTracker, FinanceAccount, FinanceSipPlan, FinancialGoalLinkType } from '@/lib/types';
import { FINANCIAL_LINK_OPTIONS } from './goal-form-helpers';

function toggleSelectionId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function SelectableChipGroup(params: {
  label: string;
  items: Array<{ id: string; name: string; amount: number }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  activeClass: string;
  emptyHint: string;
  countLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground block">{params.label}</label>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
        {params.items.map((item) => {
          const isChecked = params.selectedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => params.onToggle(item.id)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs border font-medium transition-all flex items-center gap-1.5',
                isChecked ? params.activeClass : 'bg-background border-border/60 text-muted-foreground hover:bg-muted'
              )}
            >
              <span>{item.name}</span>
              <span className="font-mono text-[10px] opacity-80">{formatINR(item.amount)}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {params.selectedIds.length === 0 ? params.emptyHint : params.countLabel}
      </p>
    </div>
  );
}

function FinancialTypeSelector({
  financialLinkType,
  setFinancialLinkType,
}: {
  financialLinkType: FinancialGoalLinkType;
  setFinancialLinkType: React.Dispatch<React.SetStateAction<FinancialGoalLinkType>>;
}) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Financial Metric Type</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {FINANCIAL_LINK_OPTIONS.map((m) => {
          const Icon = m.icon;
          const isSel = financialLinkType === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setFinancialLinkType(m.id)}
              className={cn(
                'p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all text-xs',
                isSel ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500' : 'border-border/60 bg-background/50 hover:bg-muted text-muted-foreground'
              )}
            >
              <div className="flex items-center gap-1.5 font-semibold text-foreground"><Icon className="h-3.5 w-3.5 text-sky-500" /><span>{m.label}</span></div>
              <span className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{m.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FinancialLinkTargets(params: {
  financialLinkType: FinancialGoalLinkType;
  selectedAccountIds: string[];
  setSelectedAccountIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedDebtIds: string[];
  setSelectedDebtIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedSipIds: string[];
  setSelectedSipIds: React.Dispatch<React.SetStateAction<string[]>>;
  accounts: FinanceAccount[];
  debtRecords: DebtRecord[];
  emiTrackers: EmiTracker[];
  sipPlans: FinanceSipPlan[];
  netWorth: number;
}) {
  const { financialLinkType } = params;
  if (financialLinkType === 'savings_target') {
    const items = params.accounts.filter((a) => a.type !== 'credit_card').map((a) => ({ id: a.id, name: a.name, amount: a.balance }));
    return (
      <SelectableChipGroup
        label="Link Specific Accounts (optional)"
        items={items}
        selectedIds={params.selectedAccountIds}
        onToggle={(id) => params.setSelectedAccountIds((prev) => toggleSelectionId(prev, id))}
        activeClass="bg-sky-500 text-white border-sky-600"
        emptyHint="Tracking all non-credit accounts combined."
        countLabel={`Tracking ${params.selectedAccountIds.length} selected account(s).`}
      />
    );
  }
  if (financialLinkType === 'debt_payoff') {
    const items = [
      ...params.debtRecords.map((d) => ({ id: d.id, name: d.title || d.personName, amount: d.remainingAmount })),
      ...params.emiTrackers.map((e) => ({ id: e.id, name: e.loanName, amount: Math.max(0, (e.tenureMonths - e.paidMonths) * e.emiAmount) })),
    ];
    return (
      <SelectableChipGroup
        label="Link Specific Debts / EMIs (optional)"
        items={items}
        selectedIds={params.selectedDebtIds}
        onToggle={(id) => params.setSelectedDebtIds((prev) => toggleSelectionId(prev, id))}
        activeClass="bg-rose-500 text-white border-rose-600"
        emptyHint="Tracking all active debts & EMIs combined."
        countLabel={`Tracking ${params.selectedDebtIds.length} selected debt item(s).`}
      />
    );
  }
  if (financialLinkType === 'sip_corpus') {
    const items = params.sipPlans.map((s) => ({ id: s.id, name: s.name, amount: s.currentValue || s.totalInvested }));
    return (
      <SelectableChipGroup
        label="Link Specific SIP Portfolios (optional)"
        items={items}
        selectedIds={params.selectedSipIds}
        onToggle={(id) => params.setSelectedSipIds((prev) => toggleSelectionId(prev, id))}
        activeClass="bg-invest text-white border-invest"
        emptyHint="Tracking all active SIP investment portfolios."
        countLabel={`Tracking ${params.selectedSipIds.length} selected SIP(s).`}
      />
    );
  }
  return (
    <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs flex items-center justify-between">
      <span className="text-muted-foreground">Current Live Net Worth:</span>
      <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{formatINR(params.netWorth)}</span>
    </div>
  );
}

export function GoalFinancialLinkSection(params: {
  enabled: boolean;
  setEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  financialLinkType: FinancialGoalLinkType;
  setFinancialLinkType: React.Dispatch<React.SetStateAction<FinancialGoalLinkType>>;
  financialTargetAmount: string;
  setFinancialTargetAmount: React.Dispatch<React.SetStateAction<string>>;
  financialStartingAmount: string;
  setFinancialStartingAmount: React.Dispatch<React.SetStateAction<string>>;
  selectedAccountIds: string[];
  setSelectedAccountIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedDebtIds: string[];
  setSelectedDebtIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedSipIds: string[];
  setSelectedSipIds: React.Dispatch<React.SetStateAction<string[]>>;
  accounts: FinanceAccount[];
  debtRecords: DebtRecord[];
  emiTrackers: EmiTracker[];
  sipPlans: FinanceSipPlan[];
  netWorth: number;
}) {
  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500"><Landmark className="h-4 w-4" /></div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="enable-fin-link" className="text-sm font-semibold text-foreground cursor-pointer">Live Financial Balance Link</label>
              <Badge variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10 text-[10px] px-1.5 py-0 font-medium">Life OS Link</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Automatically sync monetary progress with live bank balances, debt payoff, or SIPs</p>
          </div>
        </div>
        <Checkbox id="enable-fin-link" checked={params.enabled} onCheckedChange={(c) => params.setEnabled(Boolean(c))} />
      </div>

      {params.enabled && (
        <div className="space-y-4 pt-2 border-t border-sky-500/20">
          <FinancialTypeSelector financialLinkType={params.financialLinkType} setFinancialLinkType={params.setFinancialLinkType} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Target Amount (₹) *</label>
              <Input type="number" placeholder="e.g. 100000" value={params.financialTargetAmount} onChange={(e) => params.setFinancialTargetAmount(e.target.value)} className="font-mono text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Starting / Baseline Amount (₹)</label>
              <Input type="number" placeholder="e.g. 10000 (optional)" value={params.financialStartingAmount} onChange={(e) => params.setFinancialStartingAmount(e.target.value)} className="font-mono text-sm" />
            </div>
          </div>
          <FinancialLinkTargets
            financialLinkType={params.financialLinkType}
            selectedAccountIds={params.selectedAccountIds}
            setSelectedAccountIds={params.setSelectedAccountIds}
            selectedDebtIds={params.selectedDebtIds}
            setSelectedDebtIds={params.setSelectedDebtIds}
            selectedSipIds={params.selectedSipIds}
            setSelectedSipIds={params.setSelectedSipIds}
            accounts={params.accounts}
            debtRecords={params.debtRecords}
            emiTrackers={params.emiTrackers}
            sipPlans={params.sipPlans}
            netWorth={params.netWorth}
          />
        </div>
      )}
    </div>
  );
}
