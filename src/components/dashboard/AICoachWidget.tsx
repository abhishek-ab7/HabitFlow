import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Lightbulb, Quote, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { cn } from '@/lib/utils';

interface AICoachResponse {
    greeting: string;
    focus: string;
    quote: string;
}

export function AICoachWidget() {
    const { user } = useAuth();
    const [data, setData] = useState<AICoachResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { habits } = useHabitStore();
    const { tasks } = useTaskStore();
    const { level } = useGamificationStore();

    const fetchAdvice = async (force: boolean = false) => {
        if (!user) return;

        const today = new Date().toISOString().split('T')[0];
        const cacheKey = `ai_coach_advice_${user.id}`;

        // Check cache if not forced
        if (!force) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (parsed.date === today) {
                        setData(parsed.data);
                        return;
                    }
                } catch (e) {
                    console.error("Cache parse error", e);
                }
            }
        }

        setLoading(true);
        setError(null);

        try {
            // Prepare context for the AI
            const todaysHabits = habits.filter(h => !h.archived);
            const unfinishedTasks = tasks.filter(t => t.status !== 'done');

            const res = await fetch('/api/ai/coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userData: {
                        userName: user.email?.split('@')[0], // Fallback if no name
                        level
                    },
                    context: {
                        todaysHabits: todaysHabits.map(h => h.name),
                        unfinishedTasks: unfinishedTasks.map(t => t.title),
                        mode: 'briefing'
                    }
                })
            });

            if (!res.ok) {
                const rawText = await res.text().catch(() => "");
                let errorData: any = {};
                try {
                    errorData = JSON.parse(rawText);
                } catch (e) {
                    console.error("Non-JSON Error Response:", rawText);
                }

                if (res.status === 429) {
                    throw new Error("DAILY_QUOTA_EXCEEDED");
                }

                throw new Error(errorData?.error || errorData?.details || `Server error (${res.status})`);
            }
            const result = await res.json();

            // Check if result has the expected format
            if (!result.greeting || !result.focus || !result.quote) {
                console.error('Invalid AI response format:', result);
                throw new Error('Invalid response from AI');
            }

            setData(result);
            // Save to cache
            localStorage.setItem(cacheKey, JSON.stringify({
                date: today,
                data: result
            }));
            setError(null);
        } catch (err: any) {
            console.error('AI Coach Error:', err);
            if (err.message === "DAILY_QUOTA_EXCEEDED") {
                setError("Quota exceeded. Your personal coach needs a break—please check back in an hour or tomorrow!");
            } else {
                setError(err.message || 'AI Coach is taking a nap. Try again later.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchAdvice(false);
        }
    }, [user]);

    return (
        <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-3 opacity-10">
                <Sparkles className="w-24 h-24 text-indigo-500" />
            </div>

            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                    <Sparkles className="w-5 h-5 text-indigo-500 fill-current" />
                    AI Coach
                </CardTitle>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fetchAdvice(true)}
                    disabled={loading}
                    className="h-8 w-8 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 relative group"
                >
                    <RefreshCw className={cn(
                        "w-4 h-4 transition-all duration-500",
                        loading ? "animate-spin" : "group-hover:rotate-180"
                    )} />
                </Button>
            </CardHeader>

            <CardContent className="space-y-4 relative z-10">
                {loading && !data ? (
                    <div className="flex flex-col items-center justify-center py-6 space-y-3 text-muted-foreground/60">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <p className="text-sm">Consulting the oracle...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-6 space-y-3">
                        <div className="text-sm text-amber-600 dark:text-amber-400 text-center">
                            <p className="font-semibold mb-1">AI Coach Unavailable</p>
                            <p className="text-xs text-muted-foreground">{error}</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchAdvice(true)}
                            disabled={loading}
                            className="mt-2"
                        >
                            {loading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                            Try Again
                        </Button>
                    </div>
                ) : data ? (
                    <div className="space-y-4 animation-fade-in">
                        {/* Greeting */}
                        <h3 className="text-xl font-bold text-foreground">
                            {data.greeting}
                        </h3>

                        {/* Focus */}
                        <div className="flex gap-3 bg-background/50 backdrop-blur-sm p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                            <div className="mt-1 min-w-[24px]">
                                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                    <Lightbulb className="w-4 h-4" />
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-0.5">Focus of the Moment</p>
                                <p className="text-sm text-foreground/90 font-medium leading-relaxed">
                                    {data.focus}
                                </p>
                            </div>
                        </div>

                        {/* Quote */}
                        <div className="flex gap-2 items-start opacity-75">
                            <Quote className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-xs italic text-muted-foreground">
                                "{data.quote}"
                            </p>
                        </div>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}
