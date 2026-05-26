'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { calculateMomentum } from '@/lib/calculations';
import { isAIEnabled } from '@/lib/ai-features-flag';
import {
  HeroSection,
  MetricCards,
  HabitOverview,
  FocusGoal,
  QuickActions,
  TodayTasksWidget,
  AICoachWidget,

  PersonalizedQuote,
  BentoGrid,
} from '@/components/dashboard';
import OnboardingWizard from '@/components/dashboard/OnboardingWizard';
import { Skeleton } from '@/components/ui/skeleton';
import { MoodCheckIn } from '@/components/dashboard/MoodCheckIn';

import { useUIStore } from '@/lib/stores/ui-store';
import { getSupabaseClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const router = useRouter();
  const { loadDashboardLayout } = useUIStore();
  const [showOnboarding, setShowOnboarding] = useState(false);

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

  // Check if we need to show onboarding
  const isEmpty = habits.length === 0 && goals.length === 0 && !habitsLoading && !goalsLoading;

  useEffect(() => {
    if (isEmpty) {
      const onboarded = localStorage.getItem('habitflow_onboarded');
      if (onboarded !== 'true') {
        setShowOnboarding(true);
      }
    }
  }, [isEmpty]);

  // Initialize data on mount - OPTIMIZED: Parallel loading
  useEffect(() => {
    const init = async () => {
      // Calculate date range once
      const today = new Date();
      const start = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
      const end = format(endOfMonth(today), 'yyyy-MM-dd');

      // Load user layout settings
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadDashboardLayout(session.user.id);
      }

      // ⚡ OPTIMIZATION: Load all data in parallel instead of sequential
      await Promise.all([
        loadHabits(),
        loadGoals(),
        loadAllMilestones(),
        loadCompletions(start, end),
      ]);
    };

    init();
  }, [loadHabits, loadGoals, loadAllMilestones, loadCompletions, loadDashboardLayout]);

  // Computed values - OPTIMIZED: Memoized to prevent recalculation
  const todayProgress = useMemo(() => getTodayProgress(), [habits, completions]);
  const monthlyProgress = useMemo(() => getMonthlyProgress(), [habits, completions]);
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

  if (showOnboarding) {
    return <OnboardingWizard onComplete={() => setShowOnboarding(false)} />;
  }

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
                onClick={() => setShowOnboarding(true)}
                className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <TodayTasksWidget />
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

  // Define widgets for Bento Grid
  const widgets = {
    'metrics': (
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
    ),
    'today-tasks': <TodayTasksWidget />,
    'habit-overview': <HabitOverview habits={habits} completions={completions} onToggle={toggle} />,
    'focus-goal': (
      <FocusGoal
        goals={focusGoals}
        getMilestones={getGoalMilestones}
        getStats={getGoalStats}
        onToggleMilestone={handleToggleMilestone}
      />
    ),
    ...(isAIEnabled() ? { 'ai-quote': <PersonalizedQuote /> } : {}),
    ...(isAIEnabled() ? { 'ai-coach': <AICoachWidget /> } : {}),
    'quick-actions': (
      <QuickActions
        onMarkTodayHabits={handleMarkTodayHabits}
        onAddHabit={handleAddHabit}
        onAddGoal={handleAddGoal}
      />
    )
  };

  return (
    <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-6xl mx-auto space-y-6">
      <HeroSection />

      <MoodCheckIn />

      <BentoGrid widgets={widgets} />
    </div>
  );
}
