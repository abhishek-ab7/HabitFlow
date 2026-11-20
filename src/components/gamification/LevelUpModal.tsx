"use client"

import { motion } from 'framer-motion';
import { useGamificationStore, GEMS_PER_LEVEL } from '@/lib/stores/gamification-store';
import { Confetti } from '@/components/motion/confetti';
import { Button } from '@/components/ui/button';
import { Trophy, Diamond } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export function LevelUpModal() {
    const { showLevelUp, level, closeLevelUp } = useGamificationStore();

    return (
        <>
            <Confetti trigger={showLevelUp} duration={5000} particleCount={150} />
            <Dialog open={showLevelUp} onOpenChange={(open) => !open && closeLevelUp()}>
                <DialogContent className="sm:max-w-md bg-card border-invest/35 text-foreground rounded-2xl shadow-2xl z-[100]">
                    <DialogHeader>
                        <DialogTitle className="text-center text-3xl font-bold text-amber-500 uppercase tracking-wider py-2">
                            Level Up!
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col items-center justify-center p-6 space-y-8">
                        <div className="relative">
                            {/* Subtle trophy halo */}
                            <div className="absolute inset-0 bg-amber-400/20 blur-[32px] rounded-full" />

                            <motion.div
                                initial={{ scale: 0.5, rotateY: 180 }}
                                animate={{ scale: 1.2, rotateY: 0 }}
                                transition={{ type: 'spring', damping: 10, duration: 0.8 }}
                                className="relative z-10"
                            >
                                <Trophy className="w-28 h-28 text-amber-400 drop-shadow-md" strokeWidth={1.5} />
                            </motion.div>
                        </div>

                        <div className="text-center space-y-1">
                            <p className="text-muted-foreground text-base font-medium tracking-wide">You are now</p>
                            <motion.p
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-5xl font-bold font-mono tabular-nums text-foreground"
                            >
                                LEVEL {level}
                            </motion.p>
                        </div>

                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="flex flex-col items-center gap-3 w-full"
                        >
                            <div className="flex items-center gap-2 px-6 py-3 surface-subtle w-full justify-center">
                                <Diamond className="w-5 h-5 text-amber-500 fill-amber-500" />
                                <span className="font-bold font-mono tabular-nums text-lg text-foreground">+{GEMS_PER_LEVEL} Gems</span>
                            </div>
                            <div className="flex items-center gap-2 px-6 py-3 surface-subtle w-full justify-center">
                                <span className="font-semibold text-base text-primary">Attributes Increased!</span>
                            </div>
                        </motion.div>

                        <Button
                            onClick={closeLevelUp}
                            size="lg"
                            className="w-full bg-invest hover:bg-invest/90 text-white font-bold text-base shadow-sm transition-all"
                        >
                            CLAIM REWARDS
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
