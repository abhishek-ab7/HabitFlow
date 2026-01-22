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

function SingleGoalCard({ goal, milestones, stats, onToggleMilestone }: SingleGoalCardProps) {
  const deadlineInfo = getDeadlineStatus(goal.deadline);
  const progress = stats?.progress ?? 0;
  const nextMilestones = milestones
    .filter(m => !m.completed)
    .slice(0, 2);

  const getDeadlineColorClass = (color: typeof deadlineInfo.color) => {
    switch (color) {
      case 'destructive': return 'text-destructive';
      case 'warning': return 'text-warning';
      case 'success': return 'text-success';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg border bg-card p-3">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-chart-4/5" />

      <div className="relative flex flex-col md:flex-row gap-3">
        {/* Progress Ring */}
        <div className="flex-shrink-0 flex justify-center md:justify-start">
          <ProgressRing
            progress={progress}
            size={80}
            strokeWidth={6}
          >
            <div className="text-center">
              <span className="text-xl font-bold">
                <CountUp value={progress} />
              </span>
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </ProgressRing>
        </div>

        {/* Goal Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold mb-1 truncate">{goal.title}</h3>

          {/* Deadline */}
          <div className={cn(
            "flex items-center gap-1.5 mb-2",
            getDeadlineColorClass(deadlineInfo.color)
          )}>
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{deadlineInfo.label}</span>
          </div>

          {/* Milestones */}
          {nextMilestones.length > 0 && (
            <div className="space-y-1">
              {nextMilestones.map((milestone) => (
                <motion.div
                  key={milestone.id}
                  className="flex items-center gap-2 group"
                  whileHover={{ x: 2 }}
                >
                  <Checkbox
                    id={milestone.id}
                    checked={milestone.completed}
                    onCheckedChange={() => onToggleMilestone(milestone.id)}
                    className="data-[state=checked]:bg-success data-[state=checked]:border-success h-3.5 w-3.5"
                  />
                  <label
                    htmlFor={milestone.id}
                    className={cn(
                      "text-xs cursor-pointer transition-colors truncate",
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
          {stats && (
            <div className="flex items-center gap-3 mt-2 pt-2 border-t">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span className="text-xs">
                  {stats.milestonesCompleted}/{stats.milestonesTotal} milestones
                </span>
              </div>
              <Badge variant={stats.isOnTrack ? 'default' : 'destructive'} className="text-xs py-0 h-5">
                {stats.isOnTrack ? 'On Track' : 'Behind'}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FocusGoal({ goals, getMilestones, getStats, onToggleMilestone }: FocusGoalProps) {
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
      <Card className="h-full">
        <CardHeader>
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

        <CardContent className="space-y-3">
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
