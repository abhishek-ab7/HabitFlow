'use client';

import React from 'react';
import { CheckSquare, Dumbbell, Moon, Pill, Utensils, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FinanceAccount } from '@/lib/types';
import type {
  UniversalBioAction,
  UniversalCaptureAction,
  UniversalExpenseAction,
  UniversalMealAction,
} from './capture-types';

type UpdateActionFn = <T extends UniversalCaptureAction>(id: string, updater: (prev: T) => T) => void;

function ExpenseActionFields(params: {
  action: UniversalExpenseAction;
  accounts: FinanceAccount[];
  updateAction: UpdateActionFn;
}) {
  const { action, accounts, updateAction } = params;
  const activeAccounts = accounts.filter((a) => !a.archived && !a.deletedAt);
  return (
    <div className="flex flex-wrap items-center gap-1.5 flex-1">
      <Wallet className="h-3.5 w-3.5 text-rose-500 shrink-0" />
      <span className="text-xs font-semibold">Expense</span>
      <Input
        value={action.title}
        onChange={(e) => updateAction<UniversalExpenseAction>(action.id, (p) => ({ ...p, title: e.target.value }))}
        className="h-7 w-28 text-xs px-2"
      />
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">₹</span>
        <Input
          type="number"
          value={action.amount}
          onChange={(e) => updateAction<UniversalExpenseAction>(action.id, (p) => ({ ...p, amount: Math.max(0, Number(e.target.value) || 0) }))}
          className="h-7 w-20 text-xs px-2"
        />
      </div>
      {accounts.length > 0 && (
        <select
          value={action.accountId || ''}
          onChange={(e) => {
            const nextId = e.target.value;
            updateAction<UniversalExpenseAction>(action.id, (p) => ({
              ...p, accountId: nextId, accountName: accounts.find((a) => a.id === nextId)?.name || p.accountName,
            }));
          }}
          className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
        >
          {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}
      <Badge variant={action.isJunkFood ? 'destructive' : 'secondary'} className="text-[10px]">{action.categoryName}</Badge>
    </div>
  );
}

function MealActionFields({ action, updateAction }: { action: UniversalMealAction; updateAction: UpdateActionFn }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 flex-1">
      <Utensils className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <span className="text-xs font-semibold">Meal</span>
      <Input value={action.name} onChange={(e) => updateAction<UniversalMealAction>(action.id, (p) => ({ ...p, name: e.target.value }))} className="h-7 w-32 text-xs px-2" />
      <div className="flex items-center gap-1">
        <Input type="number" value={action.calories} onChange={(e) => updateAction<UniversalMealAction>(action.id, (p) => ({ ...p, calories: Math.max(0, Number(e.target.value) || 0) }))} className="h-7 w-16 text-xs px-1.5" />
        <span className="text-[11px] text-muted-foreground">kcal</span>
      </div>
      <div className="flex items-center gap-1">
        <Input type="number" value={action.proteinG} onChange={(e) => updateAction<UniversalMealAction>(action.id, (p) => ({ ...p, proteinG: Math.max(0, Number(e.target.value) || 0) }))} className="h-7 w-14 text-xs px-1.5" />
        <span className="text-[11px] text-muted-foreground">g P</span>
      </div>
      {action.isJunk && <Badge variant="destructive" className="text-[10px]">Junk</Badge>}
    </div>
  );
}

function BioActionBadges({ action }: { action: UniversalBioAction }) {
  const pills: string[] = [];
  if (action.stepsExact !== undefined) pills.push(`${action.stepsExact.toLocaleString()} steps`);
  if (action.stepsDelta !== undefined) pills.push(`+${action.stepsDelta.toLocaleString()} steps`);
  if (action.waterDeltaMl !== undefined) pills.push(`+${action.waterDeltaMl}ml water`);
  if (action.sleepHours !== undefined) pills.push(`${action.sleepHours}h sleep`);
  if (action.energyLevel !== undefined) pills.push(`Energy ${action.energyLevel}/5`);
  if (action.weightKg !== undefined) pills.push(`${action.weightKg} kg`);
  if (action.waistInches !== undefined) pills.push(`Waist ${action.waistInches}"`);

  return (
    <div className="flex flex-wrap items-center gap-1.5 flex-1">
      <Moon className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
      <span className="text-xs font-semibold">Bio &amp; Activity</span>
      {pills.map((label) => <Badge key={label} variant="secondary" className="text-[10px]">{label}</Badge>)}
    </div>
  );
}

function ActionKindContent(params: {
  action: UniversalCaptureAction;
  accounts: FinanceAccount[];
  updateAction: UpdateActionFn;
}) {
  const { action, accounts, updateAction } = params;
  if (action.kind === 'expense') return <ExpenseActionFields action={action} accounts={accounts} updateAction={updateAction} />;
  if (action.kind === 'meal') return <MealActionFields action={action} updateAction={updateAction} />;
  if (action.kind === 'bio') return <BioActionBadges action={action} />;
  if (action.kind === 'workout') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 flex-1">
        <Dumbbell className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        <span className="text-xs font-semibold">{action.title}</span>
        <Badge variant="secondary" className="text-[10px]">{action.durationMinutes} min · {action.workoutType}</Badge>
        <span className="text-[11px] text-muted-foreground">(~{action.estimatedCaloriesBurned} kcal)</span>
      </div>
    );
  }
  if (action.kind === 'supplement') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 flex-1">
        <Pill className="h-3.5 w-3.5 text-violet-500 shrink-0" />
        <span className="text-xs font-semibold">{action.supplementName}</span>
        <Badge variant="secondary" className="text-[10px]">{action.servings} serving</Badge>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 flex-1">
      <CheckSquare className="h-3.5 w-3.5 text-blue-500 shrink-0" />
      <span className="text-xs font-semibold">Task: {action.title}</span>
      <Badge variant="outline" className="text-[10px]">{action.priority} · {action.dueDate}</Badge>
    </div>
  );
}

export function CaptureActionsList(params: {
  actions: UniversalCaptureAction[];
  enabledCount: number;
  accounts: FinanceAccount[];
  updateAction: UpdateActionFn;
}) {
  const { actions, enabledCount, accounts, updateAction } = params;
  if (actions.length === 0) return null;

  return (
    <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Detected Actions ({enabledCount}/{actions.length}) — tap fields to adjust
      </p>
      {actions.map((action) => (
        <div key={action.id} className={cn('rounded-xl border p-2.5 transition-all', action.enabled ? 'border-border bg-muted/25' : 'border-border/40 bg-muted/10 opacity-50')}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <input
                type="checkbox"
                checked={action.enabled}
                onChange={(e) => updateAction(action.id, (prev) => ({ ...prev, enabled: e.target.checked }))}
                className="rounded border-border accent-primary h-4 w-4 shrink-0"
              />
              <ActionKindContent action={action} accounts={accounts} updateAction={updateAction} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
