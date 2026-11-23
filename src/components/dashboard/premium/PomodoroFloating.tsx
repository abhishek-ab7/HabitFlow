'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function PomodoroFloating() {
  const {
    activeTaskTitle,
    mode,
    timeLeft,
    isRunning,
    completedSessions,
    pauseTimer,
    resumeTimer,
    resetTimer,
    tick,
    setMode,
    adjustDuration,
  } = usePomodoroStore();

  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);

  const isAppRoute =
    pathname !== '/' && pathname !== '/login' && !pathname.startsWith('/auth');

  // Sync typed minutes when not editing
  useEffect(() => {
    if (!isEditingTime) {
      setCustomMinutes(Math.floor(timeLeft / 60));
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

  // Audio / notification feedback on completion
  useEffect(() => {
    const handleComplete = (e: Event) => {
      const customEvent = e as CustomEvent;
      const finishedMode = customEvent.detail.mode;

      try {
        const audio = new Audio(
          'https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav'
        );
        audio.volume = 0.5;
        audio.play();
      } catch (err) {
        console.warn('Audio play failed:', err);
      }

      if (finishedMode === 'focus') {
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
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs
      .toString()
      .padStart(2, '0')}`;
  };

  const modeColors = {
    focus: {
      text: 'text-rose-500',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/25',
      stroke: 'stroke-rose-500',
    },
    short_break: {
      text: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/25',
      stroke: 'stroke-emerald-500',
    },
    long_break: {
      text: 'text-sky-500',
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/25',
      stroke: 'stroke-sky-500',
    },
  };

  const activeColor = modeColors[mode];

  const handleMobileAddEntry = () => {
    if (pathname.startsWith('/finance')) {
      window.dispatchEvent(new CustomEvent('open-finance-add-entry'));
    } else {
      router.push('/finance?add=1');
    }
  };

  return (
    <>
      {/* Floating Container — Mobile direct + Add Entry above bottom nav; Desktop single Pomodoro pill at bottom-right */}
      <div className="fixed bottom-[76px] right-4 md:bottom-6 md:right-6 z-50 select-none flex flex-col items-end gap-2.5">
        <AnimatePresence mode="wait">
          {isExpanded ? (
            /* Expanded Pomodoro Panel (Shared Mobile + Desktop) */
            <motion.div
              key="pomodoro-panel"
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ duration: 0.18 }}
              className="w-[min(18rem,calc(100vw-2rem))] bg-card md:bg-card/95 md:backdrop-blur-xl rounded-2xl border border-border shadow-2xl p-4 space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <Timer className={cn('h-4 w-4', activeColor.text)} />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Focus Timer
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

              {/* Active Task Info */}
              <div className="bg-muted/50 rounded-xl p-3 border border-border/50">
                <div className="flex items-start gap-2">
                  <CheckSquare className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Active Task
                    </p>
                    <p className="text-sm font-semibold truncate mt-0.5 text-foreground leading-tight">
                      {activeTaskTitle || 'General Focus Session'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timer Display */}
              <div className="flex flex-col items-center justify-center py-1 relative">
                {isEditingTime ? (
                  <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                    <Input
                      type="number"
                      min="1"
                      max="180"
                      value={customMinutes}
                      onChange={(e) =>
                        setCustomMinutes(
                          Math.max(1, Math.min(180, parseInt(e.target.value) || 1))
                        )
                      }
                      className="w-20 text-center text-2xl font-bold font-mono bg-muted/50 border-border h-10 focus-visible:ring-1 focus-visible:ring-ring"
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
                      className="h-9 w-9 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg cursor-pointer"
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
                      className="h-9 w-9 rounded-lg cursor-pointer"
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
                        className="h-9 w-9 rounded-full opacity-75 md:opacity-0 md:group-hover:opacity-100 transition-all cursor-pointer"
                        onClick={() => {
                          if (timeLeft > 60) {
                            adjustDuration(-60);
                            toast.success('Reduced duration by 1 minute');
                          } else {
                            toast.error('Minimum duration is 1 minute');
                          }
                        }}
                        title="Decrease 1 minute"
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
                          setCustomMinutes(Math.floor(timeLeft / 60));
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
                        className="h-9 w-9 rounded-full opacity-75 md:opacity-0 md:group-hover:opacity-100 transition-all cursor-pointer"
                        onClick={() => {
                          if (timeLeft < 180 * 60) {
                            adjustDuration(60);
                            toast.success('Increased duration by 1 minute');
                          } else {
                            toast.error('Maximum duration is 180 minutes');
                          }
                        }}
                        title="Increase 1 minute"
                      >
                        <Plus className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                    )}
                  </div>
                )}
                <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1.5">
                  {mode === 'focus'
                    ? 'Focusing'
                    : mode === 'short_break'
                    ? 'Short Break'
                    : 'Long Break'}
                </div>
              </div>

              {/* Quick Mode Toggle */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-muted/60 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMode('focus')}
                  className={cn(
                    'py-1.5 text-[11px] font-bold rounded-lg transition-colors',
                    mode === 'focus'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Focus
                </button>
                <button
                  type="button"
                  onClick={() => setMode('short_break')}
                  className={cn(
                    'py-1.5 text-[11px] font-bold rounded-lg transition-colors',
                    mode === 'short_break'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Break
                </button>
                <button
                  type="button"
                  onClick={() => setMode('long_break')}
                  className={cn(
                    'py-1.5 text-[11px] font-bold rounded-lg transition-colors',
                    mode === 'long_break'
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Long
                </button>
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
                    onClick={resetTimer}
                    title="Reset Timer"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  {isRunning ? (
                    <Button
                      size="sm"
                      className="h-9 bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-1.5 rounded-xl px-3.5"
                      onClick={pauseTimer}
                    >
                      <Pause className="h-4 w-4 fill-current" />
                      Pause
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className={cn(
                        'h-9 font-semibold gap-1.5 text-white rounded-xl px-3.5',
                        mode === 'focus'
                          ? 'bg-rose-500 hover:bg-rose-600'
                          : 'bg-emerald-500 hover:bg-emerald-600'
                      )}
                      onClick={resumeTimer}
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Resume
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div key="collapsed-controls" className="flex flex-col items-end gap-2">
              {/* DESKTOP: Single collapsible Pomodoro pill (Quick Capture lives in top navbar) */}
              <motion.button
                type="button"
                onClick={() => setIsExpanded(true)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  'hidden md:inline-flex items-center gap-2 h-11 rounded-full border shadow-md bg-card/95 backdrop-blur-xl text-foreground transition-colors hover:border-primary/40',
                  isRunning ? 'px-3.5' : 'px-3',
                  activeColor.border
                )}
                title={
                  activeTaskTitle
                    ? `Focusing: ${activeTaskTitle}`
                    : 'Focus Timer (Pomodoro)'
                }
              >
                <span className="relative flex items-center justify-center">
                  {mode === 'focus' ? (
                    <Timer className={cn('h-4 w-4', activeColor.text)} />
                  ) : (
                    <Coffee className={cn('h-4 w-4', activeColor.text)} />
                  )}
                </span>
                <span className="text-xs font-semibold font-mono tabular-nums">
                  {isRunning ? formatTime(timeLeft) : 'Focus'}
                </span>
              </motion.button>

              {/* MOBILE: Direct single-tap + Add Entry button above bottom navbar */}
              <motion.button
                type="button"
                onClick={handleMobileAddEntry}
                whileTap={{ scale: 0.95 }}
                aria-label="Add Entry"
                className="md:hidden inline-flex items-center gap-1.5 h-12 px-4 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 font-semibold text-sm active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Entry</span>
              </motion.button>
            </div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
