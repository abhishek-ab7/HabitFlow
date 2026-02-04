'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoutineStore } from '@/lib/stores/routine-store';
import { useHabitStore } from '@/lib/stores/habit-store';
import { RoutineCard, RoutineModal, RoutinePlayer } from '@/components/routines';
import { Routine } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Play } from 'lucide-react';
import { HeroSection } from '@/components/dashboard/hero-section';
import { useSearchParams, useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export default function RoutinesPage() {
    const { routines, loadRoutines, isLoading, deleteRoutine } = useRoutineStore();
    const { loadCompletions } = useHabitStore();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
    const [playingRoutine, setPlayingRoutine] = useState<Routine | null>(null);

    useEffect(() => {
        loadRoutines();
        // Load completions for current month to ensure progress bars work
        const today = new Date();
        const start = format(startOfMonth(today), 'yyyy-MM-dd');
        const end = format(endOfMonth(today), 'yyyy-MM-dd');
        loadCompletions(start, end);
    }, [loadRoutines, loadCompletions]);

    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const playId = searchParams.get('play');
        if (playId && routines.length > 0) {
            const routineToPlay = routines.find(r => r.id === playId);
            if (routineToPlay) {
                setPlayingRoutine(routineToPlay);
                // Clear the param so it doesn't reopen on refresh, 
                // but we can replace URL without reload
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

    return (
        <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-[1400px] mx-auto space-y-8">
            {/* Reusing Hero Section structure for consistency but customized */}
            {/* Reusing Hero Section structure for consistency but customized */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-blue-50 to-indigo-50 dark:from-indigo-950 dark:via-purple-950 dark:to-indigo-950 p-8 md:p-12 shadow-xl border border-white/40 dark:border-white/10">
                {/* Glassmorphism effects */}
                <div className="absolute inset-0 bg-white/40 dark:bg-white/5 backdrop-blur-3xl z-0" />

                {/* Subtle grain overlay using CSS */}
                <div className="absolute inset-0 opacity-10 dark:opacity-20 mix-blend-overlay z-0" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }} />

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-4 max-w-2xl">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight text-slate-900 dark:text-white">
                            Design Your Flow
                        </h1>
                        <p className="text-lg text-slate-600 dark:text-indigo-100 max-w-xl leading-relaxed font-medium">
                            Chain habits together into powerful routines. Automate your day and reduce decision fatigue.
                        </p>
                    </div>
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Button
                            size="lg"
                            onClick={handleCreate}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold shadow-2xl shadow-indigo-500/30 border-none h-14 px-8 text-lg rounded-2xl transition-all"
                        >
                            <Plus className="mr-2 h-6 w-6" />
                            Create Routine
                        </Button>
                    </motion.div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <AnimatePresence>
                    {isLoading && routines.length === 0 ? (
                        <div className="col-span-full flex justify-center py-20">
                            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                        </div>
                    ) : routines.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="col-span-full text-center py-20 space-y-4"
                        >
                            <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Play className="w-8 h-8 text-muted-foreground/50 ml-1" />
                            </div>
                            <h3 className="text-xl font-semibold text-muted-foreground">No routines yet</h3>
                            <p className="text-muted-foreground/70">Create your first morning or evening routine to get started.</p>
                        </motion.div>
                    ) : (
                        routines.map((routine) => (
                            <RoutineCard
                                key={routine.id}
                                routine={routine}
                                onPlay={setPlayingRoutine}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        ))
                    )}
                </AnimatePresence>
            </div>

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
