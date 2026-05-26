'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Flame, MoreHorizontal, Pencil, Trash2, Archive, Link2, GripVertical, Snowflake, Edit3, MessageSquarePlus, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StreakRecoveryPrompt } from './StreakRecoveryPrompt';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { SuccessRipple } from '@/components/motion';
import { cn } from '@/lib/utils';
import type { Habit, HabitCompletion, Category, Routine } from '@/lib/types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFeedback } from '@/hooks/use-feedback';
import { useHabitStore } from '@/lib/stores/habit-store';
import { toast } from 'sonner';
import { ShareCardModal } from './ShareCardModal';

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
    onFreeze?: (habitId: string, date: string) => void;
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
    onFreeze,
}: SortableHabitRowProps) {
    const [rippleCell, setRippleCell] = useState<string | null>(null);
    const [burstActive, setBurstActive] = useState<string | null>(null);
    const [openPopoverDate, setOpenPopoverDate] = useState<string | null>(null);
    const [tempNote, setTempNote] = useState('');
    const [tempValue, setTempValue] = useState(0);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showRecovery, setShowRecovery] = useState(false);

    const yesterdayStr = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    }, []);

    const dayBeforeYesterdayStr = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 2);
        return d.toISOString().split('T')[0];
    }, []);

    const completionMap = useMemo(() => {
        const map = new Map<string, HabitCompletion>();
        for (let i = 0; i < completions.length; i++) {
            const c = completions[i];
            if (c.habitId === habit.id) {
                map.set(c.date, c);
            }
        }
        return map;
    }, [completions, habit.id]);

    const getCompletion = (dateStr: string) => {
        return completionMap.get(dateStr);
    };

    const isStreakBrokenYesterday = useMemo(() => {
        const yesterdayComp = completionMap.get(yesterdayStr);
        const dayBeforeComp = completionMap.get(dayBeforeYesterdayStr);
        
        const missedYesterday = !yesterdayComp || (!yesterdayComp.completed && yesterdayComp.status !== 'frozen');
        const completedDayBefore = dayBeforeComp && dayBeforeComp.completed && dayBeforeComp.status !== 'frozen';
        
        return missedYesterday && completedDayBefore;
    }, [yesterdayStr, dayBeforeYesterdayStr, completionMap]);

    const { triggerPop, triggerChime } = useFeedback();
    const { updateNote, updateValue } = useHabitStore();

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
        let count = 0;
        completionMap.forEach(c => {
            if (c.completed && c.status !== 'frozen') {
                count++;
            }
        });
        return count;
    };

    const handleOpenPopover = (dateStr: string) => {
        const comp = getCompletion(dateStr);
        setTempNote(comp?.note || '');
        setTempValue(comp?.value || 0);
        setOpenPopoverDate(dateStr);
    };

    const handleSavePopover = async (dateStr: string) => {
        await updateNote(habit.id, dateStr, tempNote);
        if (habit.isQuantitative) {
            await updateValue(habit.id, dateStr, tempValue);
        }
        setOpenPopoverDate(null);
    };

    const handleCellClick = (dateStr: string, isFutureDate: boolean, isShiftKey = false) => {
        if (isFutureDate) return;

        const cellKey = `${habit.id}-${dateStr}`;
        const comp = getCompletion(dateStr);

        if (habit.isQuantitative) {
            const currentValue = comp?.value || 0;
            const target = habit.targetValue || 1;

            let newValue = currentValue;
            if (isShiftKey) {
                newValue = Math.max(0, currentValue - 1);
            } else {
                if (currentValue >= target) {
                    newValue = 0;
                } else {
                    newValue = currentValue + 1;
                }
            }

            setRippleCell(cellKey);
            triggerChime();

            if (newValue >= target && currentValue < target) {
                setBurstActive(dateStr);
                setTimeout(() => setBurstActive(null), 800);
            }

            updateValue(habit.id, dateStr, newValue);
            setTimeout(() => setRippleCell(null), 500);
        } else {
            const completed = comp?.completed && comp?.status !== 'frozen';
            setRippleCell(cellKey);

            if (!completed) {
                triggerChime();
                setBurstActive(dateStr);
                setTimeout(() => setBurstActive(null), 800);
            } else {
                triggerPop();
            }

            onToggle(habit.id, dateStr);
            setTimeout(() => setRippleCell(null), 500);
        }
    };

    const handleCellRightClick = async (e: React.MouseEvent, dateStr: string, isFutureDate: boolean) => {
        e.preventDefault();
        if (isFutureDate || !onFreeze) return;
        
        const cellKey = `${habit.id}-${dateStr}`;
        setRippleCell(cellKey);
        triggerPop(); // Provide feedback for freeze too
        try {
            await onFreeze(habit.id, dateStr);
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setTimeout(() => setRippleCell(null), 500);
        }
    };

    const monthlyCount = getMonthlyCount();
    const totalDays = days.filter(d => !d.isFuture).length;
    const percentage = totalDays > 0 ? Math.round((monthlyCount / totalDays) * 100) : 0;

    return (
        <div ref={setNodeRef} style={style} className="flex items-center py-2 group bg-background relative">
            {/* Habit info */}
            <div className="w-44 md:w-64 shrink-0 flex items-center gap-2 pr-3 sticky left-0 bg-background z-10 border-r border-border/40">
                {/* Drag Handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab hover:text-foreground text-muted-foreground/50 active:cursor-grabbing p-1 -ml-2"
                >
                    <GripVertical className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 min-w-0">
                        {habit.icon && <span className="text-lg shrink-0 mt-0.5">{habit.icon}</span>}
                        <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm break-normal whitespace-normal leading-tight block">{habit.name}</span>
                            {habit.isQuantitative && (
                                <span className="text-[10px] text-muted-foreground font-mono block">
                                    Target: {habit.targetValue} {habit.unit}
                                </span>
                            )}
                        </div>
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
                        {isStreakBrokenYesterday && (
                            <div className="relative">
                                <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 h-4 bg-red-500/10 border-red-500/20 text-red-500 animate-pulse cursor-pointer hover:bg-red-500/20"
                                    onClick={() => setShowRecovery(true)}
                                >
                                    Recover
                                </Badge>
                                <AnimatePresence>
                                    {showRecovery && (
                                        <StreakRecoveryPrompt
                                            habit={habit}
                                            dateStr={yesterdayStr}
                                            onRecover={async () => {
                                                const { ensureComplete, updateNote, updateValue } = useHabitStore.getState();
                                                await ensureComplete(habit.id, yesterdayStr);
                                                await updateNote(habit.id, yesterdayStr, "Recovered via double completion.");
                                                
                                                const todayStr = new Date().toISOString().split('T')[0];
                                                await ensureComplete(habit.id, todayStr);
                                                if (habit.isQuantitative) {
                                                    const target = habit.targetValue || 1;
                                                    await updateValue(habit.id, todayStr, target * 2);
                                                } else {
                                                    await updateNote(habit.id, todayStr, "Double completion!");
                                                }
                                                
                                                toast.success("Streak recovered! Completed double task today.");
                                                setShowRecovery(false);
                                            }}
                                            onDismiss={() => setShowRecovery(false)}
                                        />
                                    )}
                                </AnimatePresence>
                            </div>
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
                            className="h-7 w-7 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => onEdit(habit)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowShareModal(true)}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Share Streak
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

            <div className="flex gap-0.5">
                {days.map(({ day, dateStr, isFuture: isFutureDate, isToday: isTodayDate }) => {
                    const comp = getCompletion(dateStr);
                    const isCompleted = comp?.completed && comp?.status !== 'frozen';
                    const isFrozen = comp?.status === 'frozen';
                    const cellKey = `${habit.id}-${dateStr}`;
                    const showRipple = rippleCell === cellKey && (isCompleted || isFrozen);

                    const innerButton = (
                        <motion.button
                            onClick={(e) => handleCellClick(dateStr, isFutureDate, e.shiftKey)}
                            onContextMenu={(e) => handleCellRightClick(e, dateStr, isFutureDate)}
                            disabled={isFutureDate}
                            className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center transition-all relative overflow-hidden",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                isCompleted
                                    ? "bg-success/20 text-success hover:bg-success/30"
                                    : isFrozen
                                        ? "bg-sky-500/20 text-sky-500 hover:bg-sky-500/30"
                                        : isFutureDate
                                            ? "bg-muted/20 cursor-not-allowed opacity-40"
                                            : isTodayDate
                                                ? "bg-primary/10 border-2 border-dashed border-primary/30 hover:bg-primary/20"
                                                : "bg-muted/40 hover:bg-muted/60",
                            )}
                            whileHover={!isFutureDate ? { scale: 1.05 } : {}}
                            whileTap={!isFutureDate ? { scale: 0.95 } : {}}
                            title={isFutureDate ? undefined : "Left click: toggle/increment. Shift+click: decrement. Right click: freeze."}
                        >
                            {burstActive === dateStr && (
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible z-50">
                                    {Array.from({ length: 8 }).map((_, i) => {
                                        const angle = (i * 360) / 8;
                                        const distance = 20 + Math.random() * 15;
                                        const x = Math.cos((angle * Math.PI) / 180) * distance;
                                        const y = Math.sin((angle * Math.PI) / 180) * distance;
                                        const colorClass = ['bg-emerald-400', 'bg-teal-400', 'bg-green-400', 'bg-yellow-400'][i % 4];
                                        return (
                                            <motion.div
                                                key={i}
                                                className={cn("absolute w-1.5 h-1.5 rounded-full", colorClass)}
                                                initial={{ x: 0, y: 0, scale: 0.8, opacity: 1 }}
                                                animate={{ x, y, scale: 0, opacity: 0 }}
                                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                            />
                                        );
                                    })}
                                </div>
                            )}

                            {/* Render quantitative status or default checklist icons */}
                            <AnimatePresence mode="wait">
                                {isCompleted ? (
                                    <motion.div
                                        key="completed"
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                    >
                                        <Check className="h-4 w-4" />
                                    </motion.div>
                                ) : isFrozen ? (
                                    <motion.div
                                        key="frozen"
                                        initial={{ scale: 0, opacity: 0, rotate: -45 }}
                                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                        exit={{ scale: 0, opacity: 0, rotate: 45 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                    >
                                        <Snowflake className="h-4 w-4" />
                                    </motion.div>
                                ) : habit.isQuantitative && comp?.value && comp.value > 0 ? (
                                    <motion.div
                                        key="quantitative-val"
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        className="text-xs font-bold font-mono"
                                    >
                                        {comp.value}
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>

                            {/* Note indicator: small curl/dot if note exists */}
                            {comp?.note && (
                                <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
                            )}

                            <SuccessRipple trigger={showRipple} />
                        </motion.button>
                    );

                    const finalButton = comp?.note ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                {innerButton}
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs p-2.5 space-y-1 bg-popover text-popover-foreground border shadow-md">
                                <p className="font-semibold text-[10px] text-muted-foreground/80">
                                    {format(new Date(dateStr), 'MMM d, yyyy')}
                                </p>
                                <p className="text-xs leading-relaxed italic">"{comp.note}"</p>
                            </TooltipContent>
                        </Tooltip>
                    ) : innerButton;

                    return (
                        <div key={day} className="relative group/cell">
                            {finalButton}
                            {!isFutureDate && (
                                <Popover open={openPopoverDate === dateStr} onOpenChange={(open) => {
                                    if (open) {
                                        handleOpenPopover(dateStr);
                                    } else {
                                        setOpenPopoverDate(null);
                                    }
                                }}>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation(); // Don't trigger cell click
                                            }}
                                            className={cn(
                                                "absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center border shadow-sm transition-all z-20",
                                                comp?.note 
                                                    ? "opacity-100 bg-amber-500 text-white border-amber-600" 
                                                    : "opacity-0 group-hover/cell:opacity-100 bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                                            )}
                                            title="Add note / edit count"
                                        >
                                            <Pencil className="h-2 w-2" />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent 
                                        side="top" 
                                        align="center" 
                                        className="w-72 p-4 space-y-4 z-50 bg-popover border shadow-lg rounded-xl"
                                        onClick={(e) => e.stopPropagation()} // Don't trigger row/cell actions
                                    >
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                {format(new Date(dateStr), 'EEEE, MMMM d')}
                                            </p>
                                            <h4 className="text-sm font-bold truncate">{habit.name}</h4>
                                        </div>

                                        {habit.isQuantitative && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                                                    Progress ({habit.unit || 'units'})
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <Button 
                                                        type="button"
                                                        size="icon" 
                                                        variant="outline" 
                                                        className="h-8 w-8" 
                                                        onClick={() => setTempValue(prev => Math.max(0, prev - 1))}
                                                    >
                                                        -
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        value={tempValue}
                                                        onChange={(e) => setTempValue(Math.max(0, parseInt(e.target.value) || 0))}
                                                        className="h-8 text-center"
                                                    />
                                                    <Button 
                                                        type="button"
                                                        size="icon" 
                                                        variant="outline" 
                                                        className="h-8 w-8" 
                                                        onClick={() => setTempValue(prev => prev + 1)}
                                                    >
                                                        +
                                                    </Button>
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-1">
                                                        / {habit.targetValue}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                                                Journal Entry
                                            </label>
                                            <Textarea
                                                value={tempNote}
                                                onChange={(e) => setTempNote(e.target.value)}
                                                placeholder="Write a reflection or note..."
                                                className="min-h-[80px] text-xs resize-none"
                                            />
                                        </div>

                                        <div className="flex justify-end gap-2 pt-2 border-t">
                                            <Button 
                                                type="button"
                                                size="sm" 
                                                variant="ghost" 
                                                onClick={() => setOpenPopoverDate(null)}
                                            >
                                                Cancel
                                            </Button>
                                            <Button 
                                                type="button"
                                                size="sm" 
                                                onClick={() => handleSavePopover(dateStr)}
                                            >
                                                Save
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Progress */}
            <div className="w-16 md:w-24 flex-shrink-0 flex flex-col items-center gap-1 ml-auto">
                <span className="text-sm font-medium tabular-nums">
                    {monthlyCount}/{totalDays}
                </span>
                <div className="w-10 md:w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            </div>

            <ShareCardModal
                open={showShareModal}
                onOpenChange={setShowShareModal}
                habit={habit}
                streak={streak}
            />
        </div>
    );
}
