'use client';

import { motion } from 'framer-motion';
import { Shield, Camera, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvatarById } from '@/lib/avatars';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/lib/stores/user-store';

interface SettingsHeroProps {
    avatarId: string;
    streakShield: number;
    onAvatarClick: () => void;
    onRefillShields?: () => void;
    className?: string;
}

export function SettingsHero({
    avatarId,
    streakShield,
    onAvatarClick,
    onRefillShields,
    className,
}: SettingsHeroProps) {
    const { displayName, email } = useUserStore();
    const currentAvatar = getAvatarById(avatarId);

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                'relative overflow-hidden surface-hero p-5 sm:p-6',
                className
            )}
        >
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                {/* Avatar + Identity */}
                <div className="flex flex-col sm:flex-row items-center gap-5 min-w-0">
                    <button
                        type="button"
                        onClick={onAvatarClick}
                        aria-label="Change profile avatar"
                        className="relative group shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <div className={cn(
                            'relative h-20 w-20 sm:h-22 sm:w-22 rounded-full ring-2 ring-border overflow-hidden transition-transform group-hover:scale-[1.03] flex items-center justify-center bg-gradient-to-br',
                            currentAvatar.bgGradient
                        )}>
                            <img
                                src={currentAvatar.src}
                                alt={currentAvatar.name}
                                className="h-16 w-16 sm:h-18 sm:w-18 object-contain"
                            />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 p-1.5 bg-card border border-border rounded-full text-muted-foreground group-hover:text-foreground shadow-xs transition-colors">
                            <Camera className="h-3.5 w-3.5" />
                        </span>
                    </button>

                    <div className="text-center sm:text-left space-y-1 min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                            {displayName || 'Your Name'}
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground font-medium max-w-md">
                            {email ? `${email} · ` : ''}Personal Life &amp; Finance preferences, backups, and streak protection.
                        </p>
                    </div>
                </div>

                {/* Streak Shields Utility Strip */}
                <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-6 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            'p-2.5 rounded-xl shrink-0',
                            streakShield > 0 ? 'bg-info/15 text-info' : 'bg-muted text-muted-foreground'
                        )}>
                            <Shield className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-xl font-bold font-mono tabular-nums text-foreground">
                                    {streakShield}
                                </span>
                                <span className="text-xs text-muted-foreground font-medium">
                                    Streak Shields
                                </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Protects missed habit days
                            </p>
                        </div>
                    </div>
                    {onRefillShields && streakShield < 3 && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onRefillShields}
                            className="h-8 px-3 text-xs font-semibold gap-1.5 shrink-0 whitespace-nowrap"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Refill (3)
                        </Button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

