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
                <DialogContent className="sm:max-w-md bg-gradient-to-br from-indigo-900/95 to-purple-900/95 border-indigo-500/50 backdrop-blur-xl text-white shadow-2xl z-[100]">
                    <DialogHeader>
                        <DialogTitle className="text-center text-4xl font-black bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent uppercase tracking-wider drop-shadow-md py-2">
                            Level Up!
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col items-center justify-center p-6 space-y-8">
                        <div className="relative">
                            {/* Glowing background */}
                            <div className="absolute inset-0 bg-yellow-400/30 blur-[40px] rounded-full animate-pulse" />

                            <motion.div
                                initial={{ scale: 0.5, rotateY: 180 }}
                                animate={{ scale: 1.2, rotateY: 0 }}
                                transition={{ type: 'spring', damping: 10, duration: 0.8 }}
                                className="relative z-10"
                            >
                                <Trophy className="w-32 h-32 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]" strokeWidth={1.5} />
                            </motion.div>
                        </div>

                        <div className="text-center space-y-1">
                            <p className="text-indigo-200 text-lg font-medium tracking-wide">You are now</p>
                            <motion.p
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-6xl font-black text-white drop-shadow-[0_4px_0_rgba(79,70,229,1)]"
                            >
                                LEVEL {level}
                            </motion.p>
                        </div>

                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="flex items-center gap-2 px-6 py-3 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-md"
                        >
                            <Diamond className="w-6 h-6 text-amber-400 fill-amber-400" />
                            <span className="font-bold text-xl text-amber-100">+{GEMS_PER_LEVEL} Gems</span>
                        </motion.div>

                        <Button
                            onClick={closeLevelUp}
                            size="lg"
                            className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-purple-900 font-extrabold text-lg shadow-lg hover:shadow-yellow-500/20 hover:scale-105 transition-all duration-300"
                        >
                            CLAIM REWARDS
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
