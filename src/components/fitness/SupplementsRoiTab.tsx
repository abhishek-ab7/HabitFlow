'use client';

import React from 'react';
import { Check, Pill, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SupplementItemCard } from './supplements/SupplementItemCard';
import { ProteinRoiBenchmarkCard } from './supplements/ProteinRoiBenchmarkCard';
import { AdjustStockDialog, SupplementFormDialog } from './supplements/SupplementModals';
import { useSupplementsRoiController } from './supplements/useSupplementsRoiController';

interface SupplementsRoiTabProps {
  selectedDate: string;
  userId: string;
}

export function SupplementsRoiTab({ selectedDate, userId }: SupplementsRoiTabProps) {
  const vm = useSupplementsRoiController({ selectedDate, userId });

  return (
    <div className="space-y-5">
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
            {vm.logsForSelectedDate.length > 0 && (
              <Button type="button" size="sm" variant="outline" onClick={vm.handleUndoAllToday} className="gap-1.5 text-xs">
                <RotateCcw className="h-3.5 w-3.5" /> Undo Today ({vm.logsForSelectedDate.length})
              </Button>
            )}
            {vm.summary.items.length > 0 && (
              <Button type="button" size="sm" variant={vm.untakenCount > 0 ? 'default' : 'secondary'} onClick={vm.handleTakeTodayStack} className="gap-1.5 text-xs">
                <Check className="h-3.5 w-3.5" />
                {vm.untakenCount > 0 ? `Take Today's Stack (${vm.untakenCount})` : "Today's Stack Taken"}
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={vm.openAddModal} className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add Supplement
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground">Active Stack</p>
            <p className="text-base font-bold text-foreground">{vm.summary.items.length} items</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground">Monthly Burn</p>
            <p className="text-base font-bold text-foreground font-mono">₹{vm.summary.totalMonthlySpendInr.toLocaleString('en-IN')}/mo</p>
          </div>
          <div className={cn('rounded-xl p-3', vm.summary.lowStockItems.length > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10')}>
            <p className="text-[11px] text-muted-foreground">Low-Stock Alerts</p>
            <p className={cn('text-base font-bold', vm.summary.lowStockItems.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
              {vm.summary.lowStockItems.length} running low
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground">Logged ({selectedDate})</p>
            <p className="text-base font-bold text-foreground">{vm.logsForSelectedDate.length} dose{vm.logsForSelectedDate.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        {vm.summary.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 py-10 px-4 text-center">
            <Pill className="h-7 w-7 text-muted-foreground mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-foreground">No supplements tracked yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add Whey Protein, Creatine, Vitamin D3, or Magnesium — or toggle &quot;Restock Supplement&quot; when logging a Health &amp; Supplements expense
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {vm.summary.items.map((item) => (
              <SupplementItemCard
                key={item.supplement.id}
                item={item}
                todayLog={vm.logsForSelectedDate.find((l) => l.supplementId === item.supplement.id)}
                onEdit={vm.openEditModal}
                onDelete={vm.deleteSupplement}
                onAdjustDelta={vm.adjustDelta}
                onOpenExactAdjust={(sup, remaining) => {
                  vm.setExactAdjustSupp(sup);
                  vm.setExactStockVal(String(remaining));
                }}
                onUndoDose={vm.handleUndoDose}
                onTakeDose={vm.handleTakeDose}
              />
            ))}
          </div>
        )}
      </div>

      <ProteinRoiBenchmarkCard rows={vm.summary.proteinBenchmarks} maxBenchmarkCost={vm.maxBenchmarkCost} />

      <SupplementFormDialog
        open={vm.modalOpen}
        onOpenChange={vm.setModalOpen}
        editingSupp={vm.editingSupp}
        form={vm.form}
        setForm={vm.setForm}
        onSave={vm.handleSaveSupplement}
      />

      <AdjustStockDialog
        targetSupp={vm.exactAdjustSupp}
        onClose={() => vm.setExactAdjustSupp(null)}
        exactStockVal={vm.exactStockVal}
        setExactStockVal={vm.setExactStockVal}
        onSave={vm.handleSaveExactStock}
      />
    </div>
  );
}
