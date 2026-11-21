'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useShallow } from 'zustand/react/shallow';
import {
  Check,
  Moon,
  Plus,
  Wallet,
  ArrowUpRight,
  CalendarClock,
  Sparkles,
  Flame,
  Shield,
  MessageSquareText,
  AlertCircle,
} from 'lucide-react';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import {
  calculateMomentum,
  getHabitWeekProgress,
  isHabitAutoRestOnDate,
} from '@/lib/calculations';
import { getTimeGreeting } from '@/lib/design-tokens';
import { isAIEnabled } from '@/lib/ai-features-flag';
import {
  HeroSection,
  MetricCards,
  HabitOverview,
  FocusGoal,
  TodayTasksWidget,
  AICoachWidget,
  BentoGrid,
  WeeklyReviewWidget,
  FinanceOverviewWidget,
  DashboardCenterLoader,
} from '@/components/dashboard';
import OnboardingWizard from '@/components/dashboard/OnboardingWizard';
import DashboardTour from '@/components/dashboard/DashboardTour';
import { MoodCheckIn } from '@/components/dashboard/MoodCheckIn';
import { AddTransactionModal } from '@/components/finance/AddTransactionModal';
import { SmsImportModal } from '@/components/finance/SmsImportModal';
import { AskFinancesDrawer } from '@/components/finance/AskFinancesDrawer';
import { useUserStore } from '@/lib/stores/user-store';
import { EmptyHabitsIllustration } from '@/components/ui/illustrations';
import { ProgressRing } from '@/components/motion';
import { Button } from '@/components/ui/button';

import { useUIStore } from '@/lib/stores/ui-store';
import { useAuth } from '@/providers/auth-provider';
import { useSync } from '@/providers/sync-provider';
import { toast } from 'sonner';

type WorkspaceLens = 'all' | 'habits' | 'finance';

function MiniBurnSparkline({
  points,
}: {
  points: Array<{
    day: number;
    cumulativeSpent: number | null;
    idealCumulativeBudget: number;
  }>;
}) {
  if (points.length === 0) return null;

  const width = 180;
  const height = 42;
  const pad = 3;

  const maxVal = Math.max(
    1,
    ...points.map((p) =>
      Math.max(p.cumulativeSpent ?? 0, p.idealCumulativeBudget || 0)
    )
  );
  const maxDay = Math.max(1, points.length - 1);

  const toX = (idx: number) => pad + (idx / maxDay) * (width - pad * 2);
  const toY = (val: number) => height - pad - (val / maxVal) * (height - pad * 2);

  const idealPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.idealCumulativeBudget).toFixed(1)}`)
    .join(' ');

  const actualPoints = points.filter((p) => p.cumulativeSpent !== null);
  const actualPath = actualPoints
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${toX(p.day - 1).toFixed(1)},${toY(p.cumulativeSpent || 0).toFixed(1)}`
    )
    .join(' ');

  const lastActual = actualPoints[actualPoints.length - 1];
  const isHot =
    lastActual &&
    lastActual.idealCumulativeBudget > 0 &&
    (lastActual.cumulativeSpent || 0) > lastActual.idealCumulativeBudget * 1.05;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-11 overflow-visible"
      aria-label="Cumulative monthly burn vs ideal budget pace"
      role="img"
    >
      <path
        d={idealPath}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
      {actualPath && (
        <path
          d={actualPath}
          fill="none"
          stroke={isHot ? '#f43f5e' : '#10b981'}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {lastActual && (
        <circle
          cx={toX(lastActual.day - 1)}
          cy={toY(lastActual.cumulativeSpent || 0)}
          r="3"
          fill={isHot ? '#f43f5e' : '#10b981'}
        />
      )}
    </svg>
  );
}

