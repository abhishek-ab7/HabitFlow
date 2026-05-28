'use client';

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { UserStats } from '@/lib/types';

export function DisciplineRadar({ stats: customStats }: { stats?: UserStats }) {
    const storeStats = useGamificationStore(state => state.stats);
    const stats = customStats || storeStats;

    const isThreeAxis = typeof stats?.focus === 'number' && typeof stats?.resilience === 'number';

    const data = isThreeAxis
        ? [
            {
                subject: 'Discipline',
                A: stats?.discipline || 1,
                fullMark: 100,
            },
            {
                subject: 'Focus',
                A: stats?.focus || 1,
                fullMark: 100,
            },
            {
                subject: 'Resilience',
                A: stats?.resilience || 1,
                fullMark: 100,
            },
          ]
        : [
            {
                subject: 'Vitality',
                A: stats?.vitality || 1,
                fullMark: 100,
            },
            {
                subject: 'Intellect',
                A: stats?.intelligence || 1,
                fullMark: 100,
            },
            {
                subject: 'Discipline',
                A: stats?.discipline || 1,
                fullMark: 100,
            },
            {
                subject: 'Charisma',
                A: stats?.charisma || 1,
                fullMark: 100,
            },
            {
                subject: 'Wealth',
                A: stats?.wealth || 1,
                fullMark: 100,
            },
            {
                subject: 'Creativity',
                A: stats?.creativity || 1,
                fullMark: 100,
            },
        ];

    const maxVal = isThreeAxis
        ? Math.max(
            5,
            stats?.discipline || 1,
            stats?.focus || 1,
            stats?.resilience || 1
        )
        : Math.max(
            5,
            stats?.vitality || 1,
            stats?.intelligence || 1,
            stats?.discipline || 1,
            stats?.charisma || 1,
            stats?.wealth || 1,
            stats?.creativity || 1
        );

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-auto min-h-[380px] flex flex-col items-center justify-center bg-gradient-to-b from-slate-100/50 via-slate-50/10 to-transparent dark:from-white/5 dark:to-transparent rounded-3xl border border-slate-200/60 dark:border-white/10 p-6 shadow-xl backdrop-blur-md"
        >
            <div className="flex items-center justify-between w-full mb-4 px-2">
                <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-widest">Mastery Radar</h3>
                <div className="px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-500">
                    LIVE
                </div>
            </div>

            <div className="w-full h-[180px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
                        <defs>
                            <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.2} />
                            </linearGradient>
                        </defs>
                        <PolarGrid stroke="currentColor" className="text-muted-foreground/10" gridType="polygon" />
                        <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fill: 'currentColor', fontSize: 10, fontWeight: 800 }}
                            className="text-muted-foreground uppercase"
                        />
                        <PolarRadiusAxis angle={30} domain={[0, maxVal]} tick={false} axisLine={false} />
                        <Radar
                            name="Stats"
                            dataKey="A"
                            stroke="#8b5cf6"
                            strokeWidth={3}
                            fill="url(#radarGradient)"
                            fillOpacity={1}
                            isAnimationActive={true}
                        />
                    </RadarChart>
                </ResponsiveContainer>

                {/* Decorative glows */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-500/20 blur-[50px] rounded-full pointer-events-none" />
            </div>

            <div className="grid grid-cols-3 gap-2 w-full mt-4">
                {isThreeAxis ? (
                    <>
                        <StatItem label="Discipline" value={stats?.discipline || 1} color="text-violet-500" />
                        <StatItem label="Focus" value={stats?.focus || 1} color="text-sky-500" />
                        <StatItem label="Resilience" value={stats?.resilience || 1} color="text-emerald-500" />
                    </>
                ) : (
                    <>
                        <StatItem label="Vitality" value={stats?.vitality || 1} color="text-red-500" />
                        <StatItem label="Intellect" value={stats?.intelligence || 1} color="text-blue-500" />
                        <StatItem label="Discipline" value={stats?.discipline || 1} color="text-violet-500" />
                        <StatItem label="Charisma" value={stats?.charisma || 1} color="text-pink-500" />
                        <StatItem label="Wealth" value={stats?.wealth || 1} color="text-emerald-500" />
                        <StatItem label="Creativity" value={stats?.creativity || 1} color="text-amber-500" />
                    </>
                )}
            </div>
        </motion.div>
    );
}

function StatItem({ label, value, color }: { label: string, value: number, color?: string }) {
    return (
        <div className="flex flex-col items-center bg-slate-100/50 dark:bg-white/5 rounded-lg py-2 border border-slate-200/50 dark:border-white/5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
            <span className={cn("font-bold text-xl", color)}>{value}</span>
        </div>
    );
}
