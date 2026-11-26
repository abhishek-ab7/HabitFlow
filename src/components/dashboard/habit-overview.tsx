'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import { ArrowRight, Check, Moon, Flame, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FadeIn } from '@/components/motion';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/design-tokens';
import type { Habit, HabitCompletion, Category } from '@/lib/types';
import { getHabitWeekProgress, calculateHabitStats } from '@/lib/calculations';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useFeedback } from '@/hooks/use-feedback';
import { toast } from 'sonner';

interface HabitOverviewProps {
  habits: Habit[];
  completions: HabitCompletion[];
  onToggle?: (habitId: string, date: string) => Promise<void>;
}

function partitionHabitsForToday(habits: Habit[], completions: HabitCompletion[], today: Date) {
  const due: Array<{ habit: Habit; weekProg: ReturnType<typeof getHabitWeekProgress>; streak: number }> = [];
  const resting: Array<{ habit: Habit; weekProg: ReturnType<typeof getHabitWeekProgress>; streak: number }> = [];

  for (const habit of habits) {
    const weekProg = getHabitWeekProgress(habit, completions, today);
    const stats = calculateHabitStats(habit, completions, today);
    const item = { habit, weekProg, streak: stats.currentStreak };
    const isRestingOrDoneForWeek =
      !weekProg.isCompletedToday &&
      (weekProg.isRestedToday || weekProg.isAutoRestDay || (weekProg.quotaMet && weekProg.targetCount < 7));
    if (isRestingOrDoneForWeek) resting.push(item);
    else due.push(item);
  }
  return { activeDueHabits: due, restingOrQuotaMetHabits: resting };
}

function HabitDayCellButton(props: {
  comp?: HabitCompletion;
  isFuture: boolean;
  isToday: boolean;
  onToggle?: () => Promise<void>;
}) {
  const { comp, isFuture, isToday, onToggle } = props;
  const isCompleted = Boolean(comp?.completed && comp?.status !== 'rest' && !comp?.skipped);
  const isRest = Boolean(comp && (comp.status === 'rest' || comp.skipped));
  const cellTone = isCompleted
    ? 'bg-success/20 text-success'
    : isRest
      ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
      : isFuture
        ? 'bg-muted/30 opacity-50 cursor-not-allowed'
        : isToday
          ? 'bg-muted border-2 border-dashed border-muted-foreground/30'
          : 'bg-muted/50';

  return (
    <button
      onClick={onToggle}
      disabled={isFuture || !onToggle}
      className={cn(
        'w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all',
        !isFuture && onToggle && 'cursor-pointer hover:scale-105 active:scale-95',
        cellTone
      )}
    >
      {isCompleted ? <Check className="h-4 w-4" /> : isRest ? <Moon className="h-3.5 w-3.5" /> : null}
    </button>
  );
}

