import { format } from 'date-fns';
import { ArrowDownRight, Dumbbell, Footprints, Landmark, PiggyBank, Ruler, Scale, TrendingUp, type LucideIcon } from 'lucide-react';
import { calculateHabitStats } from '@/lib/calculations';
import { calculateFitnessGoalProgress } from '@/lib/fitness/shared-analytics';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type { useFinanceStore } from '@/lib/stores/finance-store';
import type {
  AreaOfLife,
  Goal,
  GoalStats,
  Habit,
  HabitCompletion,
  Priority,
} from '@/lib/types';

type FinanceStoreState = ReturnType<typeof useFinanceStore.getState>;
type FinanceAccount = FinanceStoreState['accounts'][number];
type DebtRecord = FinanceStoreState['debtRecords'][number];
type EmiTracker = FinanceStoreState['emiTrackers'][number];
type SipPlan = FinanceStoreState['sipPlans'][number];
type FitnessProgressInput = Parameters<typeof calculateFitnessGoalProgress>[1];

export const PRIORITY_STYLES: Record<Priority, { color: string; label: string }> = {
  high: { color: 'text-rose-600 dark:text-rose-400', label: 'High' },
  medium: { color: 'text-amber-600 dark:text-amber-400', label: 'Medium' },
  low: { color: 'text-muted-foreground', label: 'Low' },
};

export const AREA_STYLES: Record<AreaOfLife, { text: string; label: string }> = {
  career: { text: 'text-blue-600 dark:text-blue-400', label: 'Career' },
  health: { text: 'text-emerald-600 dark:text-emerald-400', label: 'Health' },
  relationships: { text: 'text-rose-600 dark:text-rose-400', label: 'Relationships' },
  personal_growth: { text: 'text-teal-600 dark:text-teal-400', label: 'Personal Growth' },
  finance: { text: 'text-sky-600 dark:text-sky-400', label: 'Finance' },
  fun: { text: 'text-amber-600 dark:text-amber-400', label: 'Fun & Leisure' },
};

const LINKED_CATEGORIES: Record<string, string[]> = {
  career: ['work', 'learning'],
  health: ['health'],
  relationships: ['relationships'],
  personal_growth: ['learning', 'personal'],
  finance: ['finance'],
  fun: ['personal'],
};

export function getDeadlineColorClass(color: 'destructive' | 'warning' | 'success' | 'muted'): string {
  switch (color) {
    case 'destructive': return 'text-destructive';
    case 'warning': return 'text-amber-600 dark:text-amber-400';
    case 'success': return 'text-emerald-600 dark:text-emerald-400';
    default: return 'text-muted-foreground';
  }
}

export function getUnifiedGoalStatus(status: Goal['status'], isOnTrack: boolean): { label: string; className: string } {
  if (status === 'completed') return { label: 'Completed', className: 'text-emerald-600 dark:text-emerald-400' };
  if (status === 'on_hold') return { label: 'On Hold', className: 'text-muted-foreground' };
  if (status === 'not_started') return { label: 'Not Started', className: 'text-muted-foreground' };
  return isOnTrack
    ? { label: 'In Progress · On Track', className: 'text-emerald-600 dark:text-emerald-400' }
    : { label: 'In Progress · Behind', className: 'text-amber-600 dark:text-amber-400' };
}

export function computeGoalHealthScore(params: {
  areaOfLife: AreaOfLife;
  habits: Habit[];
  completions: HabitCompletion[];
  stats: GoalStats;
}): number {
  const { areaOfLife, habits, completions, stats } = params;
  const linkedCats = LINKED_CATEGORIES[areaOfLife] ?? [];
  const activeHabits = habits.filter((h) => !h.archived);
  const linkedHabits = activeHabits.filter((h) => linkedCats.includes(h.category));
  const targetHabits = linkedHabits.length > 0 ? linkedHabits : activeHabits;

  let consistency = 80;
  if (targetHabits.length > 0) {
    const compsByHabit = new Map<string, HabitCompletion[]>();
    for (const c of completions) {
      const arr = compsByHabit.get(c.habitId);
      if (arr) arr.push(c);
      else compsByHabit.set(c.habitId, [c]);
    }
    const sumRates = targetHabits.reduce((sum, h) => sum + calculateHabitStats(h, compsByHabit.get(h.id) || []).completionRate, 0);
    consistency = sumRates / targetHabits.length;
  }

  const totalDays = stats.totalDays || 1;
  const proximityScore = stats.isOnTrack ? 100 : Math.max(0, Math.min(100, (stats.daysRemaining / totalDays) * 100));
  return Math.round(consistency * 0.4 + stats.progress * 0.4 + proximityScore * 0.2);
}

