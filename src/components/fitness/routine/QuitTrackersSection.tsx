'use client';

import { Check, Flame, Plus, Shield, ShieldCheck, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { calculateDailyFuelSummary } from '@/lib/fitness/shared-analytics';
import {
  getQuitCardTone,
  STARTER_QUIT_TRACKERS,
} from '@/lib/fitness/routine-quit-helpers';
import { cn } from '@/lib/utils';
import type { Habit } from '@/lib/types';

function QuitTrackerBadges({ streak, junkMealCount, junkTriggered }: { streak: number; junkMealCount: number; junkTriggered: boolean }) {
  return (
    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
      <Badge variant="secondary" className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 gap-0.5">
        <Shield className="h-2.5 w-2.5" /> Quit
      </Badge>
      {streak > 0 && (
        <Badge variant="secondary" className="text-[10px] gap-0.5 font-mono">
          <Flame className="h-2.5 w-2.5 text-amber-500" /> {streak}d clean
        </Badge>
      )}
      {junkTriggered && <Badge variant="destructive" className="text-[10px]">{junkMealCount} junk logged</Badge>}
    </div>
  );
}

function QuitTrackerCard({
  habit,
  streak,
  isClean,
  fuelSummary,
  onToggleHabit,
  onStartUrge,
}: {
  habit: Habit;
  streak: number;
  isClean: boolean;
  fuelSummary: ReturnType<typeof calculateDailyFuelSummary>;
  onToggleHabit: (habit: Habit) => void;
  onStartUrge: (habitId: string | null, name: string) => void;
}) {
  const isZeroJunkHabit = habit.autoTrackRule === 'zero_junk_today' || habit.autoTrackRule === 'no_junk_food';
  const junkTriggered = isZeroJunkHabit && fuelSummary.junkMealCount > 0 && !fuelSummary.junkFreeOverride;

  return (
    <div className={cn('rounded-xl border p-3.5 space-y-3 transition-colors', getQuitCardTone(junkTriggered, isClean))}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{habit.icon || '🛡️'}</span>
          <p className="text-sm font-bold text-foreground truncate">{habit.name}</p>
        </div>
        <QuitTrackerBadges streak={streak} junkMealCount={fuelSummary.junkMealCount} junkTriggered={junkTriggered} />
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant={isClean ? 'default' : 'secondary'} onClick={() => onToggleHabit(habit)} className={cn('flex-1 h-8 text-xs gap-1', isClean && 'bg-emerald-600 hover:bg-emerald-700 text-white')}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {isClean ? 'Clean Day ✓' : 'Mark Clean'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onStartUrge(habit.id, habit.name)} className="h-8 px-2.5 text-xs gap-1 border-violet-500/35 text-violet-600 dark:text-violet-400" title="Start 10-Minute Urge Surf Timer">
          <Timer className="h-3.5 w-3.5" /> 10m Urge
        </Button>
      </div>
    </div>
  );
}

export function QuitTrackersSection(props: {
  activeHabits: Habit[];
  quitHabits: Habit[];
  streaks: Map<string, number>;
  fuelSummary: ReturnType<typeof calculateDailyFuelSummary>;
  isCompletedOnDate: (id: string) => boolean;
  onToggleHabit: (habit: Habit) => void;
  onStartUrge: (habitId: string | null, name: string) => void;
  onCreateStarterQuit: (starter: (typeof STARTER_QUIT_TRACKERS)[number]) => void;
}) {
  const { activeHabits, quitHabits, streaks, fuelSummary, isCompletedOnDate, onToggleHabit, onStartUrge, onCreateStarterQuit } = props;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-rose-500" />
            Anti-Habits (&quot;Quit&quot; Trackers)
          </h3>
          <p className="text-xs text-muted-foreground">Shield your streaks from junk food, late-night scrolling &amp; impulse card swipes</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => onStartUrge(null, 'Craving / Impulse')} className="gap-1.5 border-violet-500/40 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10">
          <Timer className="h-3.5 w-3.5" /> 10m Urge Timer
        </Button>
      </div>

      {quitHabits.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {quitHabits.map((habit) => (
            <QuitTrackerCard
              key={habit.id}
              habit={habit}
              streak={streaks.get(habit.id) || 0}
              isClean={isCompletedOnDate(habit.id)}
              fuelSummary={fuelSummary}
              onToggleHabit={onToggleHabit}
              onStartUrge={onStartUrge}
            />
          ))}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Starter Anti-Habits (1-Tap Add)</p>
        <div className="flex flex-wrap gap-2">
          {STARTER_QUIT_TRACKERS.map((starter) => {
            const alreadyExists = activeHabits.some((h) => h.name.trim().toLowerCase() === starter.payload.name.toLowerCase());
            return (
              <Button key={starter.key} type="button" size="sm" variant={alreadyExists ? 'ghost' : 'outline'} disabled={alreadyExists} onClick={() => onCreateStarterQuit(starter)} className="h-8 text-xs gap-1.5" title={starter.description}>
                {alreadyExists ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Plus className="h-3.5 w-3.5 text-rose-500" />}
                {starter.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
