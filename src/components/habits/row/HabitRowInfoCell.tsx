'use client';

import React from 'react';
import { format } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import {
  Archive, Edit3, Flame, GripVertical, Moon, MoreHorizontal, Pencil, Share2, Shield, ShieldCheck, Timer, Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Habit } from '@/lib/types';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { useHabitStore } from '@/lib/stores/habit-store';
import { toast } from 'sonner';
import { StreakRecoveryPrompt } from '../StreakRecoveryPrompt';
import { CATEGORY_COLORS, getStreakStyle } from './habit-row-helpers';

async function recoverHabitStreak(habit: Habit, yesterdayStr: string) {
  const { ensureComplete, updateNote, updateValue } = useHabitStore.getState();
  await ensureComplete(habit.id, yesterdayStr);
  await updateNote(habit.id, yesterdayStr, 'Recovered via double completion.');

  const todayStr = getLocalIsoDate();
  await ensureComplete(habit.id, todayStr);
  if (habit.isQuantitative) {
    await updateValue(habit.id, todayStr, (habit.targetValue || 1) * 2);
  } else {
    await updateNote(habit.id, todayStr, 'Double completion!');
  }
  toast.success('Streak recovered! Completed double task today.');
}

function QuitHabitBadges(params: { habit: Habit; streak: number; onStartUrgeTimer: () => void }) {
  const { streak, onStartUrgeTimer } = params;
  return (
    <>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 gap-0.5">
        <Shield className="h-2.5 w-2.5" /> Quit
      </Badge>
      <Badge
        variant="secondary"
        className={cn(
          'text-[10px] px-1.5 py-0 h-4 gap-0.5 font-mono tabular-nums',
          streak > 0 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' : 'bg-muted text-muted-foreground border border-border/60'
        )}
      >
        <ShieldCheck className="h-2.5 w-2.5" />
        {streak > 0 ? `${streak}d · Clean so far` : 'Clean so far'}
      </Badge>
      <button
        type="button"
        onClick={onStartUrgeTimer}
        className="inline-flex items-center gap-0.5 px-1.5 py-0 h-4 rounded-full border border-violet-500/35 bg-violet-500/10 text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-colors"
        title="Launch 10-Min Urge Timer"
      >
        <Timer className="h-2.5 w-2.5" /> 10m Urge
      </button>
    </>
  );
}

function HabitRowActionsMenu(params: {
  habit: Habit;
  isQuit: boolean;
  restAllowedCount: number;
  isRestedToday: boolean;
  restRemainingCount: number;
  onEdit: () => void;
  onOpenLogModal: () => void;
  onStartUrgeTimer: () => void;
  onToggleRestToday: () => void;
  onShare: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={params.onEdit}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={params.onOpenLogModal}><Edit3 className="h-4 w-4 mr-2" /> Log Notes / Progress</DropdownMenuItem>
        {params.isQuit && (
          <DropdownMenuItem onClick={params.onStartUrgeTimer}><Timer className="h-4 w-4 mr-2 text-violet-500" /> Start 10m Urge Timer</DropdownMenuItem>
        )}
        {params.restAllowedCount > 0 && (
          <DropdownMenuItem onClick={params.onToggleRestToday}>
            <Moon className="h-4 w-4 mr-2 text-teal-500" />
            {params.isRestedToday ? 'Clear Rest Day Today' : `Mark Rest Today (${params.restRemainingCount} left)`}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={params.onShare}><Share2 className="h-4 w-4 mr-2" /> Share Streak</DropdownMenuItem>
        <DropdownMenuItem onClick={params.onArchive}><Archive className="h-4 w-4 mr-2" /> Archive</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={params.onDelete} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function HabitRowInfoCell(params: {
  habit: Habit;
  streak: number;
  isQuit: boolean;
  weekProgress: {
    targetCount: number;
    completedCount: number;
    quotaMet: boolean;
    restAllowedCount: number;
    restRemainingCount: number;
    isRestedToday: boolean;
  };
  isStreakBrokenYesterday: boolean;
  showRecovery: boolean;
  setShowRecovery: React.Dispatch<React.SetStateAction<boolean>>;
  yesterdayStr: string;
  dragAttributes: Record<string, unknown>;
  dragListeners?: Record<string, unknown>;
  onStartUrgeTimer: () => void;
  onEdit: () => void;
  onOpenLogModal: () => void;
  onToggleRestDay: (dateStr: string) => void;
  onShare: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { habit, streak, isQuit, weekProgress } = params;
  return (
    <div className="w-44 md:w-64 shrink-0 flex items-center gap-2 pr-3 sticky left-0 bg-background z-10 border-r border-border/40">
      <div {...params.dragAttributes} {...params.dragListeners} className="touch-none cursor-grab hover:text-foreground text-muted-foreground/50 active:cursor-grabbing p-1 -ml-2">
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 min-w-0">
          {habit.icon && <span className="text-lg shrink-0 mt-0.5">{habit.icon}</span>}
          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm break-normal whitespace-normal leading-tight block">{habit.name}</span>
            {habit.isQuantitative && <span className="text-[10px] text-muted-foreground font-mono block">Target: {habit.targetValue} {habit.unit}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-4', CATEGORY_COLORS[habit.category])}>{habit.category}</Badge>
          {habit.anchorBlock && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize text-muted-foreground">{habit.anchorBlock}</Badge>}
          {weekProgress.targetCount < 7 && (
            <Badge
              variant="secondary"
              className={cn('text-[10px] px-1.5 py-0 h-4 font-mono tabular-nums', weekProgress.quotaMet ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-teal-500/10 text-teal-600 dark:text-teal-400')}
              title={`${weekProgress.restRemainingCount} flexible rest day(s) remaining this week`}
            >
              {weekProgress.completedCount}/{weekProgress.targetCount} wk {weekProgress.quotaMet ? '✓' : ''}
            </Badge>
          )}
          {isQuit ? (
            <QuitHabitBadges habit={habit} streak={streak} onStartUrgeTimer={params.onStartUrgeTimer} />
          ) : (
            streak > 0 && <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-4 gap-0.5 font-mono tabular-nums', getStreakStyle(streak))}><Flame className="h-2.5 w-2.5" />{streak}</Badge>
          )}
          {params.isStreakBrokenYesterday && (
            <div className="relative">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-red-500/10 border-red-500/20 text-red-500 animate-pulse cursor-pointer hover:bg-red-500/20" onClick={() => params.setShowRecovery(true)}>
                Recover
              </Badge>
              <AnimatePresence>
                {params.showRecovery && (
                  <StreakRecoveryPrompt
                    habit={habit}
                    dateStr={params.yesterdayStr}
                    onRecover={async () => { await recoverHabitStreak(habit, params.yesterdayStr); params.setShowRecovery(false); }}
                    onDismiss={() => params.setShowRecovery(false)}
                  />
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <HabitRowActionsMenu
        habit={habit}
        isQuit={isQuit}
        restAllowedCount={weekProgress.restAllowedCount}
        isRestedToday={weekProgress.isRestedToday}
        restRemainingCount={weekProgress.restRemainingCount}
        onEdit={params.onEdit}
        onOpenLogModal={params.onOpenLogModal}
        onStartUrgeTimer={params.onStartUrgeTimer}
        onToggleRestToday={() => params.onToggleRestDay(format(new Date(), 'yyyy-MM-dd'))}
        onShare={params.onShare}
        onArchive={params.onArchive}
        onDelete={params.onDelete}
      />
    </div>
  );
}
