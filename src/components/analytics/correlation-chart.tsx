'use client';

import { useMemo } from 'react';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Scatter,
} from 'recharts';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';

interface CorrelationProps {
    data: {
        date: string;
        tasksCompleted: number;
        habitCompletionRate: number;
    }[];
}

export function CorrelationChart({ data }: CorrelationProps) {
    // Filter out days with 0 activity to avoid noise? Or keep them?
    // Let's keep them but maybe sort by date
    const chartData = useMemo(() => {
        return [...data].sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
            ...d,
            formattedDate: format(parseISO(d.date), 'MMM d'),
        }));
    }, [data]);

    return (
        <Card className="col-span-full lg:col-span-2">
            <CardHeader>
                <CardTitle className="text-lg font-semibold">Activity Correlation</CardTitle>
                <CardDescription>
                    Do busy days affect your habits? Comparing completed tasks vs habit consistency.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="h-[300px]"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />

                            <XAxis
                                dataKey="formattedDate"
                                scale="point"
                                padding={{ left: 10, right: 10 }}
                                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                            />

                            <YAxis
                                yAxisId="left"
                                orientation="left"
                                stroke="hsl(var(--chart-1))"
                                tick={{ fill: 'hsl(var(--chart-1))', fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={val => `${val}%`}
                                label={{ value: 'Habit Consistency', angle: -90, position: 'insideLeft', fill: 'hsl(var(--chart-1))', fontSize: 10 }}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                stroke="hsl(var(--chart-2))"
                                tick={{ fill: 'hsl(var(--chart-2))', fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                                label={{ value: 'Tasks Done', angle: 90, position: 'insideRight', fill: 'hsl(var(--chart-2))', fontSize: 10 }}
                            />

                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--popover))',
                                    borderRadius: '8px',
                                    border: '1px solid hsl(var(--border))',
                                    color: 'hsl(var(--popover-foreground))'
                                }}
                                labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                            />
                            <Legend />

                            {/* Habit Rate as Area/Line */}
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="habitCompletionRate"
                                name="Habit Consistency (%)"
                                stroke="hsl(var(--chart-1))"
                                strokeWidth={3}
                                dot={{ r: 4, fill: 'hsl(var(--chart-1))' }}
                                activeDot={{ r: 6 }}
                            />

                            {/* Task Count as Bars */}
                            <Bar
                                yAxisId="right"
                                dataKey="tasksCompleted"
                                name="Tasks Completed"
                                fill="hsl(var(--chart-2))"
                                opacity={0.3}
                                barSize={20}
                                radius={[4, 4, 0, 0]}
                            />

                        </ComposedChart>
                    </ResponsiveContainer>
                </motion.div>
            </CardContent>
        </Card>
    );
}
