import { formatHumanDate } from '@/lib/date-format';
import type { CashFlowForecastResult } from '@/lib/finance/forecast';
import type { CrossDomainAlert, CrossDomainInsightsReport } from '@/lib/intelligence/cross-domain-insights';
import { getIstIsoDate, getIstMonthKey } from '@/lib/mcp/config';
import type {
  CategoryBreakdown,
  CreditCardCycleSummary,
  CreditCardStatement,
  DailyStats,
  DebtInstallment,
  DebtRecord,
  DebtSummaryBreakdown,
  EmiTracker,
  FinanceAccount,
  FinanceAnomalyAlert,
  FinanceBudget,
  FinanceCategory,
  FinanceRecurringBill,
  FinanceSipPlan,
  FinanceTransaction,
  FinancialObligationItem,
  FitnessDailyLog,
  FitnessProfile,
  Goal,
  GoalStats,
  Habit,
  HabitCompletion,
  HeatmapData,
  MealLog,
  Milestone,
  MonthlyCommitment,
  MonthlyFinanceSummary,
  MoodLog,
  NetWorthSummary,
  ProgressiveOverloadHint,
  RollingWeightSummary,
  SupplementInventory,
  SupplementLog,
  SupplementStockAndRoiSummary,
  Task,
  TimeRange,
  Trend,
  UserSettings,
  WeeklyWaistTrendSummary,
  WorkoutSession,
} from '@/lib/types';

export type IsoDateStr = string;
export type AnalyticsRangeKey = '7d' | '30d' | '90d' | 'year';

export const ANALYTICS_RANGE_OPTIONS: Array<{
  key: AnalyticsRangeKey;
  legacy: TimeRange;
  label: string;
  shortLabel: string;
}> = [
  { key: '7d', legacy: 'week', label: 'Last 7 days', shortLabel: '7D' },
  { key: '30d', legacy: 'month', label: 'Last 30 days', shortLabel: '30D' },
  { key: '90d', legacy: 'quarter', label: 'Last 90 days', shortLabel: '90D' },
  { key: 'year', legacy: 'year', label: 'Year to date', shortLabel: 'Year' },
];

const RANGE_KEY_MAP: Record<string, AnalyticsRangeKey> = {
  '7d': '7d', week: '7d',
  '90d': '90d', quarter: '90d',
  year: 'year',
  '30d': '30d', month: '30d',
};

const LEGACY_RANGE_MAP: Record<AnalyticsRangeKey, TimeRange> = {
  '7d': 'week', '30d': 'month', '90d': 'quarter', year: 'year',
};

export function toAnalyticsRangeKey(value?: string | null): AnalyticsRangeKey {
  if (!value) return '30d';
  return RANGE_KEY_MAP[value] ?? '30d';
}

export function toLegacyTimeRange(range: AnalyticsRangeKey): TimeRange {
  return LEGACY_RANGE_MAP[range] ?? 'month';
}

