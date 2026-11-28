'use client';

import type React from 'react';
import { cn } from '@/lib/utils';
import type { HabitFrequencyType } from '@/lib/types';
import { WEEKDAY_PILLS } from '@/lib/habits/habit-form-helpers';

function SpecificDaysPicker({
  scheduledDays,
  setScheduledDays,
}: {
  scheduledDays: number[];
  setScheduledDays: React.Dispatch<React.SetStateAction<number[]>>;
}) {
  return (
    <div className="pt-1">
      <div className="flex gap-1.5">
        {WEEKDAY_PILLS.map((w) => {
          const active = scheduledDays.includes(w.day);
          return (
            <button
              key={w.day}
              type="button"
              onClick={() =>
                setScheduledDays((prev) =>
                  prev.includes(w.day) ? (prev.length > 1 ? prev.filter((d) => d !== w.day) : prev) : [...prev, w.day]
                )
              }
              className={cn(
                'flex-1 py-2 rounded-lg text-xs font-bold transition-colors border',
                active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/60 text-muted-foreground border-transparent hover:bg-muted'
              )}
              title={w.label}
            >
              {w.short}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Scheduled {scheduledDays.length} day{scheduledDays.length > 1 ? 's' : ''}/week. Unscheduled days automatically count as Auto-Rest.
      </p>
    </div>
  );
}

function DailyFlexibleDaySelector({
  targetDays,
  setTargetDays,
  setFrequencyType,
}: {
  targetDays: number;
  setTargetDays: (d: number) => void;
  setFrequencyType: (f: HabitFrequencyType) => void;
}) {
  return (
    <div>
      <div className="flex gap-1 mt-2">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => {
              setTargetDays(day);
              setFrequencyType(day === 7 ? 'daily' : 'weekly_flexible');
            }}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-mono font-semibold transition-colors',
              targetDays === day ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
            )}
          >
            {day}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {targetDays === 7
          ? 'Daily habit (7 days/week). Missing a day requires a Streak Shield.'
          : `${targetDays} days/week • Includes ${7 - targetDays} flexible Rest Day${7 - targetDays > 1 ? 's' : ''}/week. Mark any day as Rest without breaking your streak.`}
      </p>
    </div>
  );
}

function IntervalDaysSelector({
  intervalDays,
  setIntervalDays,
}: {
  intervalDays: number;
  setIntervalDays: (n: number) => void;
}) {
  return (
    <div className="pt-1 flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">Repeat every</span>
      <div className="flex items-center gap-1.5">
        {[2, 3, 4, 5, 7].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setIntervalDays(n)}
            className={cn(
              'px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors',
              intervalDays === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-transparent'
            )}
          >
            {n}d
          </button>
        ))}
      </div>
    </div>
  );
}

const SCHEDULE_MODES = [
  { id: 'daily', label: 'Daily (7×)' },
  { id: 'weekly_flexible', label: 'X Days / Wk' },
  { id: 'specific_days', label: 'Specific Days' },
  { id: 'interval', label: 'Every N Days' },
] as const;

export function HabitScheduleSection({
  frequencyType,
  setFrequencyType,
  targetDays,
  setTargetDays,
  scheduledDays,
  setScheduledDays,
  intervalDays,
  setIntervalDays,
}: {
  frequencyType: HabitFrequencyType;
  setFrequencyType: (f: HabitFrequencyType) => void;
  targetDays: number;
  setTargetDays: (d: number) => void;
  scheduledDays: number[];
  setScheduledDays: React.Dispatch<React.SetStateAction<number[]>>;
  intervalDays: number;
  setIntervalDays: (n: number) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3.5">
      <label className="text-sm font-medium block">Schedule &amp; Rest Days</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {SCHEDULE_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => {
              const nextMode = mode.id as HabitFrequencyType;
              setFrequencyType(nextMode);
              if (nextMode === 'daily') setTargetDays(7);
              if (nextMode === 'weekly_flexible' && targetDays === 7) setTargetDays(5);
            }}
            className={cn(
              'py-2 px-2 rounded-lg text-xs font-semibold transition-all border',
              frequencyType === mode.id
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background text-muted-foreground border-border/60 hover:text-foreground'
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {(frequencyType === 'daily' || frequencyType === 'weekly_flexible') && (
        <DailyFlexibleDaySelector
          targetDays={targetDays}
          setTargetDays={setTargetDays}
          setFrequencyType={setFrequencyType}
        />
      )}

      {frequencyType === 'specific_days' && (
        <SpecificDaysPicker scheduledDays={scheduledDays} setScheduledDays={setScheduledDays} />
      )}

      {frequencyType === 'interval' && (
        <IntervalDaysSelector intervalDays={intervalDays} setIntervalDays={setIntervalDays} />
      )}
    </div>
  );
}
