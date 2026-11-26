'use client';

import React from 'react';
import { format } from 'date-fns';
import { Calendar, Play, Sparkles, Star, StickyNote, Tag, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isAIEnabled } from '@/lib/ai-features-flag';
import type { Task } from '@/lib/types';
import { ActiveTaskTimerPill, type AIPriorityInfo } from './TaskCardParts';

function TaskTimeEstimateChip({ estimatedTime, actualTime, onPromptActual }: { estimatedTime?: number; actualTime?: number; onPromptActual: (e: React.MouseEvent) => void }) {
  if (estimatedTime === undefined || estimatedTime <= 0) return null;
  const hasActual = actualTime !== undefined && actualTime > 0;
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium bg-muted/40 px-2 py-0.5 rounded border border-border/50">
      <span>Est: {estimatedTime}m</span>
      {hasActual ? (
        <span className={cn('ml-1 font-bold', actualTime > estimatedTime ? 'text-rose-500' : 'text-emerald-500')}>Act: {actualTime}m</span>
      ) : (
        <button onClick={onPromptActual} className="ml-1 text-primary hover:underline hover:text-primary/80 font-bold">+ Act</button>
      )}
    </div>
  );
}

function TaskTimerActions(params: {
  task: Task;
  isCurrentTaskActive: boolean;
  onStart2m: (e: React.MouseEvent) => void;
  onStartFocus: (e: React.MouseEvent) => void;
}) {
  if (params.task.status === 'done') return null;
  if (params.isCurrentTaskActive) return <div className="flex items-center"><ActiveTaskTimerPill /></div>;
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={params.onStart2m}
        data-testid={`task-2m-start-${params.task.id}`}
        aria-label={`2m Start ${params.task.title}`}
        className="h-6 px-2 text-[10px] gap-1 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-md font-semibold"
      >
        <Zap className="h-3 w-3" />
        <span>2m Start</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={params.onStartFocus}
        className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5 rounded-md font-medium"
      >
        <Play className="h-3 w-3" />
        <span>Start Focus</span>
      </Button>
    </div>
  );
}

function TaskDueDateAndTags(params: {
  dueDate?: string | null;
  tags?: string[];
  compact?: boolean;
  isOverdue: boolean;
}) {
  return (
    <>
      {params.dueDate && (
        <div className={cn('flex items-center gap-1 text-[10px] text-muted-foreground font-medium', params.isOverdue && 'text-red-500 font-semibold')}>
          <Calendar className={cn(params.compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          <span>{format(new Date(params.dueDate), params.compact ? 'MMM d' : 'MMM d, h:mm a')}</span>
        </div>
      )}
      {params.tags && params.tags.length > 0 && !params.compact && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Tag className="h-3.5 w-3.5" />
          <span className="bg-muted px-1.5 py-0.5 rounded-md border border-border/50">
            {params.tags[0]}{params.tags.length > 1 && ` +${params.tags.length - 1}`}
          </span>
        </div>
      )}
    </>
  );
}

function TaskMitButton(params: {
  task: Task;
  isMit?: boolean;
  mitRank?: number | null;
  hasOnToggleMit: boolean;
  onToggleMit: (e: React.MouseEvent) => void;
}) {
  if (params.task.status === 'done') return null;
  if (!params.isMit && !params.hasOnToggleMit) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={params.onToggleMit}
      aria-label={params.isMit ? `Unpin MIT ${params.task.title}` : `Pin MIT ${params.task.title}`}
      className={cn('h-6 px-2 text-[10px] gap-1 rounded-md font-semibold', params.isMit ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-muted-foreground hover:text-primary hover:bg-primary/5')}
    >
      <Star className={cn('h-3 w-3', params.isMit && 'fill-current')} />
      <span>{params.isMit ? `MIT #${params.mitRank ?? ''}`.trim() : 'MIT'}</span>
    </Button>
  );
}

function TaskNotesToggleButton(params: {
  isNotesOpen: boolean;
  hasExistingNote: boolean;
  onToggleNotes: (e: React.MouseEvent) => void;
}) {
  const isHighlighted = params.isNotesOpen || params.hasExistingNote;
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={params.onToggleNotes}
      aria-expanded={params.isNotesOpen}
      aria-label={params.isNotesOpen ? 'Hide quick notes' : 'Quick notes'}
      className={cn('h-6 px-2 text-[10px] gap-1 rounded-md font-medium transition-colors', isHighlighted ? 'text-primary bg-primary/10 hover:bg-primary/15' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}
    >
      <StickyNote className="h-3 w-3" />
      <span>{params.hasExistingNote ? 'Notes' : 'Add Note'}</span>
    </Button>
  );
}

export function TaskCardMetaRow(params: {
  task: Task;
  compact?: boolean;
  isOverdue: boolean;
  aiPriority: AIPriorityInfo | null;
  loadingPriority: boolean;
  isCurrentTaskActive: boolean;
  isMit?: boolean;
  mitRank?: number | null;
  hasOnToggleMit: boolean;
  isNotesOpen: boolean;
  hasExistingNote: boolean;
  onPromptActualTime: (e: React.MouseEvent) => void;
  onGetAiPriority: () => void;
  onStart2m: (e: React.MouseEvent) => void;
  onStartFocus: (e: React.MouseEvent) => void;
  onToggleMit: (e: React.MouseEvent) => void;
  onToggleNotes: (e: React.MouseEvent) => void;
}) {
  const { task, compact } = params;
  const showAiBtn = isAIEnabled() && !params.aiPriority && !compact && task.status !== 'done';

  return (
    <div className={cn('flex flex-wrap items-center pt-0.5', compact ? 'gap-2' : 'gap-4')}>
      <TaskDueDateAndTags dueDate={task.due_date} tags={task.tags} compact={compact} isOverdue={params.isOverdue} />
      <TaskTimeEstimateChip estimatedTime={task.estimatedTime} actualTime={task.actualTime} onPromptActual={params.onPromptActualTime} />

      {showAiBtn && (
        <Button size="sm" variant="ghost" onClick={params.onGetAiPriority} disabled={params.loadingPriority} className="h-6 px-2 text-[10px] gap-1 text-invest hover:text-invest hover:bg-invest/10">
          <Sparkles className="h-3 w-3" />
          {params.loadingPriority ? 'Analyzing...' : 'AI Priority'}
        </Button>
      )}

      <TaskTimerActions task={task} isCurrentTaskActive={params.isCurrentTaskActive} onStart2m={params.onStart2m} onStartFocus={params.onStartFocus} />

      <TaskMitButton task={task} isMit={params.isMit} mitRank={params.mitRank} hasOnToggleMit={params.hasOnToggleMit} onToggleMit={params.onToggleMit} />
      <TaskNotesToggleButton isNotesOpen={params.isNotesOpen} hasExistingNote={params.hasExistingNote} onToggleNotes={params.onToggleNotes} />
    </div>
  );
}