export function computeFitnessProgressView(params: {
  fitnessLink: Goal['fitnessLink'];
  profile: FitnessProgressInput['profile'];
  dailyLogs: FitnessProgressInput['dailyLogs'];
  workoutSessions: FitnessProgressInput['workoutSessions'];
}) {
  const { fitnessLink, profile, dailyLogs, workoutSessions } = params;
  if (!fitnessLink?.targetValue) return null;
  const summary = calculateFitnessGoalProgress(fitnessLink, {
    profile, dailyLogs, workoutSessions, referenceDate: getLocalIsoDate(),
  });
  const iconMap: Record<string, LucideIcon> = {
    target_weight: Scale,
    target_waist: Ruler,
    daily_steps_avg: Footprints,
  };
  return { ...summary, Icon: iconMap[fitnessLink.type] ?? Dumbbell };
}

export interface FinancialProgressView {
  type: NonNullable<Goal['financialLink']>['type'];
  label: string;
  Icon: LucideIcon;
  currentAmount: number;
  targetAmount: number;
  remaining: number;
  progressPct: number;
  projectionText: string | null;
}

function computeDebtPayoffAmount(params: {
  debtRecords: DebtRecord[];
  emiTrackers: EmiTracker[];
  linkedDebtIds?: string[];
  initialTotal: number;
}): number {
  const allDebts = [
    ...params.debtRecords.map((d) => ({ id: d.id, amount: d.remainingAmount })),
    ...params.emiTrackers.map((e) => ({ id: e.id, amount: Math.max(0, (e.tenureMonths - e.paidMonths) * e.emiAmount) })),
  ];
  const hasSelection = Boolean(params.linkedDebtIds && params.linkedDebtIds.length > 0);
  const relevant = hasSelection ? allDebts.filter((d) => params.linkedDebtIds?.includes(d.id)) : allDebts;
  const currentRemaining = relevant.reduce((sum, d) => sum + d.amount, 0);
  return Math.max(0, params.initialTotal - currentRemaining);
}

function resolveFinancialMetric(params: {
  link: NonNullable<Goal['financialLink']>;
  accounts: FinanceAccount[];
  debtRecords: DebtRecord[];
  emiTrackers: EmiTracker[];
  sipPlans: SipPlan[];
  getNetWorthSummary: () => { netWorth: number };
}): { label: string; Icon: LucideIcon; currentAmount: number } {
  const { link, accounts, debtRecords, emiTrackers, sipPlans, getNetWorthSummary } = params;
  if (link.type === 'savings_target') {
    const hasAccs = Boolean(link.linkedAccountIds && link.linkedAccountIds.length > 0);
    const relevant = hasAccs ? accounts.filter((a) => link.linkedAccountIds?.includes(a.id)) : accounts.filter((a) => a.type !== 'credit_card');
    return { label: 'Savings Target', Icon: PiggyBank, currentAmount: relevant.reduce((s, a) => s + (a.balance || 0), 0) };
  }
  if (link.type === 'debt_payoff') {
    const currentAmount = computeDebtPayoffAmount({
      debtRecords, emiTrackers, linkedDebtIds: link.linkedDebtIds, initialTotal: link.startingAmount || link.targetAmount,
    });
    return { label: 'Debt Payoff', Icon: ArrowDownRight, currentAmount };
  }
  if (link.type === 'net_worth') {
    return { label: 'Net Worth Milestone', Icon: Landmark, currentAmount: getNetWorthSummary().netWorth };
  }
  const hasSips = Boolean(link.linkedSipIds && link.linkedSipIds.length > 0);
  const relevantSips = hasSips ? sipPlans.filter((s) => link.linkedSipIds?.includes(s.id)) : sipPlans;
  const currentAmount = relevantSips.reduce((sum, s) => sum + (s.currentValue || s.totalInvested || 0), 0);
  return { label: 'SIP Corpus', Icon: TrendingUp, currentAmount };
}

