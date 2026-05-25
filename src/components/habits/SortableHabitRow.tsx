'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Flame, MoreHorizontal, Pencil, Trash2, Archive, Link2, GripVertical } from 'lucide-react';
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
import type { Habit, HabitCompletion, Category, Routine } from '@/lib/types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableHabitRowProps {
    habit: Habit;
    days: {
        day: number;
        dateStr: string;
        dayOfWeek: number;
        dayLabel: string;
        isWeekend: boolean;
        isFuture: boolean;
        isToday: boolean;
    }[];
    completions: HabitCompletion[];
    streak: number;
    habitRoutines?: Routine[];
    onToggle: (habitId: string, date: string) => void;
    onEdit: (habit: Habit) => void;
    onDelete: (habitId: string) => void;
    onArchive: (habitId: string) => void;
}

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

export function SortableHabitRow({
    habit,
    days,
    completions,
    streak,
    habitRoutines,
    onToggle,
    onEdit,
    onDelete,
    onArchive,
}: SortableHabitRowProps) {
    const [rippleCell, setRippleCell] = useState<string | null>(null);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: habit.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
    };

    const getMonthlyCount = () => {
        return completions.filter(c => c.habitId === habit.id && c.completed).length;
    };

    const isCompleted = (dateStr: string) => {
        return completions.some(c => c.habitId === habit.id && c.date === dateStr && c.completed);
    };

    const handleCellClick = (dateStr: string, isFutureDate: boolean) => {
        if (isFutureDate) return;

        const cellKey = `${habit.id}-${dateStr}`;
        setRippleCell(cellKey);
        onToggle(habit.id, dateStr);

        setTimeout(() => setRippleCell(null), 500);
    };

    const monthlyCount = getMonthlyCount();
    const totalDays = days.filter(d => !d.isFuture).length;
    const percentage = totalDays > 0 ? Math.round((monthlyCount / totalDays) * 100) : 0;

    return (
        <div ref={setNodeRef} style={style} className="flex items-center py-2 group bg-background relative">
            {/* Habit info */}
            <div className="w-52 flex-shrink-0 flex items-center gap-2 pr-3">
                {/* Drag Handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab hover:text-foreground text-muted-foreground/50 active:cursor-grabbing p-1 -ml-2"
                >
                    <GripVertical className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {habit.icon && <span className="text-lg">{habit.icon}</span>}
                        <span className="font-medium text-sm truncate">{habit.name}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
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
                        {habitRoutines?.map((routine) => (
                            <Badge
                                key={routine.id}
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 gap-0.5 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                                title={`Part of routine: ${routine.title}`}
                            >
                                <Link2 className="h-2 w-2" />
                                {routine.title.length > 8 ? routine.title.substring(0, 8) + '...' : routine.title}
                            </Badge>
                        ))}
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
                    const completed = isCompleted(dateStr);
                    const cellKey = `${habit.id}-${dateStr}`;
                    const showRipple = rippleCell === cellKey && completed;

                    return (
                        <motion.button
                            key={day}
                            onClick={() => handleCellClick(dateStr, isFutureDate)}
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
            <div className="w-24 flex-shrink-0 flex flex-col items-center gap-1 ml-auto">
                <span className="text-sm font-medium tabular-nums">
                    {monthlyCount}/{totalDays}
                </span>
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            </div>
        </div>
    );
}
