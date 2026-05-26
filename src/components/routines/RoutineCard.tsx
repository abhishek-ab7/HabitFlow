import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Routine, Habit } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Settings2, Clock, MapPin, MoreHorizontal, CheckCircle2, Check, Sparkles } from 'lucide-react';
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
    preFetchedHabits?: Habit[];
}

export function RoutineCard({ routine, onPlay, onEdit, onDelete, preFetchedHabits }: RoutineCardProps) {
    const { getHabitCompletions, completions, batchComplete, toggle } = useHabitStore();
    const { getRoutineHabits } = useRoutineStore();
    const [routineHabits, setRoutineHabits] = useState<Habit[]>(preFetchedHabits || []);
    const [isCompleted, setIsCompleted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    useEffect(() => {
        if (isDropdownOpen) {
            setIsExpanded(true);
        }
    }, [isDropdownOpen]);

    useEffect(() => {
        let mounted = true;
        const checkCompletion = async () => {
            try {
                let habits = preFetchedHabits;
                if (!habits) {
                    habits = await getRoutineHabits(routine.id);
                }
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
    }, [routine.id, completions, getRoutineHabits, getHabitCompletions, preFetchedHabits]);

    // Calculate progress
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
    }, [routineHabits, getHabitCompletions, completions]);

    // Calculate RPG Stats reward
    const statsReward = useMemo(() => {
        const rewards: Record<string, number> = {};
        routineHabits.forEach(h => {
            const cat = h.category || 'health';
            const statName = cat === 'health' ? 'vitality' 
                           : cat === 'learning' ? 'intelligence' 
                           : cat === 'work' ? 'discipline' 
                           : cat === 'relationships' ? 'charisma' 
                           : cat === 'finance' ? 'wealth' 
                           : 'creativity';
            rewards[statName] = (rewards[statName] || 0) + 1;
        });
        return rewards;
    }, [routineHabits]);

    const handleCompleteAll = async () => {
        if (!routineHabits.length || isCompleted || loading) return;
        try {
            setLoading(true);
            const today = new Date().toISOString().split('T')[0];
            const ids = routineHabits.map(h => h.id);
            if (batchComplete) {
                await batchComplete(ids, today);
            }
            setIsCompleted(true);
        } catch (error) {
            console.error("Error batch completing routine", error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleHabit = async (habitId: string) => {
        const today = new Date().toISOString().split('T')[0];
        try {
            await toggle(habitId, today);
        } catch (error) {
            console.error("Error toggling habit", error);
        }
    };

    const isHabitCompletedToday = (habitId: string) => {
        const today = new Date().toISOString().split('T')[0];
        const habitCompletions = getHabitCompletions(habitId);
        return habitCompletions.some(c => c.date === today && c.completed);
    };

    // SVG Circle Math
    const radius = 22;
    const strokeWidth = 3.5;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={isDropdownOpen ? undefined : { y: -6 }}
            onMouseEnter={() => { if (!isDropdownOpen) setIsExpanded(true); }}
            onMouseLeave={() => { if (!isDropdownOpen) setIsExpanded(false); }}
            onClick={() => { if (!isDropdownOpen) setIsExpanded(!isExpanded); }}
            className="group relative cursor-pointer"
        >
            {/* Glowing background outline on hover */}
            <div className="absolute -inset-[1px] bg-gradient-to-r from-indigo-500/30 to-purple-500/30 rounded-[28px] opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500" />
            
            <Card className={cn(
                "relative overflow-hidden border transition-all duration-500 flex flex-col rounded-[26px]",
                "bg-white/30 dark:bg-slate-900/30 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50",
                "shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(99,102,241,0.15)]",
                isCompleted && "bg-emerald-500/5 dark:bg-emerald-500/5 border-emerald-500/20"
            )}>
                {/* Time-of-day colored background ambient light */}
                <div className="absolute -right-20 -top-20 w-44 h-44 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl -z-10 group-hover:scale-125 transition-transform duration-700" />

                {/* Card Header */}
                <div className="relative z-10 flex flex-row items-center justify-between p-6 pb-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                        <CardTitle className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <span className="truncate">{routine.title}</span>
                            {isCompleted && (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                            )}
                        </CardTitle>
                        {routine.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-1">
                                {routine.description}
                            </p>
                        )}
                    </div>

                    {/* Progress Circle Visual */}
                    <div className="relative flex items-center justify-center ml-4 shrink-0">
                        <svg className="w-14 h-14 transform -rotate-90">
                            <circle
                                cx="28"
                                cy="28"
                                r={radius}
                                className="stroke-slate-100 dark:stroke-slate-800/80 fill-none"
                                strokeWidth={strokeWidth}
                            />
                            <motion.circle
                                cx="28"
                                cy="28"
                                r={radius}
                                className={cn(
                                    "fill-none",
                                    isCompleted ? "stroke-emerald-500" : "stroke-indigo-500 dark:stroke-indigo-400"
                                )}
                                strokeWidth={strokeWidth}
                                strokeDasharray={circumference}
                                animate={{ strokeDashoffset }}
                                transition={{ duration: 0.5 }}
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className="absolute text-[10px] font-black text-slate-700 dark:text-slate-300">
                            {completedHabits}/{totalHabits}
                        </span>
                    </div>
                </div>

                {/* Card Details Row */}
                <div className="px-6 py-2 flex flex-wrap items-center gap-2 border-t border-b border-slate-100/50 dark:border-slate-800/20 bg-slate-50/30 dark:bg-slate-900/10">
                    {routine.triggerType === 'time' && (
                        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 text-[10px] font-black tracking-wider uppercase">
                            <Clock className="w-3 h-3" />
                            <span>{routine.triggerValue}</span>
                        </div>
                    )}
                    {routine.triggerType === 'location' && (
                        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black tracking-wider uppercase">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate max-w-[80px]">{routine.triggerValue}</span>
                        </div>
                    )}
                    {routine.triggerType === 'manual' && (
                        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 text-[10px] font-black tracking-wider uppercase">
                            <span>Manual</span>
                        </div>
                    )}

                    {/* RPG Stats Badges */}
                    {Object.entries(statsReward).map(([stat, amt]) => (
                        <div key={stat} className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>{stat.substring(0, 3)} +{amt}</span>
                        </div>
                    ))}
                </div>

                {/* Main Content Area */}
                <CardContent className="relative z-10 p-6 flex-1 flex flex-col justify-between space-y-4">
                    {/* Expandable Habits Checklist */}
                    <motion.div
                        initial={false}
                        animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden space-y-2"
                        onClick={(e) => e.stopPropagation()} // Stop propagation to prevent collapse
                    >
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Habits Checklist
                        </h4>
                        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                            {routineHabits.map((habit) => {
                                const done = isHabitCompletedToday(habit.id);
                                return (
                                    <div
                                        key={habit.id}
                                        onClick={() => handleToggleHabit(habit.id)}
                                        className={cn(
                                            "flex items-center justify-between p-2 rounded-xl border transition-all text-xs font-semibold cursor-pointer",
                                            done 
                                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400" 
                                                : "bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800/40 text-slate-600 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-900/40"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className={cn(
                                                "w-4 h-4 rounded-md flex items-center justify-center border transition-all",
                                                done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 dark:border-slate-600"
                                            )}>
                                                {done && <Check className="w-3 h-3" />}
                                            </div>
                                            <span className="truncate">{habit.icon} {habit.name}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                        <motion.div
                            className="flex-1"
                            whileHover={!isCompleted && !loading ? { scale: 1.02 } : {}}
                            whileTap={!isCompleted && !loading ? { scale: 0.98 } : {}}
                        >
                            <Button
                                size="lg"
                                onClick={() => onPlay(routine)}
                                disabled={isCompleted || loading}
                                className={cn(
                                    "w-full h-11 text-sm font-black rounded-2xl shadow-md gap-2 border-none transition-all",
                                    isCompleted 
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-none" 
                                        : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/10"
                                )}
                            >
                                {isCompleted ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        Complete
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 fill-current" />
                                        Start Flow
                                    </>
                                )}
                            </Button>
                        </motion.div>

                        <DropdownMenu onOpenChange={setIsDropdownOpen}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 shrink-0 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                                    <MoreHorizontal className="w-5 h-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl border-slate-200/50 dark:border-slate-800/50">
                                <DropdownMenuItem onClick={handleCompleteAll} disabled={isCompleted || routineHabits.length === 0} className="font-semibold text-xs rounded-xl">
                                    Complete All Tasks
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onEdit(routine)} className="font-semibold text-xs rounded-xl">
                                    Edit Settings
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(routine.id)} className="font-semibold text-xs text-destructive focus:text-destructive rounded-xl">
                                    Delete Routine
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
