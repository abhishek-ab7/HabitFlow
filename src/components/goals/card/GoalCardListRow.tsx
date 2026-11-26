'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronDown, ChevronUp, Flag, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Goal, GoalStats, Milestone } from '@/lib/types';
import { GoalMilestonesList } from './GoalCardActionsMenu';
import { GoalFinancialCompactBar, GoalFitnessCompactBar } from './GoalLinkProgressBars';
import type { FinancialProgressView } from './goal-card-helpers';

export function GoalCardListRow(params: {
  goal: Goal;
  milestones: Milestone[];
  stats: GoalStats;
  areaStyle: { text: string; label: string };
  priorityStyle: { color: string; label: string };
  unifiedStatus: { label: string; className: string };
  deadlineLabel: string;
  deadlineColorClass: string;
  financialProgress: FinancialProgressView | null;
  fitnessProgress: React.ComponentProps<typeof GoalFitnessCompactBar>['progress'] | null;
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenDetails: () => void;
  actionsMenu: React.ReactNode;
  rippleMilestone: string | null;
  onToggleMilestone: (milestoneId: string) => void;
  onAddMilestone: () => void;
}) {
  const { goal, milestones, stats, areaStyle, priorityStyle, unifiedStatus } = params;
  return (
    <Card className="rounded-2xl border border-border/80 bg-card shadow-none transition-colors hover:border-border">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 min-w-0">
              {goal.isFocus && <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" aria-label="Focus Goal" />}
              <h3 className="text-base font-semibold text-foreground truncate">{goal.title}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className={cn('font-medium', areaStyle.text)}>{areaStyle.label}</span>
              <span aria-hidden="true">·</span>
              <span className={cn('font-medium', unifiedStatus.className)}>{unifiedStatus.label}</span>
              <span aria-hidden="true">·</span>
              <span className={cn('inline-flex items-center gap-1', params.deadlineColorClass)}>
                <Calendar className="h-3 w-3" /> {params.deadlineLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span className={cn('inline-flex items-center gap-1', priorityStyle.color)}>
                <Flag className="h-3 w-3" /> {priorityStyle.label}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            <div className="w-36 sm:w-44 space-y-1">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-muted-foreground">{stats.milestonesCompleted}/{stats.milestonesTotal} milestones</span>
                <span className="font-semibold text-foreground">{stats.progress}%</span>
              </div>
              <Progress value={stats.progress} className="h-1.5" />
            </div>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={params.onOpenDetails} className="h-8 px-2.5 text-xs rounded-lg gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="hidden md:inline">Roadmap</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => params.setExpanded((prev) => !prev)}
                className="h-8 w-8 text-muted-foreground"
                aria-label={params.expanded ? 'Hide milestones' : 'Show milestones'}
              >
                {params.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              {params.actionsMenu}
            </div>
          </div>
        </div>

        {params.financialProgress && <GoalFinancialCompactBar progress={params.financialProgress} />}
        {params.fitnessProgress && <GoalFitnessCompactBar progress={params.fitnessProgress} />}

        <AnimatePresence>
          {params.expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <GoalMilestonesList
                milestones={milestones}
                idPrefix="list-"
                rippleMilestone={params.rippleMilestone}
                onToggleMilestone={params.onToggleMilestone}
                onAddMilestone={params.onAddMilestone}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
