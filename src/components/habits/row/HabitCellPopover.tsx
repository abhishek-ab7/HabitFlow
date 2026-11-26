'use client';

import React from 'react';
import { format } from 'date-fns';
import { Moon, Snowflake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PopoverContent } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import type { Habit } from '@/lib/types';

export function HabitCellPopover(params: {
  habit: Habit;
  dateStr: string;
  tempValue: number;
  setTempValue: React.Dispatch<React.SetStateAction<number>>;
  tempNote: string;
  setTempNote: React.Dispatch<React.SetStateAction<string>>;
  restAllowedCount: number;
  restRemainingCount: number;
  isRest: boolean;
  isFrozen: boolean;
  hasOnFreeze: boolean;
  onToggleRest: () => void;
  onToggleFreeze: (e: React.MouseEvent) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const {
    habit, dateStr, tempValue, setTempValue, tempNote, setTempNote,
    restAllowedCount, restRemainingCount, isRest, isFrozen, hasOnFreeze,
    onToggleRest, onToggleFreeze, onClose, onSave,
  } = params;

  return (
    <PopoverContent side="top" align="center" className="w-72 p-4 space-y-4 z-50 bg-popover border shadow-lg rounded-xl" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{format(new Date(dateStr), 'EEEE, MMMM d')}</p>
        <h4 className="text-sm font-bold truncate">{habit.name}</h4>
      </div>

      {habit.isQuantitative && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Progress ({habit.unit || 'units'})</label>
          <div className="flex items-center gap-2">
            <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setTempValue((prev) => Math.max(0, prev - 1))}>-</Button>
            <Input type="number" min={0} value={tempValue} onChange={(e) => setTempValue(Math.max(0, parseInt(e.target.value, 10) || 0))} className="h-8 text-center" />
            <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setTempValue((prev) => prev + 1)}>+</Button>
            <span className="text-xs text-muted-foreground whitespace-nowrap ml-1">/ {habit.targetValue}</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Journal Entry</label>
        <Textarea value={tempNote} onChange={(e) => setTempNote(e.target.value)} placeholder="Write a reflection or note..." className="min-h-[80px] text-xs resize-none" />
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {restAllowedCount > 0 && (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1 border-teal-500/30 text-teal-600 dark:text-teal-400 hover:bg-teal-500/10" onClick={onToggleRest}>
            <Moon className="h-3 w-3" />
            {isRest ? 'Clear Rest' : `Rest Day (${restRemainingCount} left)`}
          </Button>
        )}
        {hasOnFreeze && (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1 border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10" onClick={onToggleFreeze}>
            <Snowflake className="h-3 w-3" />
            {isFrozen ? 'Unfreeze' : 'Shield'}
          </Button>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="button" size="sm" onClick={onSave}>Save</Button>
      </div>
    </PopoverContent>
  );
}
