'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { HabitAnchorBlock, SupplementCategory, SupplementInventory, SupplementInventoryFormData } from '@/lib/types';

const CATEGORY_OPTIONS: Array<{ value: SupplementCategory; label: string }> = [
  { value: 'protein', label: 'Protein / Whey' },
  { value: 'creatine', label: 'Creatine' },
  { value: 'vitamin', label: 'Vitamin' },
  { value: 'mineral', label: 'Mineral' },
  { value: 'omega', label: 'Omega-3 / Fish Oil' },
  { value: 'pre_workout', label: 'Pre-Workout' },
  { value: 'other', label: 'Other' },
];

const ANCHOR_OPTIONS: Array<{ value: HabitAnchorBlock | ''; label: string }> = [
  { value: '', label: 'Any Time' },
  { value: 'morning', label: 'Morning' },
  { value: 'work', label: 'Work' },
  { value: 'gym', label: 'Gym' },
  { value: 'night', label: 'Night' },
];

function SupplementNumericFields({
  form,
  setForm,
}: {
  form: SupplementInventoryFormData;
  setForm: React.Dispatch<React.SetStateAction<SupplementInventoryFormData>>;
}) {
  return (
    <>
      <div className="space-y-1">
        <label className="text-xs font-medium">Total Servings</label>
        <Input type="number" min={1} value={form.totalServings} onChange={(e) => setForm({ ...form, totalServings: Number(e.target.value) || 30 })} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Cost (₹)</label>
        <Input type="number" min={0} value={form.costInr ?? 0} onChange={(e) => setForm({ ...form, costInr: Number(e.target.value) || 0 })} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Daily Dosage</label>
        <Input type="number" step="0.25" min={0.25} value={form.dailyDosage ?? 1} onChange={(e) => setForm({ ...form, dailyDosage: Number(e.target.value) || 1 })} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Unit Label</label>
        <Input value={form.unitLabel || 'scoop'} onChange={(e) => setForm({ ...form, unitLabel: e.target.value })} placeholder="scoop / cap / drop" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Protein / Serving (g)</label>
        <Input
          type="number" step="0.5" min={0}
          value={form.proteinPerServingG ?? ''}
          onChange={(e) => setForm({ ...form, proteinPerServingG: e.target.value ? Number(e.target.value) : null })}
          placeholder="24 (for whey)"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Low-Stock Alert (days)</label>
        <Input type="number" min={1} value={form.lowStockThresholdDays ?? 7} onChange={(e) => setForm({ ...form, lowStockThresholdDays: Number(e.target.value) || 7 })} />
      </div>
    </>
  );
}

export function SupplementFormDialog(params: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSupp: SupplementInventory | null;
  form: SupplementInventoryFormData;
  setForm: React.Dispatch<React.SetStateAction<SupplementInventoryFormData>>;
  onSave: (e: React.FormEvent) => void;
}) {
  const { form, setForm } = params;
  return (
    <Dialog open={params.open} onOpenChange={params.onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{params.editingSupp ? 'Edit Supplement' : 'Add Supplement'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={params.onSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium">Supplement Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Whey Isolate, Creatine, Vitamin D3" required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Category</label>
              <select
                value={form.category || 'protein'}
                onChange={(e) => {
                  const cat = e.target.value as SupplementCategory;
                  setForm((prev) => ({ ...prev, category: cat, proteinPerServingG: cat === 'protein' ? prev.proteinPerServingG ?? 24 : null }));
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Routine Anchor Block</label>
              <select
                value={form.anchorBlock || ''}
                onChange={(e) => setForm({ ...form, anchorBlock: (e.target.value || null) as HabitAnchorBlock | null })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {ANCHOR_OPTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <SupplementNumericFields form={form} setForm={setForm} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => params.onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{params.editingSupp ? 'Save Changes' : 'Save Supplement'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdjustStockDialog(params: {
  targetSupp: SupplementInventory | null;
  onClose: () => void;
  exactStockVal: string;
  setExactStockVal: React.Dispatch<React.SetStateAction<string>>;
  onSave: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={Boolean(params.targetSupp)} onOpenChange={(open) => !open && params.onClose()}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Adjust Stock: {params.targetSupp?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={params.onSave} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Actual Remaining Servings ({params.targetSupp?.unitLabel}s)</label>
            <Input type="number" min={0} step="0.5" value={params.exactStockVal} onChange={(e) => params.setExactStockVal(e.target.value)} autoFocus />
            <p className="text-[11px] text-muted-foreground">Updates manualAdjustment cleanly without erasing supplement intake history.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={params.onClose}>Cancel</Button>
            <Button type="submit">Update Stock</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
