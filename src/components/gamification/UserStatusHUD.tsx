import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { Trophy, Diamond, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export function UserStatusHUD() {
    const { xp, level, gems, streakShield, loadGamification, getBufferProgress, openRules } =
        useGamificationStore();

    const [pulse, setPulse] = useState(false);
    const prevXpRef = useRef(xp);

    useEffect(() => {
        loadGamification();
    }, [loadGamification]);

    useEffect(() => {
        if (xp > prevXpRef.current) {
            setPulse(true);
            const t = setTimeout(() => setPulse(false), 1000);
            return () => clearTimeout(t);
        }
        prevXpRef.current = xp;
    }, [xp]);

    const progress = getBufferProgress();

    return (
        <div className="flex items-center gap-3 tour-hud-container">
            {/* Level Badge */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <motion.div
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-invest/10 rounded-full border border-invest/25 text-invest font-semibold text-xs font-mono tabular-nums min-w-[32px] justify-center cursor-pointer hover:bg-invest/20 transition-colors"
                            whileHover={{ scale: 1.05 }}
                            onClick={() => openRules('levels')}
                        >
                            <Trophy className="w-3 h-3" />
                            <span>Lv.{level}</span>
                        </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <div className="text-xs">
                            <p className="font-semibold">Current Level: {level}</p>
                            <p>XP: {xp} / {level * 100}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Click for details</p>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* XP Bar */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <motion.div
                            animate={pulse ? {
                                boxShadow: [
                                    '0 0 0 rgba(139,92,246,0)',
                                    '0 0 12px rgba(139,92,246,0.5)',
                                    '0 0 0 rgba(139,92,246,0)'
                                ]
                            } : {}}
                            transition={{ duration: 1 }}
                            className="block w-24 md:w-48 h-4 bg-muted rounded-full overflow-hidden relative border border-border cursor-pointer hover:opacity-90 transition-all"
                            onClick={() => openRules('xp')}
                        >
                            <motion.div
                                className="h-full bg-invest"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ type: 'spring', damping: 20 }}
                            />
                            
                            {/* XP Text Indicator */}
                            <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold font-mono tabular-nums tracking-wider text-white mix-blend-difference">
                                {xp} / {level * 100} XP
                            </div>
                        </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <div className="text-xs">
                            <p className="font-semibold">Level {level} Progress</p>
                            <p>XP: {xp} / {level * 100} ({progress.toFixed(0)}%)</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Click to see XP rules</p>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* Gems */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div
                            className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 cursor-pointer bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                            onClick={() => openRules('gems')}
                        >
                            <Diamond className="w-3.5 h-3.5 fill-current" />
                            <span>{gems}</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p className="text-xs">Habit Gems: Earn by completing tasks!</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Click to see shop</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* Shield */}
            {streakShield > 0 && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                className="flex items-center gap-1 text-xs font-medium text-blue-500 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/20 cursor-pointer hover:bg-blue-500/20 transition-colors"
                                onClick={() => openRules('gems')}
                            >
                                <Shield className="w-3.5 h-3.5 fill-current" />
                                <span>{streakShield}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p className="text-xs">Streak Shield Active: Protects your streak!</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    );
}
