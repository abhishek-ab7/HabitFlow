'use client';

import React from 'react';
import { Sparkles, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { FinanceAccount, MealLog, MealLogFormData, MealTemplateFormData, MealType } from '@/lib/types';

const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
  { value: 'pre_workout', label: 'Pre-Workout' },
  { value: 'post_workout', label: 'Post-Workout' },
];

function MealMacroInputs({ mealForm, setMealForm }: { mealForm: MealLogFormData; setMealForm: (next: MealLogFormData) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <label className="text-xs font-medium">Calories (kcal)</label>
        <Input type="number" min={0} value={mealForm.calories} onChange={(e) => setMealForm({ ...mealForm, calories: Number(e.target.value) || 0 })} required />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Protein (g)</label>
        <Input type="number" step="0.5" min={0} value={mealForm.proteinG} onChange={(e) => setMealForm({ ...mealForm, proteinG: Number(e.target.value) || 0 })} required />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Carbs (g, optional)</label>
        <Input type="number" step="0.5" min={0} value={mealForm.carbsG ?? 0} onChange={(e) => setMealForm({ ...mealForm, carbsG: Number(e.target.value) || 0 })} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Fat (g, optional)</label>
        <Input type="number" step="0.5" min={0} value={mealForm.fatG ?? 0} onChange={(e) => setMealForm({ ...mealForm, fatG: Number(e.target.value) || 0 })} />
      </div>
    </div>
  );
}

function MealPaidOutsideBox(params: {
  paidOutside: boolean;
  setPaidOutside: (v: boolean) => void;
  paidAmountStr: string;
  setPaidAmountStr: (v: string) => void;
  paidAccountId: string;
  setPaidAccountId: (v: string) => void;
  activeFinanceAccounts: FinanceAccount[];
}) {
  const { paidOutside, setPaidOutside, paidAmountStr, setPaidAmountStr, paidAccountId, setPaidAccountId, activeFinanceAccounts } = params;
  return (
    <div className="rounded-xl border border-border bg-muted/25 p-3 space-y-2.5">
      <label className="flex items-center justify-between gap-2 text-xs font-medium cursor-pointer">
        <span className="flex items-center gap-1.5 text-foreground"><Wallet className="h-3.5 w-3.5 text-primary" /> Paid outside? Add ₹ cost</span>
        <input type="checkbox" checked={paidOutside} onChange={(e) => setPaidOutside(e.target.checked)} className="rounded accent-primary h-4 w-4" />
      </label>
      {paidOutside && (
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Amount (₹)</label>
            <Input type="number" min={1} step="1" value={paidAmountStr} onChange={(e) => setPaidAmountStr(e.target.value)} placeholder="e.g., 180" className="h-9 text-sm font-mono tabular-nums" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Account</label>
            <select value={paidAccountId} onChange={(e) => setPaidAccountId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs">
              {activeFinanceAccounts.length === 0 ? (
                <option value="">No active accounts</option>
              ) : (
                activeFinanceAccounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)
              )}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export function MealFormModal(params: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingMeal: MealLog | null;
  mealForm: MealLogFormData;
  setMealForm: (next: MealLogFormData) => void;
  paidOutside: boolean;
  setPaidOutside: (v: boolean) => void;
  paidAmountStr: string;
  setPaidAmountStr: (v: string) => void;
  paidAccountId: string;
  setPaidAccountId: (v: string) => void;
  activeFinanceAccounts: FinanceAccount[];
  onAutoEstimate: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const {
    open, onOpenChange, editingMeal, mealForm, setMealForm,
    paidOutside, setPaidOutside, paidAmountStr, setPaidAmountStr,
    paidAccountId, setPaidAccountId, activeFinanceAccounts, onAutoEstimate, onSubmit,
  } = params;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{editingMeal ? 'Edit Meal' : 'Log Custom Meal'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Meal Name</label>
            <div className="flex gap-1.5">
              <Input value={mealForm.name} onChange={(e) => setMealForm({ ...mealForm, name: e.target.value })} placeholder="e.g. Paneer Roll, Dal Chawal..." required />
              <Button type="button" variant="secondary" size="sm" onClick={onAutoEstimate} title="Auto-estimate macros from Hinglish dish name" className="shrink-0 gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Estimate
              </Button>
            </div>
          </div>

          <MealMacroInputs mealForm={mealForm} setMealForm={setMealForm} />

          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="space-y-1">
              <label className="text-xs font-medium">Meal Slot</label>
              <select value={mealForm.mealType || 'snack'} onChange={(e) => setMealForm({ ...mealForm, mealType: e.target.value as MealType })} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                {MEAL_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm pt-4 cursor-pointer">
              <input type="checkbox" checked={Boolean(mealForm.isJunk)} onChange={(e) => setMealForm({ ...mealForm, isJunk: e.target.checked })} className="rounded accent-destructive h-4 w-4" />
              Flag as Junk Food
            </label>
          </div>

          {!editingMeal && (
            <MealPaidOutsideBox
              paidOutside={paidOutside} setPaidOutside={setPaidOutside}
              paidAmountStr={paidAmountStr} setPaidAmountStr={setPaidAmountStr}
              paidAccountId={paidAccountId} setPaidAccountId={setPaidAccountId}
              activeFinanceAccounts={activeFinanceAccounts}
            />
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{editingMeal ? 'Update Meal' : 'Log Meal'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StapleFormModal(params: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stapleForm: MealTemplateFormData;
  setStapleForm: (next: MealTemplateFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const { open, onOpenChange, stapleForm, setStapleForm, onSubmit } = params;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Save 1-Tap Indian Staple</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Staple Name</label>
            <Input value={stapleForm.name} onChange={(e) => setStapleForm({ ...stapleForm, name: e.target.value })} placeholder="e.g. 2 Egg Omelette + 2 Toast" required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Serving Size Label</label>
            <Input value={stapleForm.servingLabel} onChange={(e) => setStapleForm({ ...stapleForm, servingLabel: e.target.value })} placeholder="e.g. 1 plate" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Calories</label>
              <Input type="number" min={0} value={stapleForm.calories} onChange={(e) => setStapleForm({ ...stapleForm, calories: Number(e.target.value) || 0 })} required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Protein (g)</label>
              <Input type="number" step="0.5" min={0} value={stapleForm.proteinG} onChange={(e) => setStapleForm({ ...stapleForm, proteinG: Number(e.target.value) || 0 })} required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Carbs (g)</label>
              <Input type="number" step="0.5" min={0} value={stapleForm.carbsG} onChange={(e) => setStapleForm({ ...stapleForm, carbsG: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Fat (g)</label>
              <Input type="number" step="0.5" min={0} value={stapleForm.fatG} onChange={(e) => setStapleForm({ ...stapleForm, fatG: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save Staple</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
