'use client';

import React from 'react';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Moon, Pencil, ShieldCheck, Snowflake } from 'lucide-react';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SuccessRipple } from '@/components/motion';
import { cn } from '@/lib/utils';
import type { Habit, HabitCompletion } from '@/lib/types';
import {
  getCellBackgroundClass,
  getCellDataStatus,
  getCellStatusInfo,
  type CellStatusInfo,
  type HabitDayInfo,
} from './habit-row-helpers';
import { HabitCellPopover } from './HabitCellPopover';

function CellCompletionIcon({ habit, isQuit, status }: { habit: Habit; isQuit: boolean; status: CellStatusInfo }) {
  if (status.isCompleted) return isQuit ? <ShieldCheck className="h-4 w-4" /> : <Check className="h-4 w-4" />;
  if (status.isRest) return <Moon className="h-3.5 w-3.5" />;
  if (status.isFrozen) return <Snowflake className="h-4 w-4" />;
  if (status.isAutoRest) return <Moon className="h-3 w-3 opacity-60" />;
  const quantValue = habit.isQuantitative ? (status.comp?.value ?? 0) : 0;
  return quantValue > 0 ? <span className="text-xs font-bold font-mono">{quantValue}</span> : null;
}

function CellBurstBadge({ visible, isFrozen, isQuit }: { visible: boolean; isFrozen: boolean; isQuit: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          initial={{ opacity: 0, y: 8, scale: 0.8 }}
          animate={{ opacity: 1, y: -26, scale: 1.1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 text-[10px] font-extrabold drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] z-30 pointer-events-none whitespace-nowrap',
            isFrozen ? 'text-sky-500 dark:text-sky-400' : 'text-emerald-500 dark:text-emerald-400'
          )}
        >
          {isFrozen ? 'STREAK SAFE' : isQuit ? 'CLEAN DAY' : 'Done'}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function CellButtonWithTooltip(params: {
  button: React.ReactElement;
  dayInfo: HabitDayInfo;
  comp?: HabitCompletion;
}) {
  const note = params.comp?.note;
  if (!note) return params.button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{params.button}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs p-2.5 space-y-1 bg-popover text-popover-foreground border shadow-md">
        <p className="font-semibold text-[10px] text-muted-foreground/80">{format(new Date(params.dayInfo.dateStr), 'MMM d, yyyy')}</p>
        <p className="text-xs leading-relaxed italic">&quot;{note}&quot;</p>
      </TooltipContent>
    </Tooltip>
  );
}

function CellPopoverControl(params: {
  habit: Habit;
  dateStr: string;
  isFutureDate: boolean;
  status: CellStatusInfo;
  isPopoverOpen: boolean;
  setOpenPopoverDate: React.Dispatch<React.SetStateAction<string | null>>;
  tempValue: number;
  setTempValue: React.Dispatch<React.SetStateAction<number>>;
  tempNote: string;
  setTempNote: React.Dispatch<React.SetStateAction<string>>;
  restAllowedCount: number;
  restRemainingCount: number;
  hasOnFreeze: boolean;
  onOpenPopover: () => void;
  onSavePopover: () => void;
  onToggleRestDay: () => Promise<void>;
  onCellRightClick: (e: React.MouseEvent) => Promise<void>;
}) {
  const { dateStr, isFutureDate, status, isPopoverOpen, setOpenPopoverDate } = params;
  if (isFutureDate) return null;

  return (
    <Popover open={isPopoverOpen} onOpenChange={(open) => (open ? params.onOpenPopover() : setOpenPopoverDate(null))}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center border shadow-sm transition-all z-20',
            status.comp?.note ? 'opacity-100 bg-amber-500 text-white border-amber-600' : 'opacity-0 group-hover/cell:opacity-100 bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground touch-hover-hide'
          )}
          title="Add note / edit count"
        >
          <Pencil className="h-2 w-2" />
        </button>
      </PopoverTrigger>
      {isPopoverOpen && (
        <HabitCellPopover
          habit={params.habit}
          dateStr={dateStr}
          tempValue={params.tempValue}
          setTempValue={params.setTempValue}
          tempNote={params.tempNote}
          setTempNote={params.setTempNote}
          restAllowedCount={params.restAllowedCount}
          restRemainingCount={params.restRemainingCount}
          isRest={status.isRest}
          isFrozen={status.isFrozen}
          hasOnFreeze={params.hasOnFreeze}
          onToggleRest={async () => { await params.onToggleRestDay(); setOpenPopoverDate(null); }}
          onToggleFreeze={async (e) => { await params.onCellRightClick(e); setOpenPopoverDate(null); }}
          onClose={() => setOpenPopoverDate(null)}
          onSave={params.onSavePopover}
        />
      )}
    </Popover>
  );
}

