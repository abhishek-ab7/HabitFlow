'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  X,
  Timer,
  Coffee,
  CheckSquare,
  Plus,
  Minus,
  Check,
  ShieldCheck,
  Dumbbell,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { usePomodoroStore, type PomodoroMode } from '@/lib/stores/pomodoro-store';
import { useFeedback } from '@/hooks/use-feedback';
import { sensoryEngine } from '@/lib/feedback/sensory-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const AddTransactionModal = dynamic(
  () => import('@/components/finance/AddTransactionModal').then((m) => ({ default: m.AddTransactionModal })),
  { ssr: false }
);

const MODE_LABELS: Record<PomodoroMode, string> = {
  focus: 'Focusing',
  short_break: 'Short Break',
  long_break: 'Long Break',
  starter_2m: '2m Starter',
  urge_10m: '10m Urge Surf',
  gym_rest: 'Gym Rest',
};

const MODE_PILL_SHORT: Record<PomodoroMode, string> = {
  focus: 'Focus',
  short_break: 'Break',
  long_break: 'Long',
  starter_2m: '2m Start',
  urge_10m: 'Urge',
  gym_rest: 'Rest',
};

const MODE_COLORS: Record<
  PomodoroMode,
  { text: string; bg: string; border: string; pillBg: string; dot: string }
