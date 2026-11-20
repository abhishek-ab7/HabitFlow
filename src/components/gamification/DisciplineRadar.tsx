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
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-auto min-h-[380px] flex flex-col items-center justify-center surface-card p-6"
        >
            <div className="flex items-center justify-between w-full mb-4 px-2">
                <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-widest">Mastery Radar</h3>
                <div className="px-2 py-0.5 rounded-full bg-invest/10 border border-invest/20 text-[10px] font-bold text-invest">
                    LIVE
                </div>
            </div>

            <div className="w-full h-[180px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
                        <defs>
                            <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--invest)" stopOpacity={0.7} />
                                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.18} />
                            </linearGradient>
                        </defs>
                        <PolarGrid stroke="currentColor" className="text-muted-foreground/15" gridType="polygon" />
                        <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fill: 'currentColor', fontSize: 10, fontWeight: 700 }}
                            className="text-muted-foreground uppercase"
                        />
                        <PolarRadiusAxis angle={30} domain={[0, maxVal]} tick={false} axisLine={false} />
                        <Radar
                            name="Stats"
                            dataKey="A"
                            stroke="var(--invest)"
                            strokeWidth={2.5}
                            fill="url(#radarGradient)"
                            fillOpacity={1}
                            isAnimationActive={true}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full mt-4">
                {isThreeAxis ? (
                    <>
                        <StatItem label="Discipline" value={stats?.discipline || 1} color="text-invest" />
                        <StatItem label="Focus" value={stats?.focus || 1} color="text-sky-500" />
                        <StatItem label="Resilience" value={stats?.resilience || 1} color="text-emerald-500" />
                    </>
                ) : (
                    <>
                        <StatItem label="Vitality" value={stats?.vitality || 1} color="text-rose-500" />
                        <StatItem label="Intellect" value={stats?.intelligence || 1} color="text-sky-500" />
                        <StatItem label="Discipline" value={stats?.discipline || 1} color="text-invest" />
                        <StatItem label="Charisma" value={stats?.charisma || 1} color="text-rose-400" />
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
        <div className="flex flex-col items-center surface-subtle py-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
            <span className={cn("font-bold font-mono tabular-nums text-xl", color)}>{value}</span>
        </div>
    );
}
