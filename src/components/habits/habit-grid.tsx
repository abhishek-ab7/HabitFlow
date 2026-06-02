'use client';

import { useMemo, useState, useCallback, useEffect, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, getDaysInMonth, startOfMonth, getDay, isFuture, isToday } from 'date-fns';
import { Check, Flame, MoreHorizontal, Pencil, Trash2, Archive, Snowflake, Edit3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const CATEGORY_COLORS: Record<Category, string> = {
    health: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    work: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
    learning: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    personal: 'bg-pink-500/20 text-pink-600 dark:text-pink-400',
    finance: 'bg-sky-500/20 text-sky-600 dark:text-sky-400',
    relationships: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
};

const getStreakStyle = (streak: number) => {
    if (streak >= 100) return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
    if (streak >= 30) return 'bg-gradient-to-r from-orange-400 to-red-500 text-white';
    if (streak >= 7) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    if (streak >= 3) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return '';
};
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { SmartPointerSensor } from '@/lib/dnd-sensors';
import { toast } from 'sonner';
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
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedHabitForLog, setSelectedHabitForLog] = useState<Habit | null>(null);
  const [logDate, setLogDate] = useState('');
  const [logNote, setLogNote] = useState('');
  const [logValue, setLogValue] = useState(0);

  const handleOpenLogModal = (habit: Habit) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const habitsCompletionsMap = completionsMapByHabit.get(habit.id) || new Map();
    const comp = habitsCompletionsMap.get(todayStr);

    setSelectedHabitForLog(habit);
    setLogDate(todayStr);
    setLogNote(comp?.note || '');
    setLogValue(comp?.value || 0);
    setShowLogModal(true);
  };

  const handleSaveLogModal = async () => {
    if (!selectedHabitForLog) return;
    const { updateNote, updateValue } = useHabitStore.getState();
    await updateNote(selectedHabitForLog.id, logDate, logNote);
    if (selectedHabitForLog.isQuantitative) {
      await updateValue(selectedHabitForLog.id, logDate, logValue);
    }
    setShowLogModal(false);
    toast.success('Progress log updated');
  };
  const { getRoutinesForMultipleHabits, reorder, freezeHabit } = useHabitStore();
  const containerRef = useRef<HTMLDivElement>(null);

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
    useSensor(SmartPointerSensor, {
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
        tolerance: 8,
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

  // Compute displayed days (always full month for scrollable layout)
  const displayedDays = useMemo(() => {
    return days;
  }, [days]);

  // Helper to query completions efficiently
  const completionsMapByHabit = useMemo(() => {
    const map = new Map<string, Map<string, HabitCompletion>>();
    for (let i = 0; i < completions.length; i++) {
      const c = completions[i];
      if (!map.has(c.habitId)) {
        map.set(c.habitId, new Map());
      }
      map.get(c.habitId)!.set(c.date, c);
    }
    return map;
  }, [completions]);

  const mobileDays = useMemo(() => {
    const todayIndex = displayedDays.findIndex(d => d.isToday);
    if (todayIndex !== -1) {
      const start = Math.max(0, todayIndex - 4);
      return displayedDays.slice(start, todayIndex + 1);
    }
    return displayedDays.slice(-5);
  }, [displayedDays]);

  // Auto-scroll to center today's date on mobile mount (offsetting for the sticky column width)
  useEffect(() => {
    if (isMobile && containerRef.current) {
      const todayEl = containerRef.current.querySelector('.today-cell-header') as HTMLElement;
      if (todayEl) {
        const container = containerRef.current;
        const viewportWidth = container.clientWidth;
        const stickyWidth = 176; // w-44 width
        const visibleCellsWidth = viewportWidth - stickyWidth;
        
        const todayRect = todayEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const todayContentCenter = todayRect.left - containerRect.left + container.scrollLeft + todayRect.width / 2;
        
        const targetScrollLeft = todayContentCenter - (stickyWidth + visibleCellsWidth / 2);
        container.scrollLeft = Math.max(0, targetScrollLeft);
      }
    }
  }, [isMobile, displayedDays]);

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
    <div className="space-y-6">
      {/* DESKTOP LAYOUT (hidden on mobile) */}
      <div ref={containerRef} className="hidden lg:block overflow-x-auto pb-4 scrollbar-hide">
        <div className="w-fit min-w-full">
          {/* Header row with days */}
          <div className="flex items-center sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-2 border-b">
            <div className="w-44 md:w-64 shrink-0 sticky left-0 bg-background z-20 border-r border-border/40 self-stretch" /> {/* Sticky Left Spacer */}
            <div className="flex gap-0.5">
              {displayedDays.map(({ day, dayLabel, isWeekend, isToday: isTodayDate }) => (
                <div
                  key={day}
                  className={cn(
                    "w-9 h-14 flex flex-col items-center justify-center text-xs",
                    isWeekend && "text-muted-foreground",
                    isTodayDate && "font-bold today-cell-header"
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

      {/* MOBILE LAYOUT (hidden on desktop) */}
      <div className="lg:hidden space-y-4">
        {habits.map((habit) => {
          const streak = streaks.get(habit.id) || 0;
          const habitsCompletionsMap = completionsMapByHabit.get(habit.id) || new Map();

          return (
            <motion.div
              key={habit.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border rounded-2xl p-4 shadow-sm space-y-4 relative overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  {habit.icon && (
                    <span className="text-2xl shrink-0 p-2 bg-muted rounded-xl">
                      {habit.icon}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-foreground leading-tight break-words">
                      {habit.name}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge
                        variant="secondary"
                        className={cn("text-[9px] px-1.5 py-0 h-4 font-bold uppercase tracking-wider", CATEGORY_COLORS[habit.category])}
                      >
                        {habit.category}
                      </Badge>
                      {streak > 0 && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[9px] px-1.5 py-0 h-4 font-bold gap-0.5",
                            getStreakStyle(streak)
                          )}
                        >
                          <Flame className="h-2.5 w-2.5 fill-current" />
                          {streak}d
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dropdown Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => onEdit(habit)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenLogModal(habit)}>
                      <Edit3 className="h-4 w-4 mr-2 text-amber-500" />
                      Log Notes / Progress
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => freezeHabit(habit.id, format(new Date(), 'yyyy-MM-dd'))}>
                      <Snowflake className="h-4 w-4 mr-2" />
                      Freeze Today
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onArchive(habit.id)}>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(habit.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Quantitative details */}
              {habit.isQuantitative && (
                <div className="text-[10px] text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded-md w-fit">
                  Target: {habit.targetValue} {habit.unit}
                </div>
              )}

              {/* 5-Day Strip */}
              <div className="grid grid-cols-5 gap-1.5">
                {mobileDays.map(({ day, dateStr, isFuture: isFutureDate, isToday: isTodayDate, dayLabel }) => {
                  const comp = habitsCompletionsMap.get(dateStr);
                  const isCompleted = comp?.completed && comp?.status !== 'frozen';
                  const isFrozen = comp?.status === 'frozen';
                  
                  return (
                    <button
                      key={dateStr}
                      onClick={() => {
                        if (!isFutureDate) {
                          onToggle(habit.id, dateStr);
                        }
                      }}
                      disabled={isFutureDate}
                      className={cn(
                        "h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden border",
                        isCompleted
                          ? "bg-success/15 border-success/30 text-success"
                          : isFrozen
                            ? "bg-sky-500/15 border-sky-500/30 text-sky-500"
                            : isFutureDate
                              ? "bg-muted/10 border-transparent opacity-30 cursor-not-allowed"
                              : isTodayDate
                                ? "bg-primary/5 border-dashed border-primary text-primary font-bold animate-pulse"
                                : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <span className="text-[9px] font-bold uppercase opacity-60">
                        {dayLabel}
                      </span>
                      {isCompleted ? (
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      ) : isFrozen ? (
                        <Snowflake className="h-3 w-3" />
                      ) : habit.isQuantitative && comp?.value && comp.value > 0 ? (
                        <span className="text-xs font-mono font-bold leading-none">
                          {comp.value}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold leading-none">
                          {day}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={showLogModal} onOpenChange={setShowLogModal}>
        <DialogContent className="w-full max-w-sm rounded-2xl p-6 bg-background border shadow-xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-bold text-foreground">Log Progress</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update notes or quantitative values for {selectedHabitForLog?.name}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 my-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date</Label>
              <Input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>

            {selectedHabitForLog?.isQuantitative && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Progress ({selectedHabitForLog.unit || 'units'})
                </Label>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button"
                    size="icon" 
                    variant="outline" 
                    className="h-9 w-9 rounded-lg" 
                    onClick={() => setLogValue(prev => Math.max(0, prev - 1))}
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    value={logValue}
                    onChange={(e) => setLogValue(Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-9 text-center rounded-lg"
                  />
                  <Button 
                    type="button"
                    size="icon" 
                    variant="outline" 
                    className="h-9 w-9 rounded-lg" 
                    onClick={() => setLogValue(prev => prev + 1)}
                  >
                    +
                  </Button>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-1">
                    / {selectedHabitForLog.targetValue}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Journal Entry</Label>
              <Textarea
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                placeholder="Reflect on your progress..."
                className="min-h-[80px] text-xs resize-none rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button 
              type="button"
              variant="ghost" 
              onClick={() => setShowLogModal(false)}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={handleSaveLogModal}
              className="flex-1 rounded-xl"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
