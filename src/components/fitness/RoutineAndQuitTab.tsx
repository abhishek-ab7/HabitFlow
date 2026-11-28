'use client';

import { Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ANCHOR_BLOCKS } from '@/lib/fitness/routine-quit-helpers';
import { useRoutineQuitController } from './routine/useRoutineQuitController';
import { QuitTrackersSection } from './routine/QuitTrackersSection';
import { AnchorBlockCard, UnassignedHabitsCard } from './routine/AnchorRoutineSections';

interface RoutineAndQuitTabProps {
  selectedDate: string;
  userId: string;
}

export function RoutineAndQuitTab({ selectedDate, userId }: RoutineAndQuitTabProps) {
  const s = useRoutineQuitController(selectedDate, userId);

  return (
    <div className="space-y-5">
      <QuitTrackersSection
        activeHabits={s.activeHabits}
        quitHabits={s.quitHabits}
        streaks={s.streaks}
        fuelSummary={s.fuelSummary}
        isCompletedOnDate={s.isCompletedOnDate}
        onToggleHabit={s.handleToggleHabit}
        onStartUrge={s.startUrgeTimer}
        onCreateStarterQuit={s.handleCreateStarterQuit}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-foreground">Time-Blocked Anchor Routines</h3>
            <p className="text-xs text-muted-foreground">Habits, supplement doses &amp; bio check-ins organized across your 4 daily anchors</p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => s.startPresetTimer('starter_2m', { title: '2-Min Rule Anti-Procrastination Starter', openPanel: true })} className="gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5 text-amber-500" /> 2m Starter Timer
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ANCHOR_BLOCKS.map((block) => (
            <AnchorBlockCard
              key={block.id}
              block={block}
              blockHabits={s.activeHabits.filter((h) => h.anchorBlock === block.id)}
              blockSupps={s.activeSupps.filter((sup) => sup.anchorBlock === block.id)}
              todayWeightKg={s.todayLog?.weightKg}
              fuelSummary={s.fuelSummary}
              isCompletedOnDate={s.isCompletedOnDate}
              isRestOnDate={s.isRestOnDate}
              isSupplementTakenToday={s.isSupplementTakenToday}
              onToggleHabit={s.handleToggleHabit}
              onTakeSupplement={async (sup) => {
                s.feedback.complete();
                await s.takeSupplementDose(sup.id, {
                  servings: sup.dailyDosage,
                  date: selectedDate,
                  notes: null,
                  userIdOverride: userId,
                });
                toast.success(`Took ${sup.name}`);
              }}
              onAddWater={() => {
                s.feedback.complete();
                s.incrementWater(500, selectedDate, userId);
                toast.success('+500ml morning hydration');
              }}
              onStartWorkFocus={() => s.startPresetTimer('starter_2m', { title: 'Work Anchor · 2m Focus Start', openPanel: true })}
            />
          ))}
        </div>

        <UnassignedHabitsCard
          unassignedHabits={s.unassignedHabits}
          onAssign={async (habit, blockId, title) => {
            await s.editHabit(habit.id, { anchorBlock: blockId });
            toast.success(`Anchored "${habit.name}" to ${title}`);
          }}
        />
      </div>
    </div>
  );
}
