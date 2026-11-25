'use client';

import React, { useMemo } from 'react';
import {
  Briefcase,
  Check,
  Dumbbell,
  Flame,
  Moon,
  Pill,
  Plus,
  Shield,
  ShieldCheck,
  Sun,
  Timer,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { calculateDailyFuelSummary } from '@/lib/fitness/shared-analytics';
import { useFeedback } from '@/hooks/use-feedback';
import { cn } from '@/lib/utils';
import type { Habit, HabitAnchorBlock, HabitFormData } from '@/lib/types';

interface RoutineAndQuitTabProps {
  selectedDate: string;
  userId: string;
}

const ANCHOR_BLOCKS: Array<{
  id: HabitAnchorBlock;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
}> = [
  {
    id: 'morning',
    title: 'Morning Anchor',
    subtitle: 'Hydrate, weigh-in, sunlight & morning stack',
    icon: Sun,
    accentClass: 'text-amber-500 bg-amber-500/10',
  },
  {
    id: 'work',
    title: 'Work Anchor',
    subtitle: 'Deep focus blocks, steps break & protein check',
    icon: Briefcase,
    accentClass: 'text-sky-500 bg-sky-500/10',
  },
  {
    id: 'gym',
    title: 'Gym Anchor',
    subtitle: 'Training session, pre/post supplements & workout habits',
    icon: Dumbbell,
    accentClass: 'text-emerald-500 bg-emerald-500/10',
  },
  {
    id: 'night',
    title: 'Night Shutdown',
    subtitle: 'Zero-junk wrap-up, sleep check-in & quit streaks',
    icon: Moon,
    accentClass: 'text-indigo-500 bg-indigo-500/10',
  },
];

const STARTER_QUIT_TRACKERS: Array<{
  key: string;
  label: string;
  description: string;
  payload: HabitFormData;
}> = [
  {
    key: 'no_junk_food',
    label: 'No Junk Food',
    description: 'Auto-reverses if any Junk Food meal or expense is logged today',
    payload: {
      name: 'No Junk Food',
      icon: '🛡️',
      category: 'health',
      targetDaysPerWeek: 7,
      frequencyType: 'daily',
      polarity: 'quit',
      anchorBlock: 'night',
      autoTrackRule: 'zero_junk_today',
      difficulty: 'hard',
    },
  },
  {
    key: 'no_late_scroll',
    label: 'No Late-Night Scrolling',
    description: 'Protect sleep recovery by parking phone before bed',
    payload: {
      name: 'No Late-Night Scrolling',
      icon: '📵',
      category: 'personal',
      targetDaysPerWeek: 7,
      frequencyType: 'daily',
      polarity: 'quit',
      anchorBlock: 'night',
      autoTrackRule: 'none',
      difficulty: 'medium',
    },
  },
  {
    key: 'no_impulse_cc',
    label: 'No Impulse CC Swipes',
    description: 'Links with FlowFinance No-Spend Days on discretionary cards',
    payload: {
      name: 'No Impulse CC Swipes',
      icon: '💳',
      category: 'finance',
      targetDaysPerWeek: 7,
      frequencyType: 'daily',
      polarity: 'quit',
      anchorBlock: 'night',
      autoTrackRule: 'no_spend_day',
      difficulty: 'hard',
    },
  },
];

export function RoutineAndQuitTab({ selectedDate, userId }: RoutineAndQuitTabProps) {
  const habits = useHabitStore((s) => s.habits);
  const completions = useHabitStore((s) => s.completions);
  const addHabit = useHabitStore((s) => s.addHabit);
  const editHabit = useHabitStore((s) => s.editHabit);
  const toggleHabit = useHabitStore((s) => s.toggle);
  const getCurrentStreaks = useHabitStore((s) => s.getCurrentStreaks);

  const profile = useFitnessStore((s) => s.profile);
  const dailyLogs = useFitnessStore((s) => s.dailyLogs);
  const mealLogs = useFitnessStore((s) => s.mealLogs);
  const supplementInventory = useFitnessStore((s) => s.supplementInventory);
  const supplementLogs = useFitnessStore((s) => s.supplementLogs);
  const takeSupplementDose = useFitnessStore((s) => s.takeSupplementDose);
  const incrementWater = useFitnessStore((s) => s.incrementWater);

  const startUrgeTimer = usePomodoroStore((s) => s.startUrgeTimer);
  const startPresetTimer = usePomodoroStore((s) => s.startPresetTimer);
  const feedback = useFeedback();

  const activeHabits = useMemo(
    () => habits.filter((h) => !h.archived),
    [habits]
  );

  const streaks = useMemo(() => getCurrentStreaks(), [habits, completions, getCurrentStreaks]);

  const todayLog = useMemo(
    () => dailyLogs.find((d) => d.date === selectedDate && !d.deletedAt),
    [dailyLogs, selectedDate]
  );
  const fuelSummary = useMemo(
    () => calculateDailyFuelSummary(mealLogs, todayLog, profile, selectedDate),
    [mealLogs, todayLog, profile, selectedDate]
  );

  const quitHabits = useMemo(
    () =>
      activeHabits.filter(
        (h) =>
          h.polarity === 'quit' ||
          h.autoTrackRule === 'zero_junk_today' ||
          h.autoTrackRule === 'no_junk_food'
      ),
    [activeHabits]
  );

  const unassignedHabits = useMemo(
    () => activeHabits.filter((h) => !h.anchorBlock && h.polarity !== 'quit'),
    [activeHabits]
  );

  const activeSupps = useMemo(
    () => supplementInventory.filter((s) => !s.deletedAt && s.isActive),
    [supplementInventory]
  );

  const isCompletedOnDate = (habitId: string) =>
    completions.some(
      (c) =>
        c.habitId === habitId &&
        c.date === selectedDate &&
        c.completed &&
        c.status !== 'rest' &&
        !c.skipped
    );

  const isRestOnDate = (habitId: string) =>
    completions.some(
      (c) =>
        c.habitId === habitId &&
        c.date === selectedDate &&
        (c.status === 'rest' || c.skipped)
    );

  const isSupplementTakenToday = (suppId: string) =>
    supplementLogs.some(
      (l) => !l.deletedAt && l.supplementId === suppId && l.date.slice(0, 10) === selectedDate
    );

  const handleToggleHabit = async (habit: Habit) => {
    const done = isCompletedOnDate(habit.id);
    if (done) {
      feedback.uncheck();
    } else {
      feedback.complete();
    }
    try {
      await toggleHabit(habit.id, selectedDate);
    } catch {
      // Fallback if unauthenticated local demo mode
      const { CrossDomainActionMediator } = await import('@/lib/stores/mediator');
      await CrossDomainActionMediator.dispatch({
        type: done ? 'HABIT_UNCOMPLETED' : 'HABIT_COMPLETED',
        payload: {
          habitId: habit.id,
          date: selectedDate,
          category: habit.category,
          difficulty: habit.difficulty,
        },
      });
    }
  };

  const handleCreateStarterQuit = async (starter: (typeof STARTER_QUIT_TRACKERS)[number]) => {
    const exists = activeHabits.some(
      (h) => h.name.trim().toLowerCase() === starter.payload.name.toLowerCase()
    );
    if (exists) {
      toast.info(`${starter.label} is already tracked`);
      return;
    }

    try {
      await addHabit(starter.payload);
      toast.success(`Added Quit Tracker: ${starter.label}`);
    } catch {
      const { createHabit } = await import('@/lib/db');
      const created = await createHabit({ ...starter.payload, userId });
      useHabitStore.setState((s) => ({ habits: [...s.habits, created] }));
      toast.success(`Added Quit Tracker: ${starter.label}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* SECTION 1: Anti-Habits ("Quit" Trackers) */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-rose-500" />
              Anti-Habits (&quot;Quit&quot; Trackers)
            </h3>
            <p className="text-xs text-muted-foreground">
              Shield your streaks from junk food, late-night scrolling &amp; impulse card swipes
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => startUrgeTimer(null, 'Craving / Impulse')}
            className="gap-1.5 border-violet-500/40 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
          >
            <Timer className="h-3.5 w-3.5" /> 10m Urge Timer
          </Button>
        </div>

        {/* Active Quit Trackers */}
        {quitHabits.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {quitHabits.map((habit) => {
              const streak = streaks.get(habit.id) || 0;
              const isClean = isCompletedOnDate(habit.id);
              const isZeroJunkHabit =
                habit.autoTrackRule === 'zero_junk_today' ||
                habit.autoTrackRule === 'no_junk_food';
              const junkTriggered = isZeroJunkHabit && fuelSummary.junkMealCount > 0 && !fuelSummary.junkFreeOverride;

              return (
                <div
                  key={habit.id}
                  className={cn(
                    'rounded-xl border p-3.5 space-y-3 transition-colors',
                    junkTriggered
                      ? 'border-rose-500/50 bg-rose-500/5'
                      : isClean
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-rose-500/25 bg-background'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{habit.icon || '🛡️'}</span>
                        <p className="text-sm font-bold text-foreground truncate">{habit.name}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 gap-0.5"
                        >
                          <Shield className="h-2.5 w-2.5" /> Quit
                        </Badge>
                        {streak > 0 && (
                          <Badge variant="secondary" className="text-[10px] gap-0.5 font-mono">
                            <Flame className="h-2.5 w-2.5 text-amber-500" /> {streak}d clean
                          </Badge>
                        )}
                        {junkTriggered && (
                          <Badge variant="destructive" className="text-[10px]">
                            {fuelSummary.junkMealCount} junk logged
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={isClean ? 'default' : 'secondary'}
                      onClick={() => handleToggleHabit(habit)}
                      className={cn(
                        'flex-1 h-8 text-xs gap-1',
                        isClean && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      )}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {isClean ? 'Clean Day ✓' : 'Mark Clean'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => startUrgeTimer(habit.id, habit.name)}
                      className="h-8 px-2.5 text-xs gap-1 border-violet-500/35 text-violet-600 dark:text-violet-400"
                      title="Start 10-Minute Urge Surf Timer"
                    >
                      <Timer className="h-3.5 w-3.5" /> 10m Urge
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Starter Quit Tracker Creator */}
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Starter Anti-Habits (1-Tap Add)
          </p>
          <div className="flex flex-wrap gap-2">
            {STARTER_QUIT_TRACKERS.map((starter) => {
              const alreadyExists = activeHabits.some(
                (h) => h.name.trim().toLowerCase() === starter.payload.name.toLowerCase()
              );
              return (
                <Button
                  key={starter.key}
                  type="button"
                  size="sm"
                  variant={alreadyExists ? 'ghost' : 'outline'}
                  disabled={alreadyExists}
                  onClick={() => handleCreateStarterQuit(starter)}
                  className="h-8 text-xs gap-1.5"
                  title={starter.description}
                >
                  {alreadyExists ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-rose-500" />
                  )}
                  {starter.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 2: Anchor Routine Time-Blocks (Morning / Work / Gym / Night Shutdown) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Time-Blocked Anchor Routines
            </h3>
            <p className="text-xs text-muted-foreground">
              Habits, supplement doses &amp; bio check-ins organized across your 4 daily anchors
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              startPresetTimer('starter_2m', {
                title: '2-Min Rule Anti-Procrastination Starter',
                openPanel: true,
              })
            }
            className="gap-1.5 text-xs"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" /> 2m Starter Timer
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ANCHOR_BLOCKS.map((block) => {
            const Icon = block.icon;
            const blockHabits = activeHabits.filter((h) => h.anchorBlock === block.id);
            const blockSupps = activeSupps.filter((s) => s.anchorBlock === block.id);

            return (
              <div
                key={block.id}
                className="rounded-2xl border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
                        block.accentClass
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{block.title}</h4>
                      <p className="text-[11px] text-muted-foreground">{block.subtitle}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {blockHabits.length + blockSupps.length} items
                  </Badge>
                </div>

                {/* Contextual Bio Check-in Pill per Block */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {block.id === 'morning' && (
                    <>
                      <Badge variant="secondary" className="text-[10px]">
                        Weight: {todayLog?.weightKg != null ? `${todayLog.weightKg}kg` : 'Log'}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => {
                          feedback.complete();
                          incrementWater(500, selectedDate, userId);
                          toast.success('+500ml morning hydration');
                        }}
                        className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium hover:bg-sky-500/20"
                      >
                        +500ml Water ({fuelSummary.waterMl}ml)
                      </button>
                    </>
                  )}
                  {block.id === 'work' && (
                    <>
                      <Badge variant="secondary" className="text-[10px]">
                        Protein: {fuelSummary.proteinConsumedG}/{fuelSummary.proteinTargetG}g
                      </Badge>
                      <button
                        type="button"
                        onClick={() =>
                          startPresetTimer('starter_2m', {
                            title: 'Work Anchor · 2m Focus Start',
                            openPanel: true,
                          })
                        }
                        className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium hover:bg-amber-500/20"
                      >
                        Start 2m Focus
                      </button>
                    </>
                  )}
                  {block.id === 'gym' && (
                    <Badge variant="secondary" className="text-[10px]">
                      Steps: {fuelSummary.steps.toLocaleString()}/{fuelSummary.stepsTarget.toLocaleString()}
                    </Badge>
                  )}
                  {block.id === 'night' && (
                    <Badge variant="secondary" className="text-[10px]">
                      Sleep: {fuelSummary.sleepHours != null ? `${fuelSummary.sleepHours}h` : 'Pending'} · Junk: {fuelSummary.junkMealCount}
                    </Badge>
                  )}
                </div>

                {/* Block Habits */}
                {blockHabits.length === 0 && blockSupps.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No habits or supplements anchored here yet.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {blockHabits.map((h) => {
                      const done = isCompletedOnDate(h.id);
                      const rest = isRestOnDate(h.id);
                      const isQuit = h.polarity === 'quit';
                      return (
                        <div
                          key={h.id}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs',
                            done
                              ? 'border-emerald-500/30 bg-emerald-500/5'
                              : rest
                                ? 'border-teal-500/30 bg-teal-500/5'
                                : isQuit
                                  ? 'border-rose-500/25 bg-background'
                                  : 'border-border bg-background'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span>{h.icon || (isQuit ? '🛡️' : '✓')}</span>
                            <span className="font-medium text-foreground truncate">{h.name}</span>
                            {isQuit && (
                              <Badge variant="outline" className="text-[9px] text-rose-500 border-rose-500/30">
                                Quit
                              </Badge>
                            )}
                            {rest && (
                              <Badge variant="outline" className="text-[9px] text-teal-600 dark:text-teal-400">
                                Rest
                              </Badge>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={done ? 'default' : 'secondary'}
                            onClick={() => handleToggleHabit(h)}
                            className="h-7 px-2.5 text-[11px] shrink-0"
                          >
                            {done ? 'Done ✓' : isQuit ? 'Clean' : 'Complete'}
                          </Button>
                        </div>
                      );
                    })}

                    {blockSupps.map((sup) => {
                      const taken = isSupplementTakenToday(sup.id);
                      return (
                        <div
                          key={sup.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/25 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Pill className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span className="font-medium text-foreground truncate">
                              {sup.name} ({sup.dailyDosage} {sup.unitLabel})
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={taken ? 'ghost' : 'secondary'}
                            disabled={taken}
                            onClick={async () => {
                              feedback.complete();
                              await takeSupplementDose(
                                sup.id,
                                sup.dailyDosage,
                                selectedDate,
                                null,
                                userId
                              );
                              toast.success(`Took ${sup.name}`);
                            }}
                            className="h-7 px-2.5 text-[11px] shrink-0"
                          >
                            {taken ? 'Taken ✓' : 'Take Dose'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Anchor Assignment Strip for existing unassigned habits */}
        {unassignedHabits.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
            <p className="text-xs font-semibold text-foreground">
              Unassigned Habits ({unassignedHabits.length}) — assign to a time block in 1 tap
            </p>
            <div className="space-y-2">
              {unassignedHabits.slice(0, 8).map((habit) => (
                <div
                  key={habit.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs"
                >
                  <span className="font-medium text-foreground">
                    {habit.icon || '✓'} {habit.name}
                  </span>
                  <div className="flex items-center gap-1">
                    {ANCHOR_BLOCKS.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={async () => {
                          await editHabit(habit.id, { anchorBlock: b.id });
                          toast.success(`Anchored "${habit.name}" to ${b.title}`);
                        }}
                        className="px-2 py-1 rounded-lg border border-border bg-muted/40 hover:bg-primary hover:text-primary-foreground text-[11px] font-medium transition-colors capitalize"
                      >
                        {b.id}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
