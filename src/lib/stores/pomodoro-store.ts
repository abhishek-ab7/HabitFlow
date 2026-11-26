import { create } from 'zustand';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { useTaskStore } from './task-store';

export type PomodoroMode =
  | 'focus'
  | 'short_break'
  | 'long_break'
  | 'starter_2m'
  | 'urge_10m'
  | 'gym_rest';

export const POMODORO_DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60,       // 25 minutes
  short_break: 5 * 60,  // 5 minutes
  long_break: 15 * 60,  // 15 minutes
  starter_2m: 2 * 60,   // 2-minute anti-procrastination rule
  urge_10m: 10 * 60,    // 10-minute urge surfing timer
  gym_rest: 90,         // 90s default gym rest timer
};

interface PomodoroState {
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  mode: PomodoroMode;
  timeLeft: number; // in seconds
  duration: number; // in seconds
  isRunning: boolean;
  endsAt: number | null; // wall-clock epoch ms when running
  lastTickMs: number | null;
  completedSessions: number;
  urgeHabitId: string | null;
  urgeHabitName: string | null;
  pendingUrgeReflection: boolean;
  lastCompletedMode: PomodoroMode | null;

  // Actions
  startTimer: (taskId: string, taskTitle: string) => void;
  startPresetTimer: (
    mode: PomodoroMode,
    options?: {
      durationSecs?: number;
      title?: string;
      taskId?: string | null;
      habitId?: string | null;
      habitName?: string | null;
      openPanel?: boolean;
    }
  ) => void;
  startGymRestTimer: (seconds: number, exerciseName?: string) => void;
  startUrgeTimer: (habitId?: string | null, habitName?: string | null) => void;
  resolveUrgeReflection: (outcome: 'passed' | 'gave_in') => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  tick: (nowMs?: number) => void;
  syncFromClock: (nowMs?: number) => void;
  setMode: (mode: PomodoroMode) => void;
  adjustDuration: (amountSecs: number) => void;
}

function finalizeTimerCompletion(
  state: PomodoroState,
  set: (partial: Partial<PomodoroState>) => void
) {
  const { mode, activeTaskId, activeTaskTitle, completedSessions, urgeHabitId, urgeHabitName, duration } = state;
  const newCompleted =
    mode === 'focus' ? completedSessions + 1 : completedSessions;

  let nextMode: PomodoroMode = 'focus';
  let nextDuration = POMODORO_DURATIONS.focus;

  if (mode === 'focus') {
    nextMode = newCompleted % 4 === 0 ? 'long_break' : 'short_break';
    nextDuration = POMODORO_DURATIONS[nextMode];
  } else if (mode === 'short_break' || mode === 'long_break' || mode === 'starter_2m') {
    nextMode = 'focus';
    nextDuration = POMODORO_DURATIONS.focus;
  } else if (mode === 'gym_rest') {
    nextMode = 'gym_rest';
    nextDuration = duration > 0 ? duration : POMODORO_DURATIONS.gym_rest;
  } else if (mode === 'urge_10m') {
    nextMode = 'urge_10m';
    nextDuration = POMODORO_DURATIONS.urge_10m;
  }

  set({
    isRunning: false,
    endsAt: null,
    lastTickMs: null,
    mode: nextMode,
    timeLeft: nextDuration,
    duration: nextDuration,
    completedSessions: newCompleted,
    pendingUrgeReflection: mode === 'urge_10m',
    lastCompletedMode: mode,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('pomodoro-complete', {
        detail: {
          mode,
          taskId: activeTaskId,
          taskTitle: activeTaskTitle,
          habitId: urgeHabitId,
          habitName: urgeHabitName,
        },
      })
    );
  }
}

function buildPresetTimerState(
  mode: PomodoroMode,
  options?: Parameters<PomodoroState['startPresetTimer']>[1]
) {
  const now = Date.now();
  const dur = Math.max(5, Math.round(options?.durationSecs ?? POMODORO_DURATIONS[mode]));
  const defaultTitles: Partial<Record<PomodoroMode, string>> = {
    starter_2m: '2-Min Rule Starter',
    urge_10m: '10-Min Urge Surf',
    gym_rest: `Gym Rest (${dur}s)`,
  };
  return {
    mode,
    timeLeft: dur,
    duration: dur,
    isRunning: true,
    endsAt: now + dur * 1000,
    lastTickMs: now,
    activeTaskId: options?.taskId ?? null,
    activeTaskTitle: options?.title ?? defaultTitles[mode] ?? null,
    urgeHabitId: options?.habitId ?? null,
    urgeHabitName: options?.habitName ?? null,
    pendingUrgeReflection: false,
  };
}

