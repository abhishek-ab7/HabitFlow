'use client';

import React from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { CheckCircle2, Pause, Play, Sparkles, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';

export interface AIPriorityInfo {
  suggestedPriority: string;
  reasoning: string;
  urgencyScore: number;
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'border-blue-500/30 bg-blue-500/5 text-blue-500 shadow-[0_0_15px_-5px_rgba(59,130,246,0.3)]',
  medium: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-500 shadow-[0_0_15px_-5px_rgba(234,179,8,0.3)]',
  high: 'border-red-500/30 bg-red-500/5 text-red-500 shadow-[0_0_15px_-5px_rgba(239,68,68,0.3)]',
};

function formatMinutesSeconds(secs: number): string {
  const mins = Math.floor(secs / 60);
  const remaining = secs % 60;
  return `${mins}:${remaining.toString().padStart(2, '0')}`;
}

export function ActiveTaskTimerPill() {
  const { isRunning, timeLeft, pauseTimer, resumeTimer } = usePomodoroStore(
    useShallow((s) => ({
      isRunning: s.isRunning,
      timeLeft: s.timeLeft,
      pauseTimer: s.pauseTimer,
      resumeTimer: s.resumeTimer,
    }))
  );

  if (isRunning) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={(e) => { e.stopPropagation(); pauseTimer(); }}
        className="h-6 px-2 text-[10px] gap-1 text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 rounded-md font-semibold"
      >
        <Pause className="h-3 w-3 fill-current animate-pulse" />
        <span>Focusing ({formatMinutesSeconds(timeLeft)})</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={(e) => { e.stopPropagation(); resumeTimer(); }}
      className="h-6 px-2 text-[10px] gap-1 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 rounded-md font-semibold"
    >
      <Play className="h-3 w-3 fill-current" />
      <span>Paused ({formatMinutesSeconds(timeLeft)})</span>
    </Button>
  );
}

export function TaskCardSwipeBackdrop(params: {
  checkOpacity: MotionValue<number>;
  checkScale: MotionValue<number>;
  trashOpacity: MotionValue<number>;
  trashScale: MotionValue<number>;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-between pointer-events-none rounded-2xl">
      <motion.div
        style={{ opacity: params.checkOpacity }}
        className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-emerald-500/80 to-emerald-500/10 flex items-center pl-6 rounded-l-2xl"
      >
        <motion.div style={{ scale: params.checkScale }}>
          <CheckCircle2 className="h-6 w-6 text-white stroke-[2.5] drop-shadow-md" />
        </motion.div>
      </motion.div>

      <motion.div
        style={{ opacity: params.trashOpacity }}
        className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-red-500/80 to-red-500/10 flex items-center justify-end pr-6 rounded-r-2xl"
      >
        <motion.div style={{ scale: params.trashScale }}>
          <Trash2 className="h-6 w-6 text-white drop-shadow-md" />
        </motion.div>
      </motion.div>
    </div>
  );
}

export function TaskPriorityBadges({ priority, aiPriority, compact }: { priority?: string; aiPriority: AIPriorityInfo | null; compact?: boolean }) {
  return (
    <>
      {priority && (
        <span className={cn('px-1.5 py-0.5 text-[8px] uppercase tracking-widest rounded-md border font-bold transition-all', PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium)}>
          {priority.charAt(0)}
        </span>
      )}
      {aiPriority && !compact && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="flex items-center gap-1 border-invest/35 bg-invest/10 text-invest text-[8px] px-1.5 py-0.5">
                <Sparkles className="h-2.5 w-2.5" />
                AI: {aiPriority.suggestedPriority.charAt(0).toUpperCase()}
                <span className="ml-0.5">({aiPriority.urgencyScore})</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p className="text-sm">{aiPriority.reasoning}</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  );
}

export function TaskSubtaskProgressBar({ completed, total }: { completed: number; total: number }) {
  const progress = total > 0 ? (completed / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        <span>Progress</span>
        <span>{completed}/{total}</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={cn(
            'h-full rounded-full transition-all duration-500',
            progress === 100 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-primary to-primary/60'
          )}
        />
      </div>
    </div>
  );
}
