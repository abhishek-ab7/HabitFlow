'use client';

import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, X, CheckSquare } from 'lucide-react';
import type { PomodoroMode } from '@/lib/stores/pomodoro-store';
import type { useFeedback } from '@/hooks/use-feedback';
import { MODE_COLORS, MODE_LABELS, MODE_OPTIONS } from '@/lib/pomodoro/pomodoro-helpers';
import {
  ModeIcon,
  PomodoroTimerDisplay,
  UrgeReflectionPrompt,
} from './PomodoroTimerControls';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PomodoroExpandedPanel(props: {
  mode: PomodoroMode;
  activeColor: (typeof MODE_COLORS)[PomodoroMode];
  activeTaskTitle: string | null | undefined;
  timeLeft: number;
  isRunning: boolean;
  completedSessions: number;
  pendingUrgeReflection: boolean;
  urgeHabitName: string | null | undefined;
  isEditingTime: boolean;
  customMinutes: number;
  setCustomMinutes: (m: number) => void;
  setIsEditingTime: (v: boolean) => void;
  adjustDuration: (deltaSecs: number) => void;
  resolveUrgeReflection: (outcome: 'passed' | 'gave_in') => void;
  startPresetTimer: (m: 'starter_2m' | 'urge_10m' | 'gym_rest', opts?: { openPanel?: boolean }) => void;
  setMode: (m: PomodoroMode) => void;
  resetTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  onMinimize: () => void;
  feedback: ReturnType<typeof useFeedback>;
}) {
  const {
    mode, activeColor, activeTaskTitle, timeLeft, isRunning, completedSessions,
    pendingUrgeReflection, urgeHabitName, isEditingTime, customMinutes,
    setCustomMinutes, setIsEditingTime, adjustDuration, resolveUrgeReflection,
    startPresetTimer, setMode, resetTimer, pauseTimer, resumeTimer, onMinimize, feedback,
  } = props;

  return (
    <motion.div
      key="pomodoro-panel"
      initial={{ opacity: 0, scale: 0.92, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 10 }}
      transition={{ duration: 0.18 }}
      className="w-[min(19.5rem,calc(100vw-2rem))] bg-card md:bg-card/95 md:backdrop-blur-xl rounded-2xl border border-border shadow-2xl p-4 space-y-3.5"
    >
      <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
        <div className="flex items-center gap-1.5">
          <ModeIcon mode={mode} colorClass={activeColor.text} />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{MODE_LABELS[mode]}</span>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={onMinimize} aria-label="Minimize focus timer">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {pendingUrgeReflection && (
        <UrgeReflectionPrompt urgeHabitName={urgeHabitName} onResolve={resolveUrgeReflection} feedback={feedback} />
      )}

      <div className="bg-muted/50 rounded-xl p-2.5 border border-border/50">
        <div className="flex items-start gap-2">
          <CheckSquare className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Active Session</p>
            <p className="text-sm font-semibold truncate mt-0.5 text-foreground leading-tight">{activeTaskTitle || MODE_LABELS[mode]}</p>
          </div>
        </div>
      </div>

      <PomodoroTimerDisplay
        mode={mode}
        timeLeft={timeLeft}
        isRunning={isRunning}
        isEditingTime={isEditingTime}
        customMinutes={customMinutes}
        setCustomMinutes={setCustomMinutes}
        setIsEditingTime={setIsEditingTime}
        adjustDuration={adjustDuration}
      />

      <div className="grid grid-cols-3 gap-1 p-1 bg-muted/60 rounded-xl">
        {MODE_OPTIONS.map((item) => {
          const itemColor = MODE_COLORS[item.id];
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                feedback.tap();
                if (item.id === 'starter_2m' || item.id === 'urge_10m' || item.id === 'gym_rest') {
                  startPresetTimer(item.id, { openPanel: true });
                } else {
                  setMode(item.id);
                }
              }}
              className={cn(
                'py-1.5 text-[11px] font-bold rounded-lg transition-colors',
                active ? cn(itemColor.pillBg, 'text-white shadow-sm') : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/70">
        <div className="text-xs font-medium text-muted-foreground">
          Sessions: <span className="font-bold text-foreground font-mono tabular-nums">{completedSessions}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={() => { feedback.tap(); resetTimer(); }} title="Reset Timer">
            <RotateCcw className="h-4 w-4" />
          </Button>
          {isRunning ? (
            <Button size="sm" className="h-9 bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-1.5 rounded-xl px-3.5" onClick={() => { feedback.toggle(false); pauseTimer(); }}>
              <Pause className="h-4 w-4 fill-current" />
              Pause
            </Button>
          ) : (
            <Button size="sm" className={cn('h-9 font-semibold gap-1.5 text-white rounded-xl px-3.5', activeColor.pillBg)} onClick={() => { feedback.toggle(true); resumeTimer(); }}>
              <Play className="h-4 w-4 fill-current" />
              Start
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
