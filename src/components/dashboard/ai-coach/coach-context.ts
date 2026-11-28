import type { useHabitStore } from '@/lib/stores/habit-store';
import type { useTaskStore } from '@/lib/stores/task-store';
import type { useFinanceStore } from '@/lib/stores/finance-store';
import type { useFitnessStore } from '@/lib/stores/fitness';
import type { useMoodStore } from '@/lib/stores/mood-store';
import type { CoachSwarmOutput } from '@/lib/ai/graphs/coach-swarm-types';
import { getTimeGreeting } from '@/lib/design-tokens';
import { addDays, normalizeIsoDate } from '@/lib/finance/credit-card-cycles';
import { calculate7DayRollingWeight } from '@/lib/fitness/shared-analytics';
import { computeCrossDomainInsights } from '@/lib/intelligence/cross-domain-insights';

export interface CoachContextInputs {
  today: string;
  habits: ReturnType<typeof useHabitStore.getState>['habits'];
  habitCompletions: ReturnType<typeof useHabitStore.getState>['completions'];
  tasks: ReturnType<typeof useTaskStore.getState>['tasks'];
  financeTransactions: ReturnType<typeof useFinanceStore.getState>['transactions'];
  financeCategories: ReturnType<typeof useFinanceStore.getState>['categories'];
  financeDebtRecords: ReturnType<typeof useFinanceStore.getState>['debtRecords'];
  fitnessProfile: ReturnType<typeof useFitnessStore.getState>['profile'];
  fitnessDailyLogs: ReturnType<typeof useFitnessStore.getState>['dailyLogs'];
  fitnessMealLogs: ReturnType<typeof useFitnessStore.getState>['mealLogs'];
  fitnessWorkoutSessions: ReturnType<typeof useFitnessStore.getState>['workoutSessions'];
  fitnessSupplements: ReturnType<typeof useFitnessStore.getState>['supplementInventory'];
  fitnessSupplementLogs: ReturnType<typeof useFitnessStore.getState>['supplementLogs'];
  moodLogs: ReturnType<typeof useMoodStore.getState>['moodLogs'];
}

export function resolveCoachUserName(displayName?: string | null, email?: string | null): string {
  if (displayName?.trim()) {
    const firstWord = displayName.trim().split(/\s+/)[0];
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
  }
  if (!email) return 'Habit Hero';
  const match = email.split('@')[0].match(/^[a-zA-Z]+/);
  if (!match?.[0]) return email;
  return match[0].charAt(0).toUpperCase() + match[0].slice(1);
}

function avgPositiveMetric<T>(items: T[], pick: (item: T) => number | undefined | null, decimals = 0): number | null {
  const vals = items.map(pick).filter((v): v is number => typeof v === 'number' && v > 0);
  if (vals.length === 0) return null;
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const factor = Math.pow(10, decimals);
  return Math.round(mean * factor) / factor;
}

export function compute14dFitnessTelemetry(params: {
  today: string;
  fitnessProfile: CoachContextInputs['fitnessProfile'];
  fitnessDailyLogs: CoachContextInputs['fitnessDailyLogs'];
  fitnessMealLogs: CoachContextInputs['fitnessMealLogs'];
  fitnessWorkoutSessions: CoachContextInputs['fitnessWorkoutSessions'];
  walletWaistline: ReturnType<typeof computeCrossDomainInsights>['walletWaistline'];
}) {
  const window14Start = addDays(params.today, -13);
  const in14d = <T extends { date: string; deletedAt?: string | null }>(list: T[]) =>
    list.filter((l) => !l.deletedAt && normalizeIsoDate(l.date) >= window14Start && normalizeIsoDate(l.date) <= params.today);

  const logs14d = in14d(params.fitnessDailyLogs);
  const meals14d = in14d(params.fitnessMealLogs);
  const workouts14d = in14d(params.fitnessWorkoutSessions);
  const mealDaysCount = new Set(meals14d.map((m) => normalizeIsoDate(m.date))).size;
  const weightSummary = calculate7DayRollingWeight(params.fitnessDailyLogs);

  return {
    avgSleepHours14d: avgPositiveMetric(logs14d, (l) => l.sleepHours, 1),
    avgEnergy14d: avgPositiveMetric(logs14d, (l) => l.energyLevel, 1),
    workouts14dCount: workouts14d.length,
    avgSteps14d: avgPositiveMetric(logs14d, (l) => l.steps, 0),
    rollingWeightKg: weightSummary.latestRollingAvgKg,
    rollingWeightDeltaKg: weightSummary.weeklyDeltaKg,
    avgProtein14dG: mealDaysCount > 0 ? Math.round(meals14d.reduce((s, m) => s + Number(m.proteinG || 0), 0) / mealDaysCount) : null,
    proteinTargetG: params.fitnessProfile?.proteinTargetG ?? null,
    calorieTarget: params.fitnessProfile?.calorieTarget ?? null,
    junkSpend14dInr: params.walletWaistline.spend14dInr,
    junkEmptyKcal14d: params.walletWaistline.emptyKcal14d,
    fatLossDragKg14d: params.walletWaistline.fatLossDragKg14d,
  };
}