export function shiftIsoDate(isoDate: IsoDateStr, deltaDays: number): IsoDateStr {
  const [yStr, mStr, dStr] = isoDate.slice(0, 10).split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const isValid = y > 0 && m > 0 && d > 0;
  if (!isValid) return isoDate.slice(0, 10);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${utc.getUTCFullYear()}-${mm}-${dd}`;
}

export function parseIsoAsLocalNoon(isoDate: IsoDateStr): Date {
  const [yStr, mStr, dStr] = isoDate.slice(0, 10).split('-');
  return new Date(Number(yStr), Number(mStr) - 1, Number(dStr), 12, 0, 0, 0);
}

export function diffIsoDaysInclusive(startDate: IsoDateStr, endDate: IsoDateStr): number {
  const [sy, sm, sd] = startDate.slice(0, 10).split('-').map(Number);
  const [ey, em, ed] = endDate.slice(0, 10).split('-').map(Number);
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  return Math.max(1, Math.round((endUtc - startUtc) / 86_400_000) + 1);
}

export interface AnalyticsRangeWindow {
  range: AnalyticsRangeKey;
  todayDateStr: string;
  monthKey: string;
  startDateStr: string;
  endDateStr: string;
  prevStartDateStr: string;
  prevEndDateStr: string;
  dayCount: number;
  label: string;
  dateSpanLabel: string;
}

function resolveRangeStartDate(range: AnalyticsRangeKey, todayDateStr: IsoDateStr): IsoDateStr {
  if (range === '7d') return shiftIsoDate(todayDateStr, -6);
  if (range === '30d') return shiftIsoDate(todayDateStr, -29);
  if (range === '90d') return shiftIsoDate(todayDateStr, -89);
  return `${todayDateStr.slice(0, 4)}-01-01`;
}

export function getAnalyticsRangeWindow(
  rangeInput?: AnalyticsRangeKey | TimeRange | string | null,
  referenceDate: Date = new Date()
): AnalyticsRangeWindow {
  const range = toAnalyticsRangeKey(rangeInput);
  const todayDateStr = getIstIsoDate(referenceDate);
  const monthKey = getIstMonthKey(referenceDate);
  const startDateStr = resolveRangeStartDate(range, todayDateStr);
  const dayCount = diffIsoDaysInclusive(startDateStr, todayDateStr);
  const prevEndDateStr = shiftIsoDate(startDateStr, -1);
  const prevStartDateStr = shiftIsoDate(prevEndDateStr, -(dayCount - 1));
  const option = ANALYTICS_RANGE_OPTIONS.find((opt) => opt.key === range) ?? ANALYTICS_RANGE_OPTIONS[1];

  return {
    range,
    todayDateStr,
    monthKey,
    startDateStr,
    endDateStr: todayDateStr,
    prevStartDateStr,
    prevEndDateStr,
    dayCount,
    label: option.label,
    dateSpanLabel: `${formatHumanDate(startDateStr)} – ${formatHumanDate(todayDateStr)}`,
  };
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeNormalizedPillarWeights(
  showFinance: boolean,
  showFitness: boolean
): PillarWeightBreakdown {
  const baseHabits = 0.35;
  const baseFinance = showFinance ? 0.35 : 0;
  const baseFitness = showFitness ? 0.30 : 0;
  const total = baseHabits + baseFinance + baseFitness;

  const habitsPct = Math.round((baseHabits / total) * 100);
  const financePct = showFinance ? Math.round((baseFinance / total) * 100) : 0;
  const fitnessPct = showFitness ? Math.max(0, 100 - habitsPct - financePct) : 0;
  return { habitsPct, financePct, fitnessPct };
}

export interface LifeOsAggregatorInput {
  range?: AnalyticsRangeKey | TimeRange | string | null;
  referenceDate?: Date;
  settings?: Pick<UserSettings, 'habitOnlyMode' | 'showFinance' | 'showFitness' | 'weekStartsOn'> | null;
  habits?: Habit[];
  completions?: HabitCompletion[];
  goals?: Goal[];
  milestones?: Milestone[];
  tasks?: Task[];
  moodLogs?: MoodLog[];
  accounts?: FinanceAccount[];
  transactions?: FinanceTransaction[];
  categories?: FinanceCategory[];
  budgets?: FinanceBudget[];
  commitments?: MonthlyCommitment[];
  debtRecords?: DebtRecord[];
  debtInstallments?: DebtInstallment[];
  emiTrackers?: EmiTracker[];
  sipPlans?: FinanceSipPlan[];
  recurringBills?: FinanceRecurringBill[];
  creditCardStatements?: CreditCardStatement[];
  fitnessProfile?: FitnessProfile | null;
  dailyLogs?: FitnessDailyLog[];
  mealLogs?: MealLog[];
  workoutSessions?: WorkoutSession[];
  supplementInventory?: SupplementInventory[];
  supplementLogs?: SupplementLog[];
}

export interface PillarWeightBreakdown {
  habitsPct: number;
  financePct: number;
  fitnessPct: number;
}

export interface HabitsAnalyticsSlice {
  hasData: boolean;
  score: number;
  previousScore: number;
  scoreDelta: number;
  activeHabitsCount: number;
  completionRatePct: number;
  prevCompletionRatePct: number;
  completionRateDeltaPct: number;
  periodCompletions: number;
  currentBestActiveStreak: number;
  allTimeBestStreak: number;
  momentum: Trend;
  activeGoalsCount: number;
  onTrackGoalsCount: number;
  completedTasksCount: number;
  openTasksCount: number;
  overdueTasksCount: number;
  avgMoodScore: number | null;
  dailyStats: DailyStats[];
  categoryBreakdown: CategoryBreakdown[];
  heatmapData: HeatmapData[];
  goalProgressList: Array<{ goal: Goal; stats: GoalStats }>;
}

export interface FinanceAnalyticsSlice {
  enabled: boolean;
  hasData: boolean;
  score: number;
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  netSavings: number;
  savingsRatePct: number;
  prevTotalExpense: number;
  expenseDeltaPct: number | null;
  dailyAvgBurn: number;
  needsSpend: number;
  discretionarySpend: number;
  categorySpend: Array<{
    categoryId: string;
    name: string;
    color: string;
    amount: number;
    sharePct: number;
    budgetLimit: number;
    transactionCount: number;
    category?: FinanceCategory;
  }>;
  dailyCashflow: Array<{ date: string; label: string; income: number; expense: number; net: number }>;
  netWorth: NetWorthSummary;
  monthlySummary: MonthlyFinanceSummary;
  debtSummary: DebtSummaryBreakdown;
  creditCardSummaries: Array<{ account: FinanceAccount; summary: CreditCardCycleSummary }>;
  totalCardUtilizationPct: number;
  upcomingObligations7d: FinancialObligationItem[];
  anomalies: FinanceAnomalyAlert[];
  forecast30d: CashFlowForecastResult;
}

export interface FitnessAnalyticsSlice {
  enabled: boolean;
  hasData: boolean;
  score: number;
  daysLogged: number;
  latestWeightKg: number | null;
  latestRollingAvgKg: number | null;
  weeklyWeightDeltaKg: number | null;
  latestWaistInches: number | null;
  totalWaistDeltaInches: number | null;
  avgCalories: number;
  calorieTarget: number;
  calorieAdherencePct: number;
  avgProteinG: number;
  proteinTargetG: number;
  proteinAdherencePct: number;
  avgSteps: number;
  stepsTarget: number;
  avgSleepHours: number | null;
  sleepTargetHours: number;
  workoutCount: number;
  totalWorkoutMinutes: number;
  totalVolumeKg: number;
  junkMealCount: number;
  junkFreeStreakDays: number;
  avgEnergyLevel: number | null;
  workoutTypeBreakdown: Array<{ type: string; count: number; minutes: number }>;
  overloadHints: ProgressiveOverloadHint[];
  rollingWeight: RollingWeightSummary;
  waistTrend: WeeklyWaistTrendSummary;
  dailyFuelSeries: Array<{ date: string; label: string; calories: number; proteinG: number; steps: number; sleepHours: number | null }>;
  supplementRoi: SupplementStockAndRoiSummary;
}

export interface HabitSpendCorrelation {
  hasEnoughData: boolean;
  highHabitDaysCount: number;
  lowHabitDaysCount: number;
  highHabitAvgSpendInr: number;
  lowHabitAvgSpendInr: number;
  dailySavingsDeltaInr: number;
}

export interface LifeOsAnalyticsSnapshot {
  window: AnalyticsRangeWindow;
  modules: { showHabits: true; showFinance: boolean; showFitness: boolean; habitOnlyMode: boolean };
  lifeOsScore: number;
  previousLifeOsScore: number;
  lifeOsScoreDelta: number;
  weights: PillarWeightBreakdown;
  habits: HabitsAnalyticsSlice;
  finance: FinanceAnalyticsSlice;
  fitness: FitnessAnalyticsSlice;
  intelligence: {
    report: CrossDomainInsightsReport;
    alerts: CrossDomainAlert[];
    habitSpendCorrelation: HabitSpendCorrelation;
  };
}
