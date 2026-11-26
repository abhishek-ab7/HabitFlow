'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { GripVertical } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable
} from '@dnd-kit/core';
import { SmartPointerSensor } from '@/lib/dnd-sensors';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/lib/types';
import { TaskCard } from './TaskCard';
import { useTaskStore } from '@/lib/stores/task-store';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { cn } from '@/lib/utils';
import { useFeedback } from '@/hooks/use-feedback';
import { toast } from 'sonner';

interface EisenhowerMatrixProps {
  tasks: Task[];
  onComplete: (id: string) => void;
}

type QuadrantKey = 'doFirst' | 'schedule' | 'delegate' | 'dontDo';

const EXPLICIT_DONT_DO_TAG = 'matrix:dont-do';

const QUADRANT_ID_SET = new Set<string>(['doFirst', 'schedule', 'delegate', 'dontDo']);

function getExplicitFlagQuadrant(isUrgent?: boolean, isImportant?: boolean): QuadrantKey | null {
  if (isUrgent && isImportant) return 'doFirst';
  if (!isUrgent && isImportant) return 'schedule';
  if (isUrgent && !isImportant) return 'delegate';
  return null;
}

function getDefaultQuadrant(isHighPriority: boolean, isOverdueOrToday: boolean): QuadrantKey {
  if (isHighPriority && isOverdueOrToday) return 'doFirst';
  if (isHighPriority) return 'schedule';
  return isOverdueOrToday ? 'delegate' : 'dontDo';
}

function getEffectiveQuadrant(task: Task, todayEndIso: string): QuadrantKey {
  const flagged = getExplicitFlagQuadrant(task.isUrgent, task.isImportant);
  if (flagged) return flagged;
  if (task.tags?.includes(EXPLICIT_DONT_DO_TAG)) return 'dontDo';

  const isOverdueOrToday = Boolean(task.due_date && task.due_date <= todayEndIso);
  return getDefaultQuadrant(task.priority === 'high', isOverdueOrToday);
}

function DroppableQuadrant({ id, title, subtitle, count, bgClass, textClass, borderClass, children }: {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  bgClass: string;
  textClass: string;
  borderClass: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-2xl p-4 flex flex-col min-h-[260px] border transition-colors",
        bgClass,
        borderClass,
        isOver && "brightness-95 dark:brightness-105 ring-2 ring-primary/30"
      )}
    >
      <div className={cn("font-bold mb-3 flex justify-between items-center gap-2 text-sm", textClass)}>
        <div className="flex items-center gap-2">
          <span>{title}</span>
          <span className="text-xs font-mono tabular-nums opacity-75">({count})</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider opacity-80">{subtitle}</span>
      </div>
      {children}
    </div>
  );
}

const SortableTaskWrapper = memo(function SortableTaskWrapper({
  task,
  subtasks,
  onComplete,
}: {
  task: Task;
  subtasks?: Task[];
  onComplete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn('relative group/drag', isDragging && 'opacity-50')}>
      <button
        type="button"
        aria-label="Reorder task across quadrants"
        {...attributes}
        {...listeners}
        className="touch-none absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-background/85 border border-border/60 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing opacity-80 sm:opacity-0 sm:group-hover/drag:opacity-100 transition-opacity"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <TaskCard task={task} subtasks={subtasks} onComplete={onComplete} disableSwipe />
    </div>
  );
});

interface QuadrantConfig {
  id: QuadrantKey;
  title: string;
  subtitle: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  emptyText: string;
}

const QUADRANT_CONFIGS: QuadrantConfig[] = [
  {
    id: 'doFirst',
    title: 'Do First',
    subtitle: 'Urgent & Important',
    bgClass: 'bg-rose-500/5 dark:bg-rose-500/10',
    textClass: 'text-rose-600 dark:text-rose-400',
    borderClass: 'border-rose-500/20',
    emptyText: 'No urgent & important tasks',
  },
  {
    id: 'schedule',
    title: 'Schedule',
    subtitle: 'Important, Not Urgent',
    bgClass: 'bg-emerald-500/5 dark:bg-emerald-500/10',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-500/20',
    emptyText: 'No important tasks to schedule',
  },
  {
    id: 'delegate',
    title: 'Delegate',
    subtitle: 'Urgent, Not Important',
    bgClass: 'bg-amber-500/5 dark:bg-amber-500/10',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-500/20',
    emptyText: 'No urgent tasks to delegate',
  },
  {
    id: 'dontDo',
    title: "Don't Do",
    subtitle: 'Not Urgent, Not Important',
    bgClass: 'bg-muted/30 dark:bg-muted/20',
    textClass: 'text-muted-foreground',
    borderClass: 'border-border/60',
    emptyText: 'Clear of low-value tasks',
  },
];

function isActiveRootTask(t: Task): boolean {
  if (t.status === 'archived' || t.status === 'done') return false;
  return !t.parentTaskId;
}

