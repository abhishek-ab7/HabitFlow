'use client';

import { useState, useEffect, useCallback } from 'react';
import { useScroll, useTransform, useSpring, useInView } from 'framer-motion';

export interface FloatingFeedback {
  id: string;
  x: number;
  y: number;
  text: string;
  source: 'mock' | 'widget' | 'simulator';
}

export interface MockHabitItem {
  id: string;
  name: string;
  done: boolean;
  color: string;
}

export interface MockRoutineItem {
  id: string;
  name: string;
  done: boolean;
}

export const INITIAL_MOCK_HABITS: MockHabitItem[] = [
  { id: 'h1', name: 'Drink 3L Water', done: false, color: 'text-blue-500 bg-blue-500/10' },
  { id: 'h2', name: 'Morning Journal', done: false, color: 'text-amber-500 bg-amber-500/10' },
  { id: 'h3', name: 'Pushups Session', done: false, color: 'text-red-500 bg-red-500/10' },
];

export const INITIAL_MOCK_ROUTINES: MockRoutineItem[] = [
  { id: 'r1', name: 'Refactor Auth Hooks', done: false },
  { id: 'r2', name: 'Review Team PRs', done: false },
];

export const DIALOGUE_POOL = [
  'Consistency overrides motivation! ⚡',
  'Focusing is a habit, keep going! 🚀',
  'Small daily wins compound over time. 🌱',
  'You are doing amazing! 🎯',
  'Stay hydrated and take breaks! 💧',
  'One step at a time! ✨',
];

export function triggerConfetti(options: Record<string, unknown>) {
  import('canvas-confetti').then((mod) => mod.default(options)).catch(() => {});
}

export function getSimulatorRelativeY(id: string): number {
  if (id === 'meditation' || id === 'task1') return 60;
  if (id === 'read' || id === 'task2') return 120;
  return 180;
}

