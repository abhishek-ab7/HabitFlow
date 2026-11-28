'use client';

import { memo, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Habit, HabitCompletion } from '@/lib/types';
import type { HabitDayInfo } from './row/habit-row-helpers';
import { useHabitRowController } from './row/useHabitRowController';
import { HabitRowInfoCell } from './row/HabitRowInfoCell';
import { HabitDayCell } from './row/HabitDayCell';

const HabitRowDialogs = dynamic(
  () => import('./row/HabitRowDialogs').then((m) => ({ default: m.HabitRowDialogs })),
  { ssr: false }
);

interface SortableHabitRowProps {
  habit: Habit;
  days: HabitDayInfo[];
  completions: HabitCompletion[];
  streak: number;
  onToggle: (habitId: string, date: string) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habitId: string) => void;
  onArchive: (habitId: string) => void;
  onFreeze?: (habitId: string, date: string) => void;
}

function SortableHabitRowCells({
  habit,
  days,
  completions,
  vm,
  hasOnFreeze,
}: {
  habit: Habit;
  days: HabitDayInfo[];
  completions: HabitCompletion[];
  vm: ReturnType<typeof useHabitRowController>;
  hasOnFreeze: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      {days.map((dayInfo) => {
        const isOpen = vm.openPopoverDate === dayInfo.dateStr;
        return (
          <HabitDayCell
            key={dayInfo.day}
            habit={habit}
            isQuit={vm.isQuit}
            dayInfo={dayInfo}
            completions={completions}
            comp={vm.completionMap.get(dayInfo.dateStr)}
            restAllowedCount={vm.weekProgress.restAllowedCount}
            restRemainingCount={vm.weekProgress.restRemainingCount}
            isRippling={vm.rippleCell === `${habit.id}-${dayInfo.dateStr}`}
            isBurst={vm.burstActive === dayInfo.dateStr}
            isPopoverOpen={isOpen}
            setOpenPopoverDate={vm.setOpenPopoverDate}
            tempValue={isOpen ? vm.tempValue : 0}
            setTempValue={vm.setTempValue}
            tempNote={isOpen ? vm.tempNote : ''}
            setTempNote={vm.setTempNote}
            hasOnFreeze={hasOnFreeze}
            onCellClick={vm.handleCellClick}
            onCellRightClick={vm.handleCellRightClick}
            onToggleRestDay={vm.handleToggleRestDay}
            onOpenPopover={vm.handleOpenPopover}
            onSavePopover={vm.handleSavePopover}
          />
        );
      })}
    </div>
  );
}

export const SortableHabitRow = memo(function SortableHabitRow({
  habit, days, completions, streak, onToggle, onEdit, onDelete, onArchive, onFreeze,
}: SortableHabitRowProps) {
  const vm = useHabitRowController({ habit, days, completions, streak, onToggle, onFreeze });
  const anyDialogOpen = vm.showShareModal || vm.showLogModal || vm.showNoShieldsDialog;
  const [dialogsMounted, setDialogsMounted] = useState(false);
  if (anyDialogOpen && !dialogsMounted) setDialogsMounted(true);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center py-2 group bg-background relative">
      <HabitRowInfoCell
        habit={habit}
        streak={streak}
        isQuit={vm.isQuit}
        weekProgress={vm.weekProgress}
        isStreakBrokenYesterday={vm.isStreakBrokenYesterday}
        showRecovery={vm.showRecovery}
        setShowRecovery={vm.setShowRecovery}
        yesterdayStr={vm.yesterdayStr}
        dragAttributes={attributes as unknown as Record<string, unknown>}
        dragListeners={listeners as unknown as Record<string, unknown>}
        onStartUrgeTimer={() => vm.startUrgeTimer(habit.id, habit.name)}
        onEdit={() => onEdit(habit)}
        onOpenLogModal={vm.handleOpenLogModal}
        onToggleRestDay={vm.handleToggleRestDay}
        onShare={() => vm.setShowShareModal(true)}
        onArchive={() => onArchive(habit.id)}
        onDelete={() => onDelete(habit.id)}
      />

      <SortableHabitRowCells
        habit={habit}
        days={days}
        completions={completions}
        vm={vm}
        hasOnFreeze={Boolean(onFreeze)}
      />

      <div className="w-16 md:w-24 flex-shrink-0 flex flex-col items-center gap-1 ml-auto">
        <span className="text-sm font-medium tabular-nums">{vm.monthlyCount}/{vm.totalDays}</span>
        <div className="w-10 md:w-16 h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${vm.percentage}%` }} transition={{ duration: 0.5 }} />
        </div>
      </div>

      {dialogsMounted && (
        <HabitRowDialogs
          habit={habit}
          streak={streak}
          showShareModal={vm.showShareModal}
          setShowShareModal={vm.setShowShareModal}
          showLogModal={vm.showLogModal}
          setShowLogModal={vm.setShowLogModal}
          logDate={vm.logDate}
          setLogDate={vm.setLogDate}
          logValue={vm.logValue}
          setLogValue={vm.setLogValue}
          logNote={vm.logNote}
          setLogNote={vm.setLogNote}
          onSaveLogModal={vm.handleSaveLogModal}
          showNoShieldsDialog={vm.showNoShieldsDialog}
          setShowNoShieldsDialog={vm.setShowNoShieldsDialog}
          onGoToSettings={() => {
            vm.setShowNoShieldsDialog(false);
            vm.router.push('/settings');
          }}
        />
      )}
    </div>
  );
});
