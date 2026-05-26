import { create } from 'zustand';
import { useTaskStore } from './task-store';

export type PomodoroMode = 'focus' | 'short_break' | 'long_break';

interface PomodoroState {
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  mode: PomodoroMode;
  timeLeft: number; // in seconds
  duration: number; // in seconds
  isRunning: boolean;
  completedSessions: number;

  // Actions
  startTimer: (taskId: string, taskTitle: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  tick: () => void;
  setMode: (mode: PomodoroMode) => void;
  adjustDuration: (amountSecs: number) => void;
}

const DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60,       // 25 minutes
  short_break: 5 * 60,  // 5 minutes
  long_break: 15 * 60,  // 15 minutes
};

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  activeTaskId: null,
  activeTaskTitle: null,
  mode: 'focus',
  timeLeft: DURATIONS.focus,
  duration: DURATIONS.focus,
  isRunning: false,
  completedSessions: 0,

  startTimer: (taskId: string, taskTitle: string) => {
    // If starting a timer for a new task, reset everything
    const currentTaskId = get().activeTaskId;
    
    // Auto-mark task as in_progress
    try {
      useTaskStore.getState().editTask(taskId, { status: 'in_progress' });
    } catch (e) {
      console.error('Failed to set task as in_progress:', e);
    }

    if (currentTaskId !== taskId) {
      set({
        activeTaskId: taskId,
        activeTaskTitle: taskTitle,
        mode: 'focus',
        timeLeft: DURATIONS.focus,
        duration: DURATIONS.focus,
        isRunning: true,
      });
    } else {
      set({ isRunning: true });
    }
  },

  pauseTimer: () => {
    set({ isRunning: false });
  },

  resumeTimer: () => {
    set({ isRunning: true });
  },

  resetTimer: () => {
    const currentMode = get().mode;
    set({
      isRunning: false,
      timeLeft: DURATIONS[currentMode],
      duration: DURATIONS[currentMode],
    });
  },

  tick: () => {
    const { timeLeft, isRunning, mode, activeTaskId } = get();
    if (!isRunning) return;

    if (timeLeft > 1) {
      set({ timeLeft: timeLeft - 1 });
    } else {
      // Timer finished!
      const newCompleted = mode === 'focus' ? get().completedSessions + 1 : get().completedSessions;
      
      // Auto-switch mode
      let nextMode: PomodoroMode = 'focus';
      if (mode === 'focus') {
        nextMode = newCompleted % 4 === 0 ? 'long_break' : 'short_break';
      } else {
        nextMode = 'focus';
      }

      set({
        isRunning: false,
        mode: nextMode,
        timeLeft: DURATIONS[nextMode],
        duration: DURATIONS[nextMode],
        completedSessions: newCompleted,
      });

      // Trigger a custom event to notify components (sound, notification)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pomodoro-complete', {
          detail: { mode, taskId: activeTaskId }
        }));
      }
    }
  },

  setMode: (mode: PomodoroMode) => {
    set({
      mode,
      timeLeft: DURATIONS[mode],
      duration: DURATIONS[mode],
      isRunning: false,
    });
  },

  adjustDuration: (amountSecs: number) => {
    const { timeLeft, isRunning } = get();
    if (isRunning) return;
    const newTime = Math.max(60, timeLeft + amountSecs); // Min 1 min
    set({
      timeLeft: newTime,
      duration: newTime,
    });
  },
}));
