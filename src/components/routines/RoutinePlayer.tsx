"use client"

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Routine, Habit } from '@/lib/types';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useRoutineStore } from '@/lib/stores/routine-store';
import { useGamificationStore, XP_PER_ROUTINE } from '@/lib/stores/gamification-store';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, X, Trophy, Sparkles, Check, SkipForward, Flame } from 'lucide-react';
import { Confetti } from '@/components/motion/confetti';
import { useFeedback } from '@/hooks/use-feedback';
import { cn } from '@/lib/utils';

interface RoutinePlayerProps {
    routine: Routine | null;
    onClose: () => void;
}

export function RoutinePlayer({ routine, onClose }: RoutinePlayerProps) {
    const { ensureComplete, getCompletionForDate } = useHabitStore();
    const { getRoutineHabits } = useRoutineStore();
    const { addXp } = useGamificationStore();
    const { triggerPop, triggerChime } = useFeedback();

    const [activeStep, setActiveStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<string[]>([]);
    const [isFinished, setIsFinished] = useState(false);
    const [routineHabits, setRoutineHabits] = useState<Habit[]>([]);
    const [loading, setLoading] = useState(true);

    // Timer States
    const defaultDuration = 180; // 3 minutes default per habit
    const [timeLeft, setTimeLeft] = useState(defaultDuration);
    const [timerActive, setTimerActive] = useState(true);
    
    // Breathing Guide States
    const [breathingPhase, setBreathingPhase] = useState(0);

    const currentHabit = routineHabits[activeStep];
    const nextHabit = routineHabits[activeStep + 1];
    const progress = routineHabits.length > 0 ? ((activeStep) / routineHabits.length) * 100 : 0;

    const categoryColor = useMemo(() => {
        if (!currentHabit) return 'indigo';
        const cat = currentHabit.category || 'health';
        switch (cat) {
            case 'health': return 'emerald';
            case 'work': return 'indigo';
            case 'learning': return 'amber';
            case 'personal': return 'pink';
            case 'finance': return 'sky';
            case 'relationships': return 'rose';
            default: return 'indigo';
        }
    }, [currentHabit]);

    const blobColorClasses = useMemo(() => {
        switch (categoryColor) {
            case 'emerald': return { left: 'bg-emerald-500/10 dark:bg-emerald-500/5', right: 'bg-teal-500/10 dark:bg-teal-500/5' };
            case 'indigo': return { left: 'bg-indigo-500/10 dark:bg-indigo-500/5', right: 'bg-purple-500/10 dark:bg-purple-500/5' };
            case 'amber': return { left: 'bg-amber-500/10 dark:bg-amber-500/5', right: 'bg-orange-500/10 dark:bg-orange-500/5' };
            case 'pink': return { left: 'bg-pink-500/10 dark:bg-pink-500/5', right: 'bg-rose-500/10 dark:bg-rose-500/5' };
            case 'sky': return { left: 'bg-sky-500/10 dark:bg-sky-500/5', right: 'bg-blue-500/10 dark:bg-blue-500/5' };
            case 'rose': return { left: 'bg-rose-500/10 dark:bg-rose-500/5', right: 'bg-red-500/10 dark:bg-red-500/5' };
            default: return { left: 'bg-indigo-500/10 dark:bg-indigo-500/5', right: 'bg-purple-500/10 dark:bg-purple-500/5' };
        }
    }, [categoryColor]);

    const finishRoutine = async () => {
        setIsFinished(true);
        triggerChime();
        await addXp(XP_PER_ROUTINE);
    };

    const handleNext = () => {
        triggerPop();
        if (activeStep < routineHabits.length - 1) {
            setActiveStep(prev => prev + 1);
        } else {
            finishRoutine();
        }
    };

    const markCompleteAndNext = async () => {
        if (!currentHabit) return;
        const today = new Date().toISOString().split('T')[0];
        await ensureComplete(currentHabit.id, today);
        setCompletedSteps(prev => [...prev, currentHabit.id]);
        handleNext();
    };

    // Get habits for this routine
    useEffect(() => {
        if (routine) {
            setLoading(true);
            getRoutineHabits(routine.id).then(habits => {
                const activeHabits = habits.filter(h => !h.archived);
                setRoutineHabits(activeHabits);
                setLoading(false);

                // Smart Resume Logic
                const today = new Date().toISOString().split('T')[0];
                const previouslyCompletedIds: string[] = [];
                let firstUncompletedIndex = -1;

                for (let i = 0; i < activeHabits.length; i++) {
                    const habit = activeHabits[i];
                    const completion = getCompletionForDate(habit.id, today);
                    if (completion && completion.completed) {
                        previouslyCompletedIds.push(habit.id);
                    } else if (firstUncompletedIndex === -1) {
                        firstUncompletedIndex = i;
                    }
                }

                if (activeHabits.length > 0) {
                    if (firstUncompletedIndex !== -1) {
                        setActiveStep(firstUncompletedIndex);
                        setIsFinished(false);
                    } else {
                        setActiveStep(activeHabits.length - 1);
                        setIsFinished(true);
                    }
                } else {
                    setActiveStep(0);
                    setIsFinished(false);
                }

                setCompletedSteps(previouslyCompletedIds);
            });
        }
    }, [routine?.id, getRoutineHabits, getCompletionForDate]);

    // Timer Effect
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (timerActive && timeLeft > 0 && !isFinished && !loading) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && !isFinished) {
            triggerChime();
            // Automatically complete step when timer hits zero
            markCompleteAndNext();
        }
        return () => { if (interval) clearInterval(interval); };
    }, [timerActive, timeLeft, isFinished, loading, markCompleteAndNext, triggerChime]);

    // Reset Timer on step change
    useEffect(() => {
        setTimeLeft(defaultDuration);
        setTimerActive(true);
    }, [activeStep]);

    // Breathing Guide effect
    useEffect(() => {
        if (isFinished) return;
        const interval = setInterval(() => {
            setBreathingPhase(prev => (prev + 1) % 4);
        }, 3000);
        return () => clearInterval(interval);
    }, [isFinished]);

    const isMindfulnessHabit = useMemo(() => {
        if (!currentHabit) return false;
        const name = currentHabit.name.toLowerCase();
        return name.includes('breath') || 
               name.includes('meditat') || 
               name.includes('mindful') || 
               name.includes('yoga') || 
               name.includes('zen') || 
               name.includes('stretch');
    }, [currentHabit]);

    const breathingText = useMemo(() => {
        if (isMindfulnessHabit) {
            const texts = ['Breathe In', 'Hold', 'Breathe Out', 'Hold'];
            return texts[breathingPhase];
        } else {
            const texts = ['Stay Focused', 'Keep Going', 'Stay Present', 'You Got This'];
            return texts[breathingPhase];
        }
    }, [breathingPhase, isMindfulnessHabit]);

    const scaleValue = useMemo(() => {
        return (breathingPhase === 0 || breathingPhase === 1) ? 1.22 : 1.0;
    }, [breathingPhase]);

    // Formatted Time Left
    const formattedTime = useMemo(() => {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, [timeLeft]);

    // Calculate circular dash array for timer SVG
    const timerRadius = 60;
    const timerCircumference = 2 * Math.PI * timerRadius;
    const strokeDashoffset = useMemo(() => {
        return timerCircumference - (timeLeft / defaultDuration) * timerCircumference;
    }, [timeLeft, timerCircumference]);

    // Group completions into stats reward for completed habits in this session
    const finalStatsRewards = useMemo(() => {
        const rewards: Record<string, number> = {};
        completedSteps.forEach(stepId => {
            const h = routineHabits.find(habit => habit.id === stepId);
            if (h) {
                const cat = h.category || 'health';
                const statName = cat === 'health' ? 'Vitality' 
                               : cat === 'learning' ? 'Intelligence' 
                               : cat === 'work' ? 'Discipline' 
                               : cat === 'relationships' ? 'Charisma' 
                               : cat === 'finance' ? 'Wealth' 
                               : 'Creativity';
                rewards[statName] = (rewards[statName] || 0) + 1;
            }
        });
        return rewards;
    }, [completedSteps, routineHabits]);

    if (!routine) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex flex-col bg-background/95 dark:bg-slate-950/95 backdrop-blur-3xl text-foreground select-none overflow-hidden transition-colors duration-500"
            >
                {/* Background Ambient Glowing Blobs */}
                <div className={cn("absolute -left-40 top-1/4 w-96 h-96 rounded-full blur-3xl -z-10 animate-pulse transition-colors duration-500", blobColorClasses.left)} />
                <div className={cn("absolute -right-40 bottom-1/4 w-96 h-96 rounded-full blur-3xl -z-10 animate-pulse transition-colors duration-500", blobColorClasses.right)} />

                {isFinished ? (
                    /* VICTORY PAGE */
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto space-y-8 relative overflow-y-auto scrollbar-hide">
                        <Confetti trigger={true} duration={4000} />
                        
                        <motion.div
                            initial={{ scale: 0.3, rotate: -45, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{ type: "spring", damping: 12 }}
                            className="relative w-32 h-32 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.25)]"
                        >
                            <Trophy className="w-14 h-14 text-white drop-shadow-lg" />
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-0 border-4 border-dashed border-white/20 rounded-full"
                            />
                        </motion.div>

                        <div className="space-y-3">
                            <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-500 via-indigo-500 to-pink-500 dark:from-amber-200 dark:via-indigo-200 dark:to-purple-300">
                                Routine Complete!
                            </h2>
                            <p className="text-sm text-muted-foreground font-medium max-w-md">
                                You have successfully optimized your day by finishing <span className="text-indigo-600 dark:text-indigo-300 font-bold">{routine.title}</span>.
                            </p>
                        </div>

                        {/* RPG Rewards Summary List */}
                        <div className="w-full bg-slate-100/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-3xl p-6 space-y-4 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 justify-center">
                                <Sparkles className="w-4 h-4 text-amber-500" />
                                Quest Rewards Earned
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/10 dark:border-indigo-500/20 rounded-2xl p-3 flex flex-col items-center">
                                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">XP gained</span>
                                    <span className="text-base font-black text-foreground">+{XP_PER_ROUTINE} XP</span>
                                </div>
                                <div className="bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/10 dark:border-purple-500/20 rounded-2xl p-3 flex flex-col items-center">
                                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">Gems</span>
                                    <span className="text-base font-black text-foreground">+0 Gems</span>
                                </div>
                                {Object.entries(finalStatsRewards).map(([statName, val]) => (
                                    <div key={statName} className="col-span-1 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 dark:border-amber-500/20 rounded-2xl p-3 flex flex-col items-center">
                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">{statName}</span>
                                        <span className="text-base font-black text-foreground">+{val} Pts</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Button 
                            onClick={onClose} 
                            size="lg" 
                            className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/25 border-0"
                        >
                            Return to Sanctuary
                        </Button>
                    </div>
                ) : (
                    /* MAIN INTERACTIVE PLAYER */
                    <>
                        {/* Header Progress Bar */}
                        <div className="p-6 border-b border-border/40 flex items-center justify-between z-20 bg-background/20 backdrop-blur-md">
                            <div className="flex-1 max-w-md">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                                    Active Routine Process
                                </span>
                                <h2 className="text-lg font-black tracking-tight mt-0.5 truncate">{routine.title}</h2>
                                <div className="flex items-center gap-3 mt-2">
                                    {/* Progress Step Nodes */}
                                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-hide max-w-[200px] md:max-w-[400px]">
                                        {routineHabits.map((habit, idx) => {
                                            const isCompleted = completedSteps.includes(habit.id) || idx < activeStep;
                                            const isActive = idx === activeStep;
                                            return (
                                                <div key={habit.id} className="flex items-center gap-1.5 shrink-0">
                                                    {idx > 0 && (
                                                        <div className={cn(
                                                            "w-4 md:w-6 h-0.5 rounded-full transition-all duration-300",
                                                            idx <= activeStep ? "bg-indigo-500" : "bg-border/60"
                                                        )} />
                                                    )}
                                                    <div
                                                        className={cn(
                                                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all duration-300",
                                                            isCompleted 
                                                                ? "bg-emerald-500 border-emerald-500 text-white" 
                                                                : isActive 
                                                                ? "bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.4)] animate-pulse" 
                                                                : "bg-muted/10 border-border/80 text-muted-foreground"
                                                        )}
                                                        title={habit.name}
                                                    >
                                                        {isCompleted ? <Check className="w-3 h-3" /> : idx + 1}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <span className="text-xs font-black text-muted-foreground shrink-0">
                                        {activeStep + 1} / {routineHabits.length}
                                    </span>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={onClose} 
                                className="rounded-2xl w-10 h-10 ml-6 bg-slate-100 dark:bg-white/5 hover:bg-destructive/15 hover:text-destructive text-muted-foreground border border-border/40 dark:border-white/5 transition-colors shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Centered Column Interface (100% Stacked Focused Narrative) */}
                        <div className="flex-1 flex flex-col items-center justify-between p-4 md:p-8 gap-4 max-w-xl mx-auto w-full overflow-y-auto scrollbar-hide">
                            
                            {/* Card Deck Stack with Layered Depth (Z-axis) */}
                            <div className="relative w-full max-w-[360px] h-[320px] md:h-[340px] flex items-center justify-center mt-4">
                                <AnimatePresence mode="wait">
                                    {currentHabit ? (
                                        <motion.div
                                            key={currentHabit.id}
                                            drag="x"
                                            dragConstraints={{ left: 0, right: 0 }}
                                            onDragEnd={(e, info) => {
                                                if (info.offset.x > 150) {
                                                    markCompleteAndNext();
                                                } else if (info.offset.x < -150) {
                                                    handleNext();
                                                }
                                            }}
                                            initial={{ y: 30, opacity: 0, scale: 0.95 }}
                                            animate={{ y: 0, opacity: 1, scale: 1 }}
                                            exit={{ y: -30, opacity: 0, scale: 1.05 }}
                                            transition={{ type: "spring", damping: 15 }}
                                            className={cn(
                                                "w-full h-full bg-card/95 border backdrop-blur-2xl rounded-[32px] p-8 flex flex-col items-center justify-between text-center shadow-2xl relative cursor-grab active:cursor-grabbing group transition-all duration-300",
                                                categoryColor === 'emerald' && 'border-emerald-500/35 shadow-emerald-500/5',
                                                categoryColor === 'indigo' && 'border-indigo-500/35 shadow-indigo-500/5',
                                                categoryColor === 'amber' && 'border-amber-500/35 shadow-amber-500/5',
                                                categoryColor === 'pink' && 'border-pink-500/35 shadow-pink-500/5',
                                                categoryColor === 'sky' && 'border-sky-500/35 shadow-sky-500/5',
                                                categoryColor === 'rose' && 'border-rose-500/35 shadow-rose-500/5'
                                            )}
                                        >
                                            {/* Glowing indicator tags on drag */}
                                            <div className="absolute left-6 top-6 text-[10px] font-black text-amber-500 opacity-0 group-active:opacity-40 transition-opacity">
                                                👈 Drag left to skip
                                            </div>
                                            <div className="absolute right-6 top-6 text-[10px] font-black text-emerald-500 opacity-0 group-active:opacity-40 transition-opacity">
                                                Drag right to complete 👉
                                            </div>

                                            {/* Icon block */}
                                            <div className={cn(
                                                "w-24 h-24 rounded-3xl flex items-center justify-center border transition-all duration-300 relative shadow-inner overflow-hidden",
                                                categoryColor === 'emerald' && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-emerald-500/5',
                                                categoryColor === 'indigo' && 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500 shadow-indigo-500/5',
                                                categoryColor === 'amber' && 'bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-amber-500/5',
                                                categoryColor === 'pink' && 'bg-pink-500/10 border-pink-500/20 text-pink-500 shadow-pink-500/5',
                                                categoryColor === 'sky' && 'bg-sky-500/10 border-sky-500/20 text-sky-500 shadow-sky-500/5',
                                                categoryColor === 'rose' && 'bg-rose-500/10 border-rose-500/20 text-rose-500 shadow-rose-500/5'
                                            )}>
                                                <div className="absolute -inset-0.5 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-3xl blur opacity-30 group-hover:opacity-60 transition-opacity" />
                                                <span className="text-5xl drop-shadow-md relative select-none">{currentHabit.icon || '🎯'}</span>
                                            </div>

                                            {/* Name & category */}
                                            <div className="space-y-2 w-full">
                                                <h3 className="text-2xl font-black tracking-tight text-foreground line-clamp-2">
                                                    {currentHabit.name}
                                                </h3>
                                                <div className={cn(
                                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border transition-colors duration-300",
                                                    categoryColor === 'emerald' && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                                                    categoryColor === 'indigo' && 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400',
                                                    categoryColor === 'amber' && 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
                                                    categoryColor === 'pink' && 'bg-pink-500/10 border-pink-500/20 text-pink-600 dark:text-pink-400',
                                                    categoryColor === 'sky' && 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400',
                                                    categoryColor === 'rose' && 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                                                )}>
                                                    {currentHabit.category}
                                                </div>
                                            </div>

                                            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-2 opacity-50">
                                                Swipe Right to Complete | Left to Skip
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <div className="text-center p-8 bg-card border border-border rounded-3xl">
                                            <X className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                            <h3 className="font-bold text-lg">Empty Routine</h3>
                                            <p className="text-muted-foreground text-sm mt-1">This routine doesn't contain any habits.</p>
                                        </div>
                                    )}
                                </AnimatePresence>

                                {/* Next Step Peek - Layered directly behind */}
                                {nextHabit && !isFinished && (
                                    <div className="absolute w-full h-full bg-card/40 border border-border/40 backdrop-blur-md rounded-[32px] p-8 -z-10 shadow-lg select-none pointer-events-none scale-90 translate-y-6 rotate-2 opacity-60 dark:opacity-30 blur-[0.5px] flex flex-col items-center justify-between text-center transition-all duration-300">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-100/80 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center justify-center mb-2">
                                            <span className="text-3xl opacity-30">{nextHabit.icon || '🎯'}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-base font-bold text-muted-foreground/80 line-clamp-1">{nextHabit.name}</h4>
                                            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{nextHabit.category}</span>
                                        </div>
                                        <div className="text-[9px] font-black text-muted-foreground/45 uppercase tracking-widest">Upcoming Step</div>
                                    </div>
                                )}
                            </div>

                            {/* Unified Concentric Focus Pulsar (Breathing Pulsar + Timer) */}
                            <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-sm mt-2">
                                <div className="relative flex items-center justify-center w-40 h-40">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle
                                            cx="80"
                                            cy="80"
                                            r={timerRadius}
                                            className="stroke-slate-200/50 dark:stroke-white/5 fill-none"
                                            strokeWidth="5"
                                        />
                                        <motion.circle
                                            cx="80"
                                            cy="80"
                                            r={timerRadius}
                                            className={cn(
                                                "fill-none transition-colors duration-300",
                                                categoryColor === 'emerald' && 'stroke-emerald-500',
                                                categoryColor === 'indigo' && 'stroke-indigo-500',
                                                categoryColor === 'amber' && 'stroke-amber-500',
                                                categoryColor === 'pink' && 'stroke-pink-500',
                                                categoryColor === 'sky' && 'stroke-sky-500',
                                                categoryColor === 'rose' && 'stroke-rose-500'
                                            )}
                                            strokeWidth="5"
                                            strokeDasharray={timerCircumference}
                                            initial={{ strokeDashoffset: 0 }}
                                            animate={{ strokeDashoffset }}
                                            transition={{ duration: 1, ease: "linear" }}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    
                                    {/* Inner Breathing Circle */}
                                    <motion.div
                                        animate={{ scale: scaleValue }}
                                        transition={{ type: "spring", damping: 15, stiffness: 60 }}
                                        className={cn(
                                            "absolute w-28 h-28 rounded-full flex flex-col items-center justify-center border transition-all duration-300 text-center select-none shadow-md",
                                            categoryColor === 'emerald' && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-emerald-500/5',
                                            categoryColor === 'indigo' && 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-indigo-500/5',
                                            categoryColor === 'amber' && 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-amber-500/5',
                                            categoryColor === 'pink' && 'bg-pink-500/10 border-pink-500/20 text-pink-600 dark:text-pink-400 shadow-pink-500/5',
                                            categoryColor === 'sky' && 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400 shadow-sky-500/5',
                                            categoryColor === 'rose' && 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 shadow-rose-500/5'
                                        )}
                                    >
                                        <span className="text-[9px] font-black uppercase tracking-wider opacity-60">Coach Guide</span>
                                        <span className="text-sm font-black tracking-wide leading-none my-1">{breathingText}</span>
                                        <span className="text-xs font-mono font-bold tracking-widest opacity-85">{formattedTime}</span>
                                    </motion.div>
                                </div>

                                {/* Timer & Playback Buttons */}
                                <div className="flex gap-3 justify-center items-center">
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={() => setTimerActive(!timerActive)}
                                        className="w-10 h-10 rounded-xl border-border bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-foreground"
                                    >
                                        {timerActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={() => setTimeLeft(defaultDuration)}
                                        className="w-10 h-10 rounded-xl border-border bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-foreground"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Footer Controls */}
                            <div className="w-full flex gap-3 mt-4">
                                <button
                                    onClick={handleNext}
                                    disabled={!currentHabit}
                                    className="flex-1 h-13 flex items-center justify-center text-xs font-black uppercase tracking-wider rounded-2xl border border-border bg-transparent text-foreground hover:bg-slate-100 dark:hover:bg-white/5 transition-all gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <SkipForward className="w-4 h-4" />
                                    Skip
                                </button>
                                <button
                                    onClick={markCompleteAndNext}
                                    disabled={!currentHabit}
                                    className={cn(
                                        "flex-[2] h-13 flex items-center justify-center text-xs font-black uppercase tracking-wider rounded-2xl text-white shadow-lg transition-all gap-1.5 border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                                        categoryColor === 'emerald' && 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20',
                                        categoryColor === 'indigo' && 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20',
                                        categoryColor === 'amber' && 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20',
                                        categoryColor === 'pink' && 'bg-pink-600 hover:bg-pink-500 shadow-pink-500/20',
                                        categoryColor === 'sky' && 'bg-sky-600 hover:bg-sky-500 shadow-sky-500/20',
                                        categoryColor === 'rose' && 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'
                                    )}
                                >
                                    <Check className="w-4 h-4" />
                                    Complete Step
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