> = {
  focus: {
    text: 'text-rose-500',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    pillBg: 'bg-rose-500',
    dot: 'bg-rose-500',
  },
  short_break: {
    text: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    pillBg: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  long_break: {
    text: 'text-sky-500',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    pillBg: 'bg-sky-500',
    dot: 'bg-sky-500',
  },
  starter_2m: {
    text: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    pillBg: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
  urge_10m: {
    text: 'text-violet-500',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    pillBg: 'bg-violet-500',
    dot: 'bg-violet-500',
  },
  gym_rest: {
    text: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    pillBg: 'bg-cyan-500',
    dot: 'bg-cyan-500',
  },
};

export function PomodoroFloating() {
  const {
    activeTaskTitle,
    mode,
    timeLeft,
    isRunning,
    completedSessions,
    pendingUrgeReflection,
    urgeHabitName,
    pauseTimer,
    resumeTimer,
    resetTimer,
    tick,
    syncFromClock,
    setMode,
    startPresetTimer,
    resolveUrgeReflection,
    adjustDuration,
  } = usePomodoroStore();

  const pathname = usePathname() ?? '';
  const feedback = useFeedback();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);

  const isAppRoute =
    pathname !== '/' && pathname !== '/login' && !pathname.startsWith('/auth');

  // Sync typed minutes when not editing
  useEffect(() => {
    if (!isEditingTime) {
      setCustomMinutes(Math.max(1, Math.floor(timeLeft / 60)));
    }
  }, [timeLeft, isEditingTime]);

  // Tick timer every second if running
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, tick]);

  // Wall-clock resync on mobile screen wake / tab switch
  useEffect(() => {
    const handleResync = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        syncFromClock();
      }
    };
    document.addEventListener('visibilitychange', handleResync);
    window.addEventListener('focus', handleResync);
    return () => {
      document.removeEventListener('visibilitychange', handleResync);
      window.removeEventListener('focus', handleResync);
    };
  }, [syncFromClock]);

  // Offline Web Audio chime + haptic vibration + toast on completion
  useEffect(() => {
    const handleComplete = (e: Event) => {
      const customEvent = e as CustomEvent<{
        mode?: PomodoroMode;
        taskTitle?: string;
        habitName?: string;
      }>;
      const finishedMode = customEvent.detail?.mode || 'focus';

      sensoryEngine.trigger('milestone');

      if (finishedMode === 'urge_10m') {
        setIsExpanded(true);
        toast.info('10-Minute Urge Surf Complete', {
          description: 'How did it go? Log your reflection in the timer card.',
          duration: 6000,
        });
      } else if (finishedMode === 'gym_rest') {
        toast.success('Rest finished — next working set!', {
          description: customEvent.detail?.taskTitle || 'Back under the bar!',
          duration: 4500,
        });
      } else if (finishedMode === 'starter_2m') {
        toast.success('2-Minute Starter complete!', {
          description: 'Keep going or switch into a 25m Focus session.',
          duration: 5000,
        });
      } else if (finishedMode === 'focus') {
        toast.success('Focus session complete! Take a break.', {
          description: activeTaskTitle
            ? `You finished focusing on: ${activeTaskTitle}`
            : 'Great job focusing!',
          duration: 5000,
        });
      } else {
        toast.success("Break finished! Let's get back to work.", {
          duration: 5000,
        });
      }
    };

    window.addEventListener('pomodoro-complete', handleComplete);
    return () => window.removeEventListener('pomodoro-complete', handleComplete);
  }, [activeTaskTitle]);

  useEffect(() => {
    const handleOpen = () => {
      setIsExpanded(true);
    };
    window.addEventListener('open-pomodoro', handleOpen);
    return () => window.removeEventListener('open-pomodoro', handleOpen);
  }, []);

  if (!isAppRoute) return null;

  const formatTime = (secs: number) => {
    const safe = Math.max(0, Math.floor(secs));
    const mins = Math.floor(safe / 60);
    const remainingSecs = safe % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs
      .toString()
      .padStart(2, '0')}`;
  };

  const activeColor = MODE_COLORS[mode] || MODE_COLORS.focus;

  const renderModeIcon = () => {
    if (mode === 'short_break' || mode === 'long_break') {
      return <Coffee className={cn('h-4 w-4', activeColor.text)} />;
    }
    if (mode === 'gym_rest') {
      return <Dumbbell className={cn('h-4 w-4', activeColor.text)} />;
    }
    if (mode === 'urge_10m') {
      return <ShieldCheck className={cn('h-4 w-4', activeColor.text)} />;
    }
    if (mode === 'starter_2m') {
      return <Zap className={cn('h-4 w-4', activeColor.text)} />;
    }
    return <Timer className={cn('h-4 w-4', activeColor.text)} />;
  };

  return (
    <>
      {/* Floating Container — Mobile bottom-right above MobileNav + Desktop bottom-right */}
      <div className="fixed bottom-[76px] right-4 md:bottom-6 md:right-6 z-50 select-none flex flex-col items-end gap-2.5">
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="pomodoro-panel"
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ duration: 0.18 }}
              className="w-[min(19.5rem,calc(100vw-2rem))] bg-card md:bg-card/95 md:backdrop-blur-xl rounded-2xl border border-border shadow-2xl p-4 space-y-3.5"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
                <div className="flex items-center gap-1.5">
                  {renderModeIcon()}
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {MODE_LABELS[mode]}
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setIsExpanded(false)}
                  aria-label="Minimize focus timer"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Urge Surfing Reflection Prompt (shown on urge_10m completion) */}
              {pendingUrgeReflection && (
                <div className="rounded-xl border border-violet-500/35 bg-violet-500/10 p-3 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        10-Min Urge Timer Done
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {urgeHabitName
                          ? `Did you hold strong on "${urgeHabitName}"?`
                          : 'Did the craving pass?'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1"
                      onClick={() => {
                        feedback.complete();
                        resolveUrgeReflection('passed');
                        toast.success('Craving passed! Streak protected.');
                      }}
                    >
                      <Check className="h-3.5 w-3.5" /> Craving Passed
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold gap-1"
                      onClick={() => {
                        feedback.warning();
                        resolveUrgeReflection('gave_in');
                        toast.info('Logged honestly — reset and go again.');
                      }}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" /> Gave In
                    </Button>
                  </div>
                </div>
              )}

              {/* Active Label Info */}
              <div className="bg-muted/50 rounded-xl p-2.5 border border-border/50">
                <div className="flex items-start gap-2">
                  <CheckSquare className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Active Session
                    </p>
                    <p className="text-sm font-semibold truncate mt-0.5 text-foreground leading-tight">
                      {activeTaskTitle || MODE_LABELS[mode]}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timer Display */}
              <div className="flex flex-col items-center justify-center py-1 relative">
                {isEditingTime ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="180"
                      value={customMinutes}
                      onChange={(e) =>
                        setCustomMinutes(
                          Math.max(1, Math.min(180, parseInt(e.target.value, 10) || 1))
                        )
                      }
                      className="w-20 text-center text-2xl font-bold font-mono bg-muted/50 border-border h-10"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const mins = Math.max(1, Math.min(180, customMinutes));
                          adjustDuration(mins * 60 - timeLeft);
                          setIsEditingTime(false);
                          toast.success(`Duration set to ${mins}m`);
                        } else if (e.key === 'Escape') {
                          setIsEditingTime(false);
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      className="h-9 w-9 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
                      onClick={() => {
                        const mins = Math.max(1, Math.min(180, customMinutes));
                        adjustDuration(mins * 60 - timeLeft);
                        setIsEditingTime(false);
                        toast.success(`Duration set to ${mins}m`);
                      }}
                      title="Save duration"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded-lg"
                      onClick={() => setIsEditingTime(false)}
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 group">
                    {!isRunning && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-full opacity-75 md:opacity-0 md:group-hover:opacity-100 transition-all"
                        onClick={() => {
                          const step = mode === 'gym_rest' ? -15 : -60;
                          const minAllowed = mode === 'gym_rest' ? 15 : 60;
                          if (timeLeft > minAllowed) {
                            adjustDuration(step);
                          } else {
                            toast.error(`Minimum duration is ${minAllowed}s`);
                          }
                        }}
                        title="Decrease duration"
                      >
                        <Minus className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                    )}
                    <div
                      className={cn(
                        'text-4xl font-extrabold font-mono tracking-tight text-foreground tabular-nums select-all',
                        !isRunning &&
                          'cursor-pointer hover:text-primary transition-colors'
                      )}
                      onClick={() => {
                        if (!isRunning) {
                          setIsEditingTime(true);
                          setCustomMinutes(Math.max(1, Math.floor(timeLeft / 60)));
                        }
                      }}
                      title={!isRunning ? 'Click to edit duration' : undefined}
                    >
                      {formatTime(timeLeft)}
                    </div>
                    {!isRunning && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-full opacity-75 md:opacity-0 md:group-hover:opacity-100 transition-all"
                        onClick={() => {
                          const step = mode === 'gym_rest' ? 15 : 60;
                          if (timeLeft < 180 * 60) {
                            adjustDuration(step);
                          }
                        }}
                        title="Increase duration"
                      >
                        <Plus className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                    )}
                  </div>
                )}
                <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1">
                  {MODE_LABELS[mode]}
                </div>
              </div>

              {/* 6-Mode Quick Switcher */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-muted/60 rounded-xl">
                {(
                  [
                    { id: 'focus', label: 'Focus' },
                    { id: 'short_break', label: 'Break' },
                    { id: 'long_break', label: 'Long' },
                    { id: 'starter_2m', label: '2m Start' },
                    { id: 'urge_10m', label: '10m Urge' },
                    { id: 'gym_rest', label: '90s Rest' },
                  ] as const
                ).map((item) => {
                  const itemColor = MODE_COLORS[item.id];
                  const active = mode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        feedback.tap();
                        if (
                          item.id === 'starter_2m' ||
                          item.id === 'urge_10m' ||
                          item.id === 'gym_rest'
                        ) {
                          startPresetTimer(item.id, { openPanel: true });
                        } else {
                          setMode(item.id);
                        }
                      }}
                      className={cn(
                        'py-1.5 text-[11px] font-bold rounded-lg transition-colors',
                        active
                          ? cn(itemColor.pillBg, 'text-white shadow-sm')
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between pt-2 border-t border-border/70">
                <div className="text-xs font-medium text-muted-foreground">
                  Sessions:{' '}
                  <span className="font-bold text-foreground font-mono tabular-nums">
                    {completedSessions}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-xl"
                    onClick={() => {
                      feedback.tap();
                      resetTimer();
                    }}
                    title="Reset Timer"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  {isRunning ? (
                    <Button
                      size="sm"
                      className="h-9 bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-1.5 rounded-xl px-3.5"
                      onClick={() => {
                        feedback.toggle(false);
                        pauseTimer();
                      }}
                    >
                      <Pause className="h-4 w-4 fill-current" />
                      Pause
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className={cn(
                        'h-9 font-semibold gap-1.5 text-white rounded-xl px-3.5',
                        activeColor.pillBg
                      )}
                      onClick={() => {
                        feedback.toggle(true);
                        resumeTimer();
                      }}
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Start
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div key="collapsed-controls" className="flex flex-col items-end gap-2">
              <motion.button
                type="button"
                data-testid="quick-expense-lightning-pill"
                onClick={() => setShowExpenseModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                aria-label="Add expense entry"
                className="inline-flex items-center justify-center h-11 w-11 rounded-full border border-primary/35 shadow-lg bg-card md:bg-card/95 md:backdrop-blur-xl text-primary transition-colors hover:border-primary/60 hover:bg-primary/10"
              >
                <Zap className="h-4 w-4 fill-primary/20" />
              </motion.button>
              <motion.button
                type="button"
                data-testid="pomodoro-live-pill"
                onClick={() => setIsExpanded(true)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                aria-label={
                  isRunning
                    ? `${MODE_LABELS[mode]} ${formatTime(timeLeft)} remaining`
                    : 'Open Focus & Habit Timers'
                }
                className={cn(
                  'inline-flex items-center gap-2 h-11 rounded-full border shadow-lg bg-card md:bg-card/95 md:backdrop-blur-xl text-foreground transition-colors hover:border-primary/40',
                  isRunning ? 'px-3.5 ring-2 ring-primary/15' : 'px-3',
                  activeColor.border
                )}
              >
                <span className="relative flex items-center justify-center">
                  {renderModeIcon()}
                  {isRunning && (
                    <span
                      className={cn(
                        'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full animate-ping',
                        activeColor.dot
                      )}
                    />
                  )}
                </span>
                <span className="text-xs font-semibold font-mono tabular-nums">
                  {isRunning
                    ? `${MODE_PILL_SHORT[mode]} ${formatTime(timeLeft)}`
                    : pendingUrgeReflection
                      ? 'Reflect'
                      : 'Timer'}
                </span>
              </motion.button>
            </div>
          )}
        </AnimatePresence>
      </div>
      {showExpenseModal && (
        <AddTransactionModal
          open={showExpenseModal}
          onOpenChange={setShowExpenseModal}
        />
      )}
    </>
  );
}