function ActiveHabitMatrixRow(props: {
  habit: Habit;
  weekProg: ReturnType<typeof getHabitWeekProgress>;
  streak: number;
  displayedDays: Array<{ dateStr: string; isToday: boolean }>;
  today: Date;
  completions: HabitCompletion[];
  onToggle?: (habitId: string, date: string) => Promise<void>;
  onRestToday: (habitId: string) => void;
  feedback: ReturnType<typeof useFeedback>;
}) {
  const { habit, weekProg, streak, displayedDays, today, completions, onToggle, onRestToday, feedback } = props;
  const catColor = colors.categories[habit.category]?.text || 'text-muted-foreground';

  return (
    <div className="flex items-center justify-between overflow-x-auto pb-1 scrollbar-hide gap-2">
      <div className="w-32 sm:w-44 md:w-48 flex-shrink-0 flex items-center gap-2 pr-2">
        {habit.icon && <span className="text-base sm:text-lg shrink-0">{habit.icon}</span>}
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium truncate leading-tight">{habit.name}</p>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-4 hidden sm:inline-flex', `bg-category-${habit.category}/20`)}>
              <span className={catColor}>{habit.category}</span>
            </Badge>
            {weekProg.targetCount < 7 && (
              <span className="text-[10px] font-mono tabular-nums px-1.5 py-0 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400">
                {weekProg.completedCount}/{weekProg.targetCount} wk
              </span>
            )}
            {streak > 0 && (
              <span className="text-[10px] font-mono tabular-nums inline-flex items-center gap-0.5 text-amber-500 font-semibold">
                <Flame className="h-2.5 w-2.5 fill-current" />
                {streak}d
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {displayedDays.map(({ dateStr, isToday }) => {
          const comp = completions.find((c) => c.habitId === habit.id && c.date === dateStr);
          const isFuture = new Date(dateStr) > today;
          const isCompleted = Boolean(comp?.completed && comp?.status !== 'rest' && !comp?.skipped);
          return (
            <HabitDayCellButton
              key={dateStr}
              comp={comp}
              isFuture={isFuture}
              isToday={isToday}
              onToggle={
                !isFuture && onToggle
                  ? async () => {
                      if (isCompleted) feedback.uncheck();
                      else feedback.complete();
                      await onToggle(habit.id, dateStr);
                    }
                  : undefined
              }
            />
          );
        })}

        {weekProg.restAllowedCount > 0 && !weekProg.isCompletedToday && (
          <button
            type="button"
            onClick={() => onRestToday(habit.id)}
            title={`Mark Today as Rest Day (${weekProg.restRemainingCount} rest left this week)`}
            className="ml-1 w-7 h-7 rounded-lg flex items-center justify-center text-teal-600 dark:text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 transition-colors"
          >
            <Moon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function RestingHabitsTray(props: {
  items: Array<{ habit: Habit; weekProg: ReturnType<typeof getHabitWeekProgress>; streak: number }>;
  showRestingTray: boolean;
  onToggleTray: () => void;
  todayStr: string;
  onRestToday: (habitId: string) => void;
  onToggle?: (habitId: string, date: string) => Promise<void>;
  feedback: ReturnType<typeof useFeedback>;
}) {
  const { items, showRestingTray, onToggleTray, todayStr, onRestToday, onToggle, feedback } = props;
  if (items.length === 0) return null;

  return (
    <div className="pt-2 border-t border-border/50">
      <button
        type="button"
        onClick={onToggleTray}
        className="w-full flex items-center justify-between text-xs font-medium text-teal-600 dark:text-teal-400 py-1.5 px-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/15 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Moon className="h-3.5 w-3.5" />
          {items.length} Habit{items.length > 1 ? 's' : ''} Resting / Weekly Quota Met Today
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showRestingTray && 'rotate-180')} />
      </button>

      {showRestingTray && (
        <div className="mt-2 space-y-1.5 pl-1">
          {items.map(({ habit, weekProg }) => (
            <div key={habit.id} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-muted/40">
              <div className="flex items-center gap-2 min-w-0">
                <span>{habit.icon || '🌙'}</span>
                <span className="font-medium truncate">{habit.name}</span>
                <span className="text-[10px] font-mono tabular-nums text-teal-600 dark:text-teal-400">
                  {weekProg.quotaMet ? `${weekProg.completedCount}/${weekProg.targetCount} wk ✓` : weekProg.isAutoRestDay ? 'Scheduled Off' : 'Resting Today'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {weekProg.isRestedToday && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => onRestToday(habit.id)}>
                    Undo Rest
                  </Button>
                )}
                {onToggle && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => {
                      feedback.complete();
                      onToggle(habit.id, todayStr);
                    }}
                  >
                    Bonus Done
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HabitOverview({ habits, completions, onToggle }: HabitOverviewProps) {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const [isMobile, setIsMobile] = useState(false);
  const [showRestingTray, setShowRestingTray] = useState(false);
  const { markRestDay } = useHabitStore();
  const feedback = useFeedback();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const displayedDays = useMemo(() => {
    const count = isMobile ? 3 : 7;
    return Array.from({ length: count }, (_, i) => {
      const date = subDays(today, count - 1 - i);
      return {
        date,
        dateStr: format(date, 'yyyy-MM-dd'),
        dayLabel: format(date, 'EEE')[0],
        isToday: format(date, 'yyyy-MM-dd') === todayStr,
      };
    });
  }, [isMobile, todayStr]);

  const { activeDueHabits, restingOrQuotaMetHabits } = useMemo(
    () => partitionHabitsForToday(habits, completions, today),
    [habits, completions]
  );

  const handleRestToday = async (habitId: string) => {
    feedback.tap();
    try {
      await markRestDay(habitId, todayStr);
      toast.success('Updated Rest Day for today');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (habits.length === 0) {
    return (
      <FadeIn delay={0.2} className="tour-habits-widget">
        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No habits yet. Start building your routine!</p>
            <Button asChild><Link href="/habits">Create Your First Habit</Link></Button>
          </CardContent>
        </Card>
      </FadeIn>
    );
  }

  return (
    <FadeIn delay={0.2} className="h-full flex flex-col tour-habits-widget">
      <Card className="h-full flex flex-col rounded-2xl border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg font-semibold">Today&apos;s Habits Matrix</CardTitle>
            <p className="text-xs text-muted-foreground">Tap cell to complete • Moon icon for flexible rest day</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/habits" className="gap-1">View All<ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          <div className="flex items-center mb-2 overflow-x-auto pb-1 scrollbar-hide">
            <div className="w-32 sm:w-44 md:w-48 flex-shrink-0" />
            <div className="flex gap-1">
              {displayedDays.map(({ dateStr, dayLabel, isToday }) => (
                <div
                  key={dateStr}
                  className={cn('w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs font-medium rounded-md', isToday ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground')}
                >
                  {dayLabel}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {activeDueHabits.slice(0, 6).map(({ habit, weekProg, streak }) => (
              <ActiveHabitMatrixRow
                key={habit.id}
                habit={habit}
                weekProg={weekProg}
                streak={streak}
                displayedDays={displayedDays}
                today={today}
                completions={completions}
                onToggle={onToggle}
                onRestToday={handleRestToday}
                feedback={feedback}
              />
            ))}
          </div>

          <RestingHabitsTray
            items={restingOrQuotaMetHabits}
            showRestingTray={showRestingTray}
            onToggleTray={() => setShowRestingTray((prev) => !prev)}
            todayStr={todayStr}
            onRestToday={handleRestToday}
            onToggle={onToggle}
            feedback={feedback}
          />
        </CardContent>
      </Card>
    </FadeIn>
  );
}
