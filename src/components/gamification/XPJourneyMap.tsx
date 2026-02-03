'use client';

import { useGamificationStore } from '@/lib/stores/gamification-store';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check, Lock, Star, Trophy } from 'lucide-react';

export function XPJourneyMap() {
    const { level } = useGamificationStore();

    // Generate levels array (e.g., from 1 to current level + 2)
    const levels = Array.from({ length: Math.max(5, level + 3) }, (_, i) => i + 1);

    return (
        <div className="relative py-8 pl-4 pr-2">
            {/* Connecting Line */}
            <div className="absolute left-[27px] top-8 bottom-8 w-1 bg-gradient-to-b from-indigo-500/20 via-indigo-500/50 to-indigo-500/20 rounded-full" />

            <div className="space-y-8 relative">
                {levels.map((lvl) => {
                    const status = lvl < level ? 'completed' : lvl === level ? 'current' : 'locked';
                    return <LevelNode key={lvl} level={lvl} status={status} />;
                })}
            </div>
        </div>
    );
}

function LevelNode({ level, status }: { level: number, status: 'completed' | 'current' | 'locked' }) {
    const isCompleted = status === 'completed';
    const isCurrent = status === 'current';

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
                "flex items-center gap-4 group",
                status === 'locked' && "opacity-50 grayscale"
            )}
        >
            {/* Circle Node */}
            <div className={cn(
                "relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-xl border-4 transition-all duration-300",
                isCompleted ? "bg-indigo-600 border-indigo-200 text-white" : "",
                isCurrent ? "bg-white dark:bg-zinc-900 border-indigo-500 text-indigo-500 scale-110 shadow-indigo-500/20" : "",
                status === 'locked' ? "bg-muted border-muted-foreground/20 text-muted-foreground" : ""
            )}>
                {isCompleted ? <Check className="w-6 h-6" /> : level}

                {/* Current Level Pulse Effect */}
                {isCurrent && (
                    <span className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-20" />
                )}
            </div>

            {/* Content Card */}
            <div className={cn(
                "flex-1 p-4 rounded-xl border transition-all",
                isCurrent ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800" : "bg-card border-border",
                isCompleted ? "opacity-70" : ""
            )}>
                <div className="flex justify-between items-center mb-1">
                    <h4 className={cn("font-bold", isCurrent ? "text-indigo-600 dark:text-indigo-400" : "")}>
                        Level {level}
                    </h4>
                    {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide">
                            Current
                        </span>
                    )}
                </div>

                <p className="text-sm text-muted-foreground">
                    {getLevelDescription(level)}
                </p>

                {/* Rewards Preview */}
                <div className="flex gap-2 mt-3">
                    <RewardBadge icon={<Star className="w-3 h-3" />} text="Title" />
                    {level % 5 === 0 && <RewardBadge icon={<Trophy className="w-3 h-3" />} text="Rare Badge" />}
                </div>
            </div>
        </motion.div>
    );
}

function RewardBadge({ icon, text }: { icon: React.ReactNode, text: string }) {
    return (
        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 text-[10px] font-medium text-muted-foreground">
            {icon}
            <span>{text}</span>
        </div>
    );
}

function getLevelDescription(level: number): string {
    if (level === 1) return "The journey begins.";
    if (level === 5) return "Unlocking consistency mastery.";
    if (level === 10) return "A true habit building legend.";
    return `Mastering the art of small steps.`;
}
