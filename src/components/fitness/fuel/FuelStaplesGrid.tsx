'use client';

import React from 'react';
import { Plus, Trash2, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MealTemplate } from '@/lib/types';

export function FuelStaplesGrid(params: {
  pinnedTemplates: MealTemplate[];
  portionMultiplier: number;
  setPortionMultiplier: (mult: number) => void;
  onTapStaple: (tpl: MealTemplate) => void;
  onDeleteStaple: (id: string) => void;
  onOpenAddStaple: () => void;
}) {
  const { pinnedTemplates, portionMultiplier, setPortionMultiplier, onTapStaple, onDeleteStaple, onOpenAddStaple } = params;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Utensils className="h-4 w-4 text-emerald-500" />
            1-Tap Indian Staples
          </h3>
          <p className="text-xs text-muted-foreground">Tap any staple to log instantly · Big 2 Focus: Calories + Protein</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
            {[0.5, 1, 1.5, 2].map((mult) => (
              <button
                key={mult} type="button" onClick={() => setPortionMultiplier(mult)}
                className={cn('px-2 py-1 text-[11px] font-medium rounded-md transition-colors', portionMultiplier === mult ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {mult}x
              </button>
            ))}
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onOpenAddStaple} className="h-8 text-xs gap-1">
            <Plus className="h-3.5 w-3.5" /> Add Staple
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {pinnedTemplates.map((tpl) => (
          <div key={tpl.id} className="group relative rounded-xl border border-border/80 bg-background hover:border-primary/60 hover:bg-muted/30 transition-all p-3 flex flex-col justify-between">
            <button type="button" onClick={() => onTapStaple(tpl)} className="text-left w-full space-y-1">
              <p className="text-sm font-semibold text-foreground pr-5 truncate">{tpl.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{tpl.servingLabel}</p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{Math.round(tpl.calories * portionMultiplier)} kcal</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{Math.round(tpl.proteinG * portionMultiplier * 10) / 10}g P</span>
              </div>
            </button>
            <button type="button" onClick={() => onDeleteStaple(tpl.id)} title="Remove staple" className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive transition-opacity">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
