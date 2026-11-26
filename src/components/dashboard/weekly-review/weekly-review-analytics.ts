import { format, subDays } from 'date-fns';
import { addDays, normalizeIsoDate } from '@/lib/finance/credit-card-cycles';
import { calculate7DayRollingWeight, calculateWeeklyWaistTrend } from '@/lib/fitness/shared-analytics';
import { computeCrossDomainInsights } from '@/lib/intelligence/cross-domain-insights';
import type {
  DebtRecord,
  FinanceCategory,
  FinanceTransaction,
  FitnessDailyLog,
  Habit,
  HabitCompletion,
  MealLog,
  MoodLog,
  SupplementInventory,
  SupplementLog,
  WorkoutSession,
} from '@/lib/types';

export interface ReviewDayInfo {
  dateStr: string;
  dayName: string;
  dayOfWeek: number;
}

export function buildLast7Days(): ReviewDayInfo[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    return {
      dateStr: format(date, 'yyyy-MM-dd'),
      dayName: format(date, 'EEE'),
      dayOfWeek: date.getDay(),
    };
  });
}

export function computeActiveMitDate(params: {
  todayIso: string;
  dayOfWeek: number;
  mitTargetMode: 'today' | 'next_monday';
}): string {
  if (params.mitTargetMode === 'today') return params.todayIso;
  if (params.dayOfWeek === 0) return addDays(params.todayIso, 1);
  return addDays(params.todayIso, (8 - params.dayOfWeek) % 7 || 7);
}

function computeSingleHabitRate(habit: Habit, completions: HabitCompletion[], rangeDates: Set<string>) {
  const habitComps = completions.filter((c) => c.habitId === habit.id && rangeDates.has(c.date));
  const completedCount = habitComps.filter((c) => c.completed && c.status !== 'frozen').length;
  const rate = habitComps.length > 0 ? Math.round((completedCount / habitComps.length) * 100) : 0;
  return { habit, rate, completedCount };
}

export function computeWeeklyHabitStats(params: {
  habits: Habit[];
  completions: HabitCompletion[];
  last7Days: ReviewDayInfo[];
}) {
  const activeHabits = params.habits.filter((h) => !h.archived);
  const rangeDates = new Set(params.last7Days.map((d) => d.dateStr));
  const habitStats = activeHabits.map((h) => computeSingleHabitRate(h, params.completions, rangeDates));
  const bestHabit = [...habitStats].sort((a, b) => b.rate - a.rate)[0];
  const totalComps = params.completions.filter((c) => rangeDates.has(c.date) && c.completed && c.status !== 'frozen').length;
  const totalPossible = activeHabits.length * 7;

  return {
    bestHabit: bestHabit && bestHabit.rate > 0 ? bestHabit : null,
    weeklyCompletionRate: totalPossible > 0 ? Math.round((totalComps / totalPossible) * 100) : 0,
  };
}

function isWithinDateWindow(dateStr: string, startIso: string, endIso: string): boolean {
  const norm = normalizeIsoDate(dateStr);
  return norm >= startIso && norm <= endIso;
}

export function computeFourTruthsSummary(params: {
  todayIso: string;
  monthlySummary: { safeToSpendMonthly: number; safeToSpendDaily: number; remainingDaysInMonth: number };
  netWorth: { creditCardLiabilities: number; emiRemainingPrincipal: number };
  debtSummary: { totalBorrowedRemaining: number };
  financeDebtRecords: DebtRecord[];
  financeTransactions: FinanceTransaction[];
  financeCategories: FinanceCategory[];
  fitnessDailyLogs: FitnessDailyLog[];
  fitnessMealLogs: MealLog[];
  fitnessWorkoutSessions: WorkoutSession[];
  fitnessSupplements: SupplementInventory[];
  fitnessSupplementLogs: SupplementLog[];
  habits: Habit[];
  completions: HabitCompletion[];
  moodLogs: MoodLog[];
}) {
  const activeDebts = params.financeDebtRecords.filter((d) => !d.deletedAt && d.direction === 'borrowed' && d.status === 'active');
  const totalBorrowedPrincipal = activeDebts.reduce((s, d) => s + Math.max(0, Number(d.principalAmount || 0)), 0);
  const totalBorrowedRepaid = activeDebts.reduce((s, d) => s + Math.max(0, Number(d.totalRepaidAmount || 0)), 0);
  const debtRepayProgressPct = totalBorrowedPrincipal > 0 ? Math.min(100, Math.round((totalBorrowedRepaid / totalBorrowedPrincipal) * 100)) : 100;

  const window7Start = addDays(params.todayIso, -6);
  const weightSummary = calculate7DayRollingWeight(params.fitnessDailyLogs);
  const waistSummary = calculateWeeklyWaistTrend(params.fitnessDailyLogs);
  const workouts7dCount = params.fitnessWorkoutSessions.filter((w) => !w.deletedAt && isWithinDateWindow(w.date, window7Start, params.todayIso)).length;
  const stepDays = params.fitnessDailyLogs.filter((l) => !l.deletedAt && isWithinDateWindow(l.date, window7Start, params.todayIso) && l.steps > 0);
  const avgSteps7d = stepDays.length > 0 ? Math.round(stepDays.reduce((s, l) => s + l.steps, 0) / stepDays.length) : 0;

  const crossDomain = computeCrossDomainInsights({
    todayDate: params.todayIso,
    transactions: params.financeTransactions,
    categories: params.financeCategories,
    debtRecords: params.financeDebtRecords,
    mealLogs: params.fitnessMealLogs,
    workoutSessions: params.fitnessWorkoutSessions,
    fitnessDailyLogs: params.fitnessDailyLogs,
    supplementInventory: params.fitnessSupplements,
    supplementLogs: params.fitnessSupplementLogs,
    habits: params.habits,
    habitCompletions: params.completions,
    moodLogs: params.moodLogs,
  });

  return {
    truth1Finance: {
      safeToSpendMonthly: params.monthlySummary.safeToSpendMonthly,
      safeToSpendDaily: params.monthlySummary.safeToSpendDaily,
      remainingDays: params.monthlySummary.remainingDaysInMonth,
      ccFloatInr: params.netWorth.creditCardLiabilities,
      emiPrincipalInr: params.netWorth.emiRemainingPrincipal,
      borrowedRemainingInr: params.debtSummary.totalBorrowedRemaining,
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
}
