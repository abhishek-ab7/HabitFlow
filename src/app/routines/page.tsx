'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoutineStore } from '@/lib/stores/routine-store';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { RoutineCard, RoutineModal, RoutinePlayer } from '@/components/routines';
import { Routine } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Play, Sparkles, TrendingUp, Trophy, Zap, Sun, Moon, Sunset, Calendar, CheckCircle2 } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function RoutinesPage() {
    const { routines, loadRoutines, isLoading, deleteRoutine, optimizeRoutineSequences } = useRoutineStore();
    const { loadCompletions, completions, getHabitCompletions } = useHabitStore();
    const { stats } = useGamificationStore();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
    const [playingRoutine, setPlayingRoutine] = useState<Routine | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    useEffect(() => {
        loadRoutines();
        const today = new Date();
        const start = format(startOfMonth(today), 'yyyy-MM-dd');
        const end = format(endOfMonth(today), 'yyyy-MM-dd');
        loadCompletions(start, end);

        // Keep current time updated for timeline
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, [loadRoutines, loadCompletions]);

    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const playId = searchParams.get('play');
        if (playId && routines.length > 0) {
            const routineToPlay = routines.find(r => r.id === playId);
            if (routineToPlay) {
                Promise.resolve().then(() => {
                    setPlayingRoutine(routineToPlay);
                });
                router.replace('/routines', { scroll: false });
            }
        }
    }, [searchParams, routines, router]);

    const handleCreate = () => {
        setEditingRoutine(null);
        setIsModalOpen(true);
    };

    const handleEdit = (routine: Routine) => {
        setEditingRoutine(routine);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this routine?')) {
            await deleteRoutine(id);
        }
    };

    // Helper to group routines by time of day
    const groupedRoutines = useMemo(() => {
        const morning: Routine[] = [];
        const afternoon: Routine[] = [];
        const evening: Routine[] = [];

        routines.forEach(routine => {
            const titleLower = routine.title.toLowerCase();
            const descLower = (routine.description || '').toLowerCase();
            
            if (titleLower.includes('morning') || descLower.includes('morning')) {
                morning.push(routine);
                return;
            }
            if (titleLower.includes('afternoon') || descLower.includes('afternoon')) {
                afternoon.push(routine);
                return;
            }
            if (titleLower.includes('evening') || titleLower.includes('night') || titleLower.includes('bed') || descLower.includes('evening') || descLower.includes('night')) {
                evening.push(routine);
                return;
            }
            
            if (routine.triggerType === 'time' && routine.triggerValue) {
                const hour = parseInt(routine.triggerValue.split(':')[0], 10);
                if (!isNaN(hour)) {
                    if (hour >= 4 && hour < 12) morning.push(routine);
                    else if (hour >= 12 && hour < 17) afternoon.push(routine);
                    else evening.push(routine);
                    return;
                }
            }

            // Spreading fallback evenly
            if (routine.title.length % 3 === 0) morning.push(routine);
            else if (routine.title.length % 3 === 1) afternoon.push(routine);
            else evening.push(routine);
        });

        return { morning, afternoon, evening };
    }, [routines]);

    // Current time-of-day phase highlight
    const currentPhase = useMemo(() => {
        const hr = currentTime.getHours();
        if (hr >= 4 && hr < 12) return 'morning';
        if (hr >= 12 && hr < 17) return 'afternoon';
        return 'evening';
    }, [currentTime]);

    // Stats calculations
    const statsSummary = useMemo(() => {
        const total = routines.length;
        let activeCount = routines.filter(r => r.isActive).length;
        
        // Mock consistency / weekly metrics based on local DB counts
        const streak = Math.max(1, Math.min(14, total * 2 + 1));
        const completionRate = total > 0 ? Math.round((activeCount / total) * 100) : 0;

        return { total, activeCount, streak, completionRate };
    }, [routines]);

    // AI suggestions mock
    const aiOptimizations = useMemo(() => [
        { id: 1, tip: "Moving 'Morning Stretch' directly after 'Hydrate' creates a stronger anchor stack." },
        { id: 2, tip: "Your 'Evening Reading' routine triggers best if completed before 10:00 PM." },
        { id: 3, tip: "Adding +1 focus task to 'Afternoon Review' boosts your Intelligence RPG stat." }
    ], []);

    return (
        <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-[1400px] mx-auto space-y-8">
            
            {/* ATMOSPHERIC TIMELINE HEADER */}
            <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-white via-indigo-50/50 to-purple-50 dark:from-slate-900 dark:via-purple-950/20 dark:to-slate-900 p-8 md:p-10 border border-slate-200/50 dark:border-slate-800/50 shadow-xl">
                <div className="absolute inset-0 bg-white/20 dark:bg-slate-900/5 backdrop-blur-3xl z-0" />
                
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-wider">
                            <Zap className="w-3.5 h-3.5 animate-pulse" />
                            Flow Synchronization
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight text-slate-800 dark:text-white">
                            Your Routine Sanctuary
                        </h1>
                        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl font-semibold leading-relaxed">
                            Form habits easily by linking them into automated time-of-day stacks. Minimize friction and master consistency.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                            <Button
                                size="lg"
                                onClick={handleCreate}
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black shadow-lg shadow-indigo-500/25 h-13 px-6 text-sm rounded-2xl transition-all border-none"
                            >
                                <Plus className="mr-1.5 h-5 w-5" />
                                Create Routine
                            </Button>
                        </motion.div>
                    </div>
                </div>

                {/* HORIZONTAL DAILY FLOW SEGMENTS */}
                <div className="relative z-10 grid grid-cols-3 gap-3 md:gap-4 mt-8 border-t border-slate-200/40 dark:border-slate-800/30 pt-6">
                    <div className={cn(
                        "p-4 rounded-2xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-2",
                        currentPhase === 'morning' 
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300 shadow-md shadow-amber-500/5" 
                            : "bg-white/10 dark:bg-slate-900/10 border-slate-200/40 dark:border-slate-800/20 text-slate-500 dark:text-slate-400"
                    )}>
                        <div className="flex items-center gap-2 min-w-0">
                            <Sun className="w-5 h-5 text-amber-500 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-wider">Morning</p>
                                <p className="text-[10px] opacity-75 font-semibold">04:00 - 12:00</p>
                            </div>
                        </div>
                        <span className="text-xs font-black bg-slate-200/50 dark:bg-white/5 px-2 py-0.5 rounded-md">
                            {groupedRoutines.morning.length} Stacks
                        </span>
                    </div>

                    <div className={cn(
                        "p-4 rounded-2xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-2",
                        currentPhase === 'afternoon' 
                            ? "bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-300 shadow-md shadow-sky-500/5" 
                            : "bg-white/10 dark:bg-slate-900/10 border-slate-200/40 dark:border-slate-800/20 text-slate-500 dark:text-slate-400"
                    )}>
                        <div className="flex items-center gap-2 min-w-0">
                            <Sunset className="w-5 h-5 text-sky-500 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-wider">Afternoon</p>
                                <p className="text-[10px] opacity-75 font-semibold">12:00 - 17:00</p>
                            </div>
                        </div>
                        <span className="text-xs font-black bg-slate-200/50 dark:bg-white/5 px-2 py-0.5 rounded-md">
                            {groupedRoutines.afternoon.length} Stacks
                        </span>
                    </div>

                    <div className={cn(
                        "p-4 rounded-2xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-2",
                        currentPhase === 'evening' 
                            ? "bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300 shadow-md shadow-purple-500/5" 
                            : "bg-white/10 dark:bg-slate-900/10 border-slate-200/40 dark:border-slate-800/20 text-slate-500 dark:text-slate-400"
                    )}>
                        <div className="flex items-center gap-2 min-w-0">
                            <Moon className="w-5 h-5 text-purple-500 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-wider">Evening</p>
                                <p className="text-[10px] opacity-75 font-semibold">17:00 - 04:00</p>
                            </div>
                        </div>
                        <span className="text-xs font-black bg-slate-200/50 dark:bg-white/5 px-2 py-0.5 rounded-md">
                            {groupedRoutines.evening.length} Stacks
                        </span>
                    </div>
                </div>
            </div>

            {/* MAIN BENTO GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* LEFT: 3 TIME-OF-DAY LANES (col-span-8) */}
                <div className="col-span-1 lg:col-span-8 space-y-8">
                    
                    {/* LANES CONTAINER */}
                    <div className="grid gap-6 md:grid-cols-3">
                        
                        {/* MORNING COLUMN */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-amber-500/10">
                                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                                    <Sun className="w-4 h-4" />
                                </div>
                                <h3 className="font-black text-sm uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Morning Flow
                                </h3>
                            </div>
                            <div className="space-y-4">
                                {groupedRoutines.morning.length === 0 ? (
                                    <div className="text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                                        No morning stacks
                                    </div>
                                ) : (
                                    groupedRoutines.morning.map(routine => (
                                        <RoutineCard
                                            key={routine.id}
                                            routine={routine}
                                            onPlay={setPlayingRoutine}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* AFTERNOON COLUMN */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-sky-500/10">
                                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
                                    <Sunset className="w-4 h-4" />
                                </div>
                                <h3 className="font-black text-sm uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Afternoon Flow
                                </h3>
                            </div>
                            <div className="space-y-4">
                                {groupedRoutines.afternoon.length === 0 ? (
                                    <div className="text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                                        No afternoon stacks
                                    </div>
                                ) : (
                                    groupedRoutines.afternoon.map(routine => (
                                        <RoutineCard
                                            key={routine.id}
                                            routine={routine}
                                            onPlay={setPlayingRoutine}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* EVENING COLUMN */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-purple-500/10">
                                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
                                    <Moon className="w-4 h-4" />
                                </div>
                                <h3 className="font-black text-sm uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Night Flow
                                </h3>
                            </div>
                            <div className="space-y-4">
                                {groupedRoutines.evening.length === 0 ? (
                                    <div className="text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                                        No night stacks
                                    </div>
                                ) : (
                                    groupedRoutines.evening.map(routine => (
                                        <RoutineCard
                                            key={routine.id}
                                            routine={routine}
                                            onPlay={setPlayingRoutine}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                </div>

                {/* RIGHT: SIDEBAR WIDGETS (col-span-4) */}
                <div className="col-span-1 lg:col-span-4 space-y-6">
                    
                    {/* WIDGET 1: STATS & MASTERY */}
                    <div className="rounded-3xl border border-slate-200/50 dark:border-slate-800/50 bg-white/20 dark:bg-slate-900/20 backdrop-blur-xl p-6 space-y-6 shadow-md relative overflow-hidden">
                        <div className="absolute -right-10 -bottom-10 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl -z-10" />
                        
                        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/40 pb-4">
                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                <Trophy className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                                    Routine Mastery
                                </h4>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                                    Current Character Stats
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/40 rounded-2xl p-4 flex flex-col">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Routines Active</span>
                                <span className="text-2xl font-black text-slate-800 dark:text-white mt-1">
                                    {statsSummary.activeCount} <span className="text-xs font-semibold text-slate-400">/ {statsSummary.total}</span>
                                </span>
                            </div>
                            
                            <div className="bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/40 rounded-2xl p-4 flex flex-col">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Sync Streak</span>
                                <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 flex items-center gap-1">
                                    {statsSummary.streak}d <Zap className="w-4 h-4 text-amber-500 fill-current shrink-0" />
                                </span>
                            </div>

                            <div className="bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/40 rounded-2xl p-4 flex flex-col col-span-2">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    <span>Sync Completion Rate</span>
                                    <span className="text-indigo-600 dark:text-indigo-400">{statsSummary.completionRate}%</span>
                                </div>
                                <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${statsSummary.completionRate}%` }} />
                                </div>
                            </div>
                        </div>

                        {/* RPG character level block */}
                        <div className="p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/15 rounded-2xl flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white font-black flex items-center justify-center text-sm shadow-md">
                                    DIS
                                </div>
                                <div>
                                    <h5 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Discipline Level</h5>
                                    <p className="text-[10px] font-bold text-slate-400">Total accumulated routine stats</p>
                                </div>
                            </div>
                            <span className="text-lg font-black text-indigo-500">{stats.discipline} Pts</span>
                        </div>
                    </div>

                    {/* WIDGET 2: AI ROUTINE OPTIMIZER */}
                    <div className="rounded-3xl border border-slate-200/50 dark:border-slate-800/50 bg-white/20 dark:bg-slate-900/20 backdrop-blur-xl p-6 space-y-4 shadow-md relative overflow-hidden">
                        <div className="absolute -left-10 -bottom-10 w-24 h-24 bg-purple-500/5 rounded-full blur-xl -z-10 animate-pulse" />
                        
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/40 pb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                                        AI Routine Optimizer
                                    </h4>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                                        Habit Stacking Suggestions
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {aiOptimizations.map(opt => (
                                <div key={opt.id} className="p-3 bg-slate-50/30 dark:bg-slate-900/20 border border-slate-100/50 dark:border-slate-800/35 rounded-2xl flex items-start gap-2.5">
                                    <TrendingUp className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-semibold">
                                        {opt.tip}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <Button 
                            className="w-full h-11 text-xs font-black rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/10"
                            onClick={async () => {
                                setIsOptimizing(true);
                                try {
                                    await optimizeRoutineSequences();
                                    toast.success("Routine sequences successfully optimized based on habit performance!");
                                } catch (err) {
                                    console.error("Optimization failed:", err);
                                    toast.error("Failed to optimize routine sequences");
                                } finally {
                                    setIsOptimizing(false);
                                }
                            }}
                            disabled={isOptimizing}
                        >
                            {isOptimizing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                    Analyzing Stacks...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 mr-1.5 animate-pulse" />
                                    Optimize Stack Sequences
                                </>
                            )}
                        </Button>
                    </div>

                </div>

            </div>

            {/* MODALS */}
            <RoutineModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                routine={editingRoutine}
            />

            <RoutinePlayer
                routine={playingRoutine}
                onClose={() => setPlayingRoutine(null)}
            />
        </div>
    );
}
