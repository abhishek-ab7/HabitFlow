'use client';

import React from 'react';
import { DndContext, closestCenter, type DragEndEvent, type SensorDescriptor, type SensorOptions } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import type { Habit, HabitCompletion } from '@/lib/types';
import type { HabitDayInfo } from '../row/habit-row-helpers';
import { SortableHabitRow } from '../SortableHabitRow';

const EMPTY_HABIT_COMPLETIONS: HabitCompletion[] = [];

export function HabitGridDesktop({
  containerRef,
  displayedDays,
  habits,
  habitIds,
  completionsByHabit,
  streaks,
  sensors,
  onDragEnd,
  onToggle,
  onEdit,
  onDelete,
  onArchive,
  onFreeze,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  displayedDays: HabitDayInfo[];
  habits: Habit[];
  habitIds: string[];
  completionsByHabit: Map<string, HabitCompletion[]>;
  streaks: Map<string, number>;
  sensors: SensorDescriptor<SensorOptions>[];
  onDragEnd: (event: DragEndEvent) => void;
  onToggle: (habitId: string, date: string) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habitId: string) => void;
  onArchive: (habitId: string) => void;
  onFreeze: (habitId: string, date: string) => Promise<void>;
}) {
  return (
    <div ref={containerRef} className="overflow-x-auto pb-4 scrollbar-hide">
      <div className="w-fit min-w-full">
        <div className="flex items-center sticky top-0 bg-background/95 z-10 pb-2 border-b">
          <div className="w-44 md:w-64 shrink-0 sticky left-0 bg-background z-20 border-r border-border/40 self-stretch" />
          <div className="flex gap-0.5">
            {displayedDays.map(({ day, dayLabel, isWeekend, isToday: isTodayDate }) => (
              <div key={day} className={cn('w-9 h-14 flex flex-col items-center justify-center text-xs', isWeekend && 'text-muted-foreground', isTodayDate && 'font-bold today-cell-header')}>
                <span className={cn('text-[10px] mb-0.5', isWeekend ? 'text-muted-foreground/70' : 'text-muted-foreground')}>{dayLabel}</span>
                <span className={cn('w-6 h-6 flex items-center justify-center rounded-full', isTodayDate && 'bg-primary text-primary-foreground')}>{day}</span>
              </div>
            ))}
          </div>
          <div className="w-16 md:w-24 flex-shrink-0 text-center text-xs text-muted-foreground ml-auto">Progress</div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={habitIds} strategy={verticalListSortingStrategy}>
            <div className="divide-y divide-border/50">
              {habits.map((habit) => (
                <SortableHabitRow
                  key={habit.id}
                  habit={habit}
                  days={displayedDays}
                  completions={completionsByHabit.get(habit.id) || EMPTY_HABIT_COMPLETIONS}
                  streak={streaks.get(habit.id) || 0}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onArchive={onArchive}
                  onFreeze={onFreeze}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
