'use client';

import React from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Task } from '@/lib/types';
import { SubtaskList } from '../SubtaskList';
import { AddSubtaskButton } from '../AddSubtaskButton';
import { TaskPriorityBadges, TaskSubtaskProgressBar, type AIPriorityInfo } from './TaskCardParts';
import { TaskCardMetaRow } from './TaskCardMetaRow';
import { TaskCardNotesSection } from './TaskCardNotesSection';
import type { useTaskCardController } from './useTaskCardController';

function TaskCheckCircleBtn({ isDone, compact, onComplete }: { isDone: boolean; compact?: boolean; onComplete: (e: React.MouseEvent) => void }) {
  const iconCls = compact ? 'h-2 w-2' : 'h-4 w-4';
  const circleCls = compact ? 'h-2.5 w-2.5' : 'h-4 w-4';
  const btnCls = compact ? 'mt-0.5 h-4 w-4' : 'mt-1 h-6 w-6';
  const stateCls = isDone ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 group-hover:border-primary';
  return (
    <button onClick={onComplete} className={cn('relative flex items-center justify-center rounded-full border-2 transition-colors duration-200', btnCls, stateCls)}>
      {isDone ? <CheckCircle2 className={cn('stroke-[3px]', iconCls)} /> : <Circle className={cn('text-primary opacity-0 group-hover:opacity-100 transition-opacity', circleCls)} />}
    </button>
  );
}

export function TaskCardCheckColumn(params: {
  isDone: boolean;
  compact?: boolean;
  hasSubtasks: boolean;
  isExpanded: boolean;
  onComplete: (e: React.MouseEvent) => void;
  onToggleExpand: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex flex-col items-center shrink-0">
      <TaskCheckCircleBtn isDone={params.isDone} compact={params.compact} onComplete={params.onComplete} />
      {params.hasSubtasks && !params.compact && (
        <button type="button" onClick={params.onToggleExpand} className="mt-2.5 p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors cursor-pointer" title={params.isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}>
          {params.isExpanded ? <ChevronDown className="h-4 w-4 text-emerald-500" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

function TaskCardTitleRow(params: {
  task: Task;
  isDone: boolean;
  compact?: boolean;
  aiPriority: AIPriorityInfo | null;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <h3 className={cn('font-semibold text-foreground tracking-tight transition-all truncate', params.compact ? 'text-sm' : 'text-base', params.isDone && 'line-through text-muted-foreground font-normal')}>
        {params.task.title}
      </h3>
      <div className="flex items-center gap-1.5 shrink-0">
        <TaskPriorityBadges priority={params.task.priority} aiPriority={params.aiPriority} compact={params.compact} />
        <Button type="button" size="icon" variant="ghost" onClick={params.onEdit} title="Edit task" className="h-6 w-6 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-40 md:opacity-0 md:group-hover:opacity-60 md:hover:!opacity-100 transition-all duration-200 cursor-pointer">
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={params.onDelete} title="Delete task" className="h-6 w-6 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-40 md:opacity-0 md:group-hover:opacity-60 md:hover:!opacity-100 transition-all duration-200 cursor-pointer">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function TaskCardSubtasksDrawer(params: {
  task: Task;
  vm: ReturnType<typeof useTaskCardController>;
  compact?: boolean;
}) {
  const { task, vm, compact } = params;
  if (compact || !vm.isExpanded) return null;
  if (vm.subtasks.length === 0) return null;
  return (
    <div className="mt-4 pt-4 border-t border-border/40 relative z-10" onClick={(e) => e.stopPropagation()}>
      <SubtaskList
        tasks={vm.subtasks}
        parentId={task.id}
        allTasks={vm.subtasks}
        onToggle={vm.handleToggleSubtask}
        onDelete={vm.handleDeleteSubtask}
        expandedTasks={vm.expandedSubtasks}
        onToggleExpand={vm.toggleExpandSubtask}
      />
      <AddSubtaskButton parentTask={task} onAdd={vm.handleAddSubtask} />
    </div>
  );
}

export function TaskCardBody(params: {
  task: Task;
  vm: ReturnType<typeof useTaskCardController>;
  isDone: boolean;
  compact?: boolean;
  isMit?: boolean;
  mitRank?: number | null;
  onToggleMit?: (task: Task) => void;
}) {
  const { task, vm, isDone, compact } = params;
  return (
    <div className={cn('flex-1 min-w-0', compact ? 'space-y-1' : 'space-y-3')}>
      <TaskCardTitleRow
        task={task}
        isDone={isDone}
        compact={compact}
        aiPriority={vm.aiPriority}
        onEdit={(e) => { e.stopPropagation(); vm.setActiveEditTask(task); }}
        onDelete={vm.handleDeleteTask}
      />
      {task.description && !compact && <p className="text-sm text-muted-foreground/80 line-clamp-2 leading-relaxed">{task.description}</p>}
      <TaskCardMetaRow
        task={task}
        compact={compact}
        isOverdue={vm.isOverdue}
        aiPriority={vm.aiPriority}
        loadingPriority={vm.loadingPriority}
        isCurrentTaskActive={vm.isCurrentTaskActive}
        isMit={params.isMit}
        mitRank={params.mitRank}
        hasOnToggleMit={Boolean(params.onToggleMit)}
        isNotesOpen={vm.isNotesOpen}
        hasExistingNote={Boolean(vm.normalizedExistingNote)}
        onPromptActualTime={vm.handlePromptActualTime}
        onGetAiPriority={vm.getAIPriority}
        onStart2m={vm.handleStart2m}
        onStartFocus={(e) => { e.stopPropagation(); vm.startTimer(task.id, task.title); }}
        onToggleMit={(e) => { e.stopPropagation(); params.onToggleMit?.(task); }}
        onToggleNotes={(e) => { e.stopPropagation(); vm.setIsNotesOpen((prev) => !prev); }}
      />
      <TaskCardNotesSection
        taskTitle={task.title}
        compact={compact}
        isNotesOpen={vm.isNotesOpen}
        setIsNotesOpen={vm.setIsNotesOpen}
        noteDraft={vm.noteDraft}
        setNoteDraft={vm.setNoteDraft}
        normalizedExistingNote={vm.normalizedExistingNote}
        hasUnsavedNote={vm.hasUnsavedNote}
        isSavingNote={vm.isSavingNote}
        justSavedNote={vm.justSavedNote}
        onSaveNote={vm.handleSaveNote}
        onResetDraft={() => { vm.setNoteDraft(task.notes ?? ''); vm.setIsNotesOpen(false); }}
      />
      {vm.subtasks.length > 0 && !compact && <TaskSubtaskProgressBar completed={vm.completedSubtasks} total={vm.subtasks.length} />}
    </div>
  );
}
