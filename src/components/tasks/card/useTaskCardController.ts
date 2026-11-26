'use client';

import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { toast } from 'sonner';
import type { Task } from '@/lib/types';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useFeedback } from '@/hooks/use-feedback';
import type { AIPriorityInfo } from './TaskCardParts';

async function restoreDeletedTask(task: Task, addTask: ReturnType<typeof useTaskStore.getState>['addTask']) {
  try {
    await addTask({
      title: task.title,
      description: task.description || undefined,
      notes: task.notes || undefined,
      priority: task.priority,
      due_date: task.due_date || undefined,
      estimatedTime: task.estimatedTime,
      actualTime: task.actualTime,
      metadata: task.metadata || undefined,
      tags: task.tags,
      parentTaskId: task.parentTaskId,
      depth: task.depth,
    });
    toast.success('Task restored');
  } catch (undoErr) {
    toast.error('Failed to restore task');
    console.error(undoErr);
  }
}

export function useTaskCardController(params: {
  task: Task;
  subtasksProp?: Task[];
  onComplete?: (id: string) => void;
  onUpdate?: (task: Task) => void;
}) {
  const { task, subtasksProp, onComplete, onUpdate } = params;
  const feedback = useFeedback();

  const { removeTask, editTask, addTask, toggleTaskComplete } = useTaskStore(
    useShallow((s) => ({
      removeTask: s.removeTask,
      editTask: s.editTask,
      addTask: s.addTask,
      toggleTaskComplete: s.toggleTaskComplete,
    }))
  );
  const fallbackSubtasks = useTaskStore(
    useShallow((s) => (subtasksProp ? null : s.tasks.filter((t) => t.parentTaskId === task.id && t.status !== 'archived')))
  );

  const isCurrentTaskActive = usePomodoroStore((s) => s.activeTaskId === task.id);
  const startTimer = usePomodoroStore((s) => s.startTimer);
  const startPresetTimer = usePomodoroStore((s) => s.startPresetTimer);

  const [aiPriority, setAIPriority] = useState<AIPriorityInfo | null>(null);
  const [loadingPriority, setLoadingPriority] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
  const [activeEditTask, setActiveEditTask] = useState<Task | null>(null);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(task.notes ?? '');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [justSavedNote, setJustSavedNote] = useState(false);

  useEffect(() => {
    setNoteDraft(task.notes ?? '');
  }, [task.notes]);

  const x = useMotionValue(0);
  const checkScale = useTransform(x, [0, 80], [0.7, 1.25]);
  const checkOpacity = useTransform(x, [0, 50], [0, 1]);
  const trashScale = useTransform(x, [-80, 0], [1.25, 0.7]);
  const trashOpacity = useTransform(x, [-50, 0], [1, 0]);

  const normalizedExistingNote = (task.notes ?? '').trim();
  const hasUnsavedNote = noteDraft.trim() !== normalizedExistingNote;
  const subtasks = Array.isArray(subtasksProp) ? subtasksProp : Array.isArray(fallbackSubtasks) ? fallbackSubtasks : [];
  const completedSubtasks = subtasks.filter((s) => s.status === 'done').length;
  const isOverdue = Boolean(task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done');

  const handleSaveNote = async () => {
    const nextNote = noteDraft.trim();
    if (nextNote === normalizedExistingNote || isSavingNote) return;
    setIsSavingNote(true);
    try {
      const valueToPersist = nextNote.length > 0 ? nextNote : null;
      await editTask(task.id, { notes: valueToPersist });
      onUpdate?.({ ...task, notes: valueToPersist });
      setJustSavedNote(true);
      setTimeout(() => setJustSavedNote(false), 1800);
    } catch (err) {
      console.error('Failed to save task note:', err);
      toast.error('Failed to save note');
    } finally {
      setIsSavingNote(false);
    }
  };

  const toggleExpandSubtask = (subtaskId: string) => {
    setExpandedSubtasks((prev) => {
      const next = new Set(prev);
      if (next.has(subtaskId)) next.delete(subtaskId);
      else next.add(subtaskId);
      return next;
    });
  };

  const getAIPriority = async () => {
    setLoadingPriority(true);
    try {
      const response = await fetch('/api/ai/prioritize-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: { id: task.id, title: task.title, description: task.description || '', due_date: task.due_date, priority: task.priority, tags: task.tags },
          userContext: { currentTime: new Date().toISOString() },
        }),
      });
      if (response.ok) {
        setAIPriority(await response.json());
        toast.success('AI priority calculated!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to get AI priority');
      }
    } catch (error) {
      console.error('AI priority error:', error);
      toast.error('Failed to get AI priority');
    } finally {
      setLoadingPriority(false);
    }
  };

  const handleSwipeDelete = async () => {
    feedback.warning();
    try {
      await removeTask(task.id);
      toast.success('Task deleted', { action: { label: 'Undo', onClick: () => void restoreDeletedTask(task, addTask) } });
    } catch (err) {
      toast.error('Failed to delete task');
      console.error(err);
    }
  };

  const handleDragEnd = async (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 60) onComplete?.(task.id);
    else if (info.offset.x < -60) await handleSwipeDelete();
  };

  const handleDeleteTask = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this task?')) return;
    feedback.warning();
    try {
      await removeTask(task.id);
      toast.success('Task deleted successfully');
    } catch (err) {
      toast.error('Failed to delete task');
      console.error(err);
    }
  };

  const handlePromptActualTime = (e: React.MouseEvent) => {
    e.stopPropagation();
    const act = prompt('Enter actual time spent (in minutes):');
    if (act === null) return;
    const mins = parseInt(act, 10);
    if (!isNaN(mins)) void editTask(task.id, { actualTime: mins });
  };

  const handleStart2m = (e: React.MouseEvent) => {
    e.stopPropagation();
    const starter = startPresetTimer || usePomodoroStore.getState?.()?.startPresetTimer;
    starter?.('starter_2m', { taskId: task.id, title: task.title, durationSecs: 120, openPanel: true });
  };

  const handleToggleSubtask = async (subId: string) => {
    const target = subtasks.find((s) => s.id === subId);
    if (target?.status === 'done') feedback.uncheck();
    else feedback.complete();
    await toggleTaskComplete(subId);
  };

  const handleDeleteSubtask = async (subId: string) => {
    if (!confirm('Are you sure you want to delete this subtask?')) return;
    feedback.warning();
    await removeTask(subId);
    toast.success('Subtask deleted');
  };

  const handleAddSubtask = async (subtaskData: { title?: string }) => {
    try {
      await addTask({
        title: subtaskData.title || '',
        priority: task.priority,
        parentTaskId: task.id,
        depth: (task.depth || 0) + 1,
        isUrgent: false,
        isImportant: false,
      });
      toast.success('Subtask added');
    } catch {
      toast.error('Failed to add subtask');
    }
  };

  return {
    x, checkScale, checkOpacity, trashScale, trashOpacity,
    aiPriority, loadingPriority, isExpanded, setIsExpanded, expandedSubtasks,
    activeEditTask, setActiveEditTask, isNotesOpen, setIsNotesOpen,
    noteDraft, setNoteDraft, isSavingNote, justSavedNote,
    normalizedExistingNote, hasUnsavedNote, subtasks, completedSubtasks,
    isOverdue, isCurrentTaskActive, startTimer,
    handleSaveNote, toggleExpandSubtask, getAIPriority, handleDragEnd,
    handleDeleteTask, handlePromptActualTime, handleStart2m,
    handleToggleSubtask, handleDeleteSubtask, handleAddSubtask,
  };
}
