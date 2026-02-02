import { useEffect, useState } from 'react';
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
    const { getRoutineHabits } = useRoutineStore();
    const { getHabitCompletions } = useHabitStore();
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
                    const completions = await getHabitCompletions(habit.id);
                    const isDoneToday = completions.some(c => c.date === today && c.completed);
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
    }, [routine.id]); // Stabilize: only re-run if the routine ID itself changes

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
        >
            <Card className={cn(
                "overflow-hidden border-indigo-500/10 hover:border-indigo-500/30 transition-colors bg-gradient-to-br from-card to-card/50 dark:from-card dark:to-indigo-950/20",
                isCompleted && "opacity-80 grayscale-[0.3]"
            )}>
                <CardHeader className="flex flex-row items-start justify-between p-5 pb-2">
                    <div className="space-y-1">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            {routine.title}
                            {routine.isActive && !isCompleted && (
                                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                            )}
                            {isCompleted && (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                            )}
                        </CardTitle>
                        {routine.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{routine.description}</p>
                        )}
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground">
                                <MoreHorizontal className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(routine)}>
                                Edit Routine
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDelete(routine.id)} className="text-destructive focus:text-destructive">
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>

                <CardContent className="p-5 pt-2 space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {routine.triggerType === 'time' && (
                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                <Clock className="w-3 h-3 mr-1" />
                                {routine.triggerValue}
                            </Badge>
                        )}
                        {routine.triggerType === 'location' && (
                            <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                                <MapPin className="w-3 h-3 mr-1" />
                                {routine.triggerValue}
                            </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                            {routineHabits.length} Actions
                        </Badge>
                    </div>

                    <Button
                        className={cn(
                            "w-full gap-2 font-semibold shadow-lg transition-all",
                            isCompleted
                                ? "bg-green-600/10 text-green-600 hover:bg-green-600/20 shadow-none cursor-not-allowed"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20"
                        )}
                        onClick={() => !isCompleted && onPlay(routine)}
                        disabled={isCompleted || loading}
                    >
                        {isCompleted ? (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                Completed Today
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4 fill-current" />
                                Start Routine
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </motion.div>
    );
}
