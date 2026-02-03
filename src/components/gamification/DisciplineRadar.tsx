'use client';

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { motion } from 'framer-motion';

export function DisciplineRadar() {
    const { stats } = useGamificationStore();

    const data = [
        {
            subject: 'Discipline',
            A: stats.discipline,
            fullMark: 100,
        },
        {
            subject: 'Focus',
            A: stats.focus,
            fullMark: 100,
        },
        {
            subject: 'Resilience',
            A: stats.resilience,
            fullMark: 100,
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-[300px] flex flex-col items-center justify-center bg-white/5 dark:bg-zinc-900/50 rounded-2xl border border-black/5 dark:border-white/5 p-4"
        >
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Discipline Radar</h3>
            <div className="w-full h-full min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                        <PolarGrid stroke="currentColor" className="text-muted-foreground/20" />
                        <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fill: 'currentColor', fontSize: 12, fontWeight: 600 }}
                            className="text-foreground"
                        />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                            name="My Stats"
                            dataKey="A"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            fill="#8b5cf6"
                            fillOpacity={0.5}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 w-full mt-4 text-center">
                <StatItem label="Discipline" value={stats.discipline} />
                <StatItem label="Focus" value={stats.focus} />
                <StatItem label="Resilience" value={stats.resilience} />
            </div>
        </motion.div>
    );
}

function StatItem({ label, value }: { label: string, value: number }) {
    return (
        <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400">{value}</span>
        </div>
    );
}