function buildSubtaskMap(tasks: Task[]): Map<string, Task[]> {
  const subMap = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.status === 'archived' || !t.parentTaskId) continue;
    const arr = subMap.get(t.parentTaskId);
    if (arr) arr.push(t);
    else subMap.set(t.parentTaskId, [t]);
  }
  return subMap;
}

function groupTasksIntoQuadrants(tasks: Task[], todayEndIso: string) {
  const subMap = buildSubtaskMap(tasks);
  const grouped: Record<QuadrantKey, Task[]> = {
    doFirst: [],
    schedule: [],
    delegate: [],
    dontDo: [],
  };

  for (const task of tasks) {
    if (!isActiveRootTask(task)) continue;
    grouped[getEffectiveQuadrant(task, todayEndIso)].push(task);
  }

  return {
    quadrants: grouped,
    quadrantIds: {
      doFirst: grouped.doFirst.map((t) => t.id),
      schedule: grouped.schedule.map((t) => t.id),
      delegate: grouped.delegate.map((t) => t.id),
      dontDo: grouped.dontDo.map((t) => t.id),
    },
    subtasksByParentId: subMap,
  };
}

function resolveTargetQuadrant(overId: string, tasks: Task[], todayEndIso: string): QuadrantKey | null {
  if (QUADRANT_ID_SET.has(overId)) return overId as QuadrantKey;
  const overTask = tasks.find((t) => t.id === overId);
  return overTask ? getEffectiveQuadrant(overTask, todayEndIso) : null;
}

function buildQuadrantUpdate(task: Task, targetQuadrant: QuadrantKey) {
  const isUrgent = targetQuadrant === 'doFirst' || targetQuadrant === 'delegate';
  const isImportant = targetQuadrant === 'doFirst' || targetQuadrant === 'schedule';
  const existingTags = task.tags || [];
  const tags =
    targetQuadrant === 'dontDo'
      ? Array.from(new Set([...existingTags, EXPLICIT_DONT_DO_TAG]))
      : existingTags.filter((tag) => tag !== EXPLICIT_DONT_DO_TAG);
  return { isUrgent, isImportant, tags };
}

function useEisenhowerDnd(
  tasks: Task[],
  todayEndIso: string,
  editTask: (id: string, data: Partial<Task>) => Promise<void>
) {
  const feedback = useFeedback();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(SmartPointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }, [tasks]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;

    const targetQuadrant = resolveTargetQuadrant(String(over.id), tasks, todayEndIso);
    if (!targetQuadrant || targetQuadrant === getEffectiveQuadrant(task, todayEndIso)) return;

    feedback.complete();
    try {
      await editTask(task.id, buildQuadrantUpdate(task, targetQuadrant));
      toast.success('Task quadrant updated');
    } catch {
      toast.error('Failed to update quadrant');
    }
  };

  return { activeTask, sensors, handleDragStart, handleDragEnd };
}

function QuadrantColumn({
  config,
  items,
  itemIds,
  subtasksByParentId,
  onComplete,
}: {
  config: QuadrantConfig;
  items: Task[];
  itemIds: string[];
  subtasksByParentId: Map<string, Task[]>;
  onComplete: (id: string) => void;
}) {
  return (
    <DroppableQuadrant
      id={config.id}
      title={config.title}
      subtitle={config.subtitle}
      count={items.length}
      bgClass={config.bgClass}
      textClass={config.textClass}
      borderClass={config.borderClass}
    >
      <SortableContext id={config.id} items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-3">
          {items.map((t) => (
            <SortableTaskWrapper key={t.id} task={t} subtasks={subtasksByParentId.get(t.id)} onComplete={onComplete} />
          ))}
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground italic mt-2">{config.emptyText}</p>
          )}
        </div>
      </SortableContext>
    </DroppableQuadrant>
  );
}

export function EisenhowerMatrix({ tasks, onComplete }: EisenhowerMatrixProps) {
  const editTask = useTaskStore((s) => s.editTask);
  const todayEndIso = useMemo(() => `${getLocalIsoDate()}T23:59:59`, []);
  const { quadrants, quadrantIds, subtasksByParentId } = useMemo(
    () => groupTasksIntoQuadrants(tasks, todayEndIso),
    [tasks, todayEndIso]
  );
  const { activeTask, sensors, handleDragStart, handleDragEnd } = useEisenhowerDnd(tasks, todayEndIso, editTask);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUADRANT_CONFIGS.map((q) => (
          <QuadrantColumn
            key={q.id}
            config={q}
            items={quadrants[q.id]}
            itemIds={quadrantIds[q.id]}
            subtasksByParentId={subtasksByParentId}
            onComplete={onComplete}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="opacity-90 rotate-2 shadow-xl scale-105 transition-transform">
            <TaskCard task={activeTask} subtasks={subtasksByParentId.get(activeTask.id)} disableSwipe />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
