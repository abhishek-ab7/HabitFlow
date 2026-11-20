'use client';

import { motion } from 'framer-motion';
import { Shield, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvatarById } from '@/lib/avatars';
import { Progress } from '@/components/ui/progress';
import { useUserStore } from '@/lib/stores/user-store';

interface SettingsHeroProps {
    avatarId: string;
    level: number;
    xp: number;
    streakShield: number;
    onAvatarClick: () => void;
    className?: string;
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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                'relative overflow-hidden surface-hero p-6 md:p-8',
                className
            )}
        >
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                {/* Avatar Section */}
                <div className="relative group cursor-pointer" onClick={onAvatarClick}>
                    <div className={cn(
                        'relative h-24 w-24 md:h-28 md:w-28 rounded-full ring-2 ring-border shadow-md overflow-hidden transition-transform group-hover:scale-105 flex items-center justify-center bg-gradient-to-br',
                        currentAvatar.bgGradient
                    )}>
                        <img
                            src={currentAvatar.src}
                            alt={currentAvatar.name}
                            className="h-20 w-20 md:h-24 md:w-24 object-contain"
                        />
                    </div>
                    <div className="absolute bottom-0 right-0 p-2 bg-primary rounded-full text-primary-foreground shadow-md transform translate-x-1/4 translate-y-1/4">
                        <Sparkles className="h-4 w-4" />
                    </div>
                </div>

                {/* Info Section */}
                <div className="flex-1 text-center md:text-left space-y-3.5 w-full">
                    <div className="space-y-1">
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                            {displayName || 'Your Name'}
                        </h2>
                        <p className="text-muted-foreground flex items-center justify-center md:justify-start gap-2 text-sm font-medium font-mono tabular-nums">
                            <span className="inline-flex items-center gap-1 rounded-full bg-invest/15 px-3 py-0.5 text-invest font-semibold">
                                Level {level}
                            </span>
                            <span>•</span>
                            <span>{xp} XP / {nextLevelXp} XP</span>
                        </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 max-w-md mx-auto md:mx-0">
                        <div className="flex justify-between text-xs font-medium text-muted-foreground font-mono tabular-nums">
                            <span>Progress to Lvl {level + 1}</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2.5 bg-muted" />
                    </div>
                </div>

                {/* Stats Section (Desktop) */}
                <div className="flex gap-4 md:border-l border-border md:pl-8">
                    <div className="flex flex-col items-center p-4 surface-subtle min-w-[96px]">
                        <div className={cn('p-2.5 rounded-full mb-2', streakShield > 0 ? 'bg-info/15 text-info' : 'bg-muted text-muted-foreground')}>
                            <Shield className="h-5 w-5" />
                        </div>
                        <span className="text-2xl font-bold font-mono tabular-nums text-foreground">{streakShield}</span>
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Shields</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
