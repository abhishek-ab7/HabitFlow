'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trophy, Diamond, Shield, Zap, Target, Book, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { DisciplineRadar } from './DisciplineRadar';
import { XPJourneyMap } from './XPJourneyMap';
import { AccountabilityPledge } from './AccountabilityPledge';

export function GamificationRulesModal() {
    const { rulesModalOpen, activeRulesTab, closeRules, setActiveRulesTab } = useGamificationStore();

    // Debugging: Ensure component is rendering and receiving state updates
    console.log('[GamificationRulesModal] Render:', { rulesModalOpen, activeRulesTab });

    return (
        <Dialog open={rulesModalOpen} onOpenChange={(open) => !open && closeRules()}>
            <DialogContent className="sm:max-w-2xl bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-white/20 dark:border-white/10">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
                        How to Play
                    </DialogTitle>
                    <DialogDescription>
                        Master the rules to level up faster and earn rewards.
                    </DialogDescription>
                </DialogHeader>

                <Tabs
                    defaultValue="xp"
                    value={activeRulesTab}
                    onValueChange={(val) => setActiveRulesTab(val as any)}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="xp" className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            XP & Levels
                        </TabsTrigger>
                        <TabsTrigger value="gems" className="flex items-center gap-2">
                            <Diamond className="w-4 h-4 text-blue-500" />
                            Gems & Shop
                        </TabsTrigger>
                        <TabsTrigger value="rules" className="flex items-center gap-2">
                            <Book className="w-4 h-4 text-emerald-500" />
                            Rules
                        </TabsTrigger>
                    </TabsList>

                    <ScrollArea className="h-[400px] pr-4">
                        <TabsContent value="xp" className="space-y-4 focus-visible:ring-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[450px]">
                                {/* Left Column: Stats & Pledge */}
                                <ScrollArea className="h-full pr-4">
                                    <div className="space-y-4">
                                        <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-100 dark:border-amber-900/50">
                                            <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2 mb-2">
                                                <Trophy className="w-5 h-5" />
                                                Your Mastery Profile
                                            </h3>
                                            <p className="text-sm text-amber-800 dark:text-amber-300">
                                                Track your discipline, focus, and resilience. Level up to boost these stats!
                                            </p>
                                        </div>
                                        <DisciplineRadar />
                                        <AccountabilityPledge />
                                    </div>
                                </ScrollArea>

                                {/* Right Column: Journey Map */}
                                <div className="bg-white/50 dark:bg-black/20 rounded-xl border p-1 h-full overflow-hidden flex flex-col">
                                    <h3 className="text-sm font-bold px-4 py-3 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b sticky top-0 z-10 flex items-center gap-2">
                                        <Target className="w-4 h-4 text-indigo-500" />
                                        Journey Map
                                    </h3>
                                    <ScrollArea className="flex-1">
                                        <XPJourneyMap />
                                    </ScrollArea>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="gems" className="space-y-4 focus-visible:ring-0">
                            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
                                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2 mb-2">
                                    <Diamond className="w-5 h-5" />
                                    Gem Economy
                                </h3>
                                <p className="text-sm text-blue-800 dark:text-blue-300">
                                    Gems are a premium currency earned by leveling up. Spend them on powerful boosters.
                                </p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="p-4 border rounded-xl bg-gradient-to-br from-white to-blue-50 dark:from-zinc-900 dark:to-blue-950/20">
                                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                                        <Trophy className="w-4 h-4 text-yellow-500" />
                                        How to Earn
                                    </h4>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex justify-between items-center">
                                            <span>Level Up</span>
                                            <span className="font-bold text-blue-600">+5 Gems</span>
                                        </li>
                                        <li className="flex justify-between items-center text-muted-foreground">
                                            <span>Special Events</span>
                                            <span>Coming Soon</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="p-4 border rounded-xl bg-gradient-to-br from-white to-purple-50 dark:from-zinc-900 dark:to-purple-950/20">
                                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                                        <Shield className="w-4 h-4 text-indigo-500" />
                                        Streak Store
                                    </h4>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex justify-between items-center">
                                            <span>Streak Shield</span>
                                            <span className="font-bold text-red-500">-20 Gems</span>
                                        </li>
                                        <li className="text-xs text-muted-foreground mt-1">
                                            Protects your streak if you miss a day. Automatically consumed.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="rules" className="space-y-4 focus-visible:ring-0">
                            <div className="space-y-4">
                                <RuleItem
                                    title="Streaks"
                                    description="Completing a habit consecutively builds your streak. Missing a day resets it to 0 unless you have a Shield."
                                />
                                <RuleItem
                                    title="Streak Shields"
                                    description="A shield is automatically used when you miss a habit, keeping your streak alive. You can hold multiple shields."
                                />
                                <RuleItem
                                    title="Levels"
                                    description="Your level represents your overall consistency. There is no level cap. Show off your high level to friends!"
                                />
                            </div>
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

function RewardCard({ icon, title, reward, description }: { icon: React.ReactNode, title: string, reward: string, description: string }) {
    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center p-3 rounded-xl border bg-white dark:bg-zinc-900 shadow-sm"
        >
            <div className="p-2 rounded-full bg-muted mr-3">
                {icon}
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                    <h4 className="font-semibold text-sm">{title}</h4>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {reward}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
        </motion.div>
    );
}

function RuleItem({ title, description }: { title: string, description: string }) {
    return (
        <div className="p-4 rounded-xl bg-muted/30 border">
            <h4 className="font-semibold mb-1">{title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
    );
}
