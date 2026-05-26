'use client';

import { useMemo, useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, getDaysInMonth, startOfMonth, getDay, isFuture, isToday } from 'date-fns';
import { Check } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { cn } from '@/lib/utils';
import { EmptyHabitsIllustration } from '@/components/ui/illustrations';
import type { Habit, HabitCompletion, Category, Routine } from '@/lib/types';
import { useHabitStore } from '@/lib/stores/habit-store';
import { SortableHabitRow } from './SortableHabitRow';

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
  habits,
  completions,
  selectedMonth,
  onToggle,
  onEdit,
  onDelete,
  onArchive,
  streaks,
}: HabitGridProps) {
  const [rippleCell, setRippleCell] = useState<string | null>(null);
  const [habitRoutines, setHabitRoutines] = useState<Map<string, Routine[]>>(new Map());
  const [isMobile, setIsMobile] = useState(false);
  const { getRoutinesForMultipleHabits, reorder, freezeHabit } = useHabitStore();

  // Handle window resizing to detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Load routines for all habits in a single batch query (avoids N+1 issue)
  useEffect(() => {
    const loadRoutines = async () => {
      if (habits.length === 0) {
        setHabitRoutines(new Map());
        return;
      }

      const habitIds = habits.map(h => h.id);
      const routinesMap = await getRoutinesForMultipleHabits(habitIds);
      setHabitRoutines(routinesMap);
    };
    loadRoutines();
  }, [habits, getRoutinesForMultipleHabits]);

  // Generate days for the month
  const days = useMemo(() => {
    const daysInMonth = getDaysInMonth(selectedMonth);
    const firstDayOfWeek = getDay(startOfMonth(selectedMonth));

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayOfWeek = (firstDayOfWeek + i) % 7;

      return {
        day,
        dateStr,
        dayOfWeek,
        dayLabel: format(date, 'EEE')[0], // M, T, W, etc.
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isFuture: isFuture(date),
        isToday: isToday(date),
      };
    });
  }, [selectedMonth]);

  // Compute displayed days (7 days on mobile, full month on desktop)
  const displayedDays = useMemo(() => {
    if (!isMobile) return days;

    const todayIndex = days.findIndex(d => d.isToday);
    if (todayIndex !== -1) {
      // Center today if possible, showing last 5 days and today + 1 day
      const start = Math.max(0, todayIndex - 5);
      return days.slice(start, start + 7);
    }
    // Return last 7 days of the selected month if today is not in it
    return days.slice(-7);
  }, [days, isMobile]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = habits.findIndex((h) => h.id === active.id);
      const newIndex = habits.findIndex((h) => h.id === over.id);

      const newOrder = arrayMove(habits, oldIndex, newIndex);
      const orderedIds = newOrder.map(h => h.id);

      // Optimistic update handled by DnD kit conceptually, 
      // but we call store to update state and persist
      await reorder(orderedIds);
    }
  };

  if (habits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4">
          <EmptyHabitsIllustration />
        </div>
        <h3 className="text-lg font-semibold mb-2">No habits yet</h3>
        <p className="text-muted-foreground max-w-sm">
          Create your first habit to start tracking your daily progress
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4 scrollbar-hide">
      <div className="min-w-full md:min-w-[800px]">
        {/* Header row with days */}
        <div className="flex items-center sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-2 border-b">
          <div className="w-36 md:w-52 flex-shrink-0" /> {/* Responsive Spacer */}
          <div className="flex gap-0.5">
            {displayedDays.map(({ day, dayLabel, isWeekend, isToday: isTodayDate }) => (
              <div
                key={day}
                className={cn(
                  "w-9 h-14 flex flex-col items-center justify-center text-xs",
                  isWeekend && "text-muted-foreground",
                  isTodayDate && "font-bold"
                )}
              >
                <span className={cn(
                  "text-[10px] mb-0.5",
                  isWeekend ? "text-muted-foreground/70" : "text-muted-foreground"
                )}>
                  {dayLabel}
                </span>
                <span className={cn(
                  "w-6 h-6 flex items-center justify-center rounded-full",
                  isTodayDate && "bg-primary text-primary-foreground"
                )}>
                  {day}
                </span>
              </div>
            ))}
          </div>
          <div className="w-16 md:w-24 flex-shrink-0 text-center text-xs text-muted-foreground ml-auto">
            Progress
          </div>
        </div>

        {/* Habit rows */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={habits.map(h => h.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="divide-y divide-border/50">
              {habits.map((habit) => {
                const streak = streaks.get(habit.id) || 0;
                return (
                  <SortableHabitRow
                    key={habit.id}
                    habit={habit}
                    days={displayedDays}
                    completions={completions}
                    streak={streak}
                    habitRoutines={habitRoutines.get(habit.id)}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onArchive={onArchive}
                    onFreeze={freezeHabit}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
});
