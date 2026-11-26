'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useHabitStore } from '@/lib/stores/habit-store';
import type { Goal, GoalStats, Milestone } from '@/lib/types';
import { computeGoalHealthScore } from './goal-card-helpers';

const GoalRoadmapView = dynamic(
  () => import('../GoalRoadmapView').then((m) => ({ default: m.GoalRoadmapView })),
  { ssr: false }
);
const SMARTGoalAnalysis = dynamic(
  () => import('../SMARTGoalAnalysis').then((m) => ({ default: m.SMARTGoalAnalysis })),
  { ssr: false }
);

function GoalDetailsHealthBadge({ goal, stats }: { goal: Goal; stats: GoalStats }) {
  const { habits, completions } = useHabitStore(
    useShallow((s) => ({ habits: s.habits, completions: s.completions }))
  );

  const healthScore = useMemo(
    () => computeGoalHealthScore({ areaOfLife: goal.areaOfLife, habits, completions, stats }),
    [goal.areaOfLife, habits, completions, stats]
  );

  const colorClass = healthScore >= 80
    ? 'text-emerald-600 dark:text-emerald-400'
    : healthScore >= 50
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-rose-600 dark:text-rose-400';

  return <span className={cn('font-semibold', colorClass)}>Health {healthScore}/100</span>;
}

export function GoalRoadmapModal(params: {
  open: boolean;
  onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  goal: Goal;
  milestones: Milestone[];
  stats: GoalStats;
  deadlineLabel: string;
  unifiedStatus: { label: string; className: string };
  elapsedPercentage: number;
  onToggleMilestone: (milestoneId: string) => void;
}) {
  const { open, onOpenChange, goal, milestones, stats, deadlineLabel, unifiedStatus, elapsedPercentage, onToggleMilestone } = params;
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto bg-background border-border shadow-2xl p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-4 border-b border-border/60 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">{goal.title}</span>
            </DialogTitle>
            <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
              <GoalDetailsHealthBadge goal={goal} stats={stats} />
              <span className="text-muted-foreground">·</span>
              <span className={unifiedStatus.className}>{unifiedStatus.label}</span>
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-xs text-muted-foreground font-mono tabular-nums">
              <span>{format(new Date(goal.startDate), 'd MMM yyyy')}</span>
              <span>{deadlineLabel} · {format(new Date(goal.deadline), 'd MMM yyyy')}</span>
            </div>
            <div className="relative py-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 bg-muted-foreground/30" style={{ width: `${elapsedPercentage}%` }} />
                <div className="absolute inset-y-0 left-0 bg-primary transition-all" style={{ width: `${stats.progress}%` }} />
              </div>
              <div
                className="absolute top-1/2 w-1.5 h-3.5 bg-rose-500 rounded-full border border-background shadow-sm pointer-events-none"
                style={{ left: `${elapsedPercentage}%`, transform: 'translate(-50%, -50%)' }}
                title="Today"
              />
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          <div><GoalRoadmapView goal={goal} milestones={milestones} stats={stats} onToggleMilestone={onToggleMilestone} /></div>
          <div><SMARTGoalAnalysis goal={goal} /></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
