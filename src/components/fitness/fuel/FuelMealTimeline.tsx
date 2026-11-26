'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Flame, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { MealLog } from '@/lib/types';
import type { MealFinanceMatchCandidate } from '@/lib/fitness/meal-finance-matcher';

export type CandidateTxMatch = MealFinanceMatchCandidate;

function MealTimelineExpandedBody(params: {
  meal: MealLog;
  candidateMatch?: CandidateTxMatch;
  showQuickLinkChip: boolean;
  onLinkCandidate: (e: React.MouseEvent) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { meal, candidateMatch, showQuickLinkChip, onLinkCandidate, onEdit, onDelete } = params;
  return (
    <div className="mt-2 rounded-xl bg-muted/35 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
        <span>Carbs: <strong className="text-foreground">{meal.carbsG}g</strong></span>
        <span>Fat: <strong className="text-foreground">{meal.fatG}g</strong></span>
        <span>Source: <strong className="text-foreground capitalize">{meal.source.replace('_', ' ')}</strong></span>
        {meal.notes && <span>Notes: {meal.notes}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {candidateMatch && !showQuickLinkChip && (
          <Button type="button" size="sm" variant="outline" onClick={onLinkCandidate} className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10">
            <Wallet className="h-3 w-3" /> Link ₹{candidateMatch.transaction.amount}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onEdit}><Pencil className="h-3 w-3" /> Edit</Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive gap-1" onClick={onDelete}>
          <Trash2 className="h-3 w-3" /> Delete
        </Button>
      </div>
    </div>
  );
}

function MealTimelineHeader(params: {
  meal: MealLog;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const { meal, isExpanded, onToggleExpand } = params;
  return (
    <button type="button" onClick={onToggleExpand} className="w-full text-left flex items-start justify-between gap-3 py-1">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium text-foreground truncate">{meal.name}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] capitalize shrink-0">{meal.mealType.replace('_', ' ')}</Badge>
          {meal.isJunk && <Badge variant="destructive" className="text-[10px] shrink-0">Junk</Badge>}
          {meal.linkedTransactionId && (
            <Badge variant="secondary" className="text-[10px] shrink-0 gap-1"><Wallet className="h-2.5 w-2.5" /> Finance Linked</Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
        <span className="text-sm font-semibold tabular-nums whitespace-nowrap text-amber-600 dark:text-amber-400">{meal.calories} kcal</span>
        <span className="text-sm font-semibold tabular-nums whitespace-nowrap text-emerald-600 dark:text-emerald-400 min-w-[3.25rem] text-right">{meal.proteinG}g P</span>
        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>
    </button>
  );
}

function MealTimelineRow(params: {
  meal: MealLog;
  isExpanded: boolean;
  candidateMatch?: CandidateTxMatch;
  onToggleExpand: () => void;
  onLinkCandidate: (e: React.MouseEvent) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { meal, isExpanded, candidateMatch, onToggleExpand, onLinkCandidate, onEdit, onDelete } = params;
  const showQuickLinkChip = Boolean(candidateMatch) && (candidateMatch?.confidence === 'high' || meal.isJunk);

  return (
    <div className="cv-auto py-2.5 first:pt-0 last:pb-0">
      <MealTimelineHeader meal={meal} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />

      {showQuickLinkChip && candidateMatch && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onLinkCandidate} className="h-7 max-w-full px-2.5 text-[11px] rounded-full gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
            <Wallet className="h-3 w-3 shrink-0" />
            <span className="truncate">Link to ₹{candidateMatch.transaction.amount} {candidateMatch.transaction.merchantName || candidateMatch.transaction.title}</span>
          </Button>
        </div>
      )}

      {isExpanded && (
        <MealTimelineExpandedBody
          meal={meal}
          candidateMatch={candidateMatch}
          showQuickLinkChip={showQuickLinkChip}
          onLinkCandidate={onLinkCandidate}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

export function FuelMealTimeline(params: {
  selectedDate: string;
  dayMeals: MealLog[];
  junkMealCount: number;
  junkCalories: number;
  candidateTxByMealId: Map<string, CandidateTxMatch>;
  onOpenAddMeal: () => void;
  onEditMeal: (meal: MealLog) => void;
  onDeleteMeal: (id: string) => void;
  onLinkMealTx: (meal: MealLog, match: CandidateTxMatch) => void;
}) {
  const { selectedDate, dayMeals, junkMealCount, junkCalories, candidateTxByMealId, onOpenAddMeal, onEditMeal, onDeleteMeal, onLinkMealTx } = params;
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-500" />
            Meals Logged ({dayMeals.length})
            {junkMealCount > 0 && <Badge variant="destructive" className="text-[10px]">{junkMealCount} Junk ({junkCalories} kcal)</Badge>}
          </h3>
          <p className="text-xs text-muted-foreground">Tap any meal row to reveal Carbs, Fat, notes &amp; Finance link</p>
        </div>
        <Button type="button" size="sm" onClick={onOpenAddMeal} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Log Meal
        </Button>
      </div>

      {dayMeals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-8 px-4 text-center">
          <p className="text-sm font-medium text-foreground">No meals logged for {selectedDate} yet</p>
          <p className="text-xs text-muted-foreground mt-1">Tap an Indian staple above or press ⌘K for 10-Second Capture</p>
        </div>
      ) : (
        <div className="divide-y divide-border/70">
          {dayMeals.map((meal) => {
            const candidateMatch = !meal.linkedTransactionId ? candidateTxByMealId.get(meal.id) : undefined;
            return (
              <MealTimelineRow
                key={meal.id}
                meal={meal}
                isExpanded={expandedMealId === meal.id}
                candidateMatch={candidateMatch}
                onToggleExpand={() => setExpandedMealId(expandedMealId === meal.id ? null : meal.id)}
                onLinkCandidate={(e) => { e.stopPropagation(); if (candidateMatch) onLinkMealTx(meal, candidateMatch); }}
                onEdit={() => onEditMeal(meal)}
                onDelete={() => onDeleteMeal(meal.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
