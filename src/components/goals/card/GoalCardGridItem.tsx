'use client';

import React from 'react';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronDown, ChevronUp, Flag, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScaleOnHover } from '@/components/motion';
import { cn } from '@/lib/utils';
import type { Goal, GoalStats, Milestone } from '@/lib/types';
import { GoalMilestonesList } from './GoalCardActionsMenu';
import { GoalFinancialCardSection, GoalFitnessCardSection } from './GoalLinkProgressBars';
import type { FinancialProgressView } from './goal-card-helpers';

export function GoalCardGridItem(params: {
  goal: Goal;
  milestones: Milestone[];
  nextMilestone?: Milestone;
  stats: GoalStats;
  areaStyle: { text: string; label: string };
  priorityStyle: { color: string; label: string };
  unifiedStatus: { label: string; className: string };
  deadlineLabel: string;
  deadlineColorClass: string;
  financialProgress: FinancialProgressView | null;
  fitnessProgress: React.ComponentProps<typeof GoalFitnessCardSection>['progress'] | null;
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenDetails: () => void;
  actionsMenu: React.ReactNode;
  rippleMilestone: string | null;
  onToggleMilestone: (milestoneId: string) => void;
  onAddMilestone: () => void;
}) {
  const { goal, milestones, nextMilestone, stats, areaStyle, priorityStyle, unifiedStatus } = params;
  return (
    <ScaleOnHover scale={1.01} lift className="h-full min-w-0 w-full">
      <Card className="relative w-full min-w-0 overflow-hidden transition-all h-full flex flex-col rounded-2xl border border-border/80 bg-card shadow-none hover:border-border hover:shadow-sm">
        <CardHeader className="pb-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs min-w-0 truncate">
              <span className={cn('font-semibold', areaStyle.text)}>{areaStyle.label}</span>
              <span className="text-muted-foreground" aria-hidden="true">·</span>
              <span className={cn('font-medium truncate', unifiedStatus.className)}>{unifiedStatus.label}</span>
            </div>
            {params.actionsMenu}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 min-w-0">
              {goal.isFocus && <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" aria-label="Focus Goal" />}
              <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">{goal.title}</h3>
            </div>
            {goal.description && <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">{goal.description}</p>}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 flex-1 flex flex-col justify-between pt-0">
          <div className="space-y-4">
            {params.financialProgress && <GoalFinancialCardSection progress={params.financialProgress} />}
            {params.fitnessProgress && <GoalFitnessCardSection progress={params.fitnessProgress} />}

            <div className="space-y-2">
              <div className="flex items-baseline justify-between text-xs font-mono tabular-nums">
                <span className="text-muted-foreground">{stats.milestonesCompleted}/{stats.milestonesTotal} milestones</span>
                <span className="text-sm font-bold text-foreground">{stats.progress}%</span>
              </div>
              <Progress value={stats.progress} className="h-2" />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <span className={cn('inline-flex items-center gap-1.5 font-medium', params.deadlineColorClass)}>
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{params.deadlineLabel}</span>
                  <span className="text-muted-foreground font-normal">({format(new Date(goal.deadline), 'd MMM')})</span>
                </span>
                <span className={cn('inline-flex items-center gap-1 font-medium', priorityStyle.color)}>
                  <Flag className="h-3 w-3" /> {priorityStyle.label}
                </span>
              </div>
            </div>

            {nextMilestone && !params.expanded && (
              <div
                onClick={(e) => { e.stopPropagation(); params.onToggleMilestone(nextMilestone.id); }}
                className="flex items-center gap-2.5 min-w-0 px-3 py-2.5 bg-muted/40 border border-border/50 rounded-xl cursor-pointer hover:bg-muted/70 transition-colors"
              >
                <Checkbox checked={false} onCheckedChange={() => params.onToggleMilestone(nextMilestone.id)} onClick={(e) => e.stopPropagation()} className="shrink-0" />
                <span className="text-xs sm:text-sm min-w-0 flex-1 truncate text-foreground">{nextMilestone.title}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">Next</span>
              </div>
            )}

            <AnimatePresence>
              {params.expanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <GoalMilestonesList
                    milestones={milestones}
                    idPrefix=""
                    rippleMilestone={params.rippleMilestone}
                    onToggleMilestone={params.onToggleMilestone}
                    onAddMilestone={(e) => { e.stopPropagation(); params.onAddMilestone(); }}
                    addButtonVariant="outline"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); params.setExpanded((prev) => !prev); }}
              className="flex-1 h-9 text-xs gap-1 rounded-xl text-muted-foreground hover:text-foreground"
            >
              {params.expanded ? <><ChevronUp className="h-3.5 w-3.5" /> Hide</> : <><ChevronDown className="h-3.5 w-3.5" /> Milestones ({milestones.length})</>}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); params.onOpenDetails(); }}
              className="flex-1 h-9 text-xs gap-1.5 rounded-xl border-border/80 hover:bg-muted/50 font-medium"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Roadmap
            </Button>
          </div>
        </CardContent>
      </Card>
    </ScaleOnHover>
  );
}
