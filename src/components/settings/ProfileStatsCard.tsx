'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trophy, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { getAvatarById } from '@/lib/avatars';
import { BentoGridItem } from '@/components/ui/bento-grid';
import { cn } from '@/lib/utils';
import { useGamificationStore } from '@/lib/stores/gamification-store';

interface ProfileStatsCardProps {
    userName: string;
    avatarId?: string;
    level: number;
    xp: number;
    streakShield: number;
    onUpdateName: (name: string) => void;
    onAvatarClick: () => void;
    className?: string;
}

export function ProfileStatsCard({
    userName,
    avatarId,
    level,
    xp,
    streakShield,
    onUpdateName,
    onAvatarClick,
    className
}: ProfileStatsCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(userName);
    const { openRules } = useGamificationStore();

    const avatar = getAvatarById(avatarId);

    // Calculate Progress (Level * 100 formula)
    const xpRequired = level * 100;
    const progress = Math.min(100, (xp / xpRequired) * 100);

    const ProfileHeader = () => (
        <div className="flex items-start justify-between w-full">
            <div className="flex gap-4">
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onAvatarClick}
                    className={cn(
                        "w-16 h-16 rounded-2xl cursor-pointer shadow-lg flex items-center justify-center text-3xl overflow-hidden bg-gradient-to-br",
                        avatar.bgGradient
                    )}
                >
                    <img src={avatar.src} alt={avatar.name} className="w-full h-full object-cover" />
                </motion.div>

                <div className="flex flex-col pt-1">
                    {isEditing ? (
                        <div className="flex gap-2 items-center">
                            <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="h-8 w-32 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        onUpdateName(newName);
                                        setIsEditing(false);
                                    }
                                }}
                            />
                            <Button size="sm" variant="ghost" onClick={() => { onUpdateName(newName); setIsEditing(false); }}>OK</Button>
                        </div>
                    ) : (
                        <div
                            className="font-bold text-xl flex items-center gap-2 group cursor-pointer"
                            onClick={() => setIsEditing(true)}
                        >
                            {userName || 'Habit Hero'}
                            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                        </div>
                    )}
                    <div
                        className="flex items-center gap-2 text-xs text-muted-foreground mt-1 cursor-pointer hover:text-indigo-500 transition-colors"
                        onClick={() => openRules('levels')}
                    >
                        <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full text-indigo-600 dark:text-indigo-400 font-semibold">
                            <Trophy className="w-3 h-3" />
                            <span>Level {level}</span>
                        </div>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            {xp} / {xpRequired} XP
                        </span>
                    </div>
                </div>
            </div>

            <motion.div
                whileHover={{ scale: 1.1 }}
                onClick={() => openRules('gems')}
                className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 cursor-pointer"
                title="Streak Shield"
            >
                <Shield className={cn("w-5 h-5", streakShield > 0 ? "text-blue-500 fill-blue-500/20" : "text-muted-foreground")} />
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{streakShield}</span>
            </motion.div>
        </div>
    );

    return (
        <BentoGridItem
            span={2}
            className={cn("md:row-span-2 relative overflow-hidden flex flex-col justify-between group", className)}
            header={<ProfileHeader />}
        >
            {/* Added Middle Content - Quick Stats */}
            <div className="flex-1 flex flex-col justify-center py-4">
                <div className="grid grid-cols-2 gap-3">
                    <div
                        className="bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800/20 cursor-pointer hover:bg-indigo-100/50 dark:hover:bg-indigo-900/20 transition-colors"
                        onClick={() => openRules('levels')}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-semibold text-muted-foreground">Next Unlock</span>
                        </div>
                        <p className="text-sm font-bold text-foreground truncate">Level {level + 1} Badge</p>
                    </div>
                    <div
                        className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-800/20 cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors"
                        onClick={() => openRules('gems')}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-semibold text-muted-foreground">Active Shield</span>
                        </div>
                        <p className="text-sm font-bold text-foreground">
                            {streakShield > 0 ? "Protected" : "Vulnerable"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-auto space-y-2 cursor-pointer pt-4 border-t border-border/40" onClick={() => openRules('xp')}>
                <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Progress to Level {level + 1}</span>
                    <span className="text-indigo-600 dark:text-indigo-400">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2.5 bg-secondary" indicatorClassName="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                <p className="text-[10px] text-muted-foreground text-right w-full font-medium">
                    {xpRequired - xp} XP to level up
                </p>
            </div>
        </BentoGridItem>
    );
}
