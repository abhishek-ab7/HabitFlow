'use client';

// Force HMR refresh
import dynamic from 'next/dynamic';
import { useEffect, useState, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { subDays, subYears, format } from 'date-fns';
import { BarChart3, TrendingUp, Target, Flame, Calendar, Check, Heart, Coffee, Smile, Brain, Sparkles, AlertCircle, ShoppingBag, Utensils, ShieldCheck, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FadeIn, StaggerContainer, StaggerItem, CountUp } from '@/components/motion';
import { TimeRangeTabs } from '@/components/analytics';
import { useHabitStore, useGoalStore, useTaskStore, useMoodStore, usePomodoroStore, useFinanceStore, formatINR } from '@/lib/stores';
import { CrossDomainActionMediator } from '@/lib/stores/mediator';
import { toast } from 'sonner';
import {
  calculateDailyStats,
  calculateCategoryBreakdown,
  generateHeatmapData,
  calculateMomentum,
  calculateCurrentStreak,
  calculateBestStreak,
} from '@/lib/calculations';
import type { TimeRange, DailyStats, WeekdayStats, Insight, Trend, MoodType, HabitCompletion } from '@/lib/types';
import { DAYS_OF_WEEK } from '@/lib/types';
import { cn } from '@/lib/utils';

// Dynamic imports for heavy chart components
const ConsistencyChart = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.ConsistencyChart })),
  { loading: () => <Skeleton className="h-64 w-full rounded-xl" />, ssr: false }
);

const CategoryBreakdownChart = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.CategoryBreakdownChart })),
  { loading: () => <Skeleton className="h-64 w-full rounded-xl" />, ssr: false }
);

const WeekdayChart = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.WeekdayChart })),
  { loading: () => <Skeleton className="h-64 w-full rounded-xl" />, ssr: false }
);

const HeatmapCalendar = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.HeatmapCalendar })),
  { loading: () => <Skeleton className="h-48 w-full rounded-xl" />, ssr: false }
);

const InsightsCards = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.InsightsCards })),
  { loading: () => <Skeleton className="h-64 w-full rounded-xl" />, ssr: false }
);

const PredictiveAnalytics = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.PredictiveAnalytics })),
  { loading: () => <Skeleton className="h-96 w-full rounded-xl" />, ssr: false }
);

const YearInReview = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.YearInReview })),
  { loading: () => <Skeleton className="h-[520px] w-full rounded-xl" />, ssr: false }
);

