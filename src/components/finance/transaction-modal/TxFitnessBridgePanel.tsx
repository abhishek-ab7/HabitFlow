'use client';

import React from 'react';
import { Utensils, Pill } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { SupplementInventory } from '@/lib/types';

export function TxFitnessBridgePanel(params: {
  bridgeKind: string;
  dietPreview: { calories: number; proteinG: number };
  alsoLogToDiet: boolean;
  setAlsoLogToDiet: React.Dispatch<React.SetStateAction<boolean>>;
  dietCaloriesOverride: string;
  setDietCaloriesOverride: React.Dispatch<React.SetStateAction<string>>;
  dietProteinOverride: string;
  setDietProteinOverride: React.Dispatch<React.SetStateAction<string>>;
  restockSupplementEnabled: boolean;
  setRestockSupplementEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  selectedSupplementId: string;
  onSelectSupplement: (id: string) => void;
  activeSupplements: SupplementInventory[];
  title: string;
  restockServingsStr: string;
  setRestockServingsStr: React.Dispatch<React.SetStateAction<string>>;
}) {
  const {
    bridgeKind, dietPreview, alsoLogToDiet, setAlsoLogToDiet,
    dietCaloriesOverride, setDietCaloriesOverride, dietProteinOverride, setDietProteinOverride,
    restockSupplementEnabled, setRestockSupplementEnabled, selectedSupplementId,
    onSelectSupplement, activeSupplements, title, restockServingsStr, setRestockServingsStr,
  } = params;

  if (bridgeKind === 'none') return null;

  return (
    <div className="rounded-xl border border-border/80 bg-muted/30 p-3 space-y-2.5">
      {bridgeKind === 'junk' && (
        <div data-testid="junk-auto-diet-badge" className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-300">
            <Utensils className="w-3.5 h-3.5 shrink-0" />
            Auto-logs ~{dietPreview.calories} kcal ({dietPreview.proteinG}g P) to Diet as Junk Food
          </span>
        </div>
      )}

      {bridgeKind === 'food_dining' && (
        <div className="space-y-2">
          <button
            type="button"
            data-testid="food-diet-bridge-chip"
            onClick={() => setAlsoLogToDiet((v) => !v)}
            aria-pressed={alsoLogToDiet}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              alsoLogToDiet ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300' : 'bg-background border-border text-foreground hover:bg-muted'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            {alsoLogToDiet ? `Logging ~${dietCaloriesOverride || dietPreview.calories} kcal to Diet` : `Also log ~${dietPreview.calories} kcal to Diet`}
          </button>

          {alsoLogToDiet && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[11px] text-muted-foreground">Calories (kcal)</label>
                <Input type="number" min="0" value={dietCaloriesOverride} onChange={(e) => setDietCaloriesOverride(e.target.value)} placeholder={String(dietPreview.calories)} className="h-8 text-xs mt-0.5" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Protein (g)</label>
                <Input type="number" min="0" value={dietProteinOverride} onChange={(e) => setDietProteinOverride(e.target.value)} placeholder={String(dietPreview.proteinG)} className="h-8 text-xs mt-0.5" />
              </div>
            </div>
          )}
        </div>
      )}

      {bridgeKind === 'health_supplements' && (
        <div className="space-y-2">
          <button
            type="button"
            data-testid="supplement-restock-bridge-chip"
            onClick={() => setRestockSupplementEnabled((v) => !v)}
            aria-pressed={restockSupplementEnabled}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              restockSupplementEnabled ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300' : 'bg-background border-border text-foreground hover:bg-muted'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            {restockSupplementEnabled ? 'Restocking Supplement on Save' : 'Restock Supplement'}
          </button>

          {restockSupplementEnabled && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="col-span-2">
                <label className="text-[11px] text-muted-foreground">Target Supplement</label>
                <select
                  value={selectedSupplementId}
                  onChange={(e) => onSelectSupplement(e.target.value)}
                  aria-label="Target Supplement"
                  className="h-8 w-full mt-0.5 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {activeSupplements.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.remainingServings} left)</option>
                  ))}
                  <option value="__new__">+ Create new ({title.trim() || 'from title'})</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Servings</label>
                <Input type="number" min="1" value={restockServingsStr} onChange={(e) => setRestockServingsStr(e.target.value)} aria-label="Restock Servings" className="h-8 text-xs mt-0.5" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
