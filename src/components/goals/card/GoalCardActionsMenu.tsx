'use client';

import React from 'react';
import { format } from 'date-fns';
import { Archive, CheckCircle2, MoreHorizontal, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SuccessRipple } from '@/components/motion';
import { cn } from '@/lib/utils';
import type { Goal, Milestone } from '@/lib/types';

export function GoalCardActionsMenu(params: {
  goal: Goal;
  onSetFocus: () => void;
  onEdit: () => void;
  onAddMilestone: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Goal actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        <DropdownMenuItem onClick={params.onSetFocus}>
          <Star className="h-4 w-4 mr-2" />
          {params.goal.isFocus ? 'Remove Focus' : 'Set as Focus'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={params.onEdit}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={params.onAddMilestone}><CheckCircle2 className="h-4 w-4 mr-2" /> Add Milestone</DropdownMenuItem>
        <DropdownMenuItem onClick={params.onArchive}><Archive className="h-4 w-4 mr-2" /> Archive</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={params.onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GoalMilestoneRow(params: {
  milestone: Milestone;
  idPrefix: string;
  isGhost: boolean;
  rippleMilestone: string | null;
  onToggleMilestone: (milestoneId: string) => void;
}) {
  const { milestone, idPrefix, isGhost, rippleMilestone, onToggleMilestone } = params;
  return (
    <div className={cn('relative flex items-center rounded-lg hover:bg-muted/50', isGhost ? 'gap-2.5 px-2 py-1.5' : 'gap-2 p-2')}>
      <Checkbox
        id={`${idPrefix}${milestone.id}`}
        checked={milestone.completed}
        onCheckedChange={() => onToggleMilestone(milestone.id)}
        onClick={(e) => e.stopPropagation()}
        className="data-[state=checked]:bg-success data-[state=checked]:border-success"
      />
      <label
        htmlFor={`${idPrefix}${milestone.id}`}
        onClick={(e) => e.stopPropagation()}
        className={cn('flex-1 cursor-pointer', isGhost ? 'text-sm' : 'text-xs sm:text-sm', milestone.completed && 'line-through text-muted-foreground')}
      >
        {milestone.title}
      </label>
      {milestone.completed && milestone.completedAt && (
        <span className={cn('text-muted-foreground font-mono', isGhost ? 'text-xs' : 'text-[11px]')}>
          {format(new Date(milestone.completedAt), 'd MMM')}
        </span>
      )}
      <SuccessRipple trigger={rippleMilestone === milestone.id && milestone.completed} />
    </div>
  );
}

export function GoalMilestonesList(params: {
  milestones: Milestone[];
  idPrefix: string;
  rippleMilestone: string | null;
  onToggleMilestone: (milestoneId: string) => void;
  onAddMilestone: (e: React.MouseEvent) => void;
  addButtonVariant?: 'ghost' | 'outline';
}) {
  const { milestones, idPrefix, rippleMilestone, onToggleMilestone, onAddMilestone, addButtonVariant = 'ghost' } = params;
  const isGhost = addButtonVariant === 'ghost';
  return (
    <div className={cn(isGhost ? 'pt-3 border-t border-border/60 space-y-1.5' : 'space-y-1.5 pt-2 border-t border-border/60')}>
      {milestones.map((milestone) => (
        <GoalMilestoneRow
          key={milestone.id}
          milestone={milestone}
          idPrefix={idPrefix}
          isGhost={isGhost}
          rippleMilestone={rippleMilestone}
          onToggleMilestone={onToggleMilestone}
        />
      ))}
      <Button
        variant={addButtonVariant}
        size="sm"
        onClick={onAddMilestone}
        className={cn(isGhost ? 'h-8 text-xs gap-1 text-muted-foreground hover:text-foreground' : 'w-full gap-1 mt-2 h-8 text-xs rounded-lg')}
      >
        <Plus className="h-3.5 w-3.5" /> Add Milestone
      </Button>
    </div>
  );
}
