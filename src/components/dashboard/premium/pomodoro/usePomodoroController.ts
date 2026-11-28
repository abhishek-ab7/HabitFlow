'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { usePomodoroStore, type PomodoroMode } from '@/lib/stores/pomodoro-store';
import { useFeedback } from '@/hooks/use-feedback';
import { sensoryEngine } from '@/lib/feedback/sensory-engine';
import { MODE_COLORS } from '@/lib/pomodoro/pomodoro-helpers';
import { toast } from 'sonner';

function notifyPomodoroComplete(
  finishedMode: PomodoroMode,
  taskTitle: string | undefined,
  activeTaskTitle: string | null | undefined,
  onExpand: () => void
): void {
  sensoryEngine.trigger('milestone');
  if (finishedMode === 'urge_10m') {
    onExpand();
    toast.info('10-Minute Urge Surf Complete', {
      description: 'How did it go? Log your reflection in the timer card.',
      duration: 6000,
    });
    return;
  }
  const toastConfig: Record<Exclude<PomodoroMode, 'urge_10m'>, { title: string; description?: string; duration: number }> = {
    gym_rest: { title: 'Rest finished — next working set!', description: taskTitle || 'Back under the bar!', duration: 4500 },
    starter_2m: { title: '2-Minute Starter complete!', description: 'Keep going or switch into a 25m Focus session.', duration: 5000 },
    focus: { title: 'Focus session complete! Take a break.', description: activeTaskTitle ? `You finished focusing on: ${activeTaskTitle}` : 'Great job focusing!', duration: 5000 },
    short_break: { title: "Break finished! Let's get back to work.", duration: 5000 },
    long_break: { title: "Break finished! Let's get back to work.", duration: 5000 },
  };
  const cfg = toastConfig[finishedMode];
  toast.success(cfg.title, { description: cfg.description, duration: cfg.duration });
}
interface PomodoroLifecycleParams {
  timeLeft: number;
  isRunning: boolean;
  activeTaskTitle?: string | null;
  tick: () => void;
  syncFromClock: () => void;
  isEditingTime: boolean;
  setCustomMinutes: (m: number) => void;
  setIsExpanded: (v: boolean) => void;
}

function usePomodoroLifecycle(params: PomodoroLifecycleParams) {
  const { timeLeft, isRunning, activeTaskTitle, tick, syncFromClock, isEditingTime, setCustomMinutes, setIsExpanded } = params;
  useEffect(() => {
    if (!isEditingTime) setCustomMinutes(Math.max(1, Math.floor(timeLeft / 60)));
  }, [timeLeft, isEditingTime, setCustomMinutes]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => tick(), 1000);
    return () => clearInterval(interval);
  }, [isRunning, tick]);

  useEffect(() => {
    const handleResync = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') syncFromClock();
    };
    document.addEventListener('visibilitychange', handleResync);
    window.addEventListener('focus', handleResync);
    return () => {
      document.removeEventListener('visibilitychange', handleResync);
      window.removeEventListener('focus', handleResync);
    };
  }, [syncFromClock]);

  useEffect(() => {
    const handleComplete = (e: Event) => {
      const detail = (e as CustomEvent<{ mode?: PomodoroMode; taskTitle?: string }>).detail;
      notifyPomodoroComplete(detail?.mode || 'focus', detail?.taskTitle, activeTaskTitle, () => setIsExpanded(true));
    };
    window.addEventListener('pomodoro-complete', handleComplete);
    return () => window.removeEventListener('pomodoro-complete', handleComplete);
  }, [activeTaskTitle, setIsExpanded]);

  useEffect(() => {
    const handleOpen = () => setIsExpanded(true);
    window.addEventListener('open-pomodoro', handleOpen);
    return () => window.removeEventListener('open-pomodoro', handleOpen);
  }, [setIsExpanded]);
}

export function usePomodoroController() {
  const pathname = usePathname();
  const store = usePomodoroStore();
  const feedback = useFeedback();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);

  usePomodoroLifecycle({
    timeLeft: store.timeLeft,
    isRunning: store.isRunning,
    activeTaskTitle: store.activeTaskTitle,
    tick: store.tick,
    syncFromClock: store.syncFromClock,
    isEditingTime,
    setCustomMinutes,
    setIsExpanded,
  });

  const path = pathname ?? '';
  const isAppRoute = path !== '/' && path !== '/login' && !path.startsWith('/auth');
  const activeColor = MODE_COLORS[store.mode] ?? MODE_COLORS.focus;

  return {
    store,
    feedback,
    isExpanded,
    setIsExpanded,
    showExpenseModal,
    setShowExpenseModal,
    isEditingTime,
    setIsEditingTime,
    customMinutes,
    setCustomMinutes,
    isAppRoute,
    activeColor,
  };
}