function tryHandleWallClockTick(
  state: PomodoroState,
  set: (partial: Partial<PomodoroState>) => void,
  nowMs: number
): boolean {
  const { timeLeft, endsAt, lastTickMs } = state;
  const elapsedSinceLastTick = lastTickMs != null ? nowMs - lastTickMs : 1000;
  if (endsAt == null || elapsedSinceLastTick < 500) return false;

  const expectedFromEndsAt = Math.max(0, Math.ceil((endsAt - nowMs - 50) / 1000));
  const shouldUseWallClock = Math.abs(timeLeft - expectedFromEndsAt) <= 1 || elapsedSinceLastTick >= 1500;
  if (!shouldUseWallClock) return false;

  if (expectedFromEndsAt <= 0) finalizeTimerCompletion(state, set);
  else set({ timeLeft: expectedFromEndsAt, lastTickMs: nowMs });
  return true;
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  activeTaskId: null,
  activeTaskTitle: null,
  mode: 'focus',
  timeLeft: POMODORO_DURATIONS.focus,
  duration: POMODORO_DURATIONS.focus,
  isRunning: false,
  endsAt: null,
  lastTickMs: null,
  completedSessions: 0,
  urgeHabitId: null,
  urgeHabitName: null,
  pendingUrgeReflection: false,
  lastCompletedMode: null,

  startTimer: (taskId: string, taskTitle: string) => {
    const currentTaskId = get().activeTaskId;
    const now = Date.now();

    // Auto-mark task as in_progress
    try {
      useTaskStore.getState().editTask(taskId, { status: 'in_progress' });
    } catch (e) {
      console.error('Failed to set task as in_progress:', e);
    }

    if (currentTaskId !== taskId) {
      const dur = POMODORO_DURATIONS.focus;
      set({
        activeTaskId: taskId,
        activeTaskTitle: taskTitle,
        mode: 'focus',
        timeLeft: dur,
        duration: dur,
        isRunning: true,
        endsAt: now + dur * 1000,
        lastTickMs: now,
        urgeHabitId: null,
        urgeHabitName: null,
        pendingUrgeReflection: false,
      });
    } else {
      const rem = Math.max(1, get().timeLeft || POMODORO_DURATIONS.focus);
      set({
        isRunning: true,
        endsAt: now + rem * 1000,
        lastTickMs: now,
        pendingUrgeReflection: false,
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-pomodoro'));
    }
  },

  startPresetTimer: (mode, options) => {
    set(buildPresetTimerState(mode, options));
    if (typeof window !== 'undefined' && options?.openPanel !== false) {
      window.dispatchEvent(new CustomEvent('open-pomodoro'));
    }
  },

  startGymRestTimer: (seconds, exerciseName) => {
    const secs = Math.max(15, Math.round(seconds));
    get().startPresetTimer('gym_rest', {
      durationSecs: secs,
      title: exerciseName ? `Rest · ${exerciseName}` : `Gym Rest (${secs}s)`,
      openPanel: false,
    });
  },

  startUrgeTimer: (habitId, habitName) => {
    get().startPresetTimer('urge_10m', {
      durationSecs: POMODORO_DURATIONS.urge_10m,
      title: habitName ? `Urge Surf · ${habitName}` : '10-Min Urge Surf',
      habitId: habitId ?? null,
      habitName: habitName ?? null,
      openPanel: true,
    });
  },

  resolveUrgeReflection: (outcome) => {
    const { urgeHabitId } = get();
    set({ pendingUrgeReflection: false });

    if (urgeHabitId) {
      const today = getLocalIsoDate();
      import('./mediator')
        .then(({ CrossDomainActionMediator }) =>
          CrossDomainActionMediator.dispatch({
            type: outcome === 'passed' ? 'HABIT_COMPLETED' : 'HABIT_UNCOMPLETED',
            payload: {
              habitId: urgeHabitId,
              date: today,
            },
          })
        )
        .catch(() => undefined);
    }
  },

  pauseTimer: () => {
    const state = get();
    const { isRunning, endsAt, timeLeft } = state;
    if (!isRunning) return;
    const now = Date.now();
    const syncedLeft =
      endsAt != null ? Math.max(0, Math.ceil((endsAt - now - 50) / 1000)) : timeLeft;
    if (endsAt != null && syncedLeft <= 0) {
      finalizeTimerCompletion(state, set);
      return;
    }
    set({
      isRunning: false,
      endsAt: null,
      lastTickMs: null,
      timeLeft: Math.max(1, syncedLeft),
    });
  },

  resumeTimer: () => {
    const now = Date.now();
    const rem = Math.max(1, get().timeLeft);
    set({
      isRunning: true,
      endsAt: now + rem * 1000,
      lastTickMs: now,
      pendingUrgeReflection: false,
    });
  },

  resetTimer: () => {
    const currentMode = get().mode;
    const dur =
      currentMode === 'gym_rest' && get().duration > 0
        ? get().duration
        : POMODORO_DURATIONS[currentMode];
    set({
      isRunning: false,
      endsAt: null,
      lastTickMs: null,
      timeLeft: dur,
      duration: dur,
      pendingUrgeReflection: false,
    });
  },

  syncFromClock: (nowMs = Date.now()) => {
    const state = get();
    if (!state.isRunning) return;

    if (!state.endsAt) {
      set({
        endsAt: nowMs + Math.max(1, state.timeLeft) * 1000,
        lastTickMs: nowMs,
      });
      return;
    }

    const remaining = Math.max(0, Math.ceil((state.endsAt - nowMs - 50) / 1000));
    if (remaining <= 0) {
      finalizeTimerCompletion(state, set);
    } else {
      set({
        timeLeft: remaining,
        lastTickMs: nowMs,
      });
    }
  },

  tick: (nowMs = Date.now()) => {
    const state = get();
    if (!state.isRunning) return;
    if (tryHandleWallClockTick(state, set, nowMs)) return;

    if (state.timeLeft <= 1) return finalizeTimerCompletion(state, set);
    const nextLeft = state.timeLeft - 1;
    set({ timeLeft: nextLeft, endsAt: nowMs + nextLeft * 1000, lastTickMs: nowMs });
  },

  setMode: (mode: PomodoroMode) => {
    const dur = POMODORO_DURATIONS[mode];
    set({
      mode,
      timeLeft: dur,
      duration: dur,
      isRunning: false,
      endsAt: null,
      lastTickMs: null,
      pendingUrgeReflection: false,
    });
  },

  adjustDuration: (amountSecs: number) => {
    const { timeLeft, isRunning } = get();
    if (isRunning) return;
    const minSecs = get().mode === 'gym_rest' ? 15 : 60;
    const newTime = Math.max(minSecs, timeLeft + amountSecs);
    set({
      timeLeft: newTime,
      duration: newTime,
      endsAt: null,
    });
  },
}));
