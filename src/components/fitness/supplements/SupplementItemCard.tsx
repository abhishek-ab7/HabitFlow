'use client';

import React from 'react';
import { AlertTriangle, Check, Minus, Pencil, Plus, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SupplementInventory, SupplementLog } from '@/lib/types';

export interface SupplementItemSummary {
  supplement: SupplementInventory;
  derivedRemainingServings: number;
  daysRemaining: number | null;
  costPerServingInr: number;
  costPer25gProteinInr: number | null;
  adherence30dPct: number;
  roiStatus: 'high' | 'moderate' | 'wasted' | 'neutral' | string;
  isLowStock: boolean;
}

const ROI_BADGE_CLASSES: Record<string, string> = {
  high: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  moderate: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  wasted: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
};

function SupplementDoseButton(params: {
  sup: SupplementInventory;
  todayLog?: SupplementLog;
  onUndoDose: (logId: string) => void;
  onTakeDose: (sup: SupplementInventory) => void;
}) {
  const { sup, todayLog } = params;
  if (todayLog) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => params.onUndoDose(todayLog.id)}
        className="h-8 text-xs gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
      >
        <RotateCcw className="h-3 w-3" /> Taken ✓ (Undo)
      </Button>
    );
  }
  return (
    <Button type="button" size="sm" variant="secondary" onClick={() => params.onTakeDose(sup)} className="h-8 text-xs gap-1">
      <Check className="h-3.5 w-3.5" /> Take {sup.dailyDosage} {sup.unitLabel}
    </Button>
  );
}

export function SupplementItemCard(params: {
  item: SupplementItemSummary;
  todayLog?: SupplementLog;
  onEdit: (sup: SupplementInventory) => void;
  onDelete: (sup: SupplementInventory) => void;
  onAdjustDelta: (supId: string, delta: number) => void;
  onOpenExactAdjust: (sup: SupplementInventory, remaining: number) => void;
  onUndoDose: (logId: string) => void;
  onTakeDose: (sup: SupplementInventory) => void;
}) {
  const { item } = params;
  const sup = item.supplement;
  const roiColor = ROI_BADGE_CLASSES[item.roiStatus] ?? 'bg-muted text-muted-foreground';
  const stockPct = sup.totalServings > 0 ? Math.min(100, Math.round((item.derivedRemainingServings / sup.totalServings) * 100)) : 0;

  return (
    <div className={cn('rounded-xl border bg-background p-3.5 space-y-3', item.isLowStock ? 'border-rose-500/40' : 'border-border')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-bold text-foreground truncate">{sup.name}</p>
            {item.isLowStock && (
              <Badge variant="destructive" className="text-[10px] gap-0.5"><AlertTriangle className="h-2.5 w-2.5" /> Low Stock</Badge>
            )}
            {sup.anchorBlock && <Badge variant="outline" className="text-[10px] capitalize">{sup.anchorBlock}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {item.derivedRemainingServings}/{sup.totalServings} {sup.unitLabel}s left
            {item.daysRemaining != null ? ` (${item.daysRemaining}d)` : ''} · ₹{item.costPerServingInr}/{sup.unitLabel}
            {item.costPer25gProteinInr != null && (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold"> · ₹{item.costPer25gProteinInr}/25g P</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="secondary" className={cn('text-[10px]', roiColor)}>{item.adherence30dPct}% 30d</Badge>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => params.onEdit(sup)} aria-label={`Edit ${sup.name}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => params.onDelete(sup)} aria-label={`Delete ${sup.name}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full transition-all duration-300', item.isLowStock ? 'bg-rose-500' : 'bg-emerald-500')} style={{ width: `${stockPct}%` }} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => params.onAdjustDelta(sup.id, -1)} title="Subtract 1 serving manually">
            <Minus className="h-3 w-3" />
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => params.onOpenExactAdjust(sup, item.derivedRemainingServings)} title="Manual stock adjustment">
            <SlidersHorizontal className="h-3 w-3" /> Adjust
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => params.onAdjustDelta(sup.id, 1)} title="Add 1 serving manually">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <SupplementDoseButton sup={sup} todayLog={params.todayLog} onUndoDose={params.onUndoDose} onTakeDose={params.onTakeDose} />
      </div>
    </div>
  );
}
