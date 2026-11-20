'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Target, ArrowRight, Calendar, CheckCircle2, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ProgressRing, FadeIn, CountUp } from '@/components/motion';
import { cn } from '@/lib/utils';
import { getDeadlineStatus } from '@/lib/calculations';
import { formatINR } from '@/lib/stores/finance-store';
import type { Goal, Milestone, GoalStats } from '@/lib/types';

interface FocusGoalProps {
  goals: Goal[];
  getMilestones: (goalId: string) => Milestone[];
  getStats: (goalId: string) => GoalStats;
  onToggleMilestone: (milestoneId: string) => void;
}

interface SingleGoalCardProps {
  goal: Goal;
  milestones: Milestone[];
  stats: GoalStats;
  onToggleMilestone: (milestoneId: string) => void;
}

function SingleGoalCard({
  goal,
  milestones,
  stats,
  onToggleMilestone,
}: SingleGoalCardProps) {
  const deadlineInfo = getDeadlineStatus(goal.deadline);
  const progress = stats?.progress ?? 0;
  const nextMilestones = milestones.filter((m) => !m.completed).slice(0, 2);
  const isFinancialGoal =
    Boolean(goal.financialLink) &&
    typeof stats?.targetFinancialAmount === 'number' &&
    stats.targetFinancialAmount > 0;

  const getDeadlineColorClass = (color: typeof deadlineInfo.color) => {
    switch (color) {
      case 'destructive':
        return 'text-rose-600 dark:text-rose-400';
      case 'warning':
        return 'text-amber-600 dark:text-amber-400';
      case 'success':
        return 'text-emerald-600 dark:text-emerald-400';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-4 h-full">
        {/* Progress Ring */}
        <div className="shrink-0 flex justify-center sm:justify-start items-center">
          <ProgressRing progress={progress} size={92} strokeWidth={8}>
            <div className="text-center font-mono tabular-nums">
              <span className="text-xl font-bold">
                <CountUp value={progress} />
              </span>
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </ProgressRing>
        </div>

        {/* Goal Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-foreground truncate">
                {goal.title}
              </h3>
              {isFinancialGoal && (
                <span className="text-[11px] font-semibold text-primary inline-flex items-center gap-1 shrink-0">
                  <Wallet className="w-3 h-3" />
                  Live Finance
                </span>
              )}
            </div>

            {/* Unboxed Deadline & Status Line */}
            <div className="flex flex-wrap items-center gap-2 text-xs mt-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1 font-medium',
                  getDeadlineColorClass(deadlineInfo.color)
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                {deadlineInfo.label}
              </span>
              {stats && (
                <>
                  <span className="text-muted-foreground" aria-hidden="true">
                    ·
                  </span>
                  <span
                    className={cn(
                      'font-semibold',
                      stats.isOnTrack
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    )}
                  >
                    {stats.isOnTrack ? 'On Track' : 'Behind Pace'}
                  </span>
                </>
              )}
            </div>

            {/* Live Financial Progress Bar */}
            {isFinancialGoal && (
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="font-bold text-foreground">
                    {formatINR(stats.currentFinancialAmount || 0)}
                  </span>
                  <span className="text-muted-foreground">
                    Target {formatINR(stats.targetFinancialAmount || 0)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, progress)}%` }}
                    className="h-full bg-emerald-500 rounded-full transition-all"
                  />
                </div>
              </div>
            )}

            {/* Milestones */}
            {nextMilestones.length > 0 && (
              <div className="space-y-2 mt-3">
                {nextMilestones.map((milestone) => (
                  <motion.div
                    key={milestone.id}
                    className="flex items-center gap-2"
                    whileHover={{ x: 2 }}
                  >
                    <Checkbox
                      id={milestone.id}
                      checked={milestone.completed}
                      onCheckedChange={() => onToggleMilestone(milestone.id)}
                      className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 h-4 w-4"
                    />
                    <label
                      htmlFor={milestone.id}
                      className={cn(
                        'text-xs sm:text-sm cursor-pointer transition-colors truncate',
                        milestone.completed && 'line-through text-muted-foreground'
                      )}
                    >
                      {milestone.title}
                    </label>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Meta */}
          {stats && !isFinancialGoal && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/60 font-mono tabular-nums">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>
                {stats.milestonesCompleted}/{stats.milestonesTotal} milestones complete
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FocusGoal({
  goals,
  getMilestones,
  getStats,
  onToggleMilestone,
}: FocusGoalProps) {
  if (goals.length === 0) {
    return (
      <FadeIn delay={0.15} className="tour-goals-widget h-full">
        <Card className="h-full rounded-2xl border border-border bg-card shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Focus Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Target className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground max-w-xs">
              Pin a life goal or link a live savings / debt-free financial goal to keep your top priority visible.
            </p>
            <Button size="sm" asChild className="rounded-xl">
              <Link href="/goals">Set Focus Goal</Link>
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
    );
  }

  return (
    <FadeIn delay={0.15} className="h-full flex flex-col tour-goals-widget">
      <Card className="h-full flex flex-col rounded-2xl border border-border bg-card shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Focus Goal{goals.length > 1 ? 's' : ''}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
              <Link href="/goals" className="gap-1">
                All Goals
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 flex-1">
          {goals.map((goal) => (
            <SingleGoalCard
              key={goal.id}
              goal={goal}
              milestones={getMilestones(goal.id)}
              stats={getStats(goal.id)}
              onToggleMilestone={onToggleMilestone}
            />
          ))}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
