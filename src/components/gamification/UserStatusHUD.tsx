import { useEffect } from 'react';
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

    useEffect(() => {
        loadGamification();
    }, [loadGamification]);

    const progress = getBufferProgress();

    return (
        <div className="flex items-center gap-3 mr-4">
            {/* Level Badge */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <motion.div
                            className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-full border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold text-xs min-w-[32px] justify-center cursor-pointer hover:bg-indigo-500/20 transition-colors"
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
            <div
                className="hidden lg:block w-32 h-2.5 bg-secondary rounded-full overflow-hidden relative border border-border/50 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => openRules('xp')}
            >
                <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: 'spring', damping: 20 }}
                />
            </div>

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
