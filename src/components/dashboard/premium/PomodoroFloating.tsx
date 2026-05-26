'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, X, Timer, Coffee, CheckSquare, Plus, Minus, Check } from 'lucide-react';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function PomodoroFloating() {
  const {
    activeTaskId,
    activeTaskTitle,
    mode,
    timeLeft,
    duration,
    isRunning,
    completedSessions,
    pauseTimer,
    resumeTimer,
    resetTimer,
    tick,
    setMode,
    adjustDuration,
  } = usePomodoroStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);

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
      
      // Play a high quality notification sound
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav');
        audio.volume = 0.5;
        audio.play();
      } catch (err) {
        console.warn('Audio play failed:', err);
      }

      if (finishedMode === 'focus') {
        toast.success('Focus session complete! Take a break.', {
          description: activeTaskTitle ? `You finished focusing on: ${activeTaskTitle}` : 'Great job focusing!',
          duration: 5000,
        });
      } else {
        toast.success('Break finished! Let\'s get back to work.', {
          duration: 5000,
        });
      }
    };

    window.addEventListener('pomodoro-complete', handleComplete);
    return () => window.removeEventListener('pomodoro-complete', handleComplete);
  }, [activeTaskTitle]);

  // Widget is always visible in minimized state for general focus session use

  // Format time (e.g. 1500 seconds -> 25:00)
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (timeLeft / duration) * 100 : 0;
  const strokeDashoffset = 113 - (113 * progress) / 100; // circumference is 2 * pi * r = 2 * 3.14 * 18 = 113

  // Color mapping based on mode
  const modeColors = {
    focus: {
      text: 'text-rose-500',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      stroke: 'stroke-rose-500',
      accent: 'rose',
    },
    short_break: {
      text: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      stroke: 'stroke-emerald-500',
      accent: 'emerald',
    },
    long_break: {
      text: 'text-sky-500',
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/20',
      stroke: 'stroke-sky-500',
      accent: 'sky',
    },
  };

  const activeColor = modeColors[mode];

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      <AnimatePresence>
        {!isExpanded ? (
          // Minimized State: circular pulsing progress indicator
          <motion.button
            layoutId="pomodoro-container"
            onClick={() => setIsExpanded(true)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center border shadow-lg backdrop-blur-xl bg-card/95 relative",
              activeColor.border
            )}
            title={activeTaskTitle ? `Focusing: ${activeTaskTitle}` : 'Pomodoro Timer'}
          >
            {/* SVG Progress Ring */}
            <svg className="w-12 h-12 absolute transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="18"
                className="stroke-muted-foreground/10 fill-none"
                strokeWidth="2.5"
              />
              <circle
                cx="24"
                cy="24"
                r="18"
                className={cn("fill-none transition-all duration-300", activeColor.stroke)}
                strokeWidth="2.5"
                strokeDasharray="113"
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className="z-10 flex flex-col items-center">
              {mode === 'focus' ? (
                <Timer className={cn("h-4 w-4", activeColor.text)} />
              ) : (
                <Coffee className={cn("h-4 w-4", activeColor.text)} />
              )}
            </div>
            {isRunning && (
              <span className="absolute top-0 right-0 flex h-2 w-2">
                <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", mode === 'focus' ? "bg-rose-400" : "bg-emerald-400")}></span>
                <span className={cn("relative inline-flex rounded-full h-2 w-2", mode === 'focus' ? "bg-rose-500" : "bg-emerald-500")}></span>
              </span>
            )}
          </motion.button>
        ) : (
          // Expanded State: sleek Pomodoro Dashboard panel
          <motion.div
            layoutId="pomodoro-container"
            className="w-72 bg-card/95 backdrop-blur-xl rounded-2xl border shadow-xl p-4 space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-1.5">
                <Timer className={cn("h-4 w-4", activeColor.text)} />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Focus Timer</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 rounded-full"
                onClick={() => setIsExpanded(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Active Task Info */}
            <div className="bg-muted/40 rounded-xl p-3 border border-border/30">
              <div className="flex items-start gap-2">
                <CheckSquare className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Active Task</p>
                  <p className="text-sm font-semibold truncate mt-0.5 text-foreground leading-tight">
                    {activeTaskTitle || 'General Focus Session'}
                  </p>
                </div>
              </div>
            </div>

            {/* Timer circle & Display */}
            <div className="flex flex-col items-center justify-center py-2 relative">
              {isEditingTime ? (
                <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                  <Input
                    type="number"
                    min="1"
                    max="180"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Math.max(1, Math.min(180, parseInt(e.target.value) || 1)))}
                    className="w-20 text-center text-2xl font-bold font-mono bg-muted/50 border-border h-9 focus-visible:ring-1 focus-visible:ring-ring"
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
                    className="h-8 w-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg cursor-pointer"
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
                    className="h-8 w-8 rounded-lg cursor-pointer"
                    onClick={() => setIsEditingTime(false)}
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-4 group">
                  {!isRunning && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-all hover:scale-110 cursor-pointer"
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
                      "text-4xl font-extrabold font-mono tracking-tight text-foreground tabular-nums select-all",
                      !isRunning && "cursor-pointer hover:text-primary transition-all hover:scale-105 transform duration-200"
                    )}
                    onClick={() => {
                      if (!isRunning) {
                        setIsEditingTime(true);
                        setCustomMinutes(Math.floor(timeLeft / 60));
                      }
                    }}
                    title={!isRunning ? "Click to edit duration" : undefined}
                  >
                    {formatTime(timeLeft)}
                  </div>
                  {!isRunning && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-all hover:scale-110 cursor-pointer"
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
                {mode === 'focus' ? 'Focusing' : mode === 'short_break' ? 'Short Break' : 'Long Break'}
              </div>
            </div>

            {/* Quick Mode Toggle */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-muted/50 rounded-lg">
              <button
                type="button"
                onClick={() => setMode('focus')}
                className={cn(
                  "py-1 text-[10px] font-bold rounded transition-colors",
                  mode === 'focus' ? "bg-rose-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Focus
              </button>
              <button
                type="button"
                onClick={() => setMode('short_break')}
                className={cn(
                  "py-1 text-[10px] font-bold rounded transition-colors",
                  mode === 'short_break' ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Break
              </button>
              <button
                type="button"
                onClick={() => setMode('long_break')}
                className={cn(
                  "py-1 text-[10px] font-bold rounded transition-colors",
                  mode === 'long_break' ? "bg-sky-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Long
              </button>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-xs font-medium text-muted-foreground">
                Sessions: <span className="font-bold text-foreground font-mono">{completedSessions}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-lg"
                  onClick={resetTimer}
                  title="Reset Timer"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                {isRunning ? (
                  <Button
                    size="sm"
                    className="h-8 bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-1.5"
                    onClick={pauseTimer}
                  >
                    <Pause className="h-4 w-4 fill-current" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className={cn(
                      "h-8 font-semibold gap-1.5 text-white",
                      mode === 'focus' ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600"
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
        )}
      </AnimatePresence>
    </div>
  );
}
