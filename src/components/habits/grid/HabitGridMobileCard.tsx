'use client';

import React from 'react';
import { format } from 'date-fns';
import { Archive, Check, Edit3, Flame, Moon, MoreHorizontal, Pencil, Shield, ShieldCheck, Snowflake, Timer, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Habit, HabitCompletion } from '@/lib/types';
import { CATEGORY_COLORS, getCellStatusInfo, getStreakStyle, type CellStatusInfo, type HabitDayInfo } from '../row/habit-row-helpers';

const MOBILE_CELL_STYLE_RULES: Array<{ match: (s: CellStatusInfo, d: HabitDayInfo) => boolean; cls: string }> = [
  { match: (s) => s.isCompleted, cls: 'bg-success/15 border-success/30 text-success' },
  { match: (s) => s.isRest, cls: 'bg-teal-500/15 border-teal-500/30 text-teal-600 dark:text-teal-400' },
  { match: (s) => s.isFrozen, cls: 'bg-sky-500/15 border-sky-500/30 text-sky-500' },
  { match: (s) => s.isAutoRest, cls: 'bg-muted/20 border-dashed border-border/60 text-muted-foreground/60' },
  { match: (_s, d) => d.isFuture, cls: 'bg-muted/10 border-transparent opacity-30 cursor-not-allowed' },
  { match: (_s, d) => d.isToday, cls: 'bg-primary/5 border-dashed border-primary text-primary font-bold' },
];

const DEFAULT_MOBILE_CELL_CLS =
  'bg-muted/65 border-border/70 text-foreground/75 hover:bg-muted dark:bg-muted/45 dark:border-border/60 dark:text-muted-foreground';

function MobileDayCellIcon({ habit, isQuit, status, day }: { habit: Habit; isQuit: boolean; status: CellStatusInfo; day: number }) {
  if (status.isCompleted) return isQuit ? <ShieldCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5 stroke-[3]" />;
  if (status.isRest || status.isAutoRest) return <Moon className="h-3.5 w-3.5" />;
  if (status.isFrozen) return <Snowflake className="h-3 w-3" />;
  const quantValue = habit.isQuantitative ? (status.comp?.value ?? 0) : 0;
  if (quantValue > 0) return <span className="text-xs font-mono font-bold leading-none">{quantValue}</span>;
  return <span className="text-[11px] font-bold leading-none">{day}</span>;
}

