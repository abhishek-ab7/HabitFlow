'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { calculateMomentum } from '@/lib/calculations';
import {
  HeroSection,
  MetricCards,
  HabitOverview,
  FocusGoal,
  QuickActions,
} from '@/components/dashboard';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const router = useRouter();

  // Habit store
  const {
    habits,
    completions,
    isLoading: habitsLoading,
    loadHabits,
    loadCompletions,
    initializeWithDemoData,
    getTodayProgress,
    getMonthlyProgress,
    getCurrentStreaks,
    toggle,
  } = useHabitStore();

  // Goal store
  const {
    goals,
    milestones,
    isLoading: goalsLoading,
    loadGoals,
    loadAllMilestones,
    getFocusGoals,
    getGoalStats,
    getGoalMilestones,
    getActiveGoalsCount,
    getUpcomingDeadlines,
    toggleMilestoneComplete,
  } = useGoalStore();

  // Initialize data on mount
  useEffect(() => {
    const init = async () => {
      await loadHabits();
      await loadGoals();
      await loadAllMilestones();

      // Load completions for current and previous month
      const today = new Date();
      const start = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
      const end = format(endOfMonth(today), 'yyyy-MM-dd');
      await loadCompletions(start, end);
    };

    init();
  }, [loadHabits, loadGoals, loadAllMilestones, loadCompletions]);

  // Computed values
  const todayProgress = getTodayProgress();
  const monthlyProgress = getMonthlyProgress();
  const streaks = getCurrentStreaks();
  const focusGoals = getFocusGoals();
  const activeGoalsCount = getActiveGoalsCount();
  const upcomingDeadlines = getUpcomingDeadlines(7);

  // Calculate best streak and current max streak
  const { currentMaxStreak, bestStreak } = useMemo(() => {
    const streakValues = Array.from(streaks.values());
    const current = streakValues.length > 0 ? Math.max(...streakValues) : 0;
    // For best streak, we'd need historical data - for now use current as estimate
    return { currentMaxStreak: current, bestStreak: current };
  }, [streaks]);

  // Calculate monthly trend
  const monthlyTrend = useMemo(() => {
    return calculateMomentum(completions);
  }, [completions]);

  const isLoading = habitsLoading || goalsLoading;

  // Handlers
  const handleMarkTodayHabits = () => {
    router.push('/habits');
  };

  const handleAddHabit = () => {
    router.push('/habits?new=true');
  };

  const handleAddGoal = () => {
    router.push('/goals?new=true');
  };

  const handleToggleMilestone = async (milestoneId: string) => {
    await toggleMilestoneComplete(milestoneId);
  };

  // Check if we need to show demo data prompt
  const isEmpty = habits.length === 0 && goals.length === 0 && !isLoading;

  if (isEmpty) {
    return (
      <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-6xl mx-auto">
        <HeroSection />

        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4">Welcome to Habit Tracker!</h2>
            <p className="text-muted-foreground mb-8">
              Start building better habits and achieving your goals.
              Would you like to see how the app works with some demo data?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={async () => {
                  await initializeWithDemoData();
                }}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Load Demo Data
              </button>
              <button
                onClick={() => router.push('/habits?new=true')}
                className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-6xl mx-auto">
        <Skeleton className="h-40 rounded-2xl mb-8" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-6xl mx-auto">
      <HeroSection />

      <MetricCards
        todayCompleted={todayProgress.completed}
        todayTotal={todayProgress.total}
        monthlyPercentage={monthlyProgress.percentage}
        monthlyTrend={monthlyTrend}
        currentStreak={currentMaxStreak}
        bestStreak={bestStreak}
        activeGoals={activeGoalsCount}
        upcomingDeadlines={upcomingDeadlines.length}
      />


      <div className="grid gap-6 lg:grid-cols-2">
        <HabitOverview habits={habits} completions={completions} onToggle={toggle} />
        <FocusGoal
          goals={focusGoals}
          getMilestones={getGoalMilestones}
          getStats={getGoalStats}
          onToggleMilestone={handleToggleMilestone}
        />
      </div>

      <QuickActions
        onMarkTodayHabits={handleMarkTodayHabits}
        onAddHabit={handleAddHabit}
        onAddGoal={handleAddGoal}
      />
    </div>
  );
}