export function useLandingScrollMotion(params: {
  mockupRef: React.RefObject<HTMLDivElement | null>;
  focusHubRef: React.RefObject<HTMLDivElement | null>;
  simulatorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const isSimulatorInView = useInView(params.simulatorRef, { once: true, amount: 0.15 });
  const { scrollYProgress: mockupScrollY } = useScroll({ target: params.mockupRef, offset: ['start end', 'end start'] });
  const mockupSpringY = useSpring(mockupScrollY, { stiffness: 100, damping: 25 });
  const { scrollYProgress: focusScrollY } = useScroll({ target: params.focusHubRef, offset: ['start end', 'end start'] });
  const focusSpringY = useSpring(focusScrollY, { stiffness: 80, damping: 20 });

  return {
    isSimulatorInView,
    mockupRotateX: useTransform(mockupSpringY, [0, 0.45], [18, 0]),
    mockupTranslateY: useTransform(mockupSpringY, [0, 0.5], [60, 0]),
    mockupScale: useTransform(mockupSpringY, [0, 0.45], [0.88, 1]),
    mockupOpacity: useTransform(mockupSpringY, [0, 0.4], [0.4, 1]),
    pomodoroScrollOffset: useTransform(focusSpringY, [0.1, 0.6], [276.4, 0]),
  };
}

export function useFlowStageProgression(params: {
  completedHabits: Record<string, boolean>;
  completedTasks: Record<string, boolean>;
  flowStage: 1 | 2 | 3;
  setFlowStage: (s: 1 | 2 | 3) => void;
  setMomentum: (m: number) => void;
  setCompanionDialogue: (d: string) => void;
  setShowFlowComplete: (v: boolean) => void;
}) {
  const { completedHabits, completedTasks, flowStage, setFlowStage, setMomentum, setCompanionDialogue, setShowFlowComplete } = params;
  useEffect(() => {
    const habitsDone = Object.values(completedHabits).filter(Boolean).length;
    const tasksDone = Object.values(completedTasks).filter(Boolean).length;
    setMomentum(Math.round(((habitsDone + tasksDone) / 6) * 100));

    if (habitsDone < 3) return void setFlowStage(1);
    if (tasksDone < 3) {
      if (flowStage === 1) {
        setCompanionDialogue('Daily habits locked in! 🌿');
        setShowFlowComplete(true);
        triggerConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
      return void setFlowStage(2);
    }
    if (flowStage === 2) {
      setCompanionDialogue('100% daily flow achieved! 🌳');
      setShowFlowComplete(true);
      triggerConfetti({ particleCount: 130, spread: 80, origin: { y: 0.6 } });
    }
    setFlowStage(3);
  }, [completedHabits, completedTasks, flowStage, setFlowStage, setMomentum, setCompanionDialogue, setShowFlowComplete]);
}

export function usePomodoroTimerEffect(params: {
  isTimerRunning: boolean;
  pomodoroSeconds: number;
  setPomodoroSeconds: React.Dispatch<React.SetStateAction<number>>;
  setIsTimerRunning: (v: boolean) => void;
  setCompanionDialogue: (d: string) => void;
}) {
  const { isTimerRunning, pomodoroSeconds, setPomodoroSeconds, setIsTimerRunning, setCompanionDialogue } = params;
  useEffect(() => {
    if (isTimerRunning && pomodoroSeconds > 0) {
      const timer = setInterval(() => setPomodoroSeconds((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    }
    if (pomodoroSeconds === 0) {
      setIsTimerRunning(false);
      setPomodoroSeconds(1500);
      triggerConfetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      setCompanionDialogue('Time is up! Great focus session! ⏱️');
    }
  }, [isTimerRunning, pomodoroSeconds, setPomodoroSeconds, setIsTimerRunning, setCompanionDialogue]);
}

export function useMockDashboardDemo(params: {
  handleManualInteraction: () => void;
  triggerFeedbackParticle: (p: { x: number; y: number; label: string; elementId: string; source: FloatingFeedback['source']; isRelative?: boolean }) => void;
}) {
  const { handleManualInteraction, triggerFeedbackParticle } = params;
  const [mockHabits, setMockHabits] = useState<MockHabitItem[]>(INITIAL_MOCK_HABITS);
  const [mockRoutines, setMockRoutines] = useState<MockRoutineItem[]>(INITIAL_MOCK_ROUTINES);
  const [mockGraphRange, setMockGraphRange] = useState<'week' | 'month'>('week');

  const handleToggleMockHabit = useCallback((e: React.MouseEvent | null, habitId: string) => {
    if (e) handleManualInteraction();
    setMockHabits((prev) => prev.map((h) => {
      if (h.id !== habitId) return h;
      if (!h.done) {
        const relX = habitId === 'h1' ? 120 : habitId === 'h2' ? 240 : 360;
        triggerFeedbackParticle({ x: e ? e.clientX : relX, y: e ? e.clientY : 145, label: 'Done ✓', elementId: 'mock-dashboard-wrapper', source: 'mock', isRelative: !e });
        triggerConfetti({ particleCount: e ? 15 : 10, spread: e ? 30 : 25, origin: e ? { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight } : { x: 0.7, y: 0.45 } });
      }
      return { ...h, done: !h.done };
    }));
  }, [handleManualInteraction, triggerFeedbackParticle]);

  const handleToggleMockRoutine = useCallback((e: React.MouseEvent | null, routineId: string) => {
    if (e) handleManualInteraction();
    setMockRoutines((prev) => prev.map((r) => {
      if (r.id !== routineId) return r;
      if (!r.done) {
        const relY = routineId === 'r1' ? 275 : 325;
        triggerFeedbackParticle({ x: e ? e.clientX : 350, y: e ? e.clientY : relY, label: 'Checked ✓', elementId: 'mock-dashboard-wrapper', source: 'mock', isRelative: !e });
      }
      return { ...r, done: !r.done };
    }));
  }, [handleManualInteraction, triggerFeedbackParticle]);

  return { mockHabits, setMockHabits, mockRoutines, setMockRoutines, mockGraphRange, setMockGraphRange, handleToggleMockHabit, handleToggleMockRoutine };
}

export function useLandingAutoplay(params: {
  isDemoActive: boolean;
  isSimulatorInView: boolean;
  demoStep: number;
  setDemoStep: React.Dispatch<React.SetStateAction<number>>;
  stepActions: Record<number, () => void>;
}) {
  const { isDemoActive, isSimulatorInView, demoStep, setDemoStep, stepActions } = params;

  useEffect(() => {
    if (!isDemoActive || !isSimulatorInView) return;
    const interval = setInterval(() => setDemoStep((prev) => (prev + 1) % 15), 900);
    return () => clearInterval(interval);
  }, [isDemoActive, isSimulatorInView, setDemoStep]);

  useEffect(() => {
    if (!isDemoActive || !isSimulatorInView) return;
    stepActions[demoStep]?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoStep, isDemoActive, isSimulatorInView]);
}
