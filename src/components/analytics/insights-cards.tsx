'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  Trophy, 
  AlertTriangle, 
  Lightbulb, 
  Info,
  TrendingUp,
  Flame,
  Target,
  Calendar,
  Star,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StaggerContainer, StaggerItem } from '@/components/motion';
import type { Insight } from '@/lib/types';
import { useHabitStore } from '@/lib/stores/habit-store';
import { subDays, format as formatDate } from 'date-fns';
import { ResponsiveContainer, LineChart, Line } from 'recharts';

interface InsightsCardsProps {
  insights: Insight[];
}

const TYPE_STYLES: Record<Insight['type'], { 
  icon: typeof Trophy; 
  bg: string; 
  border: string;
  iconColor: string;
}> = {
  achievement: { 
    icon: Trophy, 
    bg: 'bg-success/10', 
    border: 'border-success/30',
    iconColor: 'text-success',
  },
  warning: { 
    icon: AlertTriangle, 
    bg: 'bg-warning/10', 
    border: 'border-warning/30',
    iconColor: 'text-warning',
  },
  suggestion: { 
    icon: Lightbulb, 
    bg: 'bg-primary/10', 
    border: 'border-primary/30',
    iconColor: 'text-primary',
  },
  info: { 
    icon: Info, 
    bg: 'bg-muted', 
    border: 'border-muted',
    iconColor: 'text-muted-foreground',
  },
};

// Icon mapping for insights
const INSIGHT_ICONS: Record<string, typeof Trophy> = {
  trophy: Trophy,
  trending: TrendingUp,
  flame: Flame,
  target: Target,
  calendar: Calendar,
  star: Star,
  alert: AlertTriangle,
  lightbulb: Lightbulb,
  info: Info,
};

function Sparkline({ data }: { data: { rate: number }[] }) {
  return (
    <div className="w-28 h-12">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line 
            type="monotone" 
            dataKey="rate" 
            stroke="oklch(0.65 0.2 250)" 
            strokeWidth={2.5} 
            dot={false} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InsightsCards({ insights }: InsightsCardsProps) {
  const { habits, completions } = useHabitStore();

  const sparklineData = useMemo(() => {
    const activeHabits = habits.filter(h => !h.archived);
    if (activeHabits.length === 0) return Array(5).fill({ rate: 0 });

    return Array.from({ length: 5 }).map((_, i) => {
      const date = subDays(new Date(), 4 - i);
      const dateStr = formatDate(date, 'yyyy-MM-dd');

      const completedCount = completions.filter(c => 
        c.date === dateStr && 
        c.completed && 
        c.status !== 'frozen' &&
        activeHabits.some(h => h.id === c.habitId)
      ).length;

      const rate = Math.round((completedCount / activeHabits.length) * 100);
      return { rate };
    });
  }, [habits, completions]);

  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Lightbulb className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">
            Keep tracking your habits to unlock insights!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 dark:border-white/5 bg-card/50 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          Insights & Suggestions
        </CardTitle>
        <CardDescription>
          Personalized insights based on your habit data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Featured Top Insight */}
        {insights.length > 0 && (
          <StaggerContainer>
            <StaggerItem>
              <motion.div
                whileHover={{ scale: 1.005 }}
                className="relative p-5 rounded-2xl border border-indigo-500/30 dark:border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 shadow-[0_0_15px_-3px_rgba(99,102,241,0.15)] overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                <div className="flex-1 min-w-0 space-y-2 relative z-10">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider text-[9px] border-indigo-500/30">
                      Featured Insight
                    </Badge>
                    <span className="text-[11px] text-muted-foreground capitalize font-medium">• {insights[0].type}</span>
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight leading-snug">
                    {insights[0].title}
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground max-w-xl leading-relaxed">
                    {insights[0].description}
                  </p>
                  {insights[0].actionLabel && insights[0].actionHref && (
                    <Link 
                      href={insights[0].actionHref}
                      className="inline-flex items-center text-xs font-semibold mt-2 text-primary hover:underline hover:opacity-90"
                    >
                      {insights[0].actionLabel} &rarr;
                    </Link>
                  )}
                </div>

                <div className="flex flex-col items-center md:items-end shrink-0 gap-1.5 self-stretch md:self-auto justify-center p-3 rounded-xl bg-background/50 backdrop-blur border border-white/5">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                    5-Day Trend
                  </span>
                  <Sparkline data={sparklineData} />
                </div>
                
                {/* Visual Glow overlay */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              </motion.div>
            </StaggerItem>
          </StaggerContainer>
        )}

        {/* Remaining Insights Grid */}
        {insights.length > 1 && (
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {insights.slice(1).map((insight) => {
              const style = TYPE_STYLES[insight.type];
              const IconComponent = INSIGHT_ICONS[insight.icon] || style.icon;

              return (
                <StaggerItem key={insight.id}>
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className={cn(
                      "flex gap-3 p-4 rounded-xl border transition-all duration-200 h-full bg-card/30",
                      style.border
                    )}
                  >
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-background/40 border border-white/5",
                      style.iconColor
                    )}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground">{insight.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {insight.description}
                      </p>
                      {insight.actionLabel && insight.actionHref && (
                        <Link 
                          href={insight.actionHref}
                          className="inline-flex items-center text-xs font-semibold mt-2 text-primary hover:underline hover:opacity-90"
                        >
                          {insight.actionLabel} &rarr;
                        </Link>
                      )}
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={cn("flex-shrink-0 self-start capitalize text-[9px] px-1.5 py-0.5", style.bg)}
                    >
                      {insight.type}
                    </Badge>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </CardContent>
    </Card>
  );
}
