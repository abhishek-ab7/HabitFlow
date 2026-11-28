'use client';

import { Pill } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { useFitnessStore } from '@/lib/stores/fitness';
import type { calculateDailyFuelSummary } from '@/lib/fitness/shared-analytics';
import { ANCHOR_BLOCKS, getAnchorRowTone } from '@/lib/fitness/routine-quit-helpers';
import { cn } from '@/lib/utils';
import type { Habit, HabitAnchorBlock } from '@/lib/types';

function AnchorBioPills(props: {
  blockId: HabitAnchorBlock;
  todayWeightKg?: number | null;
  fuelSummary: ReturnType<typeof calculateDailyFuelSummary>;
  onAddWater: () => void;
  onStartWorkFocus: () => void;
}) {
  const { blockId, todayWeightKg, fuelSummary, onAddWater, onStartWorkFocus } = props;
  if (blockId === 'morning') {
    return (
      <>
        <Badge variant="secondary" className="text-[10px]">Weight: {todayWeightKg != null ? `${todayWeightKg}kg` : 'Log'}</Badge>
        <button type="button" onClick={onAddWater} className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium hover:bg-sky-500/20">
          +500ml Water ({fuelSummary.waterMl}ml)
        </button>
      </>
    );
  }
  if (blockId === 'work') {
    return (
      <>
        <Badge variant="secondary" className="text-[10px]">Protein: {fuelSummary.proteinConsumedG}/{fuelSummary.proteinTargetG}g</Badge>
        <button type="button" onClick={onStartWorkFocus} className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium hover:bg-amber-500/20">
          Start 2m Focus
        </button>
      </>
    );
  }
  if (blockId === 'gym') {
    return <Badge variant="secondary" className="text-[10px]">Steps: {fuelSummary.steps.toLocaleString()}/{fuelSummary.stepsTarget.toLocaleString()}</Badge>;
  }
  return (
    <Badge variant="secondary" className="text-[10px]">
      Sleep: {fuelSummary.sleepHours != null ? `${fuelSummary.sleepHours}h` : 'Pending'} · Junk: {fuelSummary.junkMealCount}
    </Badge>
  );
}
function AnchorHabitRow({
  habit,
  done,
  rest,
  onToggleHabit,
}: {
  habit: Habit;
  done: boolean;
  rest: boolean;
  onToggleHabit: (habit: Habit) => void;
}) {
  const isQuit = habit.polarity === 'quit';
  const actionLabel = done ? 'Done ✓' : isQuit ? 'Clean' : 'Complete';

  return (
    <div className={cn('flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs', getAnchorRowTone(done, rest, isQuit))}>
      <div className="flex items-center gap-2 min-w-0">
        <span>{habit.icon || (isQuit ? '🛡️' : '✓')}</span>
        <span className="font-medium text-foreground truncate">{habit.name}</span>
        {isQuit && <Badge variant="outline" className="text-[9px] text-rose-500 border-rose-500/30">Quit</Badge>}
        {rest && <Badge variant="outline" className="text-[9px] text-teal-600 dark:text-teal-400">Rest</Badge>}
      </div>
      <Button type="button" size="sm" variant={done ? 'default' : 'secondary'} onClick={() => onToggleHabit(habit)} className="h-7 px-2.5 text-[11px] shrink-0">
        {actionLabel}
      </Button>
    </div>
  );
}

function AnchorSupplementRow({
  sup,
  taken,
  onTakeSupplement,
}: {
  sup: ReturnType<typeof useFitnessStore.getState>['supplementInventory'][number];
  taken: boolean;
  onTakeSupplement: (sup: ReturnType<typeof useFitnessStore.getState>['supplementInventory'][number]) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/25 px-3 py-2 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <Pill className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        <span className="font-medium text-foreground truncate">{sup.name} ({sup.dailyDosage} {sup.unitLabel})</span>
      </div>
      <Button type="button" size="sm" variant={taken ? 'ghost' : 'secondary'} disabled={taken} onClick={() => onTakeSupplement(sup)} className="h-7 px-2.5 text-[11px] shrink-0">
        {taken ? 'Taken ✓' : 'Take Dose'}
      </Button>
    </div>
  );
}

export function AnchorBlockCard(props: {
  block: (typeof ANCHOR_BLOCKS)[number];
  blockHabits: Habit[];
  blockSupps: ReturnType<typeof useFitnessStore.getState>['supplementInventory'];
  todayWeightKg?: number | null;
  fuelSummary: ReturnType<typeof calculateDailyFuelSummary>;
  isCompletedOnDate: (id: string) => boolean;
  isRestOnDate: (id: string) => boolean;
  isSupplementTakenToday: (id: string) => boolean;
  onToggleHabit: (habit: Habit) => void;
  onTakeSupplement: (sup: ReturnType<typeof useFitnessStore.getState>['supplementInventory'][number]) => void;
  onAddWater: () => void;
  onStartWorkFocus: () => void;
}) {
  const { block, blockHabits, blockSupps, todayWeightKg, fuelSummary, isCompletedOnDate, isRestOnDate, isSupplementTakenToday, onToggleHabit, onTakeSupplement, onAddWater, onStartWorkFocus } = props;
  const Icon = block.icon;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', block.accentClass)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">{block.title}</h4>
            <p className="text-[11px] text-muted-foreground">{block.subtitle}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono">{blockHabits.length + blockSupps.length} items</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <AnchorBioPills blockId={block.id} todayWeightKg={todayWeightKg} fuelSummary={fuelSummary} onAddWater={onAddWater} onStartWorkFocus={onStartWorkFocus} />
      </div>

      {blockHabits.length === 0 && blockSupps.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">No habits or supplements anchored here yet.</p>
      ) : (
        <div className="space-y-1.5">
          {blockHabits.map((h) => (
            <AnchorHabitRow key={h.id} habit={h} done={isCompletedOnDate(h.id)} rest={isRestOnDate(h.id)} onToggleHabit={onToggleHabit} />
          ))}

          {blockSupps.map((sup) => (
            <AnchorSupplementRow
              key={sup.id}
              sup={sup}
              taken={isSupplementTakenToday(sup.id)}
              onTakeSupplement={onTakeSupplement}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function UnassignedHabitsCard({
  unassignedHabits,
  onAssign,
}: {
  unassignedHabits: Habit[];
  onAssign: (habit: Habit, blockId: (typeof ANCHOR_BLOCKS)[number]['id'], title: string) => void;
}) {
  if (unassignedHabits.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
      <p className="text-xs font-semibold text-foreground">Unassigned Habits ({unassignedHabits.length}) — assign to a time block in 1 tap</p>
      <div className="space-y-2">
        {unassignedHabits.slice(0, 8).map((habit) => (
          <div key={habit.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs">
            <span className="font-medium text-foreground">{habit.icon || '✓'} {habit.name}</span>
            <div className="flex items-center gap-1">
              {ANCHOR_BLOCKS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onAssign(habit, b.id, b.title)}
                  className="px-2 py-1 rounded-lg border border-border bg-muted/40 hover:bg-primary hover:text-primary-foreground text-[11px] font-medium transition-colors capitalize"
                >
                  {b.id}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
