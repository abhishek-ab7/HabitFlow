'use client';

import { useEffect, useRef } from 'react';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check, Lock, Star, Trophy, Sparkles } from 'lucide-react';

export function XPJourneyMap() {
    const { level } = useGamificationStore();
    const currentLevelRef = useRef<HTMLDivElement>(null);

    // Generate levels array (e.g., from 1 to current level + 2)
    const levels = Array.from({ length: Math.max(5, level + 3) }, (_, i) => i + 1);

    useEffect(() => {
        // Auto-scroll to current level after a short delay to allow rendering
        if (currentLevelRef.current) {
            setTimeout(() => {
                currentLevelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 500);
        }
    }, []);

    return (
        <div className="relative py-8 pl-4 pr-2">
            {/* Connecting Line - Dashed Gradient */}
            <div className="absolute left-[27px] top-8 bottom-8 w-[2px] bg-gradient-to-b from-invest/0 via-invest/50 to-invest/0">
                <div className="absolute inset-0 bg-background/50" style={{ maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' }}>
                    <div className="h-full w-full border-l-2 border-dashed border-invest/30" />
                </div>
            </div>

            <div className="space-y-8 relative">
                {levels.map((lvl) => {
                    const status = lvl < level ? 'completed' : lvl === level ? 'current' : 'locked';
                    return <LevelNode key={lvl} level={lvl} status={status} isRef={lvl === level ? currentLevelRef : null} />;
                })}
            </div>
        </div>
    );
}

function LevelNode({ level, status, isRef }: { level: number, status: 'completed' | 'current' | 'locked', isRef: React.Ref<HTMLDivElement> | null }) {
    const isCompleted = status === 'completed';
    const isCurrent = status === 'current';

    return (
        <motion.div
            ref={isRef}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
                "flex items-center gap-4 group relative",
                status === 'locked' && "opacity-60 grayscale-[0.8]"
            )}
        >
            {/* Circle Node */}
            <div className={cn(
                "relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold font-mono tabular-nums shadow-sm border-4 transition-all duration-300",
                isCompleted ? "bg-invest border-invest/30 text-white" : "",
                isCurrent ? "bg-background border-invest text-invest scale-110 ring-4 ring-invest/15" : "",
                status === 'locked' ? "bg-muted border-border text-muted-foreground" : ""
            )}>
                {isCompleted ? <Check className="w-5 h-5" /> : status === 'locked' ? <Lock className="w-4 h-4" /> : level}

                {/* Current Level Pulse Effect */}
                {isCurrent && (
                    <>
                        <span className="absolute inset-0 rounded-full bg-invest animate-ping opacity-20" />
                        <motion.div
                            className="absolute -top-1 -right-1"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        >
                            <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
                        </motion.div>
                    </>
                )}
            </div>

            {/* Content Card */}
            <div className={cn(
                "flex-1 p-4 rounded-xl border transition-all duration-300",
                isCurrent ? "bg-invest/10 border-invest/35 shadow-sm" : "surface-subtle",
                isCompleted ? "opacity-80" : ""
            )}>
                <div className="flex justify-between items-center mb-1">
                    <h4 className={cn("font-bold font-mono tabular-nums", isCurrent ? "text-invest" : "text-foreground/80")}>
                        Level {level}
                    </h4>
                    {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-invest/10 border border-invest/25 text-[10px] font-bold text-invest uppercase tracking-wide">
                            Current
                        </span>
                    )}
                </div>

                <p className="text-xs text-muted-foreground font-medium">
                    {getLevelDescription(level)}
                </p>

                {/* Rewards Preview */}
                <div className="flex flex-wrap gap-2 mt-3">
                    <RewardBadge icon={<Star className="w-3 h-3 text-amber-500" />} text="Title" active={isCompleted || isCurrent} />
                    {level % 5 === 0 && <RewardBadge icon={<Trophy className="w-3 h-3 text-invest" />} text="Rare Badge" active={isCompleted || isCurrent} />}
                </div>
            </div>
        </motion.div>
    );
}

function RewardBadge({ icon, text, active }: { icon: React.ReactNode, text: string, active: boolean }) {
    return (
        <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
            active ? "bg-background border border-border shadow-sm text-foreground" : "bg-muted/30 text-muted-foreground border border-transparent"
        )}>
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