export function selectActiveHabitNames(habits: CoachContextInputs['habits']): string[] {
  return habits.filter((h) => !h.archived).map((h) => h.name);
}

export function selectDueTaskTitles(tasks: CoachContextInputs['tasks'], todayEnd: string): string[] {
  return tasks
    .filter((t) => t.status !== 'done' && t.status !== 'archived' && !t.parentTaskId && t.due_date && t.due_date <= todayEnd)
    .map((t) => t.title);
}

export function buildCoachCrossDomainSummary(crossDomain: ReturnType<typeof computeCrossDomainInsights>) {
  return {
    alerts: crossDomain.alerts.slice(0, 4).map((a) => ({ title: a.title, description: a.description, metricBadge: a.metricBadge })),
    gymCostPerWorkoutInr: crossDomain.gymSupplementRoi.gymCostPerWorkoutInr,
    primaryProteinCostPer25gInr: crossDomain.gymSupplementRoi.primaryCostPer25gProteinInr,
    triggerMultiplier: crossDomain.triggers.overallSpendMultiplier,
    topTriggerLabel: crossDomain.triggers.topTriggerLabel,
    socialFoodSpend30dInr: crossDomain.socialSpendDiet.socialFoodSpend30dInr,
    savings70PctMonthlyInr: crossDomain.walletWaistline.savings70PctMonthlyInr,
  };
}

export function buildCoachContextPayload(params: CoachContextInputs) {
  const { today, habits, habitCompletions, tasks, fitnessDailyLogs, fitnessMealLogs, fitnessWorkoutSessions, fitnessProfile } = params;
  const crossDomain = computeCrossDomainInsights({
    todayDate: today,
    transactions: params.financeTransactions,
    categories: params.financeCategories,
    debtRecords: params.financeDebtRecords,
    mealLogs: fitnessMealLogs,
    workoutSessions: fitnessWorkoutSessions,
    fitnessDailyLogs,
    supplementInventory: params.fitnessSupplements,
    supplementLogs: params.fitnessSupplementLogs,
    habits,
    habitCompletions,
    moodLogs: params.moodLogs,
  });

  return {
    todayIso: today,
    todaysHabits: selectActiveHabitNames(habits),
    unfinishedTasks: selectDueTaskTitles(tasks, `${today}T23:59:59`),
    mode: 'briefing' as const,
    fitnessTelemetry: compute14dFitnessTelemetry({
      today,
      fitnessProfile,
      fitnessDailyLogs,
      fitnessMealLogs,
      fitnessWorkoutSessions,
      walletWaistline: crossDomain.walletWaistline,
    }),
    crossDomainInsights: buildCoachCrossDomainSummary(crossDomain),
  };
}

export function readCachedCoachAdvice(cacheKey: string, today: string, expectedUserName?: string): CoachSwarmOutput | null {
  const cached = localStorage.getItem(cacheKey);
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached);
    if (parsed.date !== today) return null;
    if (expectedUserName && parsed.userName !== expectedUserName) return null;
    return parsed.data as CoachSwarmOutput;
  } catch {
    return null;
  }
}

export function writeCachedCoachAdvice(cacheKey: string, today: string, userName: string, data: CoachSwarmOutput): void {
  localStorage.setItem(cacheKey, JSON.stringify({ date: today, userName, data }));
}

async function parseCoachError(res: Response): Promise<never> {
  if (res.status === 429) throw new Error('DAILY_QUOTA_EXCEEDED');
  const errData = await res.json().catch(() => ({}));
  throw new Error(errData?.error || errData?.details || `Server error (${res.status})`);
}

export async function requestDailyCoachBriefing(params: {
  userName: string;
  context: ReturnType<typeof buildCoachContextPayload>;
  forceRefresh: boolean;
}): Promise<CoachSwarmOutput> {
  const res = await fetch('/api/ai/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userData: { userName: params.userName },
      context: params.context,
      forceRefresh: params.forceRefresh,
    }),
  });

  if (!res.ok) await parseCoachError(res);

  const result = (await res.json()) as Partial<CoachSwarmOutput>;
  const hasAllFields = Boolean(result.greeting) && Boolean(result.focus) && Boolean(result.quote);
  if (!hasAllFields) {
    throw new Error('Invalid response from AI');
  }
  return result as CoachSwarmOutput;
}

export function formatCoachErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Unable to reach AI Coach.';
  return msg === 'DAILY_QUOTA_EXCEEDED' ? 'Daily coach quota reached. Please check back later.' : msg;
}

export function formatLiveGreeting(greeting?: string): string {
  if (!greeting) return '';
  const { greeting: timeGreeting } = getTimeGreeting();
  if (/^good\s+(morning|afternoon|evening|night)/i.test(greeting)) {
    return greeting.replace(/^good\s+(morning|afternoon|evening|night)/i, timeGreeting);
  }
  return greeting;
}
