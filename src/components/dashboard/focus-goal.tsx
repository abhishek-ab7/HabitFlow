'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Target, ArrowRight, Calendar, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ProgressRing, FadeIn, CountUp } from '@/components/motion';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/design-tokens';
import { getDeadlineStatus } from '@/lib/calculations';
import type { Goal, Milestone, GoalStats } from '@/lib/types';

interface FocusGoalProps {
  goals: Goal[];
  getStats: (goalId: string) => GoalStats;
  getMilestones: (goalId: string) => Milestone[];
  onToggleMilestone: (milestoneId: string) => void;
}

export function FocusGoal({ goals, getStats, getMilestones, onToggleMilestone }: FocusGoalProps) {
  if (goals.length === 0) {
    return (
      <FadeIn delay={0.3}>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Focus Goal
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-center mb-4">
              Set a focus goal to keep your top priority visible
            </p>
            <Button asChild>
              <Link href="/goals">Set Focus Goal</Link>
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
    );
  }

  return (
    <FadeIn delay={0.3}>
      <Card className="h-full relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-chart-4/5" />

        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Focus Goal{goals.length > 1 ? 's' : ''}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/goals" className="gap-1">
                All Goals
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className={cn(
          "relative",
          goals.length > 1 ? "grid grid-cols-1 md:grid-cols-2 gap-4" : ""
        )}>
          {goals.map((goal, index) => (
            <SingleFocusGoal
              key={goal.id}
              goal={goal}
              stats={getStats(goal.id)}
              milestones={getMilestones(goal.id)}
              onToggleMilestone={onToggleMilestone}
              compact={goals.length > 1}
              index={index}
            />
          ))}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

interface SingleFocusGoalProps {
  goal: Goal;
  stats: GoalStats;
  milestones: Milestone[];
  onToggleMilestone: (id: string) => void;
  compact?: boolean;
  index: number;
}

function SingleFocusGoal({ goal, stats, milestones, onToggleMilestone, compact, index }: SingleFocusGoalProps) {
  const deadlineInfo = getDeadlineStatus(goal.deadline);
  const progress = stats?.progress ?? 0;
  // If compact, maybe show fewer milestones or smaller ring
  const maxMilestones = compact ? 1 : 2;
  const nextMilestones = milestones
    .filter(m => !m.completed)
    .slice(0, maxMilestones);

  const getDeadlineColorClass = (color: typeof deadlineInfo.color) => {
    switch (color) {
      case 'destructive': return 'text-destructive';
      case 'warning': return 'text-warning';
      case 'success': return 'text-success';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className={cn(
      "flex flex-col gap-4",
      compact && index === 0 && "md:border-r md:pr-4",
      !compact && "md:flex-row gap-6"
    )}>
      {/* Progress Ring */}
      <div className={cn("flex-shrink-0 flex justify-center", compact ? "scale-90" : "")}>
        <ProgressRing
          progress={progress}
          size={compact ? 100 : 140}
          strokeWidth={compact ? 8 : 10}
        >
          <div className="text-center">
            <span className={cn("font-bold", compact ? "text-2xl" : "text-3xl")}>
              <CountUp value={progress} />
            </span>
            <span className={cn("text-muted-foreground", compact ? "text-base" : "text-lg")}>%</span>
          </div>
        </ProgressRing>
      </div>

      {/* Goal Info */}
      <div className="flex-1 min-w-0">
        <h3 className={cn("font-semibold mb-2 truncate", compact ? "text-base" : "text-xl")}>
          {goal.title}
        </h3>

        {/* Deadline */}
        <div className={cn(
          "flex items-center gap-2 mb-4",
          getDeadlineColorClass(deadlineInfo.color)
        )}>
          <Calendar className="h-4 w-4" />
          <span className="text-sm font-medium">{deadlineInfo.label}</span>
        </div>

        {/* Milestones */}
        {nextMilestones.length > 0 && (
          <div className="space-y-2">
            {!compact && (
              <p className="text-sm font-medium text-muted-foreground">
                Next Milestones
              </p>
            )}
            {nextMilestones.map((milestone) => (
              <motion.div
                key={milestone.id}
                className="flex items-center gap-2 group"
                whileHover={{ x: 2 }}
              >
                <Checkbox
                  id={`focus-${milestone.id}`} // Unique ID
                  checked={milestone.completed}
                  onCheckedChange={() => onToggleMilestone(milestone.id)}
                  className="h-4 w-4 data-[state=checked]:bg-success data-[state=checked]:border-success"
                />
                <label
                  htmlFor={`focus-${milestone.id}`}
                  className={cn(
                    "text-sm cursor-pointer transition-colors truncate",
                    milestone.completed && "line-through text-muted-foreground"
                  )}
                >
                  {milestone.title}
                </label>
              </motion.div>
            ))}
          </div>
        )}

        {/* Stats */}
        {stats && !compact && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-sm">
                {stats.milestonesCompleted}/{stats.milestonesTotal} milestones
              </span>
            </div>
            <Badge variant={stats.isOnTrack ? 'default' : 'destructive'}>
              {stats.isOnTrack ? 'On Track' : 'Behind'}
            </Badge>
          </div>
        )}
        {/* Compact Stats */}
        {stats && compact && (
          <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t">
            <Badge variant={stats.isOnTrack ? 'default' : 'destructive'} className="text-xs px-1.5 h-5">
              {stats.isOnTrack ? 'On Track' : 'Behind'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {stats.milestonesCompleted}/{stats.milestonesTotal} steps
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
