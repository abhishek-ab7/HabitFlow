'use client';

import { Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import { normalizePaydayOfMonth } from '@/lib/finance/payday';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { useMonthlyBudgetController } from './useMonthlyBudgetController';

export function ZeroBasedReadyBanner(props: {
  readyToAssign: number;
  assignableIncomeBase: number;
  categorySum: number;
  plannedSipNum: number;
  fixedObligations: number;
  onAutoAssign: () => void;
}) {
  const { readyToAssign, assignableIncomeBase, categorySum, plannedSipNum, fixedObligations, onAutoAssign } = props;
  const bannerTone =
    readyToAssign === 0
      ? 'border-emerald-500/40 bg-emerald-500/5'
      : readyToAssign < 0
      ? 'border-rose-500/40 bg-rose-500/5'
      : 'border-primary/35 bg-primary/5';
  const amountTone =
    readyToAssign === 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : readyToAssign < 0
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-foreground';

  return (
    <div className={`rounded-2xl border p-4 space-y-2.5 ${bannerTone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ready to Assign</p>
          <p className={`text-2xl font-bold font-mono tabular-nums mt-0.5 ${amountTone}`}>{formatINR(readyToAssign)}</p>
        </div>
        {readyToAssign > 0 ? (
          <Button type="button" size="sm" variant="outline" onClick={onAutoAssign} className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Auto-Assign
          </Button>
        ) : readyToAssign === 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            Every ₹ has a job
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-4 h-4" />
            Over-assigned
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums text-muted-foreground pt-1 border-t border-border/50">
        <span>Income {formatINR(assignableIncomeBase)}</span>
        <span>·</span>
        <span>Envelopes {formatINR(categorySum)}</span>
        <span>·</span>
        <span>SIPs {formatINR(plannedSipNum)}</span>
        <span>·</span>
        <span>Fixed Dues {formatINR(fixedObligations)}</span>
      </div>
    </div>
  );
}

function SalaryLeaveCalculator(props: {
  salaryDivisor: 30 | 26;
  onDivisorChange: (d: 30 | 26) => void;
  baseSalaryInput: string;
  onBaseSalaryChange: (v: string) => void;
  leaveDaysInput: string;
  onLeaveDaysChange: (v: string) => void;
  leaveDaysNum: number;
  leaveCutAmount: number;
  netSalaryAfterLeave: number;
  onApplyNetSalary: () => void;
}) {
  const {
    salaryDivisor,
    onDivisorChange,
    baseSalaryInput,
    onBaseSalaryChange,
    leaveDaysInput,
    onLeaveDaysChange,
    leaveDaysNum,
    leaveCutAmount,
    netSalaryAfterLeave,
    onApplyNetSalary,
  } = props;

  return (
    <div className="rounded-xl border border-border/80 bg-muted/40 p-3 space-y-2.5 text-xs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-semibold text-foreground">Salary Leave / Half-Day Cut Calculator</span>
        <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-[11px]">
          {([30, 26] as const).map((div) => (
            <button
              key={div}
              type="button"
              onClick={() => onDivisorChange(div)}
              className={`px-2 py-0.5 rounded-md font-medium ${salaryDivisor === div ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              {div === 30 ? '÷30 days' : '÷26 work days'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <Label htmlFor="base-salary-calc" className="text-[11px] text-muted-foreground">Full Base Salary (₹)</Label>
          <Input id="base-salary-calc" type="number" min="0" step="1" value={baseSalaryInput} onChange={(e) => onBaseSalaryChange(e.target.value)} className="h-9 font-mono tabular-nums text-xs" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="leave-days-calc" className="text-[11px] text-muted-foreground">Unpaid Leave Days</Label>
          <Input id="leave-days-calc" type="number" min="0" step="0.5" value={leaveDaysInput} onChange={(e) => onLeaveDaysChange(e.target.value)} className="h-9 font-mono tabular-nums text-xs" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {[0.5, 1, 2, 3].map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => onLeaveDaysChange(String(days))}
            className={`px-2 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
              leaveDaysNum === days ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            {days === 0.5 ? 'Half day (0.5)' : `${days}d off`}
          </button>
        ))}
        <button type="button" onClick={() => onLeaveDaysChange('0')} className="px-2 py-1 rounded-lg border border-border bg-background text-[11px] text-muted-foreground hover:text-foreground">
          Reset
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
        <span className="font-mono tabular-nums text-[11px] text-muted-foreground">
          Cut: <strong className="text-rose-500">-{formatINR(leaveCutAmount)}</strong> · Net: <strong className="text-foreground">{formatINR(netSalaryAfterLeave)}</strong>
        </span>
        <Button type="button" size="sm" onClick={onApplyNetSalary} className="h-8 px-3 text-xs rounded-lg">
          Apply {formatINR(netSalaryAfterLeave)}
        </Button>
      </div>
    </div>
  );
}
function CapModeBudgetField(props: {
  overallInput: string;
  onOverallChange: (v: string) => void;
  overallNum: number;
  categorySum: number;
}) {
  const { overallInput, onOverallChange, overallNum, categorySum } = props;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="overall-budget-input" className="text-xs sm:text-sm font-semibold text-foreground">
          Overall Variable Spending Budget (₹)
        </Label>
        {categorySum > 0 && overallNum !== categorySum && (
          <button
            type="button"
            onClick={() => onOverallChange(String(categorySum))}
            className="min-h-[30px] px-2.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 transition-colors whitespace-nowrap"
          >
            Use sum ({formatINR(categorySum)})
          </button>
        )}
      </div>
      <Input
        id="overall-budget-input"
        type="number"
        min="0"
        step="100"
        value={overallInput}
        onChange={(e) => onOverallChange(e.target.value)}
        placeholder={categorySum > 0 ? `Auto: ${categorySum} (sum of categories)` : 'e.g., 35000'}
        className="h-10 font-mono tabular-nums text-sm"
      />
    </div>
  );
}

export function BudgetIncomeSettingsCard({ f }: { f: ReturnType<typeof useMonthlyBudgetController> }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3.5">
      {f.budgetMode === 'cap' && (
        <CapModeBudgetField overallInput={f.overallInput} onOverallChange={f.setOverallInput} overallNum={f.overallNum} categorySum={f.categorySum} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="expected-income-input" className="text-xs font-medium text-muted-foreground">
              {f.budgetMode === 'zero_based' ? 'Monthly Income to Assign (₹)' : 'Expected Monthly Income (₹)'}
            </Label>
            <button
              type="button"
              onClick={() => {
                if (!f.showLeaveHelper && f.expectedIncomeNum > 0) f.setBaseSalaryInput(String(f.expectedIncomeNum));
                f.setShowLeaveHelper((prev) => !prev);
              }}
              className="text-[11px] font-medium text-primary hover:underline whitespace-nowrap"
            >
              {f.showLeaveHelper ? 'Hide leave calc' : 'Half-day / Leave cut?'}
            </button>
          </div>
          <Input id="expected-income-input" type="number" min="0" step="1" value={f.expectedIncomeInput} onChange={(e) => f.setExpectedIncomeInput(e.target.value)} placeholder="e.g., 19000" className="h-10 font-mono tabular-nums text-sm" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="payday-of-month-input" className="text-xs font-medium text-muted-foreground">Salary / Payday Day (1–31)</Label>
          <Input
            id="payday-of-month-input"
            type="number"
            min="1"
            max="31"
            step="1"
            value={f.paydayInput}
            onChange={(e) => f.setPaydayInput(e.target.value)}
            onBlur={() => f.setPaydayInput(String(normalizePaydayOfMonth(parseInt(f.paydayInput, 10)) ?? 1))}
            placeholder="e.g., 7"
            className="h-10 font-mono tabular-nums text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="planned-sip-input" className="text-xs font-medium text-muted-foreground">Target Monthly SIP / Savings (₹)</Label>
        <Input id="planned-sip-input" type="number" min="0" step="500" value={f.plannedSipInput} onChange={(e) => f.setPlannedSipInput(e.target.value)} placeholder="e.g., 15000" className="h-10 font-mono tabular-nums text-sm" />
      </div>

      {f.showLeaveHelper && (
        <SalaryLeaveCalculator
          salaryDivisor={f.salaryDivisor}
          onDivisorChange={f.setSalaryDivisor}
          baseSalaryInput={f.baseSalaryInput}
          onBaseSalaryChange={f.setBaseSalaryInput}
          leaveDaysInput={f.leaveDaysInput}
          onLeaveDaysChange={f.setLeaveDaysInput}
          leaveDaysNum={f.leaveDaysNum}
          leaveCutAmount={f.leaveCutAmount}
          netSalaryAfterLeave={f.netSalaryAfterLeave}
          onApplyNetSalary={() => {
            f.setExpectedIncomeInput(String(f.netSalaryAfterLeave));
            f.setShowLeaveHelper(false);
            toast.success(`Updated month income to ${formatINR(f.netSalaryAfterLeave)}`);
          }}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Allocated across categories: <span className="font-mono tabular-nums font-semibold text-foreground">{formatINR(f.categorySum)}</span>
      </p>
    </div>
  );
}
