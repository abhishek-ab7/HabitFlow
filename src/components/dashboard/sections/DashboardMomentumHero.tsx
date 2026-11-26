'use client';

import React from 'react';
import Link from 'next/link';
import { Check, Moon, Sparkles } from 'lucide-react';
import { ProgressRing } from '@/components/motion';

export interface NextUpHabitItem {
  id: string;
  name: string;
  weekDone: number;
  weekTarget: number;
  restRemaining: number;
}

function NextUpHabitsStrip(params: {
  nextUpHabits: NextUpHabitItem[];
  onCompleteHabit: (item: NextUpHabitItem) => void;
  onRestHabit: (item: NextUpHabitItem) => void;
}) {
  const { nextUpHabits, onCompleteHabit, onRestHabit } = params;
  if (nextUpHabits.length === 0) {
    return (
      <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>All scheduled habits for today are handled!</span>
        </span>
        <Link href="/habits" className="hover:underline font-semibold">Open Grid →</Link>
      </div>
    );
  }

  return (
    <div className="pt-3 border-t border-border/60 space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Up Next Today</span>
        <Link href="/habits" className="text-primary hover:underline font-medium">All Habits →</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {nextUpHabits.map((item) => (
          <div key={item.id} className="surface-subtle px-2.5 py-2 flex items-center justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
              <p className="text-[10px] font-mono text-muted-foreground">{item.weekDone}/{item.weekTarget} wk</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onCompleteHabit(item)}
                title="Mark Done"
                aria-label={`Complete ${item.name}`}
                className="w-8 h-8 rounded-lg bg-success/15 text-success hover:bg-success/25 flex items-center justify-center transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
              {item.restRemaining > 0 && (
                <button
                  type="button"
                  onClick={() => onRestHabit(item)}
                  title={`Take Rest Day (${item.restRemaining} left)`}
                  aria-label={`Rest day for ${item.name}`}
                  className="w-8 h-8 rounded-lg bg-rest/15 text-rest hover:bg-rest/25 flex items-center justify-center transition-colors"
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MomentumMetricsRow(params: {
  todayScore: { todayCompleted: number; todayTotal: number; completedTasks: number; totalTasks: number };
  isTasksEnabled: boolean;
  monthlyPct: number;
  monthlyTrend: 'up' | 'down' | 'stable';
  isGoalsEnabled: boolean;
  activeGoalsCount: number;
  upcomingDeadlinesCount: number;
  bestStreak: number;
}) {
  const { todayScore, isTasksEnabled, monthlyPct, monthlyTrend, isGoalsEnabled, activeGoalsCount, upcomingDeadlinesCount, bestStreak } = params;
  const trendCls = monthlyTrend === 'up' ? 'text-emerald-600 dark:text-emerald-400 ml-1' : 'text-rose-600 dark:text-rose-400 ml-1';

  return (
    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2.5 gap-y-1 text-xs font-mono tabular-nums text-muted-foreground pt-1">
      <span>Habits <strong className="text-foreground">{todayScore.todayCompleted}/{todayScore.todayTotal}</strong></span>
      {isTasksEnabled && <span>· Tasks <strong className="text-foreground">{todayScore.completedTasks}/{todayScore.totalTasks}</strong></span>}
      <span>
        · Month <strong className="text-foreground">{monthlyPct}%</strong>
        {monthlyTrend !== 'stable' && <span className={trendCls}>{monthlyTrend === 'up' ? '↑' : '↓'}</span>}
      </span>
      {isGoalsEnabled && (
        <span>
          · Goals <strong className="text-foreground">{activeGoalsCount}</strong>
          {upcomingDeadlinesCount > 0 && <span className="text-amber-600 dark:text-amber-400 ml-1">({upcomingDeadlinesCount} due)</span>}
        </span>
      )}
      {bestStreak > 0 && <span>· Best <strong className="text-foreground">{bestStreak}d</strong></span>}
    </div>
  );
}

export function DashboardMomentumHero(params: {
  bothHeroesVisible: boolean;
  todayScore: { score: number; todayCompleted: number; todayTotal: number; completedTasks: number; totalTasks: number };
  restingOrQuotaMetCount: number;
  isTasksEnabled: boolean;
  monthlyPct: number;
  monthlyTrend: 'up' | 'down' | 'stable';
  isGoalsEnabled: boolean;
  activeGoalsCount: number;
  upcomingDeadlinesCount: number;
  bestStreak: number;
  nextUpHabits: NextUpHabitItem[];
  onCompleteHabit: (item: NextUpHabitItem) => void;
  onRestHabit: (item: NextUpHabitItem) => void;
}) {
  const {
    bothHeroesVisible, todayScore, restingOrQuotaMetCount, isTasksEnabled,
    monthlyPct, monthlyTrend, isGoalsEnabled, activeGoalsCount, upcomingDeadlinesCount,
    bestStreak, nextUpHabits, onCompleteHabit, onRestHabit,
  } = params;
  const colCls = bothHeroesVisible ? 'min-w-[90vw] sm:min-w-[520px] lg:min-w-0 snap-center lg:col-span-6' : 'col-span-1';

  return (
    <section className={`${colCls} surface-hero p-5 sm:p-6 flex flex-col justify-between gap-4 tour-momentum-card`}>
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
        <ProgressRing progress={todayScore.score} size={88} strokeWidth={8} className="shrink-0">
          <div className="flex flex-col items-center justify-center">
            <span className="text-2xl font-black font-mono tabular-nums text-foreground tracking-tight">{todayScore.score}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Score</span>
          </div>
        </ProgressRing>

        <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-0.5">
            <h2 className="text-base sm:text-lg font-bold text-foreground">Today&apos;s Momentum</h2>
            {restingOrQuotaMetCount > 0 && <span className="text-xs font-medium text-rest font-mono">· {restingOrQuotaMetCount} resting</span>}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
            {todayScore.score === 100
              ? 'Every active scheduled habit and due task for today is complete.'
              : `${todayScore.todayCompleted} of ${todayScore.todayTotal} scheduled habits complete. Rest & quota-met days protect your streak.`}
          </p>
          <MomentumMetricsRow
            todayScore={todayScore}
            isTasksEnabled={isTasksEnabled}
            monthlyPct={monthlyPct}
            monthlyTrend={monthlyTrend}
            isGoalsEnabled={isGoalsEnabled}
            activeGoalsCount={activeGoalsCount}
            upcomingDeadlinesCount={upcomingDeadlinesCount}
            bestStreak={bestStreak}
          />
        </div>
      </div>

      <NextUpHabitsStrip nextUpHabits={nextUpHabits} onCompleteHabit={onCompleteHabit} onRestHabit={onRestHabit} />
    </section>
  );
}
