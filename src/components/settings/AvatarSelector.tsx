'use client';

import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Avatar, AVATARS } from '@/lib/avatars';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AvatarSelectorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedAvatarId?: string;
    onSelect: (avatar: Avatar) => void;
}

export function AvatarSelector({
    open,
    onOpenChange,
    selectedAvatarId,
    onSelect,
}: AvatarSelectorProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl bg-white/90 dark:bg-black/90 backdrop-blur-2xl border-white/20">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
                        Choose Your Avatar
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
                        {AVATARS.map((avatar, index) => (
                            <motion.div
                                key={avatar.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onSelect(avatar)}
                                className={cn(
                                    'cursor-pointer rounded-2xl p-4 flex flex-col items-center gap-2 border-2 transition-all relative overflow-hidden group',
                                    selectedAvatarId === avatar.id
                                        ? 'border-primary bg-primary/10'
                                        : 'border-transparent hover:border-white/20 bg-muted/30 hover:bg-muted/50'
                                )}
                            >
                                {/* Background Glow */}
                                <div
                                    className={cn(
                                        "absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br",
                                        avatar.bgGradient
                                    )}
                                />

                                <div className={cn(
                                    "w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-lg relative z-10 bg-gradient-to-br",
                                    avatar.bgGradient
                                )}>
                                    <img
                                        src={avatar.src}
                                        alt={avatar.name}
                                        className="w-16 h-16 object-contain drop-shadow-md"
                                    />
                                    {selectedAvatarId === avatar.id && (
                                        <motion.div
                                            layoutId="selected-check"
                                            className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-md w-6 h-6 flex items-center justify-center"
                                        >
                                            ✓
                                        </motion.div>
                                    )}
                                </div>

                                <span className={cn(
                                    "text-xs font-medium text-center relative z-10 transition-colors",
                                    selectedAvatarId === avatar.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                )}>
                                    {avatar.name}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
