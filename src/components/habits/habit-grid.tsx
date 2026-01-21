'use client';

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, getDaysInMonth, startOfMonth, getDay, isFuture, isToday } from 'date-fns';
import { Check, Flame, MoreHorizontal, Pencil, Trash2, Archive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { SuccessRipple } from '@/components/motion';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/design-tokens';
import { STREAK_MILESTONES, CATEGORY_LABELS } from '@/lib/types';
import type { Habit, HabitCompletion, Category } from '@/lib/types';

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

const CATEGORY_COLORS: Record<Category, string> = {
  health: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  work: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  learning: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  personal: 'bg-pink-500/20 text-pink-600 dark:text-pink-400',
  finance: 'bg-sky-500/20 text-sky-600 dark:text-sky-400',
  relationships: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
};

export function HabitGrid({
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

  // Check if a habit is completed on a specific date
  const isCompleted = useCallback((habitId: string, dateStr: string) => {
    return completions.some(c => c.habitId === habitId && c.date === dateStr && c.completed);
  }, [completions]);

  // Count completions for a habit in the month
  const getMonthlyCount = useCallback((habitId: string) => {
    return completions.filter(c => c.habitId === habitId && c.completed).length;
  }, [completions]);

  // Handle cell click with animation
  const handleCellClick = (habitId: string, dateStr: string, isFutureDate: boolean) => {
    if (isFutureDate) return;

    const cellKey = `${habitId}-${dateStr}`;
    setRippleCell(cellKey);
    onToggle(habitId, dateStr);

    setTimeout(() => setRippleCell(null), 500);
  };

  // Get streak milestone styling
  const getStreakStyle = (streak: number) => {
    if (streak >= 100) return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
    if (streak >= 30) return 'bg-gradient-to-r from-orange-400 to-red-500 text-white';
    if (streak >= 7) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    if (streak >= 3) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return '';
  };

  if (habits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Check className="h-8 w-8 text-muted-foreground" />
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
      <div className="min-w-[800px]">
        {/* Header row with days */}
        <div className="flex items-center sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-2 border-b">
          <div className="w-52 flex-shrink-0" /> {/* Spacer for habit column */}
          <div className="flex gap-0.5">
            {days.map(({ day, dayLabel, isWeekend, isToday: isTodayDate }) => (
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
          <div className="w-24 flex-shrink-0 text-center text-xs text-muted-foreground">
            Progress
          </div>
        </div>

        {/* Habit rows */}
        <div className="divide-y divide-border/50">
          {habits.map((habit, index) => {
            const streak = streaks.get(habit.id) || 0;
            const monthlyCount = getMonthlyCount(habit.id);
            const totalDays = days.filter(d => !d.isFuture).length;
            const percentage = totalDays > 0 ? Math.round((monthlyCount / totalDays) * 100) : 0;

            return (
              <motion.div
                key={habit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center py-2 group"
              >
                {/* Habit info */}
                <div className="w-52 flex-shrink-0 flex items-center gap-2 pr-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {habit.icon && <span className="text-lg">{habit.icon}</span>}
                      <span className="font-medium text-sm truncate">{habit.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="secondary"
                        className={cn("text-[10px] px-1.5 py-0 h-4", CATEGORY_COLORS[habit.category])}
                      >
                        {habit.category}
                      </Badge>
                      {streak > 0 && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] px-1.5 py-0 h-4 gap-0.5",
                            getStreakStyle(streak)
                          )}
                        >
                          <Flame className="h-2.5 w-2.5" />
                          {streak}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => onEdit(habit)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
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

                {/* Day cells */}
                <div className="flex gap-0.5">
                  {days.map(({ day, dateStr, isFuture: isFutureDate, isToday: isTodayDate }) => {
                    const completed = isCompleted(habit.id, dateStr);
                    const cellKey = `${habit.id}-${dateStr}`;
                    const showRipple = rippleCell === cellKey && completed;

                    return (
                      <motion.button
                        key={day}
                        onClick={() => handleCellClick(habit.id, dateStr, isFutureDate)}
                        disabled={isFutureDate}
                        className={cn(
                          "relative w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          completed
                            ? "bg-success/20 text-success hover:bg-success/30"
                            : isFutureDate
                              ? "bg-muted/20 cursor-not-allowed opacity-40"
                              : isTodayDate
                                ? "bg-primary/10 border-2 border-dashed border-primary/30 hover:bg-primary/20"
                                : "bg-muted/40 hover:bg-muted/60",
                        )}
                        whileHover={!isFutureDate ? { scale: 1.05 } : {}}
                        whileTap={!isFutureDate ? { scale: 0.95 } : {}}
                      >
                        <AnimatePresence mode="wait">
                          {completed && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            >
                              <Check className="h-4 w-4" />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <SuccessRipple trigger={showRipple} />
                      </motion.button>
                    );
                  })}
                </div>

                {/* Progress */}
                <div className="w-24 flex-shrink-0 flex flex-col items-center gap-1">
                  <span className="text-sm font-medium tabular-nums">
                    {monthlyCount}/{totalDays}
                  </span>
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