function MobileHabitBadges(params: {
  habit: Habit;
  streak: number;
  isQuit: boolean;
  weekProg: { targetCount: number; completedCount: number; quotaMet: boolean };
  onStartUrgeTimer: () => void;
}) {
  const { habit, streak, isQuit, weekProg } = params;
  return (
    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
      <Badge variant="secondary" className={cn('text-[9px] px-1.5 py-0 h-4 font-bold uppercase tracking-wider', CATEGORY_COLORS[habit.category])}>{habit.category}</Badge>
      {habit.anchorBlock && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 capitalize text-muted-foreground">{habit.anchorBlock}</Badge>}
      {weekProg.targetCount < 7 && (
        <Badge variant="secondary" className={cn('text-[9px] px-1.5 py-0 h-4 font-mono tabular-nums', weekProg.quotaMet ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-teal-500/10 text-teal-600 dark:text-teal-400')}>
          {weekProg.completedCount}/{weekProg.targetCount} wk {weekProg.quotaMet ? '✓' : ''}
        </Badge>
      )}
      {isQuit ? (
        <>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 gap-0.5"><Shield className="h-2.5 w-2.5" /> Quit</Badge>
          <Badge variant="secondary" className={cn('text-[9px] px-1.5 py-0 h-4 font-bold gap-0.5 font-mono tabular-nums', streak > 0 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' : 'bg-muted text-muted-foreground')}>
            <ShieldCheck className="h-2.5 w-2.5" /> {streak > 0 ? `${streak}d · Clean so far` : 'Clean so far'}
          </Badge>
          <button type="button" onClick={params.onStartUrgeTimer} className="inline-flex items-center gap-0.5 px-1.5 py-0 h-4 rounded-full border border-violet-500/35 bg-violet-500/10 text-[9px] font-bold text-violet-600 dark:text-violet-400">
            <Timer className="h-2.5 w-2.5" /> 10m Urge
          </button>
        </>
      ) : (
        streak > 0 && <Badge variant="secondary" className={cn('text-[9px] px-1.5 py-0 h-4 font-bold gap-0.5 font-mono tabular-nums', getStreakStyle(streak))}><Flame className="h-2.5 w-2.5 fill-current" />{streak}d</Badge>
      )}
    </div>
  );
}

function MobileHabitMenu(params: {
  isQuit: boolean;
  restAllowedCount: number;
  isRestedToday: boolean;
  restRemainingCount: number;
  onEdit: () => void;
  onOpenLogModal: () => void;
  onStartUrgeTimer: () => void;
  onMobileRest: () => void;
  onMobileFreeze: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={params.onEdit}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={params.onOpenLogModal}><Edit3 className="h-4 w-4 mr-2 text-amber-500" /> Log Notes / Progress</DropdownMenuItem>
        {params.isQuit && <DropdownMenuItem onClick={params.onStartUrgeTimer}><Timer className="h-4 w-4 mr-2 text-violet-500" /> Start 10m Urge Timer</DropdownMenuItem>}
        {params.restAllowedCount > 0 && (
          <DropdownMenuItem onClick={params.onMobileRest}>
            <Moon className="h-4 w-4 mr-2 text-teal-500" />
            {params.isRestedToday ? 'Clear Rest Today' : `Rest Today (${params.restRemainingCount} left)`}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={params.onMobileFreeze}><Snowflake className="h-4 w-4 mr-2" /> Freeze Today</DropdownMenuItem>
        <DropdownMenuItem onClick={params.onArchive}><Archive className="h-4 w-4 mr-2" /> Archive</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={params.onDelete} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function HabitGridMobileCard(params: {
  habit: Habit;
  streak: number;
  completions: HabitCompletion[];
  habitsCompletionsMap: Map<string, HabitCompletion>;
  weekProg: { targetCount: number; completedCount: number; quotaMet: boolean; restAllowedCount: number; restRemainingCount: number; isRestedToday: boolean };
  mobileDays: HabitDayInfo[];
  onToggleDay: (dateStr: string, isCompleted: boolean) => void;
  onEdit: () => void;
  onOpenLogModal: () => void;
  onStartUrgeTimer: () => void;
  onMobileRest: (dateStr: string) => void;
  onMobileFreeze: (dateStr: string) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { habit, streak, completions, habitsCompletionsMap, weekProg, mobileDays } = params;
  const isQuit = habit.polarity === 'quit';
  const todayIso = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="cv-auto bg-card border rounded-2xl p-4 shadow-sm space-y-4 relative overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {habit.icon && <span className="text-2xl shrink-0 p-2 bg-muted rounded-xl">{habit.icon}</span>}
          <div className="min-w-0">
            <h4 className="font-bold text-sm text-foreground leading-tight break-words">{habit.name}</h4>
            <MobileHabitBadges habit={habit} streak={streak} isQuit={isQuit} weekProg={weekProg} onStartUrgeTimer={params.onStartUrgeTimer} />
          </div>
        </div>
        <MobileHabitMenu
          isQuit={isQuit}
          restAllowedCount={weekProg.restAllowedCount}
          isRestedToday={weekProg.isRestedToday}
          restRemainingCount={weekProg.restRemainingCount}
          onEdit={params.onEdit}
          onOpenLogModal={params.onOpenLogModal}
          onStartUrgeTimer={params.onStartUrgeTimer}
          onMobileRest={() => params.onMobileRest(todayIso)}
          onMobileFreeze={() => params.onMobileFreeze(todayIso)}
          onArchive={params.onArchive}
          onDelete={params.onDelete}
        />
      </div>

      {habit.isQuantitative && (
        <div className="text-[10px] text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded-md w-fit">
          Target: {habit.targetValue} {habit.unit}
        </div>
      )}

      <div className="grid grid-cols-5 gap-1.5">
        {mobileDays.map((dayInfo) => {
          const status = getCellStatusInfo({ habit, completions, comp: habitsCompletionsMap.get(dayInfo.dateStr), dateStr: dayInfo.dateStr });
          const cellCls = MOBILE_CELL_STYLE_RULES.find((r) => r.match(status, dayInfo))?.cls ?? DEFAULT_MOBILE_CELL_CLS;
          return (
            <button
              key={dayInfo.dateStr}
              onClick={() => { if (!dayInfo.isFuture) params.onToggleDay(dayInfo.dateStr, status.isCompleted); }}
              disabled={dayInfo.isFuture}
              className={cn('h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden border', cellCls)}
            >
              <span className="text-[9px] font-bold uppercase opacity-60">{dayInfo.dayLabel}</span>
              <MobileDayCellIcon habit={habit} isQuit={isQuit} status={status} day={dayInfo.day} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
