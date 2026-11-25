'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Check,
  Minus,
  Pencil,
  Pill,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { calculateSupplementStockAndRoi } from '@/lib/fitness/shared-analytics';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useFeedback } from '@/hooks/use-feedback';
import { cn } from '@/lib/utils';
import type {
  HabitAnchorBlock,
  SupplementCategory,
  SupplementInventory,
  SupplementInventoryFormData,
} from '@/lib/types';

interface SupplementsRoiTabProps {
  selectedDate: string;
  userId: string;
}

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

export function SupplementsRoiTab({ selectedDate, userId }: SupplementsRoiTabProps) {
  const supplementInventory = useFitnessStore((s) => s.supplementInventory);
  const supplementLogs = useFitnessStore((s) => s.supplementLogs);

  const addSupplement = useFitnessStore((s) => s.addSupplement);
  const updateSupplement = useFitnessStore((s) => s.updateSupplement);
  const deleteSupplement = useFitnessStore((s) => s.deleteSupplement);
  const takeSupplementDose = useFitnessStore((s) => s.takeSupplementDose);
  const takeTodaySupplementStack = useFitnessStore((s) => s.takeTodaySupplementStack);
  const deleteSupplementLog = useFitnessStore((s) => s.deleteSupplementLog);
  const adjustSupplementStock = useFitnessStore((s) => s.adjustSupplementStock);

  const summary = useMemo(
    () => calculateSupplementStockAndRoi(supplementInventory, supplementLogs, selectedDate),
    [supplementInventory, supplementLogs, selectedDate]
  );

  const logsForSelectedDate = useMemo(
    () =>
      supplementLogs.filter(
        (l) => !l.deletedAt && l.date.slice(0, 10) === selectedDate
      ),
    [supplementLogs, selectedDate]
  );

  const untakenCount = useMemo(
    () =>
      summary.items.filter(
        (item) =>
          !logsForSelectedDate.some((l) => l.supplementId === item.supplement.id)
      ).length,
    [summary.items, logsForSelectedDate]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const feedback = useFeedback();
  const [editingSupp, setEditingSupp] = useState<SupplementInventory | null>(null);
  const [form, setForm] = useState<SupplementInventoryFormData>({
    name: '',
    brand: '',
    category: 'protein',
    unitLabel: 'scoop',
    totalServings: 30,
    dailyDosage: 1,
    costInr: 1299,
    proteinPerServingG: 24,
    anchorBlock: 'gym',
    lowStockThresholdDays: 7,
  });

  const [exactAdjustSupp, setExactAdjustSupp] = useState<SupplementInventory | null>(null);
  const [exactStockVal, setExactStockVal] = useState<string>('30');

  const openAddModal = () => {
    setEditingSupp(null);
    setForm({
      name: '',
      brand: '',
      category: 'protein',
      unitLabel: 'scoop',
      totalServings: 30,
      dailyDosage: 1,
      costInr: 1299,
      proteinPerServingG: 24,
      anchorBlock: 'gym',
      lowStockThresholdDays: 7,
    });
    setModalOpen(true);
  };

  const openEditModal = (sup: SupplementInventory) => {
    setEditingSupp(sup);
    setForm({
      name: sup.name,
      brand: sup.brand || '',
      category: sup.category,
      unitLabel: sup.unitLabel,
      totalServings: sup.totalServings,
      dailyDosage: sup.dailyDosage,
      costInr: sup.costInr,
      proteinPerServingG: sup.proteinPerServingG ?? (sup.category === 'protein' ? 24 : null),
      anchorBlock: sup.anchorBlock ?? null,
      lowStockThresholdDays: sup.lowStockThresholdDays,
    });
    setModalOpen(true);
  };

  const handleSaveSupplement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const payload: SupplementInventoryFormData = {
      ...form,
      name: form.name.trim(),
      brand: form.brand?.trim() || null,
      anchorBlock: form.anchorBlock || null,
      proteinPerServingG:
        form.proteinPerServingG && Number(form.proteinPerServingG) > 0
          ? Number(form.proteinPerServingG)
          : null,
    };

    if (editingSupp) {
      feedback.success();
      await updateSupplement(editingSupp.id, payload);
      toast.success(`Updated ${payload.name}`);
    } else {
      feedback.success();
      await addSupplement(payload, userId);
      toast.success(`Added ${payload.name} to inventory`);
    }
    setModalOpen(false);
  };

  const handleTakeTodayStack = async () => {
    feedback.complete();
    const created = await takeTodaySupplementStack(selectedDate, userId);
    if (created.length === 0) {
      toast.info('All active supplements are already logged for today');
      return;
    }
    toast.success(`Logged ${created.length} supplement${created.length > 1 ? 's' : ''} for today`, {
      action: {
        label: 'Undo',
        onClick: async () => {
          for (const log of created) {
            await deleteSupplementLog(log.id);
          }
          toast.info('Reverted today’s stack log');
        },
      },
    });
  };

  const handleUndoAllToday = async () => {
    if (logsForSelectedDate.length === 0) return;
    for (const l of logsForSelectedDate) {
      await deleteSupplementLog(l.id);
    }
    toast.info(`Undid ${logsForSelectedDate.length} supplement log(s) for ${selectedDate}`);
  };

  const handleSaveExactStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exactAdjustSupp) return;
    const val = Math.max(0, Number(exactStockVal) || 0);
    await adjustSupplementStock(exactAdjustSupp.id, { targetRemaining: val });
    toast.success(`Adjusted ${exactAdjustSupp.name} stock to ${val}`);
    setExactAdjustSupp(null);
  };

  const maxBenchmarkCost = useMemo(
    () =>
      Math.max(
        1,
        ...summary.proteinBenchmarks.map((b) => b.costPer25gProteinInr)
      ),
    [summary.proteinBenchmarks]
  );

  return (
    <div className="space-y-5">
      {/* Header & Stack Action Bar */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Pill className="h-4 w-4 text-emerald-500" />
              Supplement Stock &amp; Protein ROI
            </h3>
            <p className="text-xs text-muted-foreground">
              Deterministic stock derived from intake logs · ₹/serving &amp; ₹/25g protein benchmark
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {logsForSelectedDate.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleUndoAllToday}
                className="gap-1.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Undo Today ({logsForSelectedDate.length})
              </Button>
            )}
            {summary.items.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant={untakenCount > 0 ? 'default' : 'secondary'}
                onClick={handleTakeTodayStack}
                className="gap-1.5 text-xs"
              >
                <Check className="h-3.5 w-3.5" />
                {untakenCount > 0 ? `Take Today's Stack (${untakenCount})` : "Today's Stack Taken"}
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={openAddModal} className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add Supplement
            </Button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground">Active Stack</p>
            <p className="text-base font-bold text-foreground">{summary.items.length} items</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground">Monthly Burn</p>
            <p className="text-base font-bold text-foreground font-mono">
              ₹{summary.totalMonthlySpendInr.toLocaleString('en-IN')}/mo
            </p>
          </div>
          <div
            className={cn(
              'rounded-xl p-3',
              summary.lowStockItems.length > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10'
            )}
          >
            <p className="text-[11px] text-muted-foreground">Low-Stock Alerts</p>
            <p
              className={cn(
                'text-base font-bold',
                summary.lowStockItems.length > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              )}
            >
              {summary.lowStockItems.length} running low
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground">Logged ({selectedDate})</p>
            <p className="text-base font-bold text-foreground">
              {logsForSelectedDate.length} dose{logsForSelectedDate.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* Supplement Cards Grid */}
        {summary.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 py-10 px-4 text-center">
            <Pill className="h-7 w-7 text-muted-foreground mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-foreground">No supplements tracked yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add Whey Protein, Creatine, Vitamin D3, or Magnesium — or toggle &quot;Restock Supplement&quot; when logging a Health &amp; Supplements expense
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {summary.items.map((item) => {
              const sup = item.supplement;
              const todayLog = logsForSelectedDate.find((l) => l.supplementId === sup.id);
              const roiColor =
                item.roiStatus === 'high'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : item.roiStatus === 'moderate'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : item.roiStatus === 'wasted'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      : 'bg-muted text-muted-foreground';

              return (
                <div
                  key={sup.id}
                  className={cn(
                    'rounded-xl border bg-background p-3.5 space-y-3',
                    item.isLowStock ? 'border-rose-500/40' : 'border-border'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold text-foreground truncate">{sup.name}</p>
                        {item.isLowStock && (
                          <Badge variant="destructive" className="text-[10px] gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> Low Stock
                          </Badge>
                        )}
                        {sup.anchorBlock && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {sup.anchorBlock}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.derivedRemainingServings}/{sup.totalServings} {sup.unitLabel}s left
                        {item.daysRemaining != null ? ` (${item.daysRemaining}d)` : ''} · ₹
                        {item.costPerServingInr}/{sup.unitLabel}
                        {item.costPer25gProteinInr != null && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            {' '}
                            · ₹{item.costPer25gProteinInr}/25g P
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="secondary" className={cn('text-[10px]', roiColor)}>
                        {item.adherence30dPct}% 30d
                      </Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEditModal(sup)}
                        aria-label={`Edit ${sup.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          deleteSupplement(sup.id);
                          toast.success(`Removed ${sup.name}`);
                        }}
                        aria-label={`Delete ${sup.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Stock Bar */}
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-300',
                        item.isLowStock ? 'bg-rose-500' : 'bg-emerald-500'
                      )}
                      style={{
                        width: `${Math.min(
                          100,
                          sup.totalServings > 0
                            ? Math.round((item.derivedRemainingServings / sup.totalServings) * 100)
                            : 0
                        )}%`,
                      }}
                    />
                  </div>

                  {/* Action Strip: Manual Stock Adjustment + Take / Undo Dose */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => adjustSupplementStock(sup.id, { delta: -1 })}
                        title="Subtract 1 serving manually"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => {
                          setExactAdjustSupp(sup);
                          setExactStockVal(String(item.derivedRemainingServings));
                        }}
                        title="Manual stock adjustment"
                      >
                        <SlidersHorizontal className="h-3 w-3" /> Adjust
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => adjustSupplementStock(sup.id, { delta: 1 })}
                        title="Add 1 serving manually"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    {todayLog ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          feedback.uncheck();
                          await deleteSupplementLog(todayLog.id);
                          toast.info(`Undid ${sup.name} dose`);
                        }}
                        className="h-8 text-xs gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                      >
                        <RotateCcw className="h-3 w-3" /> Taken ✓ (Undo)
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          feedback.complete();
                          const log = await takeSupplementDose(
                            sup.id,
                            sup.dailyDosage,
                            selectedDate,
                            null,
                            userId
                          );
                          if (log) {
                            toast.success(`Logged ${sup.name}`, {
                              action: {
                                label: 'Undo',
                                onClick: () => deleteSupplementLog(log.id),
                              },
                            });
                          }
                        }}
                        className="h-8 text-xs gap-1"
                      >
                        <Check className="h-3.5 w-3.5" /> Take {sup.dailyDosage} {sup.unitLabel}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ₹ per 25g Protein Benchmark Card */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              ₹ per 25g Protein ROI Benchmark (Indian Whole Foods vs Supplements)
            </h3>
            <p className="text-xs text-muted-foreground">
              Compare your protein powder cost-efficiency against Boiled Eggs, Chicken Breast, Paneer &amp; Dahi
            </p>
          </div>
          <Badge variant="outline" className="text-[11px] gap-1">
            <Sparkles className="h-3 w-3 text-amber-500" /> Lower ₹/25g = Better ROI
          </Badge>
        </div>

        <div className="space-y-2.5">
          {summary.proteinBenchmarks.map((row) => {
            const widthPct = Math.max(
              12,
              Math.round((row.costPer25gProteinInr / maxBenchmarkCost) * 100)
            );
            return (
              <div key={row.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-foreground truncate">{row.name}</span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      ({row.servingLabel} · {row.proteinPerServingG}g P)
                    </span>
                    {row.isSupplement && (
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                        Your Stack
                      </Badge>
                    )}
                  </div>
                  <span className="font-mono font-bold text-foreground shrink-0">
                    ₹{row.costPer25gProteinInr.toFixed(0)} / 25g P
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      row.isSupplement ? 'bg-primary' : 'bg-emerald-500/75'
                    )}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Supplement Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSupp ? 'Edit Supplement' : 'Add Supplement'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSupplement} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium">Supplement Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Whey Isolate, Creatine, Vitamin D3"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Category</label>
                <select
                  value={form.category || 'protein'}
                  onChange={(e) => {
                    const cat = e.target.value as SupplementCategory;
                    setForm((prev) => ({
                      ...prev,
                      category: cat,
                      proteinPerServingG:
                        cat === 'protein' ? prev.proteinPerServingG ?? 24 : null,
                    }));
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Routine Anchor Block</label>
                <select
                  value={form.anchorBlock || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      anchorBlock: (e.target.value || null) as HabitAnchorBlock | null,
                    })
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {ANCHOR_OPTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Total Servings</label>
                <Input
                  type="number"
                  min={1}
                  value={form.totalServings}
                  onChange={(e) =>
                    setForm({ ...form, totalServings: Number(e.target.value) || 30 })
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Cost (₹)</label>
                <Input
                  type="number"
                  min={0}
                  value={form.costInr ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, costInr: Number(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Daily Dosage</label>
                <Input
                  type="number"
                  step="0.25"
                  min={0.25}
                  value={form.dailyDosage ?? 1}
                  onChange={(e) =>
                    setForm({ ...form, dailyDosage: Number(e.target.value) || 1 })
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Unit Label</label>
                <Input
                  value={form.unitLabel || 'scoop'}
                  onChange={(e) => setForm({ ...form, unitLabel: e.target.value })}
                  placeholder="scoop / cap / drop"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Protein / Serving (g)</label>
                <Input
                  type="number"
                  step="0.5"
                  min={0}
                  value={form.proteinPerServingG ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      proteinPerServingG: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="24 (for whey)"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Low-Stock Alert (days)</label>
                <Input
                  type="number"
                  min={1}
                  value={form.lowStockThresholdDays ?? 7}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      lowStockThresholdDays: Number(e.target.value) || 7,
                    })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingSupp ? 'Save Changes' : 'Save Supplement'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manual Exact Stock Adjustment Dialog */}
      <Dialog
        open={Boolean(exactAdjustSupp)}
        onOpenChange={(open) => {
          if (!open) setExactAdjustSupp(null);
        }}
      >
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock: {exactAdjustSupp?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveExactStock} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">
                Actual Remaining Servings ({exactAdjustSupp?.unitLabel}s)
              </label>
              <Input
                type="number"
                min={0}
                step="0.5"
                value={exactStockVal}
                onChange={(e) => setExactStockVal(e.target.value)}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Updates manualAdjustment cleanly without erasing supplement intake history.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setExactAdjustSupp(null)}>
                Cancel
              </Button>
              <Button type="submit">Update Stock</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