export default function DashboardContent() {
  const router = useRouter();
  const loadDashboardLayout = useUIStore((s) => s.loadDashboardLayout);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [workspaceLens, setWorkspaceLens] = useState<WorkspaceLens>('all');
  const [isQuickExpenseOpen, setIsQuickExpenseOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isAskAiOpen, setIsAskAiOpen] = useState(false);

  const { user, isLoading: authLoading } = useAuth();
  const { isDataReady } = useSync();

  const { displayName } = useUserStore(
    useShallow((s) => ({
      displayName: s.displayName,
    }))
  );

  const {
    habits,
    completions,
    loadCompletions,
    initializeWithDemoData,
    getTodayProgress,
    getMonthlyProgress,
    getCurrentStreaks,
    toggle,
    markRestDay,
  } = useHabitStore(
    useShallow((s) => ({
      habits: s.habits,
      completions: s.completions,
      loadCompletions: s.loadCompletions,
      initializeWithDemoData: s.initializeWithDemoData,
      getTodayProgress: s.getTodayProgress,
      getMonthlyProgress: s.getMonthlyProgress,
      getCurrentStreaks: s.getCurrentStreaks,
      toggle: s.toggle,
      markRestDay: s.markRestDay,
    }))
  );

  const {
    goals,
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
      loadAllMilestones: s.loadAllMilestones,
      getFocusGoals: s.getFocusGoals,
      getGoalStats: s.getGoalStats,
      getGoalMilestones: s.getGoalMilestones,
      getActiveGoalsCount: s.getActiveGoalsCount,
      getUpcomingDeadlines: s.getUpcomingDeadlines,
      toggleMilestoneComplete: s.toggleMilestoneComplete,
    }))
  );

  const { settings, loadGamification } = useGamificationStore(
    useShallow((s) => ({
      settings: s.settings,
      loadGamification: s.loadGamification,
    }))
  );

  const { tasks } = useTaskStore(
    useShallow((s) => ({
      tasks: s.tasks,
    }))
  );

  const financeCategories = useFinanceStore((s) => s.categories);
  const financeTransactions = useFinanceStore((s) => s.transactions);
  const financeBudgets = useFinanceStore((s) => s.budgets);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getNetWorthSummary = useFinanceStore((s) => s.getNetWorthSummary);
  const getDailySpendingPace = useFinanceStore((s) => s.getDailySpendingPace);
  const getUpcomingFinancialObligations = useFinanceStore(
    (s) => s.getUpcomingFinancialObligations
  );

  const [isInitializing, setIsInitializing] = useState(true);
  const isLoading = isInitializing;
  const isGoalsEnabled = !settings?.habitOnlyMode && settings?.showGoals !== false;
  const isFinanceEnabled =
    !settings?.habitOnlyMode && settings?.showFinance !== false;
  const isTasksEnabled = !settings?.habitOnlyMode && settings?.showTasks !== false;
  const isEmpty =
    habits.length === 0 && (!isGoalsEnabled || goals.length === 0) && !isLoading;

  // Reset lens if finance gets toggled off in settings
  useEffect(() => {
    if (!isFinanceEnabled && workspaceLens === 'finance') {
      setWorkspaceLens('all');
    }
  }, [isFinanceEnabled, workspaceLens]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setIsInitializing(false);
      return;
    }

    if (!isDataReady) return;

    let active = true;

    const init = async () => {
      try {
        const today = new Date();
        const start = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
        const end = format(endOfMonth(today), 'yyyy-MM-dd');

        await Promise.all([
          loadDashboardLayout(user.id),
          loadAllMilestones(),
          loadCompletions(start, end),
          loadGamification(),
          loadFinanceData(),
        ]);

        const onboarded = localStorage.getItem('habitflow_onboarded');
        if (onboarded !== 'true' && active) {
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error('Failed to initialize dashboard data:', error);
      } finally {
        if (active) {
          setIsInitializing(false);
        }
      }
    };

    init();

    return () => {
      active = false;
    };
  }, [
    authLoading,
    user,
    isDataReady,
    loadAllMilestones,
    loadCompletions,
    loadDashboardLayout,
    loadGamification,
    loadFinanceData,
  ]);

  useEffect(() => {
    if (!showOnboarding && !isLoading && !isEmpty) {
      const onboarded = localStorage.getItem('habitflow_onboarded');
      const tourCompleted = localStorage.getItem(
        'habitflow_dashboard_tutorial_completed'
      );
      if (onboarded === 'true' && tourCompleted !== 'true') {
        setShowTour(true);
      }
    }
  }, [showOnboarding, isLoading, isEmpty]);

  useEffect(() => {
    if ((habits.length > 0 || goals.length > 0) && showOnboarding) {
      setShowOnboarding(false);
      localStorage.setItem('habitflow_onboarded', 'true');
    }
  }, [habits.length, goals.length, showOnboarding]);

  const todayProgress = useMemo(
    () => getTodayProgress(),
    [habits, completions, getTodayProgress]
  );
  const monthlyProgress = useMemo(
    () => getMonthlyProgress(),
    [habits, completions, getMonthlyProgress]
  );
  const streaks = useMemo(
    () => getCurrentStreaks(),
    [habits, completions, getCurrentStreaks]
  );
  const focusGoals = useMemo(() => getFocusGoals(), [goals, getFocusGoals]);
  const activeGoalsCount = useMemo(
    () => getActiveGoalsCount(),
    [goals, getActiveGoalsCount]
  );
  const upcomingDeadlines = useMemo(
    () => getUpcomingDeadlines(7),
    [goals, getUpcomingDeadlines]
  );

  const financeSummary = useMemo(
    () => getMonthlySummary(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getMonthlySummary, financeTransactions, financeCategories, financeBudgets]
  );
  const netWorthSummary = useMemo(
    () => getNetWorthSummary(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getNetWorthSummary, financeTransactions, financeCategories]
  );
  const dailyPacePoints = useMemo(
    () => getDailySpendingPace(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getDailySpendingPace, financeTransactions, financeBudgets]
  );
  const dueSoonObligations = useMemo(
    () => getUpcomingFinancialObligations(7),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getUpcomingFinancialObligations, financeTransactions]
  );

  const { currentMaxStreak, bestStreak } = useMemo(() => {
    const streakValues = Array.from(streaks.values());
    const current = streakValues.length > 0 ? Math.max(...streakValues) : 0;
    return { currentMaxStreak: current, bestStreak: current };
  }, [streaks]);

  const monthlyTrend = useMemo(
    () => calculateMomentum(completions),
    [completions]
  );

  // Schedule-aware Up-Next Habits and Resting/Quota-Met Count
  const { nextUpHabits, restingOrQuotaMetCount } = useMemo(() => {
    const todayDate = new Date();
    const todayStr = format(todayDate, 'yyyy-MM-dd');
    const activeHabits = habits.filter((h) => !h.archived);

    let restingCount = 0;
    const upNext: Array<{
      id: string;
      name: string;
      weekDone: number;
      weekTarget: number;
      restRemaining: number;
    }> = [];

    for (const h of activeHabits) {
      const hComps = completions.filter((c) => c.habitId === h.id);
      const todayRec = hComps.find((c) => c.date === todayStr);
      const isDone = todayRec?.completed === true;
      const isExplicitRest =
        todayRec?.status === 'rest' || todayRec?.skipped === true;
      const isAutoRest = isHabitAutoRestOnDate(h, hComps, todayStr);
      const wp = getHabitWeekProgress(h, hComps, todayDate);

      if (isExplicitRest || isAutoRest || (!isDone && wp.quotaMet)) {
        restingCount++;
        continue;
      }

      if (!isDone) {
        upNext.push({
          id: h.id,
          name: h.name,
          weekDone: wp.completedCount,
          weekTarget: wp.targetCount,
          restRemaining: wp.restRemainingCount,
        });
      }
    }

    return {
      nextUpHabits: upNext.slice(0, 3),
      restingOrQuotaMetCount: restingCount,
    };
  }, [habits, completions]);

  // Unified Today Momentum Score
  const todayScore = useMemo(() => {
    const todayCompleted = todayProgress.completed;
    const todayTotal = todayProgress.total;
    const habitRate = todayTotal > 0 ? todayCompleted / todayTotal : 1;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayTasksList = tasks.filter((t) => {
      if (t.status === 'archived') return false;
      const isDueToday = t.due_date && t.due_date.startsWith(todayStr);
      const isOverdueTodo =
        t.status === 'todo' &&
        t.due_date &&
        t.due_date <= todayStr + 'T23:59:59';
      return isDueToday || isOverdueTodo;
    });
    const totalTasks = todayTasksList.length;
    const completedTasks = todayTasksList.filter((t) => t.status === 'done').length;
    const taskRate = totalTasks > 0 ? completedTasks / totalTasks : 1;

    let score = 100;
    if (todayTotal > 0 && totalTasks > 0 && isTasksEnabled) {
      score = Math.round(habitRate * 60 + taskRate * 40);
    } else if (todayTotal > 0) {
      score = Math.round(habitRate * 100);
    } else if (totalTasks > 0 && isTasksEnabled) {
      score = Math.round(taskRate * 100);
    }
    return {
      score,
      todayCompleted,
      todayTotal,
      completedTasks: isTasksEnabled ? completedTasks : 0,
      totalTasks: isTasksEnabled ? totalTasks : 0,
    };
  }, [todayProgress, tasks, isTasksEnabled]);

  const handleToggleMilestone = async (milestoneId: string) => {
    await toggleMilestoneComplete(milestoneId);
  };

  if (isLoading) {
    return (
      <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto flex flex-col items-center justify-center min-h-[500px]">
        <DashboardCenterLoader />
      </div>
    );
  }

  if (showOnboarding) {
    return <OnboardingWizard onComplete={() => setShowOnboarding(false)} />;
  }

  if (isEmpty) {
    return (
      <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto">
        <HeroSection userName={displayName} currentStreak={currentMaxStreak} />

        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-center max-w-md">
            <div className="mb-6 flex justify-center">
              <EmptyHabitsIllustration />
            </div>
            <h2 className="text-2xl font-bold mb-4">Welcome to HabitFlow!</h2>
            <p className="text-muted-foreground mb-8">
              Start building flexible habits, mastering your cashflow, and achieving your goals.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={async () => {
                  await initializeWithDemoData();
                }}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                Load Demo Data
              </button>
              <button
                onClick={() => setShowOnboarding(true)}
                className="px-6 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors"
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8">
          {isTasksEnabled && <TodayTasksWidget isHydrated={true} />}
        </div>
      </div>
    );
  }

  const todayDateObj = new Date();
  const todayStr = format(todayDateObj, 'yyyy-MM-dd');
  const todayDisplay = format(todayDateObj, 'EEE, d MMM');
  const { greeting } = getTimeGreeting();
  const firstName = displayName?.trim()
    ? displayName.trim().split(/\s+/)[0]
    : undefined;

  const hasBudget = financeSummary.monthlyBudget > 0;
  const budgetPct = hasBudget
    ? Math.min(
        100,
        Math.round(
          (financeSummary.totalSpent / financeSummary.monthlyBudget) * 100
        )
      )
    : 0;
  const isOverBudget =
    hasBudget && financeSummary.totalSpent > financeSummary.monthlyBudget;
  const isAheadOfPace =
    hasBudget &&
    !isOverBudget &&
    budgetPct > financeSummary.dayOfMonthProgressPct + 8;

  const dueSoonTotal = dueSoonObligations.reduce((s, o) => s + o.amount, 0);

  const showHabitHero = workspaceLens !== 'finance';
  const showFinanceHero = isFinanceEnabled && workspaceLens !== 'habits';
  const bothHeroesVisible = showHabitHero && showFinanceHero;

  // Layer 3 Balanced Bento Grid Widgets filtered by Workspace Lens & Settings
  const allWidgets: Record<string, React.ReactNode> = {
    ...(workspaceLens !== 'finance'
      ? {
          metrics: (
            <MetricCards
              todayCompleted={todayProgress.completed}
              todayTotal={todayProgress.total}
              monthlyPercentage={monthlyProgress.percentage}
              monthlyTrend={monthlyTrend}
              currentStreak={currentMaxStreak}
              bestStreak={bestStreak}
              activeGoals={activeGoalsCount}
              upcomingDeadlines={upcomingDeadlines.length}
              habitOnlyMode={!!settings?.habitOnlyMode}
              streakShields={settings?.streakShield ?? 0}
            />
          ),
          'habit-overview': (
            <HabitOverview
              habits={habits}
              completions={completions}
              onToggle={toggle}
            />
          ),
        }
      : {}),
    ...(isFinanceEnabled && workspaceLens !== 'habits'
      ? {
          'finance-overview': <FinanceOverviewWidget />,
        }
      : {}),
    ...(workspaceLens !== 'finance' && isTasksEnabled
      ? {
          'today-tasks': <TodayTasksWidget isHydrated={true} />,
        }
      : {}),
    ...(isGoalsEnabled
      ? {
          'focus-goal': (
            <FocusGoal
              goals={focusGoals}
              getMilestones={getGoalMilestones}
              getStats={getGoalStats}
              onToggleMilestone={handleToggleMilestone}
            />
          ),
        }
      : {}),
    ...(isAIEnabled()
      ? {
          'ai-coach': (
            <AICoachWidget
              onOpenAskFinances={
                isFinanceEnabled ? () => setIsAskAiOpen(true) : undefined
              }
            />
          ),
        }
      : {}),
    ...(workspaceLens !== 'finance'
      ? { 'weekly-review': <WeeklyReviewWidget /> }
      : {}),
  };

  return (
    <div className="w-full px-4 py-4 sm:py-5 md:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-5 pb-24 md:pb-12">
      {/* LAYER 1: Unified Top Command Bar */}
      <header className="surface-card px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 tour-hero-section">
        {/* Left: Greeting + Date + Streak/Shields */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
              {greeting}
              {firstName ? `, ${firstName}` : ''}
            </h1>
            <span className="text-xs text-muted-foreground font-mono">
              · {todayDisplay}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono tabular-nums flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            <span className="inline-flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <strong className="text-foreground">{currentMaxStreak}d</strong> streak
            </span>
            {(settings?.streakShield ?? 0) > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-cyan-500" />
                  <strong className="text-foreground">
                    {settings?.streakShield}
                  </strong>{' '}
                  shields
                </span>
              </>
            )}
          </p>
        </div>

        {/* Center: Workspace Lens Switcher */}
        {isFinanceEnabled && (
          <div
            role="tablist"
            aria-label="Dashboard workspace lens"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted self-start lg:self-center shrink-0"
          >
            {(
              [
                { id: 'all', label: 'All Life OS' },
                { id: 'habits', label: 'Habits & Focus' },
                { id: 'finance', label: 'Finance & Cashflow' },
              ] as const
            ).map((lens) => (
              <button
                key={lens.id}
                type="button"
                role="tab"
                aria-selected={workspaceLens === lens.id}
                onClick={() => setWorkspaceLens(lens.id)}
                className={`min-h-[36px] px-3 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  workspaceLens === lens.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {lens.label}
              </button>
            ))}
          </div>
        )}

        {/* Right: Compact Inline 5-Mood Strip */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
          <MoodCheckIn compact />
        </div>
      </header>

      {/* LAYER 2: Dual Flagship Hero Strip */}
      <div
        className={
          bothHeroesVisible
            ? 'flex overflow-x-auto snap-x snap-mandatory gap-4 pb-1 -mx-4 px-4 lg:mx-0 lg:px-0 lg:pb-0 lg:grid lg:grid-cols-12 lg:gap-5 items-stretch'
            : 'grid grid-cols-1 gap-5'
        }
      >
        {/* Hero A: Today's Momentum */}
        {showHabitHero && (
          <section
            className={`${
              bothHeroesVisible
                ? 'min-w-[90vw] sm:min-w-[520px] lg:min-w-0 snap-center lg:col-span-6'
                : 'col-span-1'
            } surface-hero p-5 sm:p-6 flex flex-col justify-between gap-4 tour-momentum-card`}
          >
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
              <ProgressRing
                progress={todayScore.score}
                size={88}
                strokeWidth={8}
                className="shrink-0"
              >
                <div className="flex flex-col items-center justify-center">
                  <span className="text-2xl font-black font-mono tabular-nums text-foreground tracking-tight">
                    {todayScore.score}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Score
                  </span>
                </div>
              </ProgressRing>

              <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-0.5">
                  <h2 className="text-base sm:text-lg font-bold text-foreground">
                    Today&apos;s Momentum
                  </h2>
                  {restingOrQuotaMetCount > 0 && (
                    <span className="text-xs font-medium text-rest font-mono">
                      · {restingOrQuotaMetCount} resting
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                  {todayScore.score === 100
                    ? 'Every active scheduled habit and due task for today is complete.'
                    : `${todayScore.todayCompleted} of ${todayScore.todayTotal} scheduled habits complete. Rest & quota-met days protect your streak.`}
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2.5 gap-y-1 text-xs font-mono tabular-nums text-muted-foreground pt-1">
                  <span>
                    Habits{' '}
                    <strong className="text-foreground">
                      {todayScore.todayCompleted}/{todayScore.todayTotal}
                    </strong>
                  </span>
                  {isTasksEnabled && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        Tasks{' '}
                        <strong className="text-foreground">
                          {todayScore.completedTasks}/{todayScore.totalTasks}
                        </strong>
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>
                    Month{' '}
                    <strong className="text-foreground">
                      {monthlyProgress.percentage}%
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Up Next Active Habits (1-Tap Done or Rest Day) */}
            {nextUpHabits.length > 0 ? (
              <div className="pt-3 border-t border-border/60 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    Up Next Today
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push('/habits')}
                    className="text-primary hover:underline font-medium"
                  >
                    All Habits →
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {nextUpHabits.map((item) => (
                    <div
                      key={item.id}
                      className="surface-subtle px-2.5 py-2 flex items-center justify-between gap-1.5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {item.name}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground">
                          {item.weekDone}/{item.weekTarget} wk
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            await toggle(item.id, todayStr);
                            toast.success(`Completed ${item.name}`);
                          }}
                          title="Mark Done"
                          aria-label={`Complete ${item.name}`}
                          className="w-8 h-8 rounded-lg bg-success/15 text-success hover:bg-success/25 flex items-center justify-center transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        {item.restRemaining > 0 && (
                          <button
                            type="button"
                            onClick={async () => {
                              await markRestDay(item.id, todayStr);
                              toast.info(`Marked ${item.name} as Rest Day`);
                            }}
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
            ) : (
              <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>All scheduled habits for today are handled!</span>
                </span>
                <button
                  type="button"
                  onClick={() => router.push('/habits')}
                  className="hover:underline font-semibold"
                >
                  Open Grid →
                </button>
              </div>
            )}
          </section>
        )}

        {/* Hero B: Financial Pulse */}
        {showFinanceHero && (
          <section
            className={`${
              bothHeroesVisible
                ? 'min-w-[90vw] sm:min-w-[520px] lg:min-w-0 snap-center lg:col-span-6'
                : 'col-span-1'
            } surface-hero p-5 sm:p-6 flex flex-col justify-between gap-4`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-primary" />
                    Financial Pulse
                  </span>
                  <span
                    className={`font-semibold ${
                      isOverBudget
                        ? 'text-rose-600 dark:text-rose-400'
                        : isAheadOfPace
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    ·{' '}
                    {isOverBudget
                      ? 'Over Budget'
                      : isAheadOfPace
                      ? 'Ahead of Pace'
                      : 'On Pace'}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 pt-0.5 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground">
                    {hasBudget || financeSummary.totalIncome > 0
                      ? formatINR(financeSummary.safeToSpendDaily)
                      : formatINR(financeSummary.totalSpent)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {hasBudget || financeSummary.totalIncome > 0
                      ? `safe / day · ${financeSummary.remainingDaysInMonth}d left`
                      : 'spent this month'}
                  </span>
                </div>
              </div>

              {/* Direct Quick Actions: + Log Expense, SMS, Ask AI, Open */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsQuickExpenseOpen(true)}
                  className="min-h-[38px] px-3 rounded-xl gap-1 text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setIsSmsModalOpen(true)}
                  title="Import SMS / UPI notifications"
                  aria-label="Import SMS"
                  className="min-h-[38px] min-w-[38px] rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MessageSquareText className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAskAiOpen(true)}
                  title="Ask AI about your finances"
                  aria-label="Ask AI Finances"
                  className="min-h-[38px] min-w-[38px] rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center text-invest transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/finance')}
                  aria-label="Open Finance workspace"
                  className="min-h-[38px] min-w-[38px] rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cumulative Burn Sparkline + Budget Progress Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-7 space-y-1.5">
                <div className="relative h-2 w-full rounded-full bg-muted overflow-visible">
                  <div
                    style={{ width: `${hasBudget ? budgetPct : 30}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      isOverBudget
                        ? 'bg-rose-500'
                        : isAheadOfPace
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                  {hasBudget && (
                    <div
                      style={{
                        left: `${Math.min(
                          99,
                          Math.max(1, financeSummary.dayOfMonthProgressPct)
                        )}%`,
                      }}
                      title={`Today's pace: ${financeSummary.dayOfMonthProgressPct}%`}
                      className="absolute -top-1 -bottom-1 w-0.5 bg-foreground/80 rounded-full"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-muted-foreground">
                  <span>
                    Spent {formatINR(financeSummary.totalSpent)}
                    {hasBudget
                      ? ` / ${formatINR(financeSummary.monthlyBudget)}`
                      : ''}
                  </span>
                  <span>NW {formatINR(netWorthSummary.netWorth)}</span>
                </div>
              </div>

              <div className="sm:col-span-5 rounded-xl border border-border/60 bg-muted/35 px-2.5 py-1.5">
                <MiniBurnSparkline points={dailyPacePoints} />
              </div>
            </div>

            {/* Footer Strip: Safe Monthly · Due 7d · Needs Review */}
            <div className="pt-3 border-t border-border/60 grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
              <div>
                <span className="text-[11px] text-muted-foreground font-sans block">
                  Safe Monthly
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatINR(financeSummary.safeToSpendMonthly)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => router.push('/finance?tab=trackers')}
                className="text-left hover:underline"
              >
                <span className="text-[11px] text-muted-foreground font-sans flex items-center gap-1">
                  <CalendarClock className="w-3 h-3 text-amber-500" />
                  Due 7d ({dueSoonObligations.length})
                </span>
                <span
                  className={`font-bold ${
                    dueSoonTotal > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-foreground'
                  }`}
                >
                  {formatINR(dueSoonTotal)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => router.push('/finance?tab=activity')}
                className="text-left hover:underline"
              >
                <span className="text-[11px] text-muted-foreground font-sans flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-primary" />
                  Review Inbox
                </span>
                <span
                  className={`font-bold ${
                    financeSummary.needsReviewCount > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-foreground'
                  }`}
                >
                  {financeSummary.needsReviewCount} pending
                </span>
              </button>
            </div>
          </section>
        )}
      </div>

      {/* LAYER 3: Balanced 12-Col Bento Grid */}
      <BentoGrid widgets={allWidgets} />

      {/* Inline Quick Modals & Drawers */}
      <AddTransactionModal
        open={isQuickExpenseOpen}
        onOpenChange={setIsQuickExpenseOpen}
        onOpenSmsImport={() => {
          setIsQuickExpenseOpen(false);
          setIsSmsModalOpen(true);
        }}
      />
      <SmsImportModal
        open={isSmsModalOpen}
        onOpenChange={setIsSmsModalOpen}
      />
      <AskFinancesDrawer
        open={isAskAiOpen}
        onOpenChange={setIsAskAiOpen}
      />
      {showTour && <DashboardTour onClose={() => setShowTour(false)} />}
    </div>
  );
}
