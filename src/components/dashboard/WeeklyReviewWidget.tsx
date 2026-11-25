'use client';

import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Award,
  Smile,
  Flame,
  ChevronRight,
  X,
  Sparkles,
  Wallet,
  Scale,
  AlertTriangle,
  Target,
  Check,
  Play,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useMoodStore } from '@/lib/stores/mood-store';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import {
  calculate7DayRollingWeight,
  calculateWeeklyWaistTrend,
} from '@/lib/fitness/shared-analytics';
import { computeCrossDomainInsights } from '@/lib/intelligence/cross-domain-insights';
import {
  addDays,
  getLocalIsoDate,
  normalizeIsoDate,
} from '@/lib/finance/credit-card-cycles';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function WeeklyReviewWidget() {
  const [showFullReview, setShowFullReview] = useState(false);
  const [selectedMitIds, setSelectedMitIds] = useState<string[]>([]);
  const [savingMits, setSavingMits] = useState(false);

  const today = new Date();
  const todayIso = getLocalIsoDate(today);
  const isSunday = today.getDay() === 0;
  // On Sunday reset -> pin for upcoming Monday OR today; user can toggle target date inside modal
  const defaultMitDate = isSunday ? addDays(todayIso, 1) : todayIso;
  const [mitTargetMode, setMitTargetMode] = useState<'today' | 'next_monday'>(
    isSunday ? 'next_monday' : 'today'
  );
  const activeMitDate =
    mitTargetMode === 'today'
      ? todayIso
      : isSunday
        ? addDays(todayIso, 1)
        : addDays(todayIso, (8 - today.getDay()) % 7 || 7);

  const { habits, completions } = useHabitStore(
    useShallow((s) => ({
      habits: s.habits,
      completions: s.completions,
    }))
  );

  const tasks = useTaskStore((s) => s.tasks);
  const editTask = useTaskStore((s) => s.editTask);
  const moodLogs = useMoodStore((s) => s.moodLogs);
  const getMoodForDate = useMoodStore((s) => s.getMoodForDate);

  const financeTransactions = useFinanceStore((s) => s.transactions);
  const financeCategories = useFinanceStore((s) => s.categories);
  const financeDebtRecords = useFinanceStore((s) => s.debtRecords);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getNetWorthSummary = useFinanceStore((s) => s.getNetWorthSummary);
  const getDebtSummary = useFinanceStore((s) => s.getDebtSummary);

  const fitnessDailyLogs = useFitnessStore((s) => s.dailyLogs);
  const fitnessMealLogs = useFitnessStore((s) => s.mealLogs);
  const fitnessWorkoutSessions = useFitnessStore((s) => s.workoutSessions);
  const fitnessSupplements = useFitnessStore((s) => s.supplementInventory);
  const fitnessSupplementLogs = useFitnessStore((s) => s.supplementLogs);
  const isFitnessEnabled = isFitnessModuleEnabled(
    useGamificationStore((s) => s.settings)
  );

  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return {
        dateStr: format(date, 'yyyy-MM-dd'),
        dayName: format(date, 'EEE'),
        dayOfWeek: date.getDay(),
      };
    });
  }, []);

  const stats = useMemo(() => {
    const activeHabits = habits.filter((h) => !h.archived);
    const rangeDateStrings = last7Days.map((d) => d.dateStr);

    const habitStats = activeHabits.map((h) => {
      const habitComps = completions.filter(
        (c) => c.habitId === h.id && rangeDateStrings.includes(c.date)
      );
      const completedCount = habitComps.filter(
        (c) => c.completed && c.status !== 'frozen'
      ).length;
      const rate =
        habitComps.length > 0 ? Math.round((completedCount / habitComps.length) * 100) : 0;
      return { habit: h, rate, completedCount };
    });

    const sortedHabits = [...habitStats].sort((a, b) => b.rate - a.rate);
    const bestHabit = sortedHabits[0];

    const totalComps = completions.filter(
      (c) => rangeDateStrings.includes(c.date) && c.completed && c.status !== 'frozen'
    ).length;
    const totalPossible = activeHabits.length * 7;
    const weeklyCompletionRate =
      totalPossible > 0 ? Math.round((totalComps / totalPossible) * 100) : 0;

    return {
      bestHabit: bestHabit && bestHabit.rate > 0 ? bestHabit : null,
      weeklyCompletionRate,
    };
  }, [habits, completions, last7Days]);

  // 4 Truths Telemetry
  const fourTruths = useMemo(() => {
    // Truth 1: Safe-to-Spend & Debt / CC Float Progress
    const monthlySummary = getMonthlySummary();
    const netWorth = getNetWorthSummary();
    const debtSummary = getDebtSummary();

    const activeDebts = financeDebtRecords.filter(
      (d) => !d.deletedAt && d.direction === 'borrowed' && d.status === 'active'
    );
    const totalBorrowedPrincipal = activeDebts.reduce(
      (s, d) => s + Math.max(0, Number(d.principalAmount || 0)),
      0
    );
    const totalBorrowedRepaid = activeDebts.reduce(
      (s, d) => s + Math.max(0, Number(d.totalRepaidAmount || 0)),
      0
    );
    const debtRepayProgressPct =
      totalBorrowedPrincipal > 0
        ? Math.min(100, Math.round((totalBorrowedRepaid / totalBorrowedPrincipal) * 100))
        : 100;

    // Truth 2: 7-Day Avg Weight Δ + Waist Δ + Workouts + Avg Steps
    const window7Start = addDays(todayIso, -6);
    const weightSummary = calculate7DayRollingWeight(fitnessDailyLogs);
    const waistSummary = calculateWeeklyWaistTrend(fitnessDailyLogs);
    const workouts7dCount = fitnessWorkoutSessions.filter(
      (w) =>
        !w.deletedAt &&
        normalizeIsoDate(w.date) >= window7Start &&
        normalizeIsoDate(w.date) <= todayIso
    ).length;

    const logs7d = fitnessDailyLogs.filter(
      (l) =>
        !l.deletedAt &&
        normalizeIsoDate(l.date) >= window7Start &&
        normalizeIsoDate(l.date) <= todayIso
    );
    const stepDays = logs7d.filter((l) => l.steps > 0);
    const avgSteps7d =
      stepDays.length > 0
        ? Math.round(stepDays.reduce((s, l) => s + l.steps, 0) / stepDays.length)
        : 0;

    // Truth 3: Junk Spend & Empty kcal + Top Trigger
    const crossDomain = computeCrossDomainInsights({
      todayDate: todayIso,
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

    return {
      truth1Finance: {
        safeToSpendMonthly: monthlySummary.safeToSpendMonthly,
        safeToSpendDaily: monthlySummary.safeToSpendDaily,
        remainingDays: monthlySummary.remainingDaysInMonth,
        ccFloatInr: netWorth.creditCardLiabilities,
        emiPrincipalInr: netWorth.emiRemainingPrincipal,
        borrowedRemainingInr: debtSummary.totalBorrowedRemaining,
        debtRepayProgressPct,
      },
      truth2BodyWorkouts: {
        latestRollingWeightKg: weightSummary.latestRollingAvgKg,
        weeklyWeightDeltaKg: weightSummary.weeklyDeltaKg,
        latestWaistInches: waistSummary.latestWaistInches,
        waistDeltaInches: waistSummary.totalDeltaInches,
        workouts7dCount,
        avgSteps7d,
      },
      truth3JunkTrigger: {
        junkSpend14dInr: crossDomain.walletWaistline.spend14dInr,
        junkSpend30dInr: crossDomain.walletWaistline.spend30dInr,
        emptyKcal14d: crossDomain.walletWaistline.emptyKcal14d,
        emptyKcal30d: crossDomain.walletWaistline.emptyKcal30d,
        fatLossDragKg30d: crossDomain.walletWaistline.fatLossDragKg30d,
        topTriggerLabel: crossDomain.triggers.topTriggerLabel,
        triggerMultiplier: crossDomain.triggers.overallSpendMultiplier,
      },
    };
  }, [
    todayIso,
    getMonthlySummary,
    getNetWorthSummary,
    getDebtSummary,
    financeDebtRecords,
    financeTransactions,
    financeCategories,
    fitnessDailyLogs,
    fitnessMealLogs,
    fitnessWorkoutSessions,
    fitnessSupplements,
    fitnessSupplementLogs,
    habits,
    completions,
    moodLogs,
  ]);

  const candidateTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'done' && t.status !== 'archived' && !t.parentTaskId)
        .sort((a, b) => {
          const aPinned = a.metadata?.isMitForDate === activeMitDate ? 0 : 1;
          const bPinned = b.metadata?.isMitForDate === activeMitDate ? 0 : 1;
          if (aPinned !== bPinned) return aPinned - bPinned;
          const pRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return (pRank[a.priority] ?? 2) - (pRank[b.priority] ?? 2);
        }),
    [tasks, activeMitDate]
  );

  const handleOpenReview = async () => {
    // Pre-populate Top 3 MIT selection with currently pinned MITs for target date, or top 3 pending tasks
    const existingPinned = candidateTasks
      .filter((t) => t.metadata?.isMitForDate === activeMitDate)
      .slice(0, 3)
      .map((t) => t.id);

    setSelectedMitIds(
      existingPinned.length > 0
        ? existingPinned
        : candidateTasks.slice(0, 3).map((t) => t.id)
    );
    setShowFullReview(true);

    if (isSunday) {
      try {
        const confetti = (await import('canvas-confetti')).default;
        confetti({
          particleCount: 45,
          spread: 40,
          origin: { y: 0.7 },
        });
      } catch {
        // Optional confetti effect
      }
    }
  };

  const toggleMitSelection = (taskId: string) => {
    setSelectedMitIds((prev) => {
      if (prev.includes(taskId)) {
        return prev.filter((id) => id !== taskId);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), taskId];
      }
      return [...prev, taskId];
    });
  };

  const handleSaveWeeklyMits = async () => {
    if (typeof editTask !== 'function') {
      setShowFullReview(false);
      return;
    }

    setSavingMits(true);
    try {
      // Unpin any tasks previously assigned for activeMitDate that are no longer selected
      for (const t of tasks) {
        if (t.metadata?.isMitForDate === activeMitDate && !selectedMitIds.includes(t.id)) {
          await editTask(t.id, {
            metadata: {
              ...(t.metadata || {}),
              isMitForDate: null,
              mitRank: null,
            },
          });
        }
      }

      // Pin up to 3 selected MITs with explicit rank 1..3
      for (let i = 0; i < selectedMitIds.length; i += 1) {
        const task = tasks.find((t) => t.id === selectedMitIds[i]);
        if (!task) continue;
        await editTask(task.id, {
          metadata: {
            ...(task.metadata || {}),
            isMitForDate: activeMitDate,
            mitRank: i + 1,
          },
        });
      }

      toast.success(
        `Locked Top ${selectedMitIds.length} MIT${selectedMitIds.length === 1 ? '' : 's'} for ${activeMitDate}`
      );
      setShowFullReview(false);
    } catch {
      toast.error('Failed to save weekly MIT priorities');
    } finally {
      setSavingMits(false);
    }
  };

  void defaultMitDate;

  return (
    <>
      <Card className="surface-card shadow-none overflow-hidden h-full flex flex-col justify-between tour-weekly-review-widget">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <BarChart3 className="w-4 h-4 text-primary" />
              5-Min Sunday Reset
            </CardTitle>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              4 Truths
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between space-y-4">
          {/* Weekday Visual Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
              <span>Weekly Consistency</span>
              <span className="font-mono tabular-nums text-foreground">
                {stats.weeklyCompletionRate}%
              </span>
            </div>
            <div className="flex gap-1.5 justify-between">
              {last7Days.map((day) => {
                const dayComps = completions.filter(
                  (c) => c.date === day.dateStr && c.completed && c.status !== 'frozen'
                ).length;
                const activeHabitsCount = habits.filter((h) => !h.archived).length;
                const isDayComplete = activeHabitsCount > 0 && dayComps >= activeHabitsCount;

                return (
                  <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        'w-full h-8 rounded-md border flex items-center justify-center text-[10px] font-mono font-bold transition-all',
                        isDayComplete
                          ? 'bg-success/20 text-success border-success/30'
                          : dayComps > 0
                            ? 'bg-primary/12 text-primary border-primary/25'
                            : 'bg-muted/40 border-transparent text-muted-foreground/40'
                      )}
                    >
                      {dayComps}
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground/70">
                      {day.dayName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick 4-Truth Compact Summary */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-xl border border-border/70 bg-background/60 px-2.5 py-2">
              <span className="text-muted-foreground block text-[10px]">Safe/Day</span>
              <span className="font-mono font-bold text-foreground">
                {formatINR(fourTruths.truth1Finance.safeToSpendDaily)}
              </span>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 px-2.5 py-2">
              <span className="text-muted-foreground block text-[10px]">7d Workouts</span>
              <span className="font-mono font-bold text-foreground">
                {fourTruths.truth2BodyWorkouts.workouts7dCount} sessions
              </span>
            </div>
          </div>

          {/* Sunday Prompt OR Mon-Sat Run/Preview Reset */}
          {isSunday ? (
            <div className="bg-accent/50 border border-primary/25 rounded-xl p-3.5 text-center space-y-2.5">
              <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Sunday Reset Ready
              </div>
              <p className="text-xs text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
                Review the 4 Truths (Money, Body, Junk Triggers) &amp; lock next week&apos;s Top 3 MITs.
              </p>
              <Button
                size="sm"
                onClick={handleOpenReview}
                data-testid="launch-sunday-reset-btn"
                className="w-full font-semibold text-xs py-2 rounded-xl"
              >
                Launch Sunday Reset
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2 text-center">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Sunday ritual unlocks weekly, or preview &amp; update MITs anytime.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenReview}
                data-testid="preview-sunday-reset-btn"
                className="w-full font-semibold text-xs rounded-xl gap-1.5"
              >
                <Play className="w-3 h-3 text-primary" />
                Run / Preview Reset
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5-Minute Sunday Reset Ritual Full Overlay */}
      <AnimatePresence>
        {showFullReview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="sunday-reset-modal"
            className="fixed inset-0 z-50 bg-background/90 dark:bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="absolute top-4 right-4 z-55">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close Sunday Reset"
                onClick={() => setShowFullReview(false)}
                className="rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.25 }}
              className="max-w-3xl w-full surface-hero p-5 md:p-7 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto"
            >
              <div className="space-y-5">
                {/* Header */}
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold border border-primary/20">
                    <Award className="w-3.5 h-3.5 text-primary" />
                    5-Minute Sunday Reset Ritual · The 4 Truths
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Weekly Truth Check &amp; Top 3 Priorities
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    Objective Life OS review across Cashflow, Body/Training, Junk Leaks, and Next-Week Focus.
                  </p>
                </div>

                {/* The 4 Truths Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Truth 1: Safe-to-Spend & Debt/CC Float Progress */}
                  <div
                    data-testid="sunday-truth-1"
                    className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider inline-flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5" />
                        1. Safe-to-Spend &amp; Debt / CC Float
                      </span>
                      <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {fourTruths.truth1Finance.debtRepayProgressPct}% repaid
                      </span>
                    </div>
                    <div className="text-lg font-bold font-mono text-foreground">
                      {formatINR(fourTruths.truth1Finance.safeToSpendMonthly)} safe
                      <span className="text-xs font-normal text-muted-foreground ml-1.5">
                        ({formatINR(fourTruths.truth1Finance.safeToSpendDaily)}/day ·{' '}
                        {fourTruths.truth1Finance.remainingDays}d left)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      CC Float: <strong className="text-foreground">{formatINR(fourTruths.truth1Finance.ccFloatInr)}</strong> ·
                      Borrowed Debt: <strong className="text-foreground">{formatINR(fourTruths.truth1Finance.borrowedRemainingInr)}</strong> ·
                      EMIs: <strong className="text-foreground">{formatINR(fourTruths.truth1Finance.emiPrincipalInr)}</strong>
                    </p>
                  </div>

                  {/* Truth 2: 7-Day Avg Weight Δ + Waist Δ + Workouts + Avg Steps */}
                  {isFitnessEnabled && (
                  <div
                    data-testid="sunday-truth-2"
                    className="p-4 rounded-xl border border-sky-500/25 bg-sky-500/5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400 tracking-wider inline-flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5" />
                        2. 7-Day Weight &Delta;, Waist &Delta;, Workouts &amp; Steps
                      </span>
                      <span className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400">
                        {fourTruths.truth2BodyWorkouts.workouts7dCount} workouts
                      </span>
                    </div>
                    <div className="text-lg font-bold font-mono text-foreground">
                      {fourTruths.truth2BodyWorkouts.latestRollingWeightKg !== null
                        ? `${fourTruths.truth2BodyWorkouts.latestRollingWeightKg} kg`
                        : 'Weight n/a'}
                      {fourTruths.truth2BodyWorkouts.weeklyWeightDeltaKg !== null && (
                        <span className="text-xs font-semibold ml-1.5 text-muted-foreground">
                          ({fourTruths.truth2BodyWorkouts.weeklyWeightDeltaKg >= 0 ? '+' : ''}
                          {fourTruths.truth2BodyWorkouts.weeklyWeightDeltaKg} kg 7d &Delta;)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Waist:{' '}
                      <strong className="text-foreground">
                        {fourTruths.truth2BodyWorkouts.latestWaistInches !== null
                          ? `${fourTruths.truth2BodyWorkouts.latestWaistInches}"`
                          : 'n/a'}
                      </strong>
                      {fourTruths.truth2BodyWorkouts.waistDeltaInches !== null &&
                        ` (${fourTruths.truth2BodyWorkouts.waistDeltaInches >= 0 ? '+' : ''}${fourTruths.truth2BodyWorkouts.waistDeltaInches}" Δ)`}{' '}
                      · Avg Steps:{' '}
                      <strong className="text-foreground">
                        {fourTruths.truth2BodyWorkouts.avgSteps7d.toLocaleString('en-IN')}/day
                      </strong>
                    </p>
                  </div>
                  )}

                  {/* Truth 3: Junk Spend & Empty kcal + Top Trigger */}
                  <div
                    data-testid="sunday-truth-3"
                    className="p-4 rounded-xl border border-amber-500/25 bg-amber-500/5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {isFitnessEnabled
                          ? '3. Junk Spend & Empty kcal + Top Trigger'
                          : 'Junk Spend & Pattern Trigger'}
                      </span>
                      {isFitnessEnabled && (
                        <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
                          {fourTruths.truth3JunkTrigger.fatLossDragKg30d} kg drag
                        </span>
                      )}
                    </div>
                    <div className="text-lg font-bold font-mono text-foreground">
                      {formatINR(fourTruths.truth3JunkTrigger.junkSpend14dInr)}
                      <span className="text-xs font-normal text-muted-foreground ml-1.5">
                        (14d){isFitnessEnabled ? ` · ${fourTruths.truth3JunkTrigger.emptyKcal14d.toLocaleString('en-IN')} kcal` : ''}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      30d Total:{' '}
                      <strong className="text-foreground">
                        {formatINR(fourTruths.truth3JunkTrigger.junkSpend30dInr)}
                      </strong>
                      {isFitnessEnabled
                        ? ` (${fourTruths.truth3JunkTrigger.emptyKcal30d.toLocaleString('en-IN')} kcal)`
                        : ''}{' '}
                      · Top Trigger:{' '}
                      <strong className="text-foreground">
                        {fourTruths.truth3JunkTrigger.topTriggerLabel || 'None detected'}
                        {fourTruths.truth3JunkTrigger.triggerMultiplier
                          ? ` (${fourTruths.truth3JunkTrigger.triggerMultiplier}x)`
                          : ''}
                      </strong>
                    </p>
                  </div>

                  {/* Best Habit & Mood Strip */}
                  <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider inline-flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-primary" />
                        Habits &amp; 7-Day Mood Pulse
                      </span>
                      <span className="text-[11px] font-mono font-bold text-foreground">
                        {stats.weeklyCompletionRate}% week
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      {last7Days.map((day) => {
                        const mood = getMoodForDate(day.dateStr);
                        const emojiMap = {
                          happy: '😊',
                          calm: '😌',
                          neutral: '😐',
                          sad: '😢',
                          stressed: '🤯',
                        };
                        return (
                          <div key={day.dateStr} className="flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-muted-foreground">{day.dayName}</span>
                            <span className="text-base">{mood ? emojiMap[mood] : '⚪'}</span>
                          </div>
                        );
                      })}
                    </div>
                    {stats.bestHabit && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        Anchor Habit: <strong className="text-foreground">{stats.bestHabit.habit.name}</strong> ({stats.bestHabit.rate}%)
                      </p>
                    )}
                  </div>
                </div>

                {/* Truth 4: Interactive Next Week's Top 3 Priorities Picker */}
                <div
                  data-testid="sunday-truth-4"
                  className="border border-primary/25 bg-primary/5 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Target className="w-4 h-4" />
                        4. Interactive Next Week&apos;s Top 3 Priorities ({selectedMitIds.length}/3)
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Select up to 3 must-do MITs for <span className="font-mono font-semibold text-foreground">{activeMitDate}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border text-[11px]">
                      <button
                        type="button"
                        onClick={() => setMitTargetMode('today')}
                        className={cn(
                          'px-2 py-1 rounded-md font-medium',
                          mitTargetMode === 'today'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        Today ({todayIso})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMitTargetMode('next_monday')}
                        className={cn(
                          'px-2 py-1 rounded-md font-medium',
                          mitTargetMode === 'next_monday'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        Next Monday
                      </button>
                    </div>
                  </div>

                  {candidateTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      No pending tasks in queue. Add tasks under /tasks to lock your Top 3 MITs.
                    </p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                      {candidateTasks.slice(0, 10).map((task) => {
                        const rankIdx = selectedMitIds.indexOf(task.id);
                        const isPicked = rankIdx !== -1;
                        return (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => toggleMitSelection(task.id)}
                            data-testid={`sunday-mit-option-${task.id}`}
                            className={cn(
                              'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left text-xs transition-colors',
                              isPicked
                                ? 'border-primary bg-primary/10 text-foreground font-semibold'
                                : 'border-border bg-background/70 text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span
                                className={cn(
                                  'w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0',
                                  isPicked
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                {isPicked ? `#${rankIdx + 1}` : <Check className="w-3 h-3 opacity-30" />}
                              </span>
                              <span className="truncate">{task.title}</span>
                            </span>
                            <span className="text-[10px] font-mono uppercase shrink-0">
                              {task.priority}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowFullReview(false)}
                    className="rounded-xl text-xs"
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    disabled={savingMits}
                    onClick={handleSaveWeeklyMits}
                    data-testid="save-sunday-mits-btn"
                    className="font-semibold px-5 py-2 rounded-xl text-xs gap-1.5"
                  >
                    <Smile className="w-3.5 h-3.5" />
                    {savingMits ? 'Saving MITs...' : 'Lock Top 3 MITs & Complete Reset'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
