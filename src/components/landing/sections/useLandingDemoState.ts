'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DIALOGUE_POOL,
  INITIAL_MOCK_HABITS,
  INITIAL_MOCK_ROUTINES,
  getSimulatorRelativeY,
  triggerConfetti,
  useFlowStageProgression,
  useLandingAutoplay,
  useLandingScrollMotion,
  useMockDashboardDemo,
  usePomodoroTimerEffect,
  type FloatingFeedback,
} from './landing-demo-helpers';

export type { FloatingFeedback, MockHabitItem, MockRoutineItem } from './landing-demo-helpers';

export const SIMULATOR_HABITS = [
  { id: 'meditation', name: 'Morning Meditation', desc: 'Focus · 10 mins', icon: '🧘' },
  { id: 'read', name: 'Read 30 mins', desc: 'Growth · 30 mins', icon: '📚' },
  { id: 'steps', name: '10k Steps', desc: 'Fitness · Daily', icon: '🏃‍♂️' },
];

export const SIMULATOR_TASKS = [
  { id: 'task1', name: 'Complete UI layout design', desc: 'Productivity · High' },
  { id: 'task2', name: 'Refactor client sync engine', desc: 'Code · Medium' },
  { id: 'task3', name: 'Prepare release documentation', desc: 'Work · Low' },
];

function useSimulatorHandlers(params: {
  handleManualInteraction: () => void;
  triggerFeedbackParticle: (p: { x: number; y: number; label: string; elementId: string; source: FloatingFeedback['source']; isRelative?: boolean }) => void;
  setCompanionDialogue: (d: string) => void;
}) {
  const { handleManualInteraction, triggerFeedbackParticle, setCompanionDialogue } = params;
  const [completedHabits, setCompletedHabits] = useState<Record<string, boolean>>({});
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});

  const handleCompleteHabit = useCallback((e: React.MouseEvent<HTMLDivElement> | null, habitId: string) => {
    if (completedHabits[habitId]) return;
    if (e) handleManualInteraction();
    setCompletedHabits((prev) => ({ ...prev, [habitId]: true }));
    triggerFeedbackParticle({ x: e ? e.clientX : 320, y: e ? e.clientY : getSimulatorRelativeY(habitId), label: 'Habit ✓', elementId: 'simulator-content-box', source: 'simulator', isRelative: !e });
    triggerConfetti({ particleCount: e ? 30 : 20, angle: 60, spread: e ? 55 : 45, origin: e ? { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight } : { x: 0.45, y: 0.7 } });
  }, [completedHabits, handleManualInteraction, triggerFeedbackParticle]);

  const handleCompleteTask = useCallback((e: React.MouseEvent<HTMLDivElement> | null, taskId: string) => {
    if (completedTasks[taskId]) return;
    if (e) handleManualInteraction();
    setCompletedTasks((prev) => ({ ...prev, [taskId]: true }));
    triggerFeedbackParticle({ x: e ? e.clientX : 320, y: e ? e.clientY : getSimulatorRelativeY(taskId), label: 'Task ✓', elementId: 'simulator-content-box', source: 'simulator', isRelative: !e });
    triggerConfetti({ particleCount: e ? 20 : 15, angle: 120, spread: 45, origin: e ? { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight } : { x: 0.45, y: 0.7 } });
  }, [completedTasks, handleManualInteraction, triggerFeedbackParticle]);

  const handleCompanionClick = useCallback((e: React.MouseEvent | null) => {
    if (e) handleManualInteraction();
    setCompanionDialogue(DIALOGUE_POOL[Math.floor(Math.random() * DIALOGUE_POOL.length)]);
    triggerFeedbackParticle({ x: e ? e.clientX : 72, y: e ? e.clientY : 100, label: 'In Flow ✨', elementId: 'companion-widget-box', source: 'widget', isRelative: !e });
    triggerConfetti({ particleCount: e ? 15 : 10, spread: e ? 40 : 30, origin: e ? { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight } : { x: 0.25, y: 0.6 } });
  }, [handleManualInteraction, setCompanionDialogue, triggerFeedbackParticle]);

  return { completedHabits, setCompletedHabits, completedTasks, setCompletedTasks, handleCompleteHabit, handleCompleteTask, handleCompanionClick };
}

