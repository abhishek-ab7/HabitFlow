import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Routine, Habit } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Settings2, Clock, MapPin, MoreHorizontal, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRoutineStore } from '@/lib/stores/routine-store';
import { useHabitStore } from '@/lib/stores/habit-store';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RoutineCardProps {
    routine: Routine;
    onPlay: (routine: Routine) => void;
    onEdit: (routine: Routine) => void;
    onDelete: (id: string) => void;
}

export function RoutineCard({ routine, onPlay, onEdit, onDelete }: RoutineCardProps) {
    const { getHabitCompletions, completions } = useHabitStore();
    const { getRoutineHabits } = useRoutineStore();
    const [routineHabits, setRoutineHabits] = useState<Habit[]>([]);
    const [isCompleted, setIsCompleted] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const checkCompletion = async () => {
            try {
                const habits = await getRoutineHabits(routine.id);
                if (!mounted) return;

                setRoutineHabits(habits);

                if (habits.length === 0) {
                    setIsCompleted(false);
                    setLoading(false);
                    return;
                }

                // Check if ALL habits in this routine are completed for today
                const today = new Date().toISOString().split('T')[0];
                let allDone = true;

                for (const habit of habits) {
                    // We can use the store's completions directly since we have them now
                    // fetching getHabitCompletions is fine too, but we need to ensure reactivity
                    const habitCompletions = getHabitCompletions(habit.id);
                    const isDoneToday = habitCompletions.some(c => c.date === today && c.completed);
                    if (!isDoneToday) {
                        allDone = false;
                        break;
                    }
                }

                if (mounted) {
                    setIsCompleted(allDone);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Error checking routine completion", error);
                if (mounted) setLoading(false);
            }
        };

        checkCompletion();

        return () => { mounted = false; };
    }, [routine.id, completions, getRoutineHabits, getHabitCompletions]); // Re-run when completions change

    // Memoize progress calculation to avoid recalculation on every render
    // and ensure it updates when completions change in the store
    const { totalHabits, completedHabits, progressPercentage } = useMemo(() => {
        const total = routineHabits.length;
        let completed = 0;

        if (total > 0) {
            const today = new Date().toISOString().split('T')[0];
            completed = routineHabits.filter(habit => {
                const habitCompletions = getHabitCompletions(habit.id);
                return habitCompletions.some(c => c.date === today && c.completed);
            }).length;
        }

        return {
            totalHabits: total,
            completedHabits: completed,
            progressPercentage: total > 0 ? (completed / total) * 100 : 0
        };
    }, [routineHabits, getHabitCompletions, completions]); // getHabitCompletions will be stable, but results depend on store state which causes re-render

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="group relative h-full"
        >
            <Card className={cn(
                "relative overflow-hidden border transition-all duration-300 h-full flex flex-col",
                "bg-white/40 dark:bg-slate-900/40 backdrop-blur-md", // Glassmorphism base
                "border-white/50 dark:border-white/10", // Glass border
                "hover:shadow-2xl hover:shadow-indigo-500/20 dark:hover:shadow-indigo-900/30", // Glow effect on hover
                isCompleted && "opacity-90"
            )}>

                {/* Background Progress Bar */}
                <motion.div
                    className="absolute inset-0 bg-indigo-500/5 dark:bg-indigo-400/10 z-0"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                />

                {/* Active Progress Gradient Line at bottom (optional but adds polish) */}
                <motion.div
                    className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 z-10"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                />

                <CardHeader className="relative z-10 flex flex-row items-start justify-between p-5 pb-2">
                    <div className="space-y-1 w-full">
                        <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            {routine.title}
                            {/* Status Indicator Dot */}
                            {!isCompleted && routine.isActive && (
                                <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse ring-2 ring-indigo-500/30" />
                            )}
                        </CardTitle>
                        <div className="h-5">
                            {routine.description ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 font-medium">{routine.description}</p>
                            ) : (
                                <span className="text-sm text-transparent select-none">No description</span>
                            )}
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
                                <MoreHorizontal className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
                            <DropdownMenuItem onClick={() => onEdit(routine)}>
                                Edit Routine
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDelete(routine.id)} className="text-destructive focus:text-destructive">
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>

                <CardContent className="relative z-10 p-5 pt-2 space-y-6 flex-1 flex flex-col justify-end">
                    {/* Tags & Stats Row */}
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {routine.triggerType === 'time' && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-200/50 dark:border-blue-500/20">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{routine.triggerValue}</span>
                            </div>
                        )}
                        {routine.triggerType === 'location' && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100/50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-200/50 dark:border-purple-500/20">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>{routine.triggerValue}</span>
                            </div>
                        )}

                        <div className="ml-auto flex items-center gap-1.5">
                            <span className={cn(
                                "transition-colors",
                                completedHabits === totalHabits ? "text-green-600 dark:text-green-400" : ""
                            )}>
                                {completedHabits}/{totalHabits} Done
                            </span>
                        </div>
                    </div>

                    {/* Action Area */}
                    <div className="pt-2">
                        <motion.div
                            whileHover={!isCompleted && !loading ? { scale: 1.03 } : {}}
                            whileTap={!isCompleted && !loading ? { scale: 0.97 } : {}}
                        >
                            <Button
                                className={cn(
                                    "w-full h-12 gap-2 font-bold text-base shadow-lg transition-all rounded-xl border relative overflow-hidden",
                                    isCompleted
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 shadow-none cursor-default"
                                        : "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30 hover:border-indigo-400 dark:hover:border-indigo-400"
                                )}
                                onClick={() => !isCompleted && onPlay(routine)}
                                disabled={isCompleted || loading}
                            >
                                {/* Button Content */}
                                <span className="relative z-10 flex items-center gap-2">
                                    {isCompleted ? (
                                        <>
                                            <CheckCircle2 className="w-5 h-5" />
                                            Active Today
                                        </>
                                    ) : (
                                        <>
                                            <Play className={cn("w-5 h-5 fill-current", !isCompleted && "animate-pulse")} />
                                            Start Routine
                                        </>
                                    )}
                                </span>

                                {/* Button Hover Fill Effect (Gradient) for Play State */}
                                {!isCompleted && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                )}
                            </Button>
                        </motion.div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
