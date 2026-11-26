'use client';

import { motion } from 'framer-motion';
import { Flame, Target, TrendingUp, CheckCircle2, TrendingDown, Minus, ShieldCheck } from 'lucide-react';
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
  habitOnlyMode?: boolean;
  streakShields?: number;
}

function getTrendIcon(trend: Trend) {
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-success" />;
  if (trend === 'down') return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function getMonthlyTone(pct: number): { bg: string; text: string } {
  if (pct >= 80) return { bg: 'bg-success/20', text: 'text-success' };
  if (pct >= 60) return { bg: 'bg-chart-2/20', text: 'text-chart-2' };
  if (pct >= 40) return { bg: 'bg-warning/20', text: 'text-warning' };
  return { bg: 'bg-destructive/20', text: 'text-destructive' };
}

function TodayHabitsMetricCard({ todayCompleted, todayTotal }: { todayCompleted: number; todayTotal: number }) {
  const todayPercentage = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;
  const remainingText =
    todayTotal - todayCompleted === 0 && todayTotal > 0 ? 'All habits completed!' : `${todayTotal - todayCompleted} remaining today`;

  return (
    <Card className="relative overflow-hidden hover-lift h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Today&apos;s Habits</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums">{todayCompleted}</span>
              <span className="text-muted-foreground text-lg">/ {todayTotal}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{remainingText}</p>
          </div>
          <ProgressRing progress={todayPercentage} size={60} strokeWidth={6}>
            <span className="text-xs font-semibold">{todayPercentage}%</span>
          </ProgressRing>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyRateMetricCard({ monthlyPercentage, monthlyTrend }: { monthlyPercentage: number; monthlyTrend: Trend }) {
  const { color: monthlyColor } = getCompletionColor(monthlyPercentage);
  const tone = getMonthlyTone(monthlyPercentage);

  return (
    <Card className="relative overflow-hidden hover-lift h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-chart-2/5 to-transparent" />
      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Monthly Rate</p>
            <div className="flex items-baseline gap-2">
              <span className={cn('text-3xl font-bold tabular-nums', monthlyColor)}>
                <CountUp value={monthlyPercentage} suffix="%" />
              </span>
              {getTrendIcon(monthlyTrend)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Target: 80% completion</p>
          </div>
          <div className={cn('flex items-center justify-center w-12 h-12 rounded-xl', tone.bg)}>
            <CheckCircle2 className={cn('h-6 w-6', tone.text)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CurrentStreakMetricCard({ currentStreak, bestStreak }: { currentStreak: number; bestStreak: number }) {
  const isStreakMilestone = [7, 14, 21, 30, 60, 90, 100, 365].includes(currentStreak);

  return (
    <Card className={cn('relative overflow-hidden hover-lift h-full', isStreakMilestone && 'ring-2 ring-warning/50')}>
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
            <p className="text-sm font-medium text-muted-foreground mb-1">Current Streak</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums text-warning">
                <CountUp value={currentStreak} />
              </span>
              <span className="text-muted-foreground text-sm">days</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Best: {bestStreak} days</p>
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
  );
}

function GoalsOrShieldsMetricCard({
  habitOnlyMode,
  streakShields,
  activeGoals,
  upcomingDeadlines,
}: {
  habitOnlyMode: boolean;
  streakShields: number;
  activeGoals: number;
  upcomingDeadlines: number;
}) {
  if (habitOnlyMode) {
    return (
      <Card className="relative overflow-hidden hover-lift h-full">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
        <CardContent className="p-6 relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Streak Shields</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-blue-500">
                  <CountUp value={streakShields} />
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {streakShields > 0 ? `${streakShields} active shields` : 'No shields active'}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/20">
              <ShieldCheck className="h-6 w-6 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden hover-lift h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-chart-4/5 to-transparent" />
      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Active Goals</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">
                <CountUp value={activeGoals} />
              </span>
            </div>
            <p className={cn('text-xs mt-1', upcomingDeadlines > 0 ? 'text-warning' : 'text-muted-foreground')}>
              {upcomingDeadlines > 0 ? `${upcomingDeadlines} due soon` : 'No upcoming deadlines'}
            </p>
          </div>
          <div className={cn('flex items-center justify-center w-12 h-12 rounded-xl', upcomingDeadlines > 0 ? 'bg-warning/20' : 'bg-chart-4/20')}>
            <Target className={cn('h-6 w-6', upcomingDeadlines > 0 ? 'text-warning' : 'text-chart-4')} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
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
  habitOnlyMode = false,
  streakShields = 0,
}: MetricCardsProps) {
  return (
    <StaggerContainer className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      <StaggerItem className="h-full">
        <TodayHabitsMetricCard todayCompleted={todayCompleted} todayTotal={todayTotal} />
      </StaggerItem>
      <StaggerItem className="h-full">
        <MonthlyRateMetricCard monthlyPercentage={monthlyPercentage} monthlyTrend={monthlyTrend} />
      </StaggerItem>
      <StaggerItem className="h-full">
        <CurrentStreakMetricCard currentStreak={currentStreak} bestStreak={bestStreak} />
      </StaggerItem>
      <StaggerItem className="h-full">
        <GoalsOrShieldsMetricCard
          habitOnlyMode={habitOnlyMode}
          streakShields={streakShields}
          activeGoals={activeGoals}
          upcomingDeadlines={upcomingDeadlines}
        />
      </StaggerItem>
    </StaggerContainer>
  );
}