export function useLandingDemoState(refs: {
  mockupRef: React.RefObject<HTMLDivElement | null>;
  focusHubRef: React.RefObject<HTMLDivElement | null>;
  simulatorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const motionVals = useLandingScrollMotion(refs);
  const [momentum, setMomentum] = useState(0);
  const [flowStage, setFlowStage] = useState<1 | 2 | 3>(1);
  const [floatingFeedbacks, setFloatingFeedbacks] = useState<FloatingFeedback[]>([]);
  const [showFlowComplete, setShowFlowComplete] = useState(false);
  const [activeTab, setActiveTab] = useState<'habits' | 'tasks' | 'milestones'>('habits');
  const [companionDialogue, setCompanionDialogue] = useState('Check off daily habits to build flow.');
  const [pomodoroSeconds, setPomodoroSeconds] = useState(1500);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isDemoActive, setIsDemoActive] = useState(true);
  const [demoStep, setDemoStep] = useState(0);

  const handleManualInteraction = useCallback(() => setIsDemoActive(false), []);
  const triggerFeedbackParticle = useCallback((p: { x: number; y: number; label: string; elementId: string; source: FloatingFeedback['source']; isRelative?: boolean }) => {
    const listRect = document.getElementById(p.elementId)?.getBoundingClientRect();
    if (!listRect) return;
    const id = Math.random().toString();
    setFloatingFeedbacks((prev) => [...prev, { id, x: p.isRelative ? p.x : p.x - listRect.left, y: p.isRelative ? p.y : p.y - listRect.top, text: p.label, source: p.source }]);
    setTimeout(() => setFloatingFeedbacks((prev) => prev.filter((item) => item.id !== id)), 950);
  }, []);

  const mock = useMockDashboardDemo({ handleManualInteraction, triggerFeedbackParticle });
  const sim = useSimulatorHandlers({ handleManualInteraction, triggerFeedbackParticle, setCompanionDialogue });

  useFlowStageProgression({ completedHabits: sim.completedHabits, completedTasks: sim.completedTasks, flowStage, setFlowStage, setMomentum, setCompanionDialogue, setShowFlowComplete });
  usePomodoroTimerEffect({ isTimerRunning, pomodoroSeconds, setPomodoroSeconds, setIsTimerRunning, setCompanionDialogue });

  useEffect(() => {
    if (!showFlowComplete) return;
    const timer = setTimeout(() => setShowFlowComplete(false), 2600);
    return () => clearTimeout(timer);
  }, [showFlowComplete]);

  useLandingAutoplay({
    isDemoActive, isSimulatorInView: motionVals.isSimulatorInView, demoStep, setDemoStep,
    stepActions: {
      0: () => {
        mock.setMockHabits(INITIAL_MOCK_HABITS); mock.setMockRoutines(INITIAL_MOCK_ROUTINES); mock.setMockGraphRange('week');
        sim.setCompletedHabits({}); sim.setCompletedTasks({}); setActiveTab('habits');
        setFlowStage(1); setMomentum(0); setCompanionDialogue('Check off daily habits to build flow. 🌿');
      },
      1: () => mock.handleToggleMockHabit(null, 'h1'), 2: () => mock.handleToggleMockHabit(null, 'h2'), 3: () => mock.handleToggleMockHabit(null, 'h3'),
      4: () => sim.handleCompanionClick(null),
      5: () => sim.handleCompleteHabit(null, 'meditation'), 6: () => sim.handleCompleteHabit(null, 'read'), 7: () => sim.handleCompleteHabit(null, 'steps'),
      8: () => setActiveTab('tasks'),
      9: () => sim.handleCompleteTask(null, 'task1'), 10: () => sim.handleCompleteTask(null, 'task2'), 11: () => sim.handleCompleteTask(null, 'task3'),
      12: () => mock.handleToggleMockRoutine(null, 'r1'), 13: () => mock.setMockGraphRange('month'), 14: () => setActiveTab('milestones'),
    },
  });

  return {
    ...motionVals, ...mock, ...sim,
    momentum, flowStage, floatingFeedbacks, showFlowComplete, activeTab, setActiveTab,
    companionDialogue, pomodoroSeconds, setPomodoroSeconds, isTimerRunning, setIsTimerRunning,
    isDemoActive, setIsDemoActive, setDemoStep, handleManualInteraction,
    completedTotal: Object.values(sim.completedHabits).filter(Boolean).length + Object.values(sim.completedTasks).filter(Boolean).length,
  };
}
