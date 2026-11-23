'use client';

import { useMemo, useState } from 'react';
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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EisenhowerMatrixProps {
  tasks: Task[];
  onComplete: (id: string) => void;
}

type QuadrantKey = 'doFirst' | 'schedule' | 'delegate' | 'dontDo';

const EXPLICIT_DONT_DO_TAG = 'matrix:dont-do';

function getEffectiveQuadrant(task: Task, todayEndIso: string): QuadrantKey {
  if (task.isUrgent && task.isImportant) return 'doFirst';
  if (!task.isUrgent && task.isImportant) return 'schedule';
  if (task.isUrgent && !task.isImportant) return 'delegate';

  // If the user explicitly dragged this task into Don't Do, respect that choice
  if (task.tags?.includes(EXPLICIT_DONT_DO_TAG)) {
    return 'dontDo';
  }

  // Smart default mapping: high-priority and/or overdue/due-today tasks never fall into Don't Do
  const isOverdueOrToday = Boolean(task.due_date && task.due_date <= todayEndIso);
  const isHighPriority = task.priority === 'high';

  if (isHighPriority && isOverdueOrToday) return 'doFirst';
  if (isHighPriority) return 'schedule';
  if (isOverdueOrToday) return 'delegate';
  return 'dontDo';
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

function SortableTaskWrapper({ task, onComplete }: { task: Task; onComplete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'Task', task }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={cn(isDragging && 'opacity-50')}>
      <TaskCard task={task} onComplete={onComplete} />
    </div>
  );
}

export function EisenhowerMatrix({ tasks, onComplete }: EisenhowerMatrixProps) {
  const { editTask } = useTaskStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const todayEndIso = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return `${today}T23:59:59`;
  }, []);

  const quadrants = useMemo(() => {
    const activeRootTasks = tasks.filter(
      (t) => !t.parentTaskId && t.status !== 'done' && t.status !== 'archived'
    );

    const grouped: Record<QuadrantKey, Task[]> = {
      doFirst: [],
      schedule: [],
      delegate: [],
      dontDo: [],
    };

    for (const task of activeRootTasks) {
      const q = getEffectiveQuadrant(task, todayEndIso);
      grouped[q].push(task);
    }

    return grouped;
  }, [tasks, todayEndIso]);

  const sensors = useSensors(
    useSensor(SmartPointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;

    let targetQuadrant: QuadrantKey;
    if (overId === 'doFirst' || overId === 'schedule' || overId === 'delegate' || overId === 'dontDo') {
      targetQuadrant = overId;
    } else {
      const overTask = tasks.find(t => t.id === overId);
      if (!overTask) return;
      targetQuadrant = getEffectiveQuadrant(overTask, todayEndIso);
    }

    const currentQuadrant = getEffectiveQuadrant(task, todayEndIso);
    if (targetQuadrant === currentQuadrant) return;

    const isUrgent = targetQuadrant === 'doFirst' || targetQuadrant === 'delegate';
    const isImportant = targetQuadrant === 'doFirst' || targetQuadrant === 'schedule';

    const existingTags = task.tags || [];
    const nextTags =
      targetQuadrant === 'dontDo'
        ? Array.from(new Set([...existingTags, EXPLICIT_DONT_DO_TAG]))
        : existingTags.filter((tag) => tag !== EXPLICIT_DONT_DO_TAG);

    try {
      await editTask(activeTaskId, { isUrgent, isImportant, tags: nextTags });
      toast.success('Task quadrant updated');
    } catch {
      toast.error('Failed to update quadrant');
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Do First (Urgent & Important) */}
        <DroppableQuadrant
          id="doFirst"
          title="Do First"
          subtitle="Urgent & Important"
          count={quadrants.doFirst.length}
          bgClass="bg-rose-500/5 dark:bg-rose-500/10"
          textClass="text-rose-600 dark:text-rose-400"
          borderClass="border-rose-500/20"
        >
          <SortableContext id="doFirst" items={quadrants.doFirst.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex-1 space-y-3">
              {quadrants.doFirst.map(t => <SortableTaskWrapper key={t.id} task={t} onComplete={onComplete} />)}
              {quadrants.doFirst.length === 0 && <p className="text-xs text-muted-foreground italic mt-2">No urgent &amp; important tasks</p>}
            </div>
          </SortableContext>
        </DroppableQuadrant>

        {/* Schedule (Not Urgent & Important) */}
        <DroppableQuadrant
          id="schedule"
          title="Schedule"
          subtitle="Important, Not Urgent"
          count={quadrants.schedule.length}
          bgClass="bg-emerald-500/5 dark:bg-emerald-500/10"
          textClass="text-emerald-600 dark:text-emerald-400"
          borderClass="border-emerald-500/20"
        >
          <SortableContext id="schedule" items={quadrants.schedule.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex-1 space-y-3">
              {quadrants.schedule.map(t => <SortableTaskWrapper key={t.id} task={t} onComplete={onComplete} />)}
              {quadrants.schedule.length === 0 && <p className="text-xs text-muted-foreground italic mt-2">No important tasks to schedule</p>}
            </div>
          </SortableContext>
        </DroppableQuadrant>

        {/* Delegate (Urgent & Not Important) */}
        <DroppableQuadrant
          id="delegate"
          title="Delegate"
          subtitle="Urgent, Not Important"
          count={quadrants.delegate.length}
          bgClass="bg-amber-500/5 dark:bg-amber-500/10"
          textClass="text-amber-600 dark:text-amber-400"
          borderClass="border-amber-500/20"
        >
          <SortableContext id="delegate" items={quadrants.delegate.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex-1 space-y-3">
              {quadrants.delegate.map(t => <SortableTaskWrapper key={t.id} task={t} onComplete={onComplete} />)}
              {quadrants.delegate.length === 0 && <p className="text-xs text-muted-foreground italic mt-2">No urgent tasks to delegate</p>}
            </div>
          </SortableContext>
        </DroppableQuadrant>

        {/* Don't Do (Not Urgent & Not Important) */}
        <DroppableQuadrant
          id="dontDo"
          title="Don't Do"
          subtitle="Not Urgent, Not Important"
          count={quadrants.dontDo.length}
          bgClass="bg-muted/30 dark:bg-muted/20"
          textClass="text-muted-foreground"
          borderClass="border-border/60"
        >
          <SortableContext id="dontDo" items={quadrants.dontDo.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex-1 space-y-3">
              {quadrants.dontDo.map(t => <SortableTaskWrapper key={t.id} task={t} onComplete={onComplete} />)}
              {quadrants.dontDo.length === 0 && <p className="text-xs text-muted-foreground italic mt-2">Clear of low-value tasks</p>}
            </div>
          </SortableContext>
        </DroppableQuadrant>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="opacity-90 rotate-2 shadow-xl scale-105 transition-transform">
            <TaskCard task={activeTask} onComplete={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
