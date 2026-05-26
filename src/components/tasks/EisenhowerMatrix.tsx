'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable
} from '@dnd-kit/core';
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

function DroppableQuadrant({ id, title, subtitle, bgClass, textClass, borderClass, children }: {
  id: string;
  title: string;
  subtitle: string;
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
        "rounded-xl p-4 flex flex-col min-h-[300px] border transition-colors",
        bgClass,
        borderClass,
        isOver && "brightness-95 dark:brightness-105 scale-[1.01]"
      )}
    >
      <h3 className={cn("font-bold mb-4 flex justify-between items-center text-sm", textClass)}>
        <span>{title}</span>
        <span className="text-[10px] uppercase tracking-widest opacity-80">{subtitle}</span>
      </h3>
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

  const quadrants = useMemo(() => {
    return {
      doFirst: tasks.filter(t => t.isUrgent && t.isImportant && t.status !== 'done'), // Urgent & Important
      schedule: tasks.filter(t => !t.isUrgent && t.isImportant && t.status !== 'done'), // Not Urgent & Important
      delegate: tasks.filter(t => t.isUrgent && !t.isImportant && t.status !== 'done'), // Urgent & Not Important
      dontDo: tasks.filter(t => !t.isUrgent && !t.isImportant && t.status !== 'done'), // Not Urgent & Not Important
    };
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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
    const overQuadrantId = over.id as string;

    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;

    let isUrgent = task.isUrgent;
    let isImportant = task.isImportant;

    if (overQuadrantId === 'doFirst') {
      isUrgent = true;
      isImportant = true;
    } else if (overQuadrantId === 'schedule') {
      isUrgent = false;
      isImportant = true;
    } else if (overQuadrantId === 'delegate') {
      isUrgent = true;
      isImportant = false;
    } else if (overQuadrantId === 'dontDo') {
      isUrgent = false;
      isImportant = false;
    } else {
      // dropped over a task, find that task's quadrant
      const overTask = tasks.find(t => t.id === overQuadrantId);
      if (overTask) {
        isUrgent = overTask.isUrgent;
        isImportant = overTask.isImportant;
      }
    }

    if (isUrgent !== task.isUrgent || isImportant !== task.isImportant) {
      try {
        await editTask(activeTaskId, { isUrgent, isImportant });
        toast.success('Task quadrant updated');
      } catch (e) {
        toast.error('Failed to update quadrant');
      }
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
        {/* Do First (Urgent & Important) */}
        <DroppableQuadrant 
          id="doFirst" 
          title="Do First" 
          subtitle="Urgent & Important" 
          bgClass="bg-rose-500/5 dark:bg-rose-500/10" 
          textClass="text-rose-500" 
          borderClass="border-rose-500/20"
        >
          <SortableContext id="doFirst" items={quadrants.doFirst.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {quadrants.doFirst.map(t => <SortableTaskWrapper key={t.id} task={t} onComplete={onComplete} />)}
              {quadrants.doFirst.length === 0 && <p className="text-xs text-muted-foreground italic mt-2">No urgent & important tasks</p>}
            </div>
          </SortableContext>
        </DroppableQuadrant>

        {/* Schedule (Not Urgent & Important) */}
        <DroppableQuadrant 
          id="schedule" 
          title="Schedule" 
          subtitle="Important, Not Urgent" 
          bgClass="bg-emerald-500/5 dark:bg-emerald-500/10" 
          textClass="text-emerald-500" 
          borderClass="border-emerald-500/20"
        >
          <SortableContext id="schedule" items={quadrants.schedule.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
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
          bgClass="bg-amber-500/5 dark:bg-amber-500/10" 
          textClass="text-amber-500" 
          borderClass="border-amber-500/20"
        >
          <SortableContext id="delegate" items={quadrants.delegate.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
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
          bgClass="bg-muted/20" 
          textClass="text-muted-foreground" 
          borderClass="border-border/40"
        >
          <SortableContext id="dontDo" items={quadrants.dontDo.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
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
