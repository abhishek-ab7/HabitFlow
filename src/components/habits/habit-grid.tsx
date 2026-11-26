'use client';

import { memo, useRef } from 'react';
import { getHabitWeekProgress } from '@/lib/calculations';
import { EmptyHabitsIllustration } from '@/components/ui/illustrations';
import type { Habit, HabitCompletion } from '@/lib/types';
import { HabitGridDesktop } from './grid/HabitGridDesktop';
import { HabitGridMobileCard } from './grid/HabitGridMobileCard';
import { HabitGridDialogs } from './grid/HabitGridDialogs';
import { useHabitGridController } from './grid/useHabitGridController';

const EMPTY_HABIT_COMPLETIONS: HabitCompletion[] = [];

interface HabitGridProps {
  habits: Habit[];
  completions: HabitCompletion[];
  selectedMonth: Date;
  onToggle: (habitId: string, date: string) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habitId: string) => void;
  onArchive: (habitId: string) => void;
  streaks: Map<string, number>;
}

export const HabitGrid = memo(function HabitGrid({
  habits, completions, selectedMonth, onToggle, onEdit, onDelete, onArchive, streaks,
}: HabitGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vm = useHabitGridController({ habits, completions, selectedMonth, containerRef });

  if (habits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4"><EmptyHabitsIllustration /></div>
        <h3 className="text-lg font-semibold mb-2">No habits yet</h3>
        <p className="text-muted-foreground max-w-sm">Create your first habit to start tracking your daily progress</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!vm.isMobile ? (
        <HabitGridDesktop
          containerRef={containerRef}
          displayedDays={vm.displayedDays}
          habits={habits}
          habitIds={vm.habitIds}
          completionsByHabit={vm.completionsByHabit}
          streaks={streaks}
          sensors={vm.sensors}
          onDragEnd={vm.handleDragEnd}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          onArchive={onArchive}
          onFreeze={vm.freezeHabit}
        />
      ) : (
        <div className="space-y-4">
          {habits.map((habit) => {
            const habitComps = vm.completionsByHabit.get(habit.id) || EMPTY_HABIT_COMPLETIONS;
            return (
              <HabitGridMobileCard
                key={habit.id}
                habit={habit}
                streak={streaks.get(habit.id) || 0}
                completions={completions}
                habitsCompletionsMap={vm.completionsMapByHabit.get(habit.id) || new Map()}
                weekProg={getHabitWeekProgress(habit, habitComps, new Date())}
                mobileDays={vm.mobileDays}
                onToggleDay={(dateStr, isCompleted) => {
                  if (isCompleted) vm.feedback.uncheck();
                  else vm.feedback.complete();
                  onToggle(habit.id, dateStr);
                }}
                onEdit={() => onEdit(habit)}
                onOpenLogModal={() => vm.handleOpenLogModal(habit)}
                onStartUrgeTimer={() => vm.startUrgeTimer(habit.id, habit.name)}
                onMobileRest={(dateStr) => vm.handleMobileRest(habit.id, dateStr)}
                onMobileFreeze={(dateStr) => vm.handleMobileFreeze(habit.id, dateStr)}
                onArchive={() => onArchive(habit.id)}
                onDelete={() => onDelete(habit.id)}
              />
            );
          })}
        </div>
      )}

      <HabitGridDialogs
        showLogModal={vm.showLogModal}
        setShowLogModal={vm.setShowLogModal}
        selectedHabitForLog={vm.selectedHabitForLog}
        logDate={vm.logDate}
        setLogDate={vm.setLogDate}
        logValue={vm.logValue}
        setLogValue={vm.setLogValue}
        logNote={vm.logNote}
        setLogNote={vm.setLogNote}
        onSaveLogModal={vm.handleSaveLogModal}
        showNoShieldsDialog={vm.showNoShieldsDialog}
        setShowNoShieldsDialog={vm.setShowNoShieldsDialog}
        onGoToSettings={() => {
          vm.setShowNoShieldsDialog(false);
          vm.router.push('/settings');
        }}
      />
    </div>
  );
});