function computeProjectionText(params: {
  type: NonNullable<Goal['financialLink']>['type'];
  progressPct: number;
  remaining: number;
  sipPlans: SipPlan[];
  emiTrackers: EmiTracker[];
  debtRecords: DebtRecord[];
  getMonthlySummary: (m: string) => { totalIncome: number; totalSpent: number; safeToSpendMonthly: number };
}): string | null {
  if (params.progressPct >= 100) return 'Target Achieved';
  if (params.remaining <= 0) return null;

  const summary = params.getMonthlySummary(format(new Date(), 'yyyy-MM'));
  const netCashFlow = summary.totalIncome - summary.totalSpent;
  const monthlyNetSavings = netCashFlow > 0 ? netCashFlow : summary.safeToSpendMonthly;

  let monthlyPace = monthlyNetSavings;
  if (params.type === 'sip_corpus') {
    const sipMonthly = params.sipPlans.filter((s) => s.isActive).reduce((sum, s) => sum + s.monthlyAmount, 0);
    if (sipMonthly > 0) monthlyPace = sipMonthly;
  } else if (params.type === 'debt_payoff') {
    const debtMonthly = params.emiTrackers.reduce((sum, e) => sum + e.emiAmount, 0) + (params.debtRecords.length > 0 ? 5000 : 0);
    if (debtMonthly > 0) monthlyPace = debtMonthly;
  }

  if (monthlyPace <= 0) return null;
  const monthsNeeded = Math.ceil(params.remaining / monthlyPace);
  if (monthsNeeded <= 1) return 'Projected: Reached this month';
  const paceLabel = `₹${Math.round(monthlyPace).toLocaleString('en-IN')}/mo`;
  return monthsNeeded <= 12
    ? `Projected: ~${monthsNeeded} mo (${paceLabel})`
    : `Projected: ~${(monthsNeeded / 12).toFixed(1)} yrs (${paceLabel})`;
}

export function computeFinancialProgressView(params: {
  financialLink: Goal['financialLink'];
  accounts: FinanceAccount[];
  debtRecords: DebtRecord[];
  emiTrackers: EmiTracker[];
  sipPlans: SipPlan[];
  getNetWorthSummary: () => { netWorth: number };
  getMonthlySummary: (m: string) => { totalIncome: number; totalSpent: number; safeToSpendMonthly: number };
}): FinancialProgressView | null {
  const { financialLink } = params;
  if (!financialLink?.targetAmount) return null;

  const { targetAmount, startingAmount = 0, type } = financialLink;
  const { label, Icon, currentAmount } = resolveFinancialMetric({
    link: financialLink,
    accounts: params.accounts,
    debtRecords: params.debtRecords,
    emiTrackers: params.emiTrackers,
    sipPlans: params.sipPlans,
    getNetWorthSummary: params.getNetWorthSummary,
  });

  const base = type === 'net_worth' ? startingAmount : 0;
  const denominator = targetAmount - base || 1;
  const progressPct = Math.min(100, Math.max(0, Math.round(((currentAmount - base) / denominator) * 100)));
  const remaining = Math.max(0, targetAmount - currentAmount);
  const projectionText = computeProjectionText({
    type,
    progressPct,
    remaining,
    sipPlans: params.sipPlans,
    emiTrackers: params.emiTrackers,
    debtRecords: params.debtRecords,
    getMonthlySummary: params.getMonthlySummary,
  });

  return { type, label, Icon, currentAmount, targetAmount, remaining, progressPct, projectionText };
}
