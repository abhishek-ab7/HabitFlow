"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Routine, Habit } from '@/lib/types';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useRoutineStore } from '@/lib/stores/routine-store';
import { useGamificationStore, XP_PER_ROUTINE } from '@/lib/stores/gamification-store';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, X, Trophy, Sparkles, Check, ArrowRight, SkipForward } from 'lucide-react';
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
    const [breathingText, setBreathingText] = useState('Focus & Hydrate');

    const currentHabit = routineHabits[activeStep];
    const progress = routineHabits.length > 0 ? ((activeStep) / routineHabits.length) * 100 : 0;

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

    // Breathing Text Effect (Pulsing every 4s)
    useEffect(() => {
        if (isFinished) return;
        const texts = ['Breathe In', 'Hold', 'Breathe Out', 'Hold'];
        let idx = 0;
        const interval = setInterval(() => {
            idx = (idx + 1) % texts.length;
            setBreathingText(texts[idx]);
        }, 3000);
        return () => clearInterval(interval);
    }, [isFinished]);

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
                className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-2xl text-white select-none overflow-hidden"
            >
                {/* Background Ambient Glowing Blobs */}
                <div className="absolute -left-40 top-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl -z-10 animate-pulse" />
                <div className="absolute -right-40 bottom-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl -z-10 animate-pulse" />

                {isFinished ? (
                    /* VICTORY PAGE */
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto space-y-8 relative">
                        <Confetti trigger={true} duration={4000} />
                        
                        <motion.div
                            initial={{ scale: 0.3, rotate: -45, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{ type: "spring", damping: 12 }}
                            className="relative w-36 h-36 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.3)]"
                        >
                            <Trophy className="w-16 h-16 text-white drop-shadow-lg" />
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-0 border-4 border-dashed border-white/20 rounded-full"
                            />
                        </motion.div>

                        <div className="space-y-3">
                            <h2 className="text-3xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-indigo-200 to-purple-300">
                                Routine Complete!
                            </h2>
                            <p className="text-base text-slate-300 font-medium">
                                You have successfully optimized your day by finishing <span className="text-indigo-300 font-bold">{routine.title}</span>.
                            </p>
                        </div>

                        {/* RPG Rewards Summary List */}
                        <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 justify-center">
                                <Sparkles className="w-4 h-4 text-amber-400" />
                                Quest Rewards Earned
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3 flex flex-col items-center">
                                    <span className="text-xs text-indigo-300 font-bold">XP gained</span>
                                    <span className="text-lg font-black text-white">+{XP_PER_ROUTINE} XP</span>
                                </div>
                                <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3 flex flex-col items-center">
                                    <span className="text-xs text-purple-300 font-bold">Gold/Gems</span>
                                    <span className="text-lg font-black text-white">+0 Gems</span>
                                </div>
                                {Object.entries(finalStatsRewards).map(([statName, val]) => (
                                    <div key={statName} className="col-span-1 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex flex-col items-center">
                                        <span className="text-xs text-amber-300 font-bold">{statName}</span>
                                        <span className="text-lg font-black text-white">+{val} Points</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Button 
                            onClick={onClose} 
                            size="lg" 
                            className="w-full h-14 text-base font-black rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/30"
                        >
                            Return to Sanctuary
                        </Button>
                    </div>
                ) : (
                    /* MAIN INTERACTIVE PLAYER */
                    <>
                        {/* Header Progress Bar */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between z-20 bg-slate-950/20">
                            <div className="flex-1 max-w-md">
                                <span className="text-xs font-black uppercase tracking-wider text-indigo-400">
                                    Active Routine Process
                                </span>
                                <h2 className="text-lg font-black tracking-tight mt-0.5 truncate">{routine.title}</h2>
                                <div className="flex items-center gap-3 mt-2">
                                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 0.4 }}
                                        />
                                    </div>
                                    <span className="text-xs font-black text-slate-400 shrink-0">
                                        {activeStep + 1} / {routineHabits.length}
                                    </span>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={onClose} 
                                className="rounded-2xl w-10 h-10 ml-6 bg-white/5 hover:bg-destructive/15 hover:text-destructive text-slate-400 border border-white/5 transition-colors shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Split Interface */}
                        <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-8 gap-12 max-w-5xl mx-auto w-full">
                            {/* Left: Step Card with Gesture controls */}
                            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
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
                                            className="w-full bg-white/10 dark:bg-slate-900/40 border border-white/10 backdrop-blur-3xl rounded-[32px] p-8 flex flex-col items-center justify-between text-center min-h-[350px] shadow-2xl relative cursor-grab active:cursor-grabbing group"
                                        >
                                            {/* Glowing indicator tags on drag */}
                                            <div className="absolute left-6 top-6 text-[10px] font-black text-amber-500 opacity-0 group-active:opacity-40 transition-opacity">
                                                👈 Drag left to skip
                                            </div>
                                            <div className="absolute right-6 top-6 text-[10px] font-black text-emerald-500 opacity-0 group-active:opacity-40 transition-opacity">
                                                Drag right to complete 👉
                                            </div>

                                            {/* Icon block */}
                                            <div className="w-28 h-28 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center border border-white/10 shadow-xl mb-4 relative">
                                                <div className="absolute -inset-0.5 bg-gradient-to-br from-indigo-500/30 to-purple-500/30 rounded-3xl blur opacity-30 group-hover:opacity-60 transition-opacity" />
                                                <span className="text-6xl drop-shadow-md relative">{currentHabit.icon || '🎯'}</span>
                                            </div>

                                            {/* Name & category */}
                                            <div className="space-y-2">
                                                <h3 className="text-3xl font-black tracking-tight text-white line-clamp-2">
                                                    {currentHabit.name}
                                                </h3>
                                                <div className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-indigo-300">
                                                    {currentHabit.category}
                                                </div>
                                            </div>

                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">
                                                Swipe Right to Complete | Left to Skip
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <div className="text-center p-8 bg-white/5 border border-white/10 rounded-3xl">
                                            <X className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                                            <h3 className="font-bold text-lg">Empty Routine</h3>
                                            <p className="text-slate-400 text-sm mt-1">This routine doesn't contain any habits.</p>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Right: Circular Timer & breathing guide */}
                            <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                                {/* Meditative Breathing Pulsar */}
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                    className="w-48 h-48 rounded-full border border-indigo-500/30 flex flex-col items-center justify-center bg-indigo-500/5 relative shadow-[0_0_50px_rgba(99,102,241,0.05)]"
                                >
                                    <div className="absolute -inset-2 border border-purple-500/10 rounded-full animate-ping opacity-30" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Coach Guide</span>
                                    <span className="text-sm font-black text-white text-center tracking-wider max-w-[120px]">
                                        {breathingText}
                                    </span>
                                </motion.div>

                                {/* Glowing Circular Countdown Timer */}
                                <div className="flex items-center gap-6 bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-md">
                                    <div className="relative flex items-center justify-center w-24 h-24">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle
                                                cx="48"
                                                cy="48"
                                                r={timerRadius}
                                                className="stroke-white/10 fill-none"
                                                strokeWidth="4"
                                            />
                                            <motion.circle
                                                cx="48"
                                                cy="48"
                                                r={timerRadius}
                                                className="stroke-indigo-500 fill-none"
                                                strokeWidth="4"
                                                strokeDasharray={timerCircumference}
                                                animate={{ strokeDashoffset }}
                                                transition={{ duration: 1, ease: "linear" }}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <span className="absolute text-base font-black tracking-widest text-indigo-300">
                                            {formattedTime}
                                        </span>
                                    </div>

                                    {/* Timer Controls */}
                                    <div className="flex flex-col gap-2">
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            onClick={() => setTimerActive(!timerActive)}
                                            className="w-10 h-10 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white"
                                        >
                                            {timerActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            onClick={() => setTimeLeft(defaultDuration)}
                                            className="w-10 h-10 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Controls */}
                        <div className="p-8 pb-10 flex gap-4 max-w-lg mx-auto w-full z-20 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent">
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={handleNext}
                                disabled={!currentHabit}
                                className="flex-1 h-14 text-sm font-black rounded-2xl border border-white/10 hover:bg-white/5 bg-transparent text-white transition-all gap-1.5"
                            >
                                <SkipForward className="w-4 h-4" />
                                Skip
                            </Button>
                            <Button
                                size="lg"
                                onClick={markCompleteAndNext}
                                disabled={!currentHabit}
                                className="flex-[2] h-14 text-sm font-black rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/25 transition-all gap-1.5"
                            >
                                <Check className="w-5 h-5" />
                                Complete Step
                            </Button>
                        </div>
                    </>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
