'use client';

import { motion } from 'framer-motion';
import { Shield, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, getAvatarById } from '@/lib/avatars';
import { Progress } from '@/components/ui/progress';
import { useUserStore } from '@/lib/stores/user-store';

interface SettingsHeroProps {
    avatarId: string;
    level: number;
    xp: number;
    streakShield: number;
    onAvatarClick: () => void;
    className?: string; // Add className prop for grid positioning
}

export function SettingsHero({
    avatarId,
    level,
    xp,
    streakShield,
    onAvatarClick,
    className,
}: SettingsHeroProps) {
    const { displayName } = useUserStore();
    const nextLevelXp = level * 100;
    const progress = Math.min((xp / nextLevelXp) * 100, 100);
    const currentAvatar = getAvatarById(avatarId);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-6 md:p-8 backdrop-blur-xl shadow-2xl",
                "dark:bg-black/20 dark:border-white/10",
                className
            )}
        >
            {/* Background Ambience */}
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl opacity-50 pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl opacity-50 pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                {/* Avatar Section */}
                <div className="relative group cursor-pointer" onClick={onAvatarClick}>
                    <div className={cn(
                        "relative h-24 w-24 md:h-32 md:w-32 rounded-full ring-4 ring-white/30 shadow-xl overflow-hidden transition-transform group-hover:scale-105 flex items-center justify-center bg-gradient-to-br",
                        currentAvatar.bgGradient
                    )}>
                        <img
                            src={currentAvatar.src}
                            alt={currentAvatar.name}
                            className="h-20 w-20 md:h-28 md:w-28 object-contain drop-shadow-lg"
                        />
                    </div>
                    <div className="absolute bottom-0 right-0 p-2 bg-primary rounded-full text-white shadow-lg transform translate-x-1/4 translate-y-1/4">
                        <Sparkles className="h-5 w-5" />
                    </div>
                </div>

                {/* Info Section */}
                <div className="flex-1 text-center md:text-left space-y-4 w-full">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
                            {displayName || 'Habit Hero'}
                        </h2>
                        <p className="text-muted-foreground flex items-center justify-center md:justify-start gap-2 text-sm font-medium">
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-primary">
                                Level {level}
                            </span>
                            <span>•</span>
                            <span>{xp} XP / {nextLevelXp} XP</span>
                        </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2 max-w-md mx-auto md:mx-0">
                        <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                            <span>Progress to Lvl {level + 1}</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-3 bg-white/20" />
                    </div>
                </div>

                {/* Stats Section (Desktop) */}
                <div className="flex gap-4 md:border-l border-white/10 md:pl-8">
                    <div className="flex flex-col items-center p-4 rounded-2xl bg-white/5 border border-white/10 transition-colors">
                        <div className={cn("p-3 rounded-full mb-2", streakShield > 0 ? "bg-blue-500/20 text-blue-500" : "bg-gray-500/20 text-gray-500")}>
                            <Shield className="h-6 w-6" />
                        </div>
                        <span className="text-2xl font-bold">{streakShield}</span>
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Shields</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