export const HabitDayCell = React.memo(function HabitDayCell(params: {
  habit: Habit;
  isQuit: boolean;
  dayInfo: HabitDayInfo;
  completions: HabitCompletion[];
  comp?: HabitCompletion;
  restAllowedCount: number;
  restRemainingCount: number;
  isRippling: boolean;
  isBurst: boolean;
  isPopoverOpen: boolean;
  setOpenPopoverDate: React.Dispatch<React.SetStateAction<string | null>>;
  tempValue: number;
  setTempValue: React.Dispatch<React.SetStateAction<number>>;
  tempNote: string;
  setTempNote: React.Dispatch<React.SetStateAction<string>>;
  hasOnFreeze: boolean;
  onCellClick: (params: { dateStr: string; isFutureDate: boolean; isShiftKey: boolean }) => void;
  onCellRightClick: (params: { e: React.MouseEvent; dateStr: string; isFutureDate: boolean }) => Promise<void>;
  onToggleRestDay: (dateStr: string) => Promise<void>;
  onOpenPopover: (dateStr: string) => void;
  onSavePopover: (dateStr: string) => void;
}) {
  const { habit, isQuit, dayInfo, completions, comp, restAllowedCount } = params;
  const { dateStr, isFuture: isFutureDate, isToday: isTodayDate } = dayInfo;
  const status = getCellStatusInfo({ habit, completions, comp, dateStr });
  const isActiveState = status.isCompleted || status.isFrozen || status.isRest;
  const showRipple = params.isRippling && isActiveState;

  const titleText = isFutureDate
    ? undefined
    : restAllowedCount > 0
      ? 'Click: Done • Right-click: Rest Day • Pencil: Note / Shield'
      : 'Left click: toggle. Right click: Streak Shield.';

  const handleContextMenu = (e: React.MouseEvent) => {
    const shouldToggleRest = e.altKey || (restAllowedCount > 0 && !status.isCompleted && !status.isFrozen);
    if (shouldToggleRest) {
      e.preventDefault();
      if (!isFutureDate) void params.onToggleRestDay(dateStr);
      return;
    }
    void params.onCellRightClick({ e, dateStr, isFutureDate });
  };

  const innerButton = (
    <button
      type="button"
      onClick={(e) => params.onCellClick({ dateStr, isFutureDate, isShiftKey: e.shiftKey })}
      onContextMenu={handleContextMenu}
      disabled={isFutureDate}
      data-date={dateStr}
      data-today={isTodayDate}
      data-status={getCellDataStatus(status)}
      className={cn(
        'w-9 h-9 rounded-lg flex items-center justify-center transition-transform transition-colors relative overflow-hidden flex-shrink-0 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        !isFutureDate && 'hover:scale-105',
        params.isBurst && 'scale-115',
        getCellBackgroundClass({ status, isFutureDate, isTodayDate })
      )}
      title={titleText}
    >
      <CellCompletionIcon habit={habit} isQuit={isQuit} status={status} />
      {comp?.note && <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />}
      {showRipple && <SuccessRipple trigger={showRipple} color={status.isFrozen ? 'bg-sky-400/40' : status.isRest ? 'bg-teal-400/30' : 'bg-success/30'} />}
    </button>
  );

  return (
    <div className="relative group/cell">
      <CellButtonWithTooltip button={innerButton} dayInfo={dayInfo} comp={comp} />
      <CellBurstBadge visible={params.isBurst} isFrozen={status.isFrozen} isQuit={isQuit} />
      <CellPopoverControl
        habit={habit}
        dateStr={dateStr}
        isFutureDate={isFutureDate}
        status={status}
        isPopoverOpen={params.isPopoverOpen}
        setOpenPopoverDate={params.setOpenPopoverDate}
        tempValue={params.tempValue}
        setTempValue={params.setTempValue}
        tempNote={params.tempNote}
        setTempNote={params.setTempNote}
        restAllowedCount={restAllowedCount}
        restRemainingCount={params.restRemainingCount}
        hasOnFreeze={params.hasOnFreeze}
        onOpenPopover={() => params.onOpenPopover(dateStr)}
        onSavePopover={() => params.onSavePopover(dateStr)}
        onToggleRestDay={() => params.onToggleRestDay(dateStr)}
        onCellRightClick={(e) => params.onCellRightClick({ e, dateStr, isFutureDate })}
      />
    </div>
  );
});
