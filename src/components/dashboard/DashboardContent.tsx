'use client';

// Force HMR refresh
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useShallow } from 'zustand/react/shallow';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { useTaskStore } from '@/lib/stores/task-store';
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
  WeeklyReviewWidget,
} from '@/components/dashboard';
import OnboardingWizard from '@/components/dashboard/OnboardingWizard';
import { Skeleton } from '@/components/ui/skeleton';
import { MoodCheckIn } from '@/components/dashboard/MoodCheckIn';
import { FocusModeOverlay } from '@/components/dashboard/FocusModeOverlay';
import { useUserStore } from '@/lib/stores/user-store';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { EmptyHabitsIllustration } from '@/components/ui/illustrations';
import { ProgressRing } from '@/components/motion';

import { useUIStore } from '@/lib/stores/ui-store';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/providers/auth-provider';

export default function DashboardContent() {
  const router = useRouter();
  const loadDashboardLayout = useUIStore((s) => s.loadDashboardLayout);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isFocusOpen, setIsFocusOpen] = useState(false);
  const { user, isLoading: authLoading } = useAuth();

  const { displayName, loadUser } = useUserStore(
    useShallow((s) => ({
      displayName: s.displayName,
      loadUser: s.loadUser,
    }))
  );

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
  } = useHabitStore(
    useShallow((s) => ({
      habits: s.habits,
      completions: s.completions,
      isLoading: s.isLoading,
      loadHabits: s.loadHabits,
      loadCompletions: s.loadCompletions,
      initializeWithDemoData: s.initializeWithDemoData,
      getTodayProgress: s.getTodayProgress,
      getMonthlyProgress: s.getMonthlyProgress,
      getCurrentStreaks: s.getCurrentStreaks,
      toggle: s.toggle,
    }))
  );

  // Goal store
  const {
    goals,
    isLoading: goalsLoading,
    loadGoals,
    loadAllMilestones,
    getFocusGoals,
    getGoalStats,
    getGoalMilestones,
    getActiveGoalsCount,
    getUpcomingDeadlines,
    toggleMilestoneComplete,
  } = useGoalStore(
    useShallow((s) => ({
      goals: s.goals,
      isLoading: s.isLoading,
      loadGoals: s.loadGoals,
      loadAllMilestones: s.loadAllMilestones,
      getFocusGoals: s.getFocusGoals,
      getGoalStats: s.getGoalStats,
      getGoalMilestones: s.getGoalMilestones,
      getActiveGoalsCount: s.getActiveGoalsCount,
      getUpcomingDeadlines: s.getUpcomingDeadlines,
      toggleMilestoneComplete: s.toggleMilestoneComplete,
    }))
  );

  // Task store
  const {
    tasks,
    loadTasks,
  } = useTaskStore(
    useShallow((s) => ({
      tasks: s.tasks,
      loadTasks: s.loadTasks,
    }))
  );

  // Check if we need to show onboarding
  const isEmpty = habits.length === 0 && goals.length === 0 && !habitsLoading && !goalsLoading;

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
        await Promise.all([
          loadDashboardLayout(session.user.id),
          loadUser(),
        ]);

        // Check if welcome wizard should be shown (only on brand new signup)
        const onboarded = localStorage.getItem('habitflow_onboarded');
        if (onboarded !== 'true') {
          const justSignedUp = localStorage.getItem('habitflow_just_signed_up') === 'true';
          const createdAt = session.user.created_at;
          const lastSignInAt = session.user.last_sign_in_at;
          
          const isNewUser = createdAt && lastSignInAt && 
            (new Date(lastSignInAt).getTime() - new Date(createdAt).getTime() < 120000); // 2 minutes

          if (justSignedUp || isNewUser) {
            setShowOnboarding(true);
          }
        }
      }

      // ⚡ OPTIMIZATION: Load all data in parallel instead of sequential
      await Promise.all([
        loadHabits(),
        loadGoals(),
        loadAllMilestones(),
        loadCompletions(start, end),
        loadTasks(),
      ]);
    };

    init();
  }, [loadHabits, loadGoals, loadAllMilestones, loadCompletions, loadDashboardLayout, loadUser]);

  // Auto-trigger daily Focus Mode
  useEffect(() => {
    if (!showOnboarding && !isEmpty && !authLoading) {
      const todayStr = new Date().toISOString().split('T')[0];
      const userId = user?.id || 'guest';
      const started = localStorage.getItem(`focus_mode_started_${userId}_${todayStr}`);
      if (started !== 'true') {
        setIsFocusOpen(true);
      }
    }
  }, [showOnboarding, isEmpty, authLoading, user?.id]);

  // If we have habits or goals, we are an existing user. Disable onboarding if it's open.
  useEffect(() => {
    if ((habits.length > 0 || goals.length > 0) && showOnboarding) {
      setShowOnboarding(false);
      localStorage.setItem('habitflow_onboarded', 'true');
    }
  }, [habits.length, goals.length, showOnboarding]);

  // Computed values - OPTIMIZED: Memoized to prevent recalculation
  const todayProgress = useMemo(() => getTodayProgress(), [habits, completions, getTodayProgress]);
  const monthlyProgress = useMemo(() => getMonthlyProgress(), [habits, completions, getMonthlyProgress]);
  const streaks = useMemo(() => getCurrentStreaks(), [habits, completions, getCurrentStreaks]);
  const focusGoals = useMemo(() => getFocusGoals(), [goals, getFocusGoals]);
  const activeGoalsCount = useMemo(() => getActiveGoalsCount(), [goals, getActiveGoalsCount]);
  const upcomingDeadlines = useMemo(() => getUpcomingDeadlines(7), [goals, getUpcomingDeadlines]);

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

  // Unified Today Momentum Score
  const todayScore = useMemo(() => {
    const todayCompleted = todayProgress.completed;
    const todayTotal = todayProgress.total;
    const habitRate = todayTotal > 0 ? (todayCompleted / todayTotal) : 1;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayTasksList = tasks.filter(t => {
      if (t.status === 'archived') return false;
      const isDueToday = t.due_date && t.due_date.startsWith(todayStr);
      const isOverdueTodo = t.status === 'todo' && t.due_date && t.due_date <= todayStr + "T23:59:59";
      return isDueToday || isOverdueTodo;
    });
    const totalTasks = todayTasksList.length;
    const completedTasks = todayTasksList.filter(t => t.status === 'done').length;
    const taskRate = totalTasks > 0 ? (completedTasks / totalTasks) : 1;

    let score = 100;
    if (todayTotal > 0 && totalTasks > 0) {
      score = Math.round(habitRate * 60 + taskRate * 40);
    } else if (todayTotal > 0) {
      score = Math.round(habitRate * 100);
    } else if (totalTasks > 0) {
      score = Math.round(taskRate * 100);
    }
    return {
      score,
      todayCompleted,
      todayTotal,
      completedTasks,
      totalTasks
    };
  }, [todayProgress, tasks]);

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
        <HeroSection userName={displayName} currentStreak={currentMaxStreak} />

        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-center max-w-md">
            <div className="mb-6 flex justify-center">
              <EmptyHabitsIllustration />
            </div>
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
    ),
    'weekly-review': <WeeklyReviewWidget />
  };

  return (
    <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsFocusOpen(true)}
          className="gap-2 text-xs border-indigo-200 dark:border-indigo-900/60 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-semibold rounded-xl h-8"
        >
          <Sparkles className="w-3.5 h-3.5 fill-current" />
          Focus Mode
        </Button>
      </div>

      <HeroSection userName={displayName} currentStreak={currentMaxStreak} />

      <MoodCheckIn />

      {/* Unified Today Score Ring Card */}
      <div className="bg-card/45 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center gap-6 mb-6 hover:border-primary/20 transition-all">
        <ProgressRing progress={todayScore.score} size={100} strokeWidth={8} className="shrink-0">
          <div className="flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-foreground tracking-tight">{todayScore.score}</span>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Score</span>
          </div>
        </ProgressRing>
        <div className="flex-1 text-center sm:text-left space-y-1.5">
          <h3 className="text-xl font-bold text-foreground">Today's Momentum</h3>
          <p className="text-sm text-muted-foreground max-w-xl">
            {todayScore.score === 100 
              ? "Flawless progress! All scheduled habits and due tasks completed. You are on fire today! 🔥"
              : todayScore.score >= 80 
              ? "Exceptional velocity! Just a few items remaining to secure a perfect daily score. 🚀"
              : todayScore.score >= 50 
              ? "Over halfway mark! Keep up the momentum to build consistency and unlock today's full XP reward. 💪"
              : todayScore.score > 0 
              ? "Good start! Keep moving down your checklist and complete your habits and tasks. 📈"
              : "Let's kickstart the flow! Track your first habit or complete a task to begin today's momentum. 🌱"}
          </p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-xs font-semibold text-muted-foreground pt-1">
            <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1 rounded-full border border-border/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Habits: {todayScore.todayCompleted}/{todayScore.todayTotal}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1 rounded-full border border-border/20">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>Tasks: {todayScore.completedTasks}/{todayScore.totalTasks}</span>
            </div>
          </div>
        </div>
      </div>

      <BentoGrid widgets={widgets} />

      <FocusModeOverlay isOpen={isFocusOpen} onClose={() => setIsFocusOpen(false)} />
    </div>
  );
}
