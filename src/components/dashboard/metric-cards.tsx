'use client';

import { motion } from 'framer-motion';
import { Flame, Target, TrendingUp, CheckCircle2, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressRing, CountUp, StaggerContainer, StaggerItem } from '@/components/motion';
import { cn } from '@/lib/utils';
import { getCompletionColor } from '@/lib/design-tokens';
import type { Trend } from '@/lib/types';

interface MetricCardsProps {
  todayCompleted: number;
  todayTotal: number;
  monthlyPercentage: number;
  monthlyTrend: Trend;
  currentStreak: number;
  bestStreak: number;
  activeGoals: number;
  upcomingDeadlines: number;
}

export function MetricCards({
  todayCompleted,
  todayTotal,
  monthlyPercentage,
  monthlyTrend,
  currentStreak,
  bestStreak,
  activeGoals,
  upcomingDeadlines,
}: MetricCardsProps) {
  const todayPercentage = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;
  const { color: monthlyColor } = getCompletionColor(monthlyPercentage);

  const getTrendIcon = (trend: Trend) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const isStreakMilestone = [7, 14, 21, 30, 60, 90, 100, 365].includes(currentStreak);

  return (
    <StaggerContainer className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {/* Today's Habits */}
      <StaggerItem>
        <Card className="relative overflow-hidden hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <CardContent className="p-6 relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Today's Habits
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tabular-nums">{todayCompleted}</span>
                  <span className="text-muted-foreground text-lg">/ {todayTotal}</span>
                </div>
              </div>
              <ProgressRing
                progress={todayPercentage}
                size={60}
                strokeWidth={6}
              >
                <span className="text-xs font-semibold">{todayPercentage}%</span>
              </ProgressRing>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Monthly Rate */}
      <StaggerItem>
        <Card className="relative overflow-hidden hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-chart-2/5 to-transparent" />
          <CardContent className="p-6 relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Monthly Rate
                </p>
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-3xl font-bold tabular-nums", monthlyColor)}>
                    <CountUp value={monthlyPercentage} suffix="%" />
                  </span>
                  {getTrendIcon(monthlyTrend)}
                </div>
              </div>
              <div className={cn(
                "flex items-center justify-center w-12 h-12 rounded-xl",
                monthlyPercentage >= 80 ? "bg-success/20" :
                  monthlyPercentage >= 60 ? "bg-chart-2/20" :
                    monthlyPercentage >= 40 ? "bg-warning/20" : "bg-destructive/20"
              )}>
                <CheckCircle2 className={cn(
                  "h-6 w-6",
                  monthlyPercentage >= 80 ? "text-success" :
                    monthlyPercentage >= 60 ? "text-chart-2" :
                      monthlyPercentage >= 40 ? "text-warning" : "text-destructive"
                )} />
              </div>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Current Streak */}
      <StaggerItem>
        <Card className={cn(
          "relative overflow-hidden hover-lift",
          isStreakMilestone && "ring-2 ring-warning/50"
        )}>
          <div className="absolute inset-0 bg-gradient-to-br from-warning/5 to-transparent" />
          {isStreakMilestone && (
            <motion.div
              className="absolute inset-0 bg-warning/10"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          <CardContent className="p-6 relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Current Streak
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums text-warning">
                    <CountUp value={currentStreak} />
                  </span>
                  <span className="text-muted-foreground text-sm">days</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Best: {bestStreak} days
                </p>
              </div>
              <motion.div
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-warning/20"
                animate={isStreakMilestone ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1, repeat: isStreakMilestone ? Infinity : 0 }}
              >
                <Flame className="h-6 w-6 text-warning" />
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Active Goals */}
      <StaggerItem>
        <Card className="relative overflow-hidden hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-chart-4/5 to-transparent" />
          <CardContent className="p-6 relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Active Goals
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">
                    <CountUp value={activeGoals} />
                  </span>
                </div>
                {upcomingDeadlines > 0 && (
                  <p className="text-xs text-warning mt-1">
                    {upcomingDeadlines} due soon
                  </p>
                )}
              </div>
              <div className={cn(
                "flex items-center justify-center w-12 h-12 rounded-xl",
                upcomingDeadlines > 0 ? "bg-warning/20" : "bg-chart-4/20"
              )}>
                <Target className={cn(
                  "h-6 w-6",
                  upcomingDeadlines > 0 ? "text-warning" : "text-chart-4"
                )} />
              </div>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>
    </StaggerContainer>
  );
}