export default function AnalyticsPageContent() {
  const { habits, completions, loadHabits, loadCompletions, addHabit, isLoading: habitsLoading } = useHabitStore(
    useShallow((s) => ({
      habits: s.habits,
      completions: s.completions,
      loadHabits: s.loadHabits,
      loadCompletions: s.loadCompletions,
      addHabit: s.addHabit,
      isLoading: s.isLoading,
    }))
  );
  const { goals, loadGoals, isLoading: goalsLoading } = useGoalStore(
    useShallow((s) => ({
      goals: s.goals,
      loadGoals: s.loadGoals,
      isLoading: s.isLoading,
    }))
  );
  const { tasks, loadTasks, isLoading: tasksLoading } = useTaskStore(
    useShallow((s) => ({
      tasks: s.tasks,
      loadTasks: s.loadTasks,
      isLoading: s.isLoading,
    }))
  );
  const { loadMoodLogs, getMoodForDate } = useMoodStore(
    useShallow((s) => ({
      loadMoodLogs: s.loadMoodLogs,
      getMoodForDate: s.getMoodForDate,
    }))
  );
  const { transactions, categories, loadFinanceData } = useFinanceStore(
    useShallow((s) => ({
      transactions: s.transactions,
      categories: s.categories,
      loadFinanceData: s.loadFinanceData,
    }))
  );
  const completedSessions = usePomodoroStore((s) => s.completedSessions);

  // Pre-map completions by habitId and dateStr for O(1) grid lookups
  const completionsMap = useMemo(() => {
    const map = new Map<string, HabitCompletion>();
    completions.forEach(c => {
      map.set(`${c.habitId}_${c.date}`, c);
    });
    return map;
  }, [completions]);

  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [activeView, setActiveView] = useState<'analytics' | 'weekly-review' | 'predictive' | 'wrapped'>('analytics');

  // Load data on mount
  useEffect(() => {
    loadHabits();
    loadGoals();
    loadTasks();
    loadFinanceData();

    const end = new Date();
    const start = subYears(end, 1);
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    
    const cacheKey = 'analytics_completions_' + format(end, 'yyyy-MM-dd');
    const cached = sessionStorage.getItem(cacheKey);
    if (!cached) {
      loadCompletions(startStr, endStr);
      sessionStorage.setItem(cacheKey, '1');
    }
    
    loadMoodLogs(startStr, endStr);
  }, [loadHabits, loadCompletions, loadGoals, loadTasks, loadMoodLogs, loadFinanceData]);

  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    const today = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'week':
        startDate = subDays(today, 7);
        break;
      case 'month':
        startDate = subDays(today, 30);
        break;
      case 'quarter':
        startDate = subDays(today, 90);
        break;
      case 'year':
        startDate = subYears(today, 1);
        break;
      default:
        startDate = subDays(today, 30);
    }

    return { startDate, endDate: today };
  }, [timeRange]);

  // Calculate all analytics data
  const analyticsData = useMemo(() => {
    const activeHabits = habits.filter(h => !h.archived);
    const { startDate, endDate } = dateRange;

    // Filter completions within date range
    const rangeCompletions = completions.filter(c => {
      const date = new Date(c.date);
      return date >= startDate && date <= endDate;
    });

    // Daily stats for the range
    const dailyStats = calculateDailyStats(activeHabits, completions, startDate, endDate);

    // Calculate average completion rate
    const avgCompletionRate = dailyStats.length > 0
      ? dailyStats.reduce((sum, d) => sum + d.completionRate, 0) / dailyStats.length
      : 0;

    // Overall trend
    const trend = calculateMomentum(completions);

    // Category breakdown
    const categoryBreakdown = calculateCategoryBreakdown(habits, rangeCompletions);

    // Weekday stats
    const weekdayStats: WeekdayStats[] = DAYS_OF_WEEK.map((dayName, dayOfWeek) => {
      const dayCompletions = dailyStats.filter(d => new Date(d.date).getDay() === dayOfWeek);
      const avgRate = dayCompletions.length > 0
        ? dayCompletions.reduce((sum, d) => sum + d.completionRate, 0) / dayCompletions.length
        : 0;
      const totalCompletions = dayCompletions.reduce((sum, d) => sum + d.completedHabits, 0);

      return {
        dayOfWeek,
        dayName,
        averageCompletionRate: avgRate,
        totalCompletions,
      };
    });

    // Heatmap data (always show full year)
    const heatmapData = generateHeatmapData(completions, habits, 365);

    // Calculate summary metrics
    const totalCompletionsInRange = rangeCompletions.filter(c => c.completed).length;
    const bestStreak = calculateBestStreak(completions);
    const currentStreak = calculateCurrentStreak(completions);
    const activeGoals = goals.filter(g => !g.archived && g.status !== 'completed').length;

    return {
      dailyStats,
      avgCompletionRate,
      trend,
      weekdayStats,
      categoryBreakdown,
      heatmapData,
      totalCompletionsInRange,
      currentStreak,
      bestStreak,
      activeGoals,
      activeHabits: activeHabits.length,
    };
  }, [habits, completions, goals, dateRange]);

  const [isCreatingNoSpend, setIsCreatingNoSpend] = useState(false);
  const [isSyncingNoSpend, setIsSyncingNoSpend] = useState(false);

  // Behavioral Correlations: Mood & Habits × Spending
  const behavioralCorrelations = useMemo(() => {
    const startDateStr = format(dateRange.startDate, 'yyyy-MM-dd');
    const endDateStr = format(dateRange.endDate, 'yyyy-MM-dd');

    const expenseTransactions = transactions.filter(
      (t) => t.type === 'expense' && !t.deletedAt && t.date.slice(0, 10) >= startDateStr && t.date.slice(0, 10) <= endDateStr
    );

    // Map daily spending
    const dailySpendMap = new Map<string, { total: number; impulse: number }>();
    const impulseKeywords = ['food', 'dining', 'restaurant', 'swiggy', 'zomato', 'blinkit', 'zepto', 'shopping', 'amazon', 'flipkart', 'coffee', 'cafe', 'uber', 'entertainment', 'cinema'];
    const foodKeywords = ['food', 'dining', 'restaurant', 'swiggy', 'zomato', 'blinkit', 'zepto', 'cafe', 'takeout', 'fast food'];

    const dailyFoodSpendMap = new Map<string, number>();

    expenseTransactions.forEach(tx => {
      const dateKey = tx.date.split('T')[0];
      const prev = dailySpendMap.get(dateKey) || { total: 0, impulse: 0 };
      const descLower = (tx.title || tx.notes || '').toLowerCase();
      const merchantLower = (tx.merchantName || '').toLowerCase();
      const cat = categories.find(c => c.id === tx.categoryId);
      const catLower = (cat?.name || '').toLowerCase();

      const isImpulse = impulseKeywords.some(kw => 
        descLower.includes(kw) || merchantLower.includes(kw) || catLower.includes(kw)
      );
      const isFood = foodKeywords.some(kw =>
        descLower.includes(kw) || merchantLower.includes(kw) || catLower.includes(kw)
      );

      dailySpendMap.set(dateKey, {
        total: prev.total + tx.amount,
        impulse: prev.impulse + (isImpulse ? tx.amount : 0),
      });

      if (isFood) {
        dailyFoodSpendMap.set(dateKey, (dailyFoodSpendMap.get(dateKey) || 0) + tx.amount);
      }
    });

    const stressedSpends: number[] = [];
    const calmSpends: number[] = [];
    const stressedImpulseSpends: number[] = [];
    const calmImpulseSpends: number[] = [];

    const highHabitSpends: number[] = [];
    const lowHabitSpends: number[] = [];

    // Health habits correlation
    const healthHabits = habits.filter(
      h => !h.archived && (h.category === 'health' || /gym|workout|exercise|cook|walk|run|yoga|meal/i.test(h.name))
    );
    const healthDaysFoodSpends: number[] = [];
    const nonHealthDaysFoodSpends: number[] = [];

    // Iterate across all calendar days in analyticsData.dailyStats (including ₹0-spend days)
    analyticsData.dailyStats.forEach((dayStat) => {
      const dateKey = dayStat.date;
      const spend = dailySpendMap.get(dateKey);
      const mood = getMoodForDate(dateKey);

      if (spend) {
        if (mood === 'stressed' || mood === 'sad') {
          stressedSpends.push(spend.total);
          stressedImpulseSpends.push(spend.impulse);
        } else if (mood === 'calm' || mood === 'happy') {
          calmSpends.push(spend.total);
          calmImpulseSpends.push(spend.impulse);
        }

        if (dayStat.completionRate >= 70) {
          highHabitSpends.push(spend.total);
        } else if (dayStat.completionRate < 50) {
          lowHabitSpends.push(spend.total);
        }
      }

      // Check health habit completion for this day across all days in range (reflects ₹0 home-cooked days)
      const foodSpend = dailyFoodSpendMap.get(dateKey) || 0;
      const completedHealth = healthHabits.some(h => {
        const c = completionsMap.get(`${h.id}_${dateKey}`);
        return c && c.completed;
      });
      if (completedHealth) {
        healthDaysFoodSpends.push(foodSpend);
      } else {
        nonHealthDaysFoodSpends.push(foodSpend);
      }
    });

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const avgStressedSpend = Math.round(avg(stressedSpends));
    const avgCalmSpend = Math.round(avg(calmSpends));
    const avgStressedImpulse = Math.round(avg(stressedImpulseSpends));
    const avgCalmImpulse = Math.round(avg(calmImpulseSpends));

    const avgHighHabitSpend = Math.round(avg(highHabitSpends));
    const avgLowHabitSpend = Math.round(avg(lowHabitSpends));

    const avgHealthDaysFoodSpend = Math.round(avg(healthDaysFoodSpends));
    const avgNonHealthDaysFoodSpend = Math.round(avg(nonHealthDaysFoodSpends));
    const healthFoodSavingsPct = avgNonHealthDaysFoodSpend > 0
      ? Math.round(((avgNonHealthDaysFoodSpend - avgHealthDaysFoodSpend) / avgNonHealthDaysFoodSpend) * 100)
      : 0;

    const moodDiffPct = avgCalmSpend > 0 
      ? Math.round(((avgStressedSpend - avgCalmSpend) / avgCalmSpend) * 100)
      : (avgStressedSpend > 0 ? 100 : 0);

    const impulseDiffPct = avgCalmImpulse > 0
      ? Math.round(((avgStressedImpulse - avgCalmImpulse) / avgCalmImpulse) * 100)
      : (avgStressedImpulse > 0 ? 100 : 0);

    const habitDiffPct = avgHighHabitSpend > 0
      ? Math.round(((avgLowHabitSpend - avgHighHabitSpend) / avgHighHabitSpend) * 100)
      : 0;

    // No-Spend Day tracking status
    const noSpendHabit = habits.find(
      (h) => !h.archived && h.autoTrackRule === 'no_spend_day'
    );
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const essentialCategories = new Set([
      'bills_utilities',
      'utilities-bills',
      'rent_housing',
      'rent-housing',
      'education',
      'insurance',
      'healthcare',
      'medical-supplements',
      'groceries_essentials',
      'groceries-household',
      'family-commitments',
      'family_support',
    ]);
    const todayExpenses = expenseTransactions.filter(t => t.date.split('T')[0] === todayStr);
    const todayDiscretionarySpend = todayExpenses.reduce((sum, tx) => {
      if (tx.linkedEmiId || tx.linkedCommitmentId || tx.linkedSipId || tx.paidStatementId || tx.linkedDebtId) return sum;
      const cat = categories.find(c => c.id === tx.categoryId);
      const slug = cat?.slug || cat?.id || '';
      if (essentialCategories.has(slug)) return sum;
      return sum + tx.amount;
    }, 0);

    const hasData = dailySpendMap.size > 0;

    return {
      hasData,
      dailyCount: dailySpendMap.size,
      avgStressedSpend,
      avgCalmSpend,
      avgStressedImpulse,
      avgCalmImpulse,
      avgHighHabitSpend,
      avgLowHabitSpend,
      avgHealthDaysFoodSpend,
      avgNonHealthDaysFoodSpend,
      healthFoodSavingsPct,
      healthDaysCount: healthDaysFoodSpends.length,
      nonHealthDaysCount: nonHealthDaysFoodSpends.length,
      hasHealthHabits: healthHabits.length > 0,
      noSpendHabit,
      todayDiscretionarySpend,
      moodDiffPct,
      impulseDiffPct,
      habitDiffPct,
      stressedDaysCount: stressedSpends.length,
      calmDaysCount: calmSpends.length,
      highHabitDaysCount: highHabitSpends.length,
      lowHabitDaysCount: lowHabitSpends.length,
    };
  }, [transactions, categories, getMoodForDate, analyticsData.dailyStats, habits, completionsMap, dateRange]);

  const handleCreateNoSpendHabit = async () => {
    try {
      setIsCreatingNoSpend(true);
      await addHabit({
        name: 'No-Spend Day',
        category: 'finance',
        targetDaysPerWeek: 7,
        frequencyType: 'daily',
        autoTrackRule: 'no_spend_day',
        difficulty: 'medium',
        icon: 'Wallet',
      });
      await CrossDomainActionMediator.evaluateNoSpendDayRules();
      toast.success("Created auto-tracked 'No-Spend Day' habit!");
    } catch {
      toast.error("Failed to create No-Spend Day habit");
    } finally {
      setIsCreatingNoSpend(false);
    }
  };

  const handleSyncNoSpend = async () => {
    try {
      setIsSyncingNoSpend(true);
      await CrossDomainActionMediator.evaluateNoSpendDayRules();
      toast.success("Synced No-Spend Day completions with Finance records");
    } catch {
      toast.error("Failed to sync No-Spend Day records");
    } finally {
      setIsSyncingNoSpend(false);
    }
  };

  // Generate insights based on data
  const insights = useMemo((): Insight[] => {
    const result: Insight[] = [];
    const {
      avgCompletionRate,
      trend,
      weekdayStats,
      currentStreak,
      bestStreak,
      categoryBreakdown,
    } = analyticsData;

    // Streak achievements
    if (currentStreak >= 7) {
      result.push({
        id: 'streak-week',
        type: 'achievement',
        title: `${currentStreak} Day Streak!`,
        description: `You've been consistent for ${currentStreak} days. Keep up the momentum!`,
        icon: 'flame',
        priority: 1,
        actionLabel: 'View Dashboard',
        actionHref: '/',
      });
    }

    if (bestStreak > currentStreak && bestStreak >= 7) {
      result.push({
        id: 'best-streak',
        type: 'info',
        title: 'Your Best Streak',
        description: `Your record is ${bestStreak} days. You're ${bestStreak - currentStreak} days away from beating it!`,
        icon: 'trophy',
        priority: 3,
        actionLabel: 'View Habits',
        actionHref: '/habits',
      });
    }

    // Completion rate insights
    if (avgCompletionRate >= 80) {
      result.push({
        id: 'high-completion',
        type: 'achievement',
        title: 'Excellent Consistency',
        description: `With ${avgCompletionRate.toFixed(0)}% completion rate, you're crushing your habits!`,
        icon: 'star',
        priority: 2,
        actionLabel: 'View Habits',
        actionHref: '/habits',
      });
    } else if (avgCompletionRate < 50 && habits.length > 0) {
      result.push({
        id: 'low-completion',
        type: 'warning',
        title: 'Room for Improvement',
        description: 'Consider focusing on fewer habits to build consistency before adding more.',
        icon: 'alert',
        priority: 2,
        actionLabel: 'Manage Habits',
        actionHref: '/habits',
      });
    }

    // Trend insights
    if (trend === 'up') {
      result.push({
        id: 'trend-up',
        type: 'achievement',
        title: 'Upward Trend',
        description: 'Your completion rate is improving compared to last week. Great progress!',
        icon: 'trending',
        priority: 3,
        actionLabel: 'View Dashboard',
        actionHref: '/',
      });
    } else if (trend === 'down') {
      result.push({
        id: 'trend-down',
        type: 'warning',
        title: 'Declining Trend',
        description: 'Your completion rate dropped this week. Consider reviewing your goals.',
        icon: 'alert',
        priority: 2,
        actionLabel: 'Review Goals',
        actionHref: '/goals',
      });
    }

    // Best/worst day suggestions
    const sortedDays = [...weekdayStats].sort((a, b) => b.averageCompletionRate - a.averageCompletionRate);
    const bestDay = sortedDays[0];
    const worstDay = sortedDays[sortedDays.length - 1];

    if (bestDay && worstDay && bestDay.averageCompletionRate - worstDay.averageCompletionRate > 20) {
      result.push({
        id: 'weekday-pattern',
        type: 'suggestion',
        title: `${worstDay.dayName} is Your Challenge Day`,
        description: `You complete ${(bestDay.averageCompletionRate - worstDay.averageCompletionRate).toFixed(0)}% fewer habits on ${worstDay.dayName}s. Try scheduling easier habits for that day.`,
        icon: 'calendar',
        priority: 4,
        actionLabel: 'Reschedule Habits',
        actionHref: '/habits',
      });
    }

    // Category suggestions
    const lowPerformingCategory = categoryBreakdown.find(c => c.completionRate < 40 && c.count > 0);
    if (lowPerformingCategory) {
      result.push({
        id: 'category-low',
        type: 'suggestion',
        title: `Review ${lowPerformingCategory.category.charAt(0).toUpperCase() + lowPerformingCategory.category.slice(1)} Habits`,
        description: `Your ${lowPerformingCategory.category} habits have a ${lowPerformingCategory.completionRate}% completion rate. Consider making them easier or more specific.`,
        icon: 'target',
        priority: 4,
        actionLabel: 'Edit Habits',
        actionHref: '/habits',
      });
    }

    return result.sort((a, b) => a.priority - b.priority);
  }, [analyticsData, habits]);

  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return {
        date,
        dateStr: format(date, 'yyyy-MM-dd'),
        dayName: format(date, 'EEE'),
        dayOfWeek: date.getDay(),
      };
    });
  }, []);

  const weeklyNotes = useMemo(() => {
    const startStr = format(subDays(new Date(), 6), 'yyyy-MM-dd');
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    const notesList: { habitName: string; date: string; text: string }[] = [];
    const habitsMap = new Map(habits.map(h => [h.id, h]));
    
    completions.forEach(c => {
      if (c.date >= startStr && c.date <= todayStr && c.note) {
        const habit = habitsMap.get(c.habitId);
        if (habit) {
          notesList.push({
            habitName: habit.name,
            date: c.date,
            text: c.note,
          });
        }
      }
    });
    
    return notesList.sort((a, b) => b.date.localeCompare(a.date));
  }, [completions, habits]);

  const isLoading = habitsLoading || goalsLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-muted rounded w-48" />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-80 bg-muted rounded-xl" />
            <div className="h-80 bg-muted rounded-xl" />
            <div className="h-80 bg-muted rounded-xl md:col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  const noData = habits.length === 0;

  return (
    <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <FadeIn className="mb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              Analytics & Review
            </h1>
            <p className="text-muted-foreground mt-1">
              Discover patterns, track mood history, and review weekly reflections
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="flex p-1 bg-muted rounded-lg border border-border/40 overflow-x-auto max-w-full scrollbar-hide w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveView('analytics')}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shrink-0 flex-1 sm:flex-none text-center",
                  activeView === 'analytics' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Analytics
              </button>
              <button
                type="button"
                onClick={() => setActiveView('predictive')}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shrink-0 flex-1 sm:flex-none text-center",
                  activeView === 'predictive' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Predictions
              </button>
              <button
                type="button"
                onClick={() => setActiveView('weekly-review')}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shrink-0 flex-1 sm:flex-none text-center",
                  activeView === 'weekly-review' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Weekly Review
              </button>
              <button
                type="button"
                onClick={() => setActiveView('wrapped')}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shrink-0 flex-1 sm:flex-none text-center",
                  activeView === 'wrapped' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                2026 Wrapped
              </button>
            </div>

            {activeView === 'analytics' && !noData && (
              <div className="w-full sm:w-auto flex justify-end sm:justify-start">
                <TimeRangeTabs value={timeRange} onChange={setTimeRange} />
              </div>
            )}
          </div>
        </div>
      </FadeIn>

      {noData ? (
        <FadeIn className="text-center py-16">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Data Yet</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Start tracking habits to see your analytics. Once you have some completions,
            you'll see charts, insights, and patterns here.
          </p>
        </FadeIn>
      ) : activeView === 'analytics' ? (
        <>
          {/* Summary Cards */}
          <FadeIn delay={0.1} className="mb-8">
            <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StaggerItem>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Completion Rate
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      <CountUp value={analyticsData.avgCompletionRate} />%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Average for selected period
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Current Streak
                    </CardTitle>
                    <Flame className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      <CountUp value={analyticsData.currentStreak} /> days
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Best: {analyticsData.bestStreak} days
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Completions
                    </CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      <CountUp value={analyticsData.totalCompletionsInRange} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      In selected period
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Active Goals
                    </CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      <CountUp value={analyticsData.activeGoals} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analyticsData.activeHabits} active habits
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
            </StaggerContainer>
          </FadeIn>

          {/* Charts Grid */}
          <div className="space-y-6 mb-6">
            <FadeIn delay={0.2}>
              <ConsistencyChart
                data={analyticsData.dailyStats}
                trend={analyticsData.trend}
                averageRate={analyticsData.avgCompletionRate}
              />
            </FadeIn>

            <FadeIn delay={0.3}>
              <CategoryBreakdownChart data={analyticsData.categoryBreakdown} />
            </FadeIn>

            <div className="grid gap-6 md:grid-cols-2">
              <FadeIn delay={0.4}>
                <WeekdayChart data={analyticsData.weekdayStats} />
              </FadeIn>

              <FadeIn delay={0.5}>
                <InsightsCards insights={insights} />
              </FadeIn>
            </div>

            {/* Life OS Behavioral Correlations: Mood & Habits × Spending */}
            <FadeIn delay={0.55}>
              <Card className="surface-card overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-invest/10 text-invest border border-invest/20">
                        <Brain className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold">
                            Life OS Behavioral Correlations: Mood, Habits & Spending
                          </CardTitle>
                          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-invest/10 text-invest border border-invest/20">
                            Cross-Domain Sync
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          How your emotional state and habit consistency directly influence daily discretionary outflow
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {!behavioralCorrelations || !behavioralCorrelations.hasData ? (
                    <div className="py-8 text-center text-muted-foreground text-sm space-y-2">
                      <ShoppingBag className="h-8 w-8 mx-auto opacity-40" />
                      <p className="font-medium text-foreground">Awaiting Cross-Domain Data</p>
                      <p className="text-xs max-w-md mx-auto">
                        Log transactions in Finance and track your daily Mood to unlock real-time impulse spending patterns and habit correlation insights.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Correlation 1: Mood vs Impulse Spending */}
                        <div className="p-3.5 surface-subtle space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Mood × Food & Shopping
                            </span>
                            <span className={cn(
                              "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border",
                              behavioralCorrelations.impulseDiffPct > 0
                                ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            )}>
                              {behavioralCorrelations.impulseDiffPct > 0 ? `+${behavioralCorrelations.impulseDiffPct}% impulse` : 'Disciplined'}
                            </span>
                          </div>
                          
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <span className="text-sm">😤</span> Stressed / Sad days:
                              </span>
                              <span className="font-mono font-bold tabular-nums text-foreground">
                                {formatINR(behavioralCorrelations.avgStressedImpulse || behavioralCorrelations.avgStressedSpend)}/day
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <span className="text-sm">😌</span> Calm / Happy days:
                              </span>
                              <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                {formatINR(behavioralCorrelations.avgCalmImpulse || behavioralCorrelations.avgCalmSpend)}/day
                              </span>
                            </div>
                          </div>

                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-rose-500"
                              style={{ width: `${Math.min(100, Math.max(20, (behavioralCorrelations.avgStressedImpulse / (behavioralCorrelations.avgStressedImpulse + behavioralCorrelations.avgCalmImpulse || 1)) * 100))}%` }}
                            />
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${Math.min(100, Math.max(20, (behavioralCorrelations.avgCalmImpulse / (behavioralCorrelations.avgStressedImpulse + behavioralCorrelations.avgCalmImpulse || 1)) * 100))}%` }}
                            />
                          </div>
                        </div>

                        {/* Correlation 2: Habit Consistency vs Daily Outflow */}
                        <div className="p-3.5 surface-subtle space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Habit Streaks × Outflow
                            </span>
                            <span className={cn(
                              "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border",
                              behavioralCorrelations.habitDiffPct > 0
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            )}>
                              {behavioralCorrelations.habitDiffPct > 0 ? `+${behavioralCorrelations.habitDiffPct}% on broken days` : 'Optimal'}
                            </span>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Flame className="h-3.5 w-3.5 text-emerald-500" /> Streaks Active (&ge;70%):
                              </span>
                              <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                {formatINR(behavioralCorrelations.avgHighHabitSpend)}/day
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Off-Track Days (&lt;50%):
                              </span>
                              <span className="font-mono font-bold tabular-nums text-foreground">
                                {formatINR(behavioralCorrelations.avgLowHabitSpend)}/day
                              </span>
                            </div>
                          </div>

                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${Math.min(100, Math.max(20, (behavioralCorrelations.avgHighHabitSpend / (behavioralCorrelations.avgHighHabitSpend + behavioralCorrelations.avgLowHabitSpend || 1)) * 100))}%` }}
                            />
                            <div
                              className="h-full bg-amber-500"
                              style={{ width: `${Math.min(100, Math.max(20, (behavioralCorrelations.avgLowHabitSpend / (behavioralCorrelations.avgHighHabitSpend + behavioralCorrelations.avgLowHabitSpend || 1)) * 100))}%` }}
                            />
                          </div>
                        </div>

                        {/* Correlation 3: Health Habits vs Outside Food Spend */}
                        <div className="p-3.5 surface-subtle space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Health Habits × Dining
                            </span>
                            <span className={cn(
                              "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border",
                              behavioralCorrelations.healthFoodSavingsPct > 0
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : "bg-muted text-muted-foreground"
                            )}>
                              {behavioralCorrelations.healthFoodSavingsPct > 0 ? `-${behavioralCorrelations.healthFoodSavingsPct}% delivery` : 'Balanced'}
                            </span>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Utensils className="h-3.5 w-3.5 text-emerald-500" /> On Health Habit Days:
                              </span>
                              <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                {formatINR(behavioralCorrelations.avgHealthDaysFoodSpend)}/day
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Utensils className="h-3.5 w-3.5 text-muted-foreground" /> On Off-Track Days:
                              </span>
                              <span className="font-mono font-bold tabular-nums text-foreground">
                                {formatINR(behavioralCorrelations.avgNonHealthDaysFoodSpend)}/day
                              </span>
                            </div>
                          </div>

                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${Math.min(100, Math.max(20, (behavioralCorrelations.avgHealthDaysFoodSpend / (behavioralCorrelations.avgHealthDaysFoodSpend + behavioralCorrelations.avgNonHealthDaysFoodSpend || 1)) * 100))}%` }}
                            />
                            <div
                              className="h-full bg-rose-500"
                              style={{ width: `${Math.min(100, Math.max(20, (behavioralCorrelations.avgNonHealthDaysFoodSpend / (behavioralCorrelations.avgHealthDaysFoodSpend + behavioralCorrelations.avgNonHealthDaysFoodSpend || 1)) * 100))}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 1-Click No-Spend Day Habit Automation Card */}
                      <div className="rounded-xl border border-border/70 bg-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            <ShieldCheck className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground">
                                {behavioralCorrelations.noSpendHabit
                                  ? "'No-Spend Day' Tracking Active"
                                  : "Automate 'No-Spend Day' Tracking"}
                              </span>
                              {behavioralCorrelations.noSpendHabit && (
                                <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.2 rounded-full border border-emerald-500/20">
                                  Rule Active
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {behavioralCorrelations.noSpendHabit
                                ? "Auto-completes days with ₹0 non-essential spend from your FlowFinance transactions."
                                : "Connect your daily routine with financial discipline. Automatically ticks whenever you log ₹0 discretionary spend."}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          {behavioralCorrelations.noSpendHabit ? (
                            <div className="flex items-center gap-2.5">
                              <span className={cn(
                                "text-xs font-mono font-semibold px-2.5 py-1 rounded-lg border",
                                behavioralCorrelations.todayDiscretionarySpend === 0
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              )}>
                                {behavioralCorrelations.todayDiscretionarySpend === 0
                                  ? "Today: On Track (₹0 spent)"
                                  : `Today: ${formatINR(behavioralCorrelations.todayDiscretionarySpend)} spent`}
                              </span>
                              <button
                                type="button"
                                disabled={isSyncingNoSpend}
                                onClick={handleSyncNoSpend}
                                title="Sync completions with ledger"
                                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                              >
                                <RefreshCw className={cn("h-3.5 w-3.5", isSyncingNoSpend && "animate-spin")} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isCreatingNoSpend}
                              onClick={handleCreateNoSpendHabit}
                              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs disabled:opacity-50"
                            >
                              {isCreatingNoSpend ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  Create 'No-Spend Day' Habit
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* AI Behavioral Takeaway Bar */}
                      <div className="p-3 rounded-xl bg-invest/5 border border-invest/20 flex items-start gap-2.5">
                        <Sparkles className="h-4 w-4 text-invest shrink-0 mt-0.5" />
                        <div className="text-xs leading-relaxed text-muted-foreground">
                          <span className="font-semibold text-foreground">Life OS Behavioral Insight: </span>
                          {behavioralCorrelations.healthFoodSavingsPct > 15 ? (
                            <span>
                              On days when you complete health &amp; fitness habits, outside food delivery and dining spend drops by <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">-{behavioralCorrelations.healthFoodSavingsPct}%</strong>. Physical discipline visibly protects your wallet from convenience spending.
                            </span>
                          ) : behavioralCorrelations.impulseDiffPct > 15 ? (
                            <span>
                              On days logged as stressed or sad, your food delivery and impulse retail spend increases by <strong className="text-rose-600 dark:text-rose-400 font-mono">+{behavioralCorrelations.impulseDiffPct}%</strong>. We recommend creating an auto-tracked habit: <em>"5-min evening meditation or walk"</em> to pause before checking delivery apps.
                            </span>
                          ) : behavioralCorrelations.habitDiffPct > 15 ? (
                            <span>
                              Maintaining habit consistency has a strong positive financial spillover: daily spending is <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{behavioralCorrelations.habitDiffPct}% lower</strong> on days when you complete &ge;70% of your habits.
                            </span>
                          ) : (
                            <span>
                              Your daily spending habits show resilient discipline across emotional states. Continuing to log moods and expenses will further refine these cross-domain intelligence models.
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          </div>

          {/* Heatmap - Full Width */}
          <FadeIn delay={0.6}>
            <HeatmapCalendar data={analyticsData.heatmapData} weeks={52} />
          </FadeIn>
        </>
      ) : activeView === 'predictive' ? (
        <FadeIn className="space-y-6">
          <PredictiveAnalytics />
        </FadeIn>
      ) : activeView === 'wrapped' ? (
        <FadeIn className="space-y-6">
          <YearInReview />
        </FadeIn>
      ) : (
        // Weekly Review Screen Panel
        <FadeIn className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weekly Habits Logged</p>
                    <p className="text-2xl font-bold text-foreground">
                      {completions.filter(c => {
                        const startStr = format(subDays(new Date(), 6), 'yyyy-MM-dd');
                        return c.date >= startStr && c.completed && c.status !== 'frozen';
                      }).length} completions
                    </p>
                  </div>
                  <Check className="h-8 w-8 text-emerald-500 bg-emerald-500/10 p-1.5 rounded-xl border border-emerald-500/20" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Focus Session Time</p>
                    <p className="text-2xl font-bold text-foreground">
                      {completedSessions * 25} minutes
                    </p>
                  </div>
                  <Coffee className="h-8 w-8 text-rose-500 bg-rose-500/10 p-1.5 rounded-xl border border-rose-500/20" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Streak</p>
                    <p className="text-2xl font-bold text-foreground">
                      {analyticsData.currentStreak} days
                    </p>
                  </div>
                  <Flame className="h-8 w-8 text-amber-500 bg-amber-500/10 p-1.5 rounded-xl border border-amber-500/20" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Smile className="h-4 w-4 text-emerald-500" />
                Daily Mood Log (Past 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center max-w-3xl mx-auto p-4 bg-muted/20 rounded-2xl border border-border/30 overflow-x-auto max-w-full pb-2 scrollbar-hide gap-3 sm:gap-0">
                {last7Days.map((day) => {
                  const mood = getMoodForDate(day.dateStr);
                  const moodEmojiMap = {
                    happy: '😊',
                    calm: '😌',
                    neutral: '😐',
                    sad: '😢',
                    stressed: '🤯',
                  };
                  const emoji = mood ? moodEmojiMap[mood] : '⚪';
                  const moodLabel = mood ? mood.charAt(0).toUpperCase() + mood.slice(1) : 'No Log';
                  
                  return (
                    <div key={day.dateStr} className="flex flex-col items-center gap-1.5">
                      <span className="text-xs text-muted-foreground font-medium">{day.dayName}</span>
                      <div 
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center border text-2xl shadow-sm bg-card transition-all",
                          mood === 'happy' && "bg-amber-500/15 border-amber-500/30 text-amber-500",
                          mood === 'calm' && "bg-emerald-500/15 border-emerald-500/30 text-emerald-500",
                          mood === 'neutral' && "bg-slate-500/15 border-slate-500/30 text-slate-500",
                          mood === 'sad' && "bg-blue-500/15 border-blue-500/30 text-blue-500",
                          mood === 'stressed' && "bg-red-500/15 border-red-500/30 text-red-500"
                        )}
                        title={moodLabel}
                      >
                        {emoji}
                      </div>
                      <span className="text-[9px] font-bold text-muted-foreground/60">{format(day.date, 'MM/dd')}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Habits Overview (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {habits.filter(h => !h.archived).map((habit) => {
                  return (
                    <div key={habit.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 surface-subtle hover:bg-muted/40 transition-colors gap-3 sm:gap-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {habit.icon && <span className="text-lg">{habit.icon}</span>}
                        <div className="min-w-0">
                          <span className="font-semibold text-sm block truncate">{habit.name}</span>
                          {habit.isQuantitative && (
                            <span className="text-[10px] text-muted-foreground font-mono">Target: {habit.targetValue} {habit.unit}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2 overflow-x-auto max-w-full pb-1 scrollbar-hide">
                        {last7Days.map((day) => {
                          const comp = completionsMap.get(`${habit.id}_${day.dateStr}`);
                          const isCompleted = comp?.completed && comp?.status !== 'frozen';
                          const isFrozen = comp?.status === 'frozen';
                          
                          return (
                            <div 
                              key={day.dateStr}
                              className={cn(
                                "w-8 h-8 rounded-lg flex flex-col items-center justify-center text-xs border font-mono transition-all",
                                isCompleted
                                  ? "bg-success/20 text-success border-success/30 font-bold"
                                  : isFrozen
                                    ? "bg-sky-500/20 text-sky-500 border-sky-500/30"
                                    : "bg-muted/40 border-transparent text-muted-foreground/30"
                              )}
                              title={`${format(day.date, 'MMM d')}: ${isCompleted ? 'Completed' : isFrozen ? 'Frozen' : 'Not completed'}`}
                            >
                              {isCompleted ? (
                                habit.isQuantitative && comp?.value ? (
                                  comp.value
                                ) : (
                                  <Check className="h-3 w-3" />
                                )
                              ) : (
                                '-'
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-500" />
                Weekly Journal & Reflections
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyNotes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm italic">
                  No reflection notes written this week.
                </div>
              ) : (
                <div className="grid gap-3 grid-cols-1 md:grid-cols-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-hide">
                  {weeklyNotes.map((note, idx) => (
                    <div key={idx} className="p-4 bg-muted/20 rounded-xl border border-border/40 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-foreground bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                          {note.habitName}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {format(new Date(note.date), 'EEEE, MMM d')}
                        </span>
                      </div>
                      <p className="text-xs italic text-muted-foreground/90 leading-relaxed font-serif pl-2 border-l-2 border-amber-500/50">
                        "{note.text}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
