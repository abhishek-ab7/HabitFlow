'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useShallow } from 'zustand/react/shallow';
import {
  BatteryLow,
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
  Dumbbell,
  Droplets,
  Footprints,
  Zap,
} from 'lucide-react';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useMoodStore } from '@/lib/stores/mood-store';
import { calculateDailyFuelSummary } from '@/lib/fitness/shared-analytics';
import { computeCrossDomainInsights } from '@/lib/intelligence/cross-domain-insights';
import {
  calculateMomentum,
  calculateTodayMomentumScore,
  getHabitWeekProgress,
  isHabitAutoRestOnDate,
} from '@/lib/calculations';
import { getTimeGreeting } from '@/lib/design-tokens';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { isAIEnabled } from '@/lib/ai-features-flag';
import {
  HeroSection,
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

type WorkspaceLens = 'all' | 'habits' | 'fitness' | 'finance';

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
  const financeDebtRecords = useFinanceStore((s) => s.debtRecords);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getNetWorthSummary = useFinanceStore((s) => s.getNetWorthSummary);
  const getDailySpendingPace = useFinanceStore((s) => s.getDailySpendingPace);
  const getSpendingAnomalies = useFinanceStore((s) => s.getSpendingAnomalies);
  const getUpcomingFinancialObligations = useFinanceStore(
    (s) => s.getUpcomingFinancialObligations
  );

  const fitnessProfile = useFitnessStore((s) => s.profile);
  const fitnessDailyLogs = useFitnessStore((s) => s.dailyLogs);
  const fitnessMealLogs = useFitnessStore((s) => s.mealLogs);
  const fitnessWorkoutSessions = useFitnessStore((s) => s.workoutSessions);
  const fitnessSupplements = useFitnessStore((s) => s.supplementInventory);
  const fitnessSupplementLogs = useFitnessStore((s) => s.supplementLogs);
  const loadFitnessData = useFitnessStore((s) => s.loadFitnessData);
  const incrementFitnessWater = useFitnessStore((s) => s.incrementWater);
  const toggleLowEnergyMode = useFitnessStore((s) => s.toggleLowEnergyMode);

  const moodLogs = useMoodStore((s) => s.moodLogs);
  const loadMoodLogs = useMoodStore((s) => s.loadMoodLogs);

  const [isInitializing, setIsInitializing] = useState(true);
  const isLoading = isInitializing;
  const isGoalsEnabled = !settings?.habitOnlyMode && settings?.showGoals !== false;
  const isFinanceEnabled =
    !settings?.habitOnlyMode && settings?.showFinance !== false;
  const isFitnessEnabled =
    !settings?.habitOnlyMode && settings?.showFitness !== false;
  const isTasksEnabled = !settings?.habitOnlyMode && settings?.showTasks !== false;
  const isEmpty =
    habits.length === 0 && (!isGoalsEnabled || goals.length === 0) && !isLoading;

  // Reset lens if finance or fitness gets toggled off in settings
  useEffect(() => {
    if (!isFinanceEnabled && workspaceLens === 'finance') {
      setWorkspaceLens('all');
    }
    if (!isFitnessEnabled && workspaceLens === 'fitness') {
      setWorkspaceLens('all');
    }
  }, [isFinanceEnabled, isFitnessEnabled, workspaceLens]);

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
          loadFitnessData(user.id),
          loadMoodLogs(start, end),
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
    loadFitnessData,
    loadMoodLogs,
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

  const todayIsoStr = getLocalIsoDate();
  const todayFitnessLog = useMemo(
    () => fitnessDailyLogs.find((d) => d.date === todayIsoStr && !d.deletedAt),
    [fitnessDailyLogs, todayIsoStr]
  );
  const todayFuelSummary = useMemo(
    () =>
      calculateDailyFuelSummary(
        fitnessMealLogs,
        todayFitnessLog,
        fitnessProfile,
        todayIsoStr
      ),
    [fitnessMealLogs, todayFitnessLog, fitnessProfile, todayIsoStr]
  );

  // Unified Today Momentum Score (rest/quota-met habits excluded cleanly)
  const todayScore = useMemo(
    () =>
      calculateTodayMomentumScore({
        habits,
        completions,
        tasks,
        todayStr: todayIsoStr,
        isTasksEnabled,
      }),
    [habits, completions, tasks, todayIsoStr, isTasksEnabled]
  );

  // Deterministic Cross-Domain & Finance Anomaly Alerts (always visible even if AI toggle is off)
  const crossDomainReport = useMemo(() => {
    if (settings?.habitOnlyMode || (!isFinanceEnabled && !isFitnessEnabled)) {
      return null;
    }
    return computeCrossDomainInsights({
      todayDate: todayIsoStr,
      transactions: financeTransactions,
      categories: financeCategories,
      debtRecords: financeDebtRecords,
      mealLogs: fitnessMealLogs,
      workoutSessions: fitnessWorkoutSessions,
      fitnessDailyLogs,
      supplementInventory: fitnessSupplements,
      supplementLogs: fitnessSupplementLogs,
      habits,
      habitCompletions: completions,
      moodLogs,
    });
  }, [
    settings?.habitOnlyMode,
    isFinanceEnabled,
    isFitnessEnabled,
    todayIsoStr,
    financeTransactions,
    financeCategories,
    financeDebtRecords,
    fitnessMealLogs,
    fitnessWorkoutSessions,
    fitnessDailyLogs,
    fitnessSupplements,
    fitnessSupplementLogs,
    habits,
    completions,
    moodLogs,
  ]);

  const financeAnomalies = useMemo(() => {
    if (!isFinanceEnabled) return [];
    return getSpendingAnomalies().slice(0, 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinanceEnabled, getSpendingAnomalies, financeTransactions]);

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

  const showHabitHero = workspaceLens === 'all' || workspaceLens === 'habits';
  const showFitnessHero =
    isFitnessEnabled && (workspaceLens === 'all' || workspaceLens === 'fitness');
  const showFinanceHero =
    isFinanceEnabled && (workspaceLens === 'all' || workspaceLens === 'finance');
  const bothHeroesVisible = showHabitHero && showFinanceHero;

  // Layer 3 Balanced Bento Grid Widgets filtered by Workspace Lens & Settings
  const allWidgets: Record<string, React.ReactNode> = {
    ...(workspaceLens === 'all' || workspaceLens === 'habits'
      ? {
          'habit-overview': (
            <HabitOverview
              habits={habits}
              completions={completions}
              onToggle={toggle}
            />
          ),
        }
      : {}),
    ...(isFinanceEnabled && (workspaceLens === 'all' || workspaceLens === 'finance')
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
    <div className="w-full overflow-x-hidden px-4 py-4 sm:py-5 md:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-5 pb-24 md:pb-12">
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
        {(isFinanceEnabled || isFitnessEnabled) && (
          <div
            role="tablist"
            aria-label="Dashboard workspace lens"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted self-start lg:self-center shrink-0 overflow-x-auto max-w-full"
          >
            {(
              [
                { id: 'all', label: 'All Life OS' },
                { id: 'habits', label: 'Habits & Focus' },
                ...(isFitnessEnabled
                  ? [{ id: 'fitness', label: 'Body & Fitness' } as const]
                  : []),
                ...(isFinanceEnabled
                  ? [{ id: 'finance', label: 'Finance & Cashflow' } as const]
                  : []),
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
                    {monthlyTrend !== 'stable' && (
                      <span
                        className={
                          monthlyTrend === 'up'
                            ? 'text-emerald-600 dark:text-emerald-400 ml-1'
                            : 'text-rose-600 dark:text-rose-400 ml-1'
                        }
                      >
                        {monthlyTrend === 'up' ? '↑' : '↓'}
                      </span>
                    )}
                  </span>
                  {isGoalsEnabled && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        Goals{' '}
                        <strong className="text-foreground">
                          {activeGoalsCount}
                        </strong>
                        {upcomingDeadlines.length > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 ml-1">
                            ({upcomingDeadlines.length} due)
                          </span>
                        )}
                      </span>
                    </>
                  )}
                  {bestStreak > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        Best{' '}
                        <strong className="text-foreground">{bestStreak}d</strong>
                      </span>
                    </>
                  )}
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
                  {(hasBudget || financeSummary.totalIncome > 0) && (
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
                  )}
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

      {/* Hero C: Compact Body & Fuel Summary Strip */}
      {showFitnessHero && (
        <section className="surface-hero p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                <Dumbbell className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span>Body &amp; Fuel Today</span>
                  {todayFuelSummary.lowEnergyMode && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 normal-case tracking-normal">
                      Low-Energy Day
                    </span>
                  )}
                </p>
                <p className="text-sm font-bold text-foreground">
                  {todayFuelSummary.caloriesRemaining >= 0
                    ? `${todayFuelSummary.caloriesRemaining} kcal left`
                    : `${Math.abs(todayFuelSummary.caloriesRemaining)} kcal over`}{' '}
                  <span className="text-muted-foreground font-normal">
                    ({todayFuelSummary.caloriesConsumed}/{todayFuelSummary.calorieTarget})
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
              <div>
                <span className="text-muted-foreground font-sans block text-[11px]">
                  Protein
                </span>
                <strong className="text-emerald-600 dark:text-emerald-400 text-sm">
                  {todayFuelSummary.proteinConsumedG}g
                </strong>
                <span className="text-muted-foreground">
                  /{todayFuelSummary.proteinTargetG}g
                </span>
              </div>

              <div>
                <span className="text-muted-foreground font-sans flex items-center gap-1 text-[11px]">
                  <Footprints className="w-3 h-3 text-sky-500" /> Steps
                </span>
                <strong className="text-foreground text-sm">
                  {todayFuelSummary.steps.toLocaleString()}
                </strong>
                <span className="text-muted-foreground">
                  /{todayFuelSummary.stepsTarget.toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground font-sans flex items-center gap-1 text-[11px]">
                  <Droplets className="w-3 h-3 text-sky-500" /> Water
                </span>
                <strong className="text-foreground text-sm">
                  {todayFuelSummary.waterMl}ml
                </strong>
                <span className="text-muted-foreground">
                  /{todayFuelSummary.waterTargetMl}ml
                </span>
              </div>

              {todayFuelSummary.sleepHours != null && (
                <div>
                  <span className="text-muted-foreground font-sans block text-[11px]">
                    Sleep
                  </span>
                  <strong className="text-foreground text-sm">
                    {todayFuelSummary.sleepHours}h
                  </strong>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant={todayFuelSummary.lowEnergyMode ? 'default' : 'secondary'}
              data-testid="dashboard-low-energy-toggle"
              onClick={async () => {
                const next = !todayFuelSummary.lowEnergyMode;
                const { restedHabitIds } = await toggleLowEnergyMode(
                  todayIsoStr,
                  next,
                  user?.id
                );
                if (next) {
                  toast.success(
                    restedHabitIds.length > 0
                      ? `Low-Energy Day ON (${restedHabitIds.length} gym habit rested)`
                      : 'Minimum Viable Day ON'
                  );
                } else {
                  toast.success('Normal targets restored');
                }
              }}
              className={`h-8 text-xs gap-1 ${
                todayFuelSummary.lowEnergyMode
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : ''
              }`}
            >
              <BatteryLow className="w-3.5 h-3.5" />
              {todayFuelSummary.lowEnergyMode ? 'Low-Energy ON' : 'Low-Energy'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                incrementFitnessWater(250, todayIsoStr, user?.id);
                toast.success('+250ml water logged');
              }}
              className="h-8 text-xs gap-1"
            >
              <Droplets className="w-3.5 h-3.5 text-sky-500" /> +250ml
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => window.dispatchEvent(new Event('open-quick-capture'))}
              className="h-8 text-xs gap-1"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" /> 10s Capture
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => router.push('/fitness')}
              className="h-8 text-xs gap-1"
            >
              Open Fitness <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </section>
      )}

      {/* Deterministic Cross-Domain & Finance Alerts (Always-Visible regardless of AI toggle) */}
      {((crossDomainReport?.alerts.length ?? 0) > 0 || financeAnomalies.length > 0) && (
        <section
          data-testid="dashboard-deterministic-alerts"
          aria-label="Life OS Cross-Domain Alerts"
          className="surface-card p-3.5 sm:p-4 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                <AlertCircle className="w-3.5 h-3.5" />
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Life OS Signals &amp; Wallet Alerts
              </h2>
            </div>
            {isFinanceEnabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAskAiOpen(true)}
                className="h-7 px-2.5 text-[11px] gap-1 rounded-lg"
              >
                <MessageSquareText className="w-3 h-3 text-primary" />
                Ask Life OS
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {crossDomainReport?.alerts.slice(0, 4).map((alert) => (
              <div
                key={alert.id}
                className={`rounded-xl border p-3 flex items-start justify-between gap-2.5 text-xs ${
                  alert.severity === 'critical'
                    ? 'border-rose-500/30 bg-rose-500/5'
                    : alert.severity === 'warning'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-border bg-background/60'
                }`}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-foreground">{alert.title}</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-secondary text-[10px] font-mono text-muted-foreground">
                      {alert.metricBadge}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {alert.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      alert.pillar === 'gym_supplement_roi' ? '/fitness' : '/analytics'
                    )
                  }
                  className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
                >
                  Inspect <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            ))}
            {financeAnomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className={`rounded-xl border p-3 flex items-start justify-between gap-2.5 text-xs ${
                  anomaly.severity === 'critical'
                    ? 'border-rose-500/30 bg-rose-500/5'
                    : 'border-amber-500/30 bg-amber-500/5'
                }`}
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-semibold text-foreground">{anomaly.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {anomaly.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      anomaly.actionTarget === 'finance' ||
                        anomaly.actionTarget === 'budgets'
                        ? '/finance'
                        : `/finance?tab=${anomaly.actionTarget}`
                    )
                  }
                  className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
                >
                  {anomaly.actionLabel} <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

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
