'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Task } from '@/lib/types';
import { EditTaskModal } from './EditTaskModal';
import { TaskCardSwipeBackdrop } from './card/TaskCardParts';
import { TaskCardBody, TaskCardCheckColumn, TaskCardSubtasksDrawer } from './card/TaskCardSections';
import { useTaskCardController } from './card/useTaskCardController';

interface TaskCardProps {
  task: Task;
  onComplete?: (id: string) => void;
  onUpdate?: (task: Task) => void;
  isOverlay?: boolean;
  compact?: boolean;
  isMit?: boolean;
  mitRank?: number | null;
  onToggleMit?: (task: Task) => void;
  subtasks?: Task[];
  disableSwipe?: boolean;
}

function TaskCardSurface(params: {
  task: Task;
  vm: ReturnType<typeof useTaskCardController>;
  isDone: boolean;
  compact?: boolean;
  isMit?: boolean;
  mitRank?: number | null;
  onComplete?: (id: string) => void;
  onToggleMit?: (task: Task) => void;
  disableSwipe?: boolean;
}) {
  const { task, vm, isDone, compact } = params;
  return (
    <motion.div
      drag={params.disableSwipe ? false : 'x'}
      dragDirectionLock
      dragConstraints={{ left: -100, right: 100 }}
      dragElastic={{ left: 0.6, right: 0.6 }}
      style={{ x: vm.x }}
      onDragEnd={vm.handleDragEnd}
      className={cn(
        'group relative rounded-2xl border transition-transform transition-colors duration-200 hover:-translate-y-0.5 hover:shadow-md bg-card border-border shadow-xs hover:border-primary/35',
        compact ? 'p-3' : 'p-5',
        isDone && 'opacity-60 grayscale-[0.3]'
      )}
    >
      <div className={cn('flex items-start', compact ? 'gap-2.5' : 'gap-4')}>
        <TaskCardCheckColumn
          isDone={isDone}
          compact={compact}
          hasSubtasks={vm.subtasks.length > 0}
          isExpanded={vm.isExpanded}
          onComplete={(e) => { e.stopPropagation(); params.onComplete?.(task.id); }}
          onToggleExpand={(e) => { e.stopPropagation(); vm.setIsExpanded((p) => !p); }}
        />
        <TaskCardBody task={task} vm={vm} isDone={isDone} compact={compact} isMit={params.isMit} mitRank={params.mitRank} onToggleMit={params.onToggleMit} />
      </div>

      <TaskCardSubtasksDrawer task={task} vm={vm} compact={compact} />

      <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/10 via-white/5 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-700" />
      {task.priority === 'high' && !task.status && <div className="absolute -z-10 -inset-1 blur-2xl opacity-10 bg-red-500 rounded-2xl" />}
    </motion.div>
  );
}

export const TaskCard = memo(function TaskCard({
  task, onComplete, onUpdate, compact, isMit, mitRank, onToggleMit, subtasks: subtasksProp, disableSwipe,
}: TaskCardProps) {
  const vm = useTaskCardController({ task, subtasksProp, onComplete, onUpdate });

  return (
    <div className="relative overflow-hidden rounded-2xl w-full">
      <TaskCardSwipeBackdrop checkOpacity={vm.checkOpacity} checkScale={vm.checkScale} trashOpacity={vm.trashOpacity} trashScale={vm.trashScale} />
      <TaskCardSurface task={task} vm={vm} isDone={task.status === 'done'} compact={compact} isMit={isMit} mitRank={mitRank} onComplete={onComplete} onToggleMit={onToggleMit} disableSwipe={disableSwipe} />
      {vm.activeEditTask && (
        <EditTaskModal task={vm.activeEditTask} isOpen={Boolean(vm.activeEditTask)} onOpenChange={(open: boolean) => !open && vm.setActiveEditTask(null)} />
      )}
    </div>
  );
});
