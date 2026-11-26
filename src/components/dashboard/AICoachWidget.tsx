'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Lightbulb,
  Quote,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';
import { useShallow } from 'zustand/react/shallow';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useUserStore } from '@/lib/stores/user-store';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useMoodStore } from '@/lib/stores/mood-store';
import { getTimeGreeting } from '@/lib/design-tokens';
import { addDays, normalizeIsoDate } from '@/lib/finance/credit-card-cycles';
import { getIstIsoDate } from '@/lib/mcp/config';
import { calculate7DayRollingWeight } from '@/lib/fitness/shared-analytics';
import { computeCrossDomainInsights } from '@/lib/intelligence/cross-domain-insights';
import { cn } from '@/lib/utils';

interface AICoachResponse {
  greeting: string;
  focus: string;
  quote: string;
}

interface AICoachWidgetProps {
  onOpenAskFinances?: () => void;
}

function useTypewriter(text: string, speed = 15, active = true) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (!active || !text) {
      setDisplayedText(text);
      return;
    }

    setDisplayedText('');
    let i = 0;
    const timer = setInterval(() => {
      const char = text.charAt(i);
      setDisplayedText((prev) => prev + char);
      i++;
      if (i >= text.length) {
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed, active]);

  return displayedText;
}

function resolveCoachUserName(displayName?: string | null, email?: string | null): string {
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

function compute14dFitnessTelemetry(params: {
  today: string;
  fitnessProfile: ReturnType<typeof useFitnessStore.getState>['profile'];
  fitnessDailyLogs: ReturnType<typeof useFitnessStore.getState>['dailyLogs'];
  fitnessMealLogs: ReturnType<typeof useFitnessStore.getState>['mealLogs'];
  fitnessWorkoutSessions: ReturnType<typeof useFitnessStore.getState>['workoutSessions'];
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

function buildCoachContextPayload(params: {
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
}) {
  const { today, habits, habitCompletions, tasks, fitnessDailyLogs, fitnessMealLogs, fitnessWorkoutSessions, fitnessProfile } = params;
  const todayEnd = `${today}T23:59:59`;
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
    todaysHabits: habits.filter((h) => !h.archived).map((h) => h.name),
    unfinishedTasks: tasks.filter((t) => t.status !== 'done' && t.status !== 'archived' && !t.parentTaskId && t.due_date && t.due_date <= todayEnd).map((t) => t.title),
    mode: 'briefing' as const,
    fitnessTelemetry: compute14dFitnessTelemetry({
      today,
      fitnessProfile,
      fitnessDailyLogs,
      fitnessMealLogs,
      fitnessWorkoutSessions,
      walletWaistline: crossDomain.walletWaistline,
    }),
    crossDomainInsights: {
      alerts: crossDomain.alerts.slice(0, 4).map((a) => ({ title: a.title, description: a.description, metricBadge: a.metricBadge })),
      gymCostPerWorkoutInr: crossDomain.gymSupplementRoi.gymCostPerWorkoutInr,
      primaryProteinCostPer25gInr: crossDomain.gymSupplementRoi.primaryCostPer25gProteinInr,
      triggerMultiplier: crossDomain.triggers.overallSpendMultiplier,
      topTriggerLabel: crossDomain.triggers.topTriggerLabel,
      socialFoodSpend30dInr: crossDomain.socialSpendDiet.socialFoodSpend30dInr,
      savings70PctMonthlyInr: crossDomain.walletWaistline.savings70PctMonthlyInr,
    },
  };
}

function readCachedCoachAdvice(cacheKey: string, today: string, expectedUserName?: string): AICoachResponse | null {
  const cached = localStorage.getItem(cacheKey);
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached);
    if (parsed.date !== today) return null;
    if (expectedUserName && parsed.userName !== expectedUserName) return null;
    return parsed.data as AICoachResponse;
  } catch {
    return null;
  }
}

async function parseCoachError(res: Response): Promise<never> {
  if (res.status === 429) throw new Error('DAILY_QUOTA_EXCEEDED');
  const errData = await res.json().catch(() => ({}));
  throw new Error(errData?.error || errData?.details || `Server error (${res.status})`);
}

async function requestDailyCoachBriefing(params: {
  userName: string;
  context: ReturnType<typeof buildCoachContextPayload>;
  forceRefresh: boolean;
}): Promise<AICoachResponse> {
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

  const result = (await res.json()) as Partial<AICoachResponse>;
  const hasAllFields = Boolean(result.greeting) && Boolean(result.focus) && Boolean(result.quote);
  if (!hasAllFields) {
    throw new Error('Invalid response from AI');
  }
  return result as AICoachResponse;
}

function useCoachStoreInputs() {
  return {
    habits: useHabitStore((s) => s.habits),
    habitCompletions: useHabitStore((s) => s.completions),
    tasks: useTaskStore((s) => s.tasks),
    settings: useGamificationStore((s) => s.settings),
    financeTransactions: useFinanceStore((s) => s.transactions),
    financeCategories: useFinanceStore((s) => s.categories),
    financeDebtRecords: useFinanceStore((s) => s.debtRecords),
    getSpendingAnomalies: useFinanceStore((s) => s.getSpendingAnomalies),
    fitnessProfile: useFitnessStore((s) => s.profile),
    fitnessDailyLogs: useFitnessStore((s) => s.dailyLogs),
    fitnessMealLogs: useFitnessStore((s) => s.mealLogs),
    fitnessWorkoutSessions: useFitnessStore((s) => s.workoutSessions),
    fitnessSupplements: useFitnessStore((s) => s.supplementInventory),
    fitnessSupplementLogs: useFitnessStore((s) => s.supplementLogs),
    moodLogs: useMoodStore((s) => s.moodLogs),
  };
}

function formatCoachErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Unable to reach AI Coach.';
  return msg === 'DAILY_QUOTA_EXCEEDED' ? 'Daily coach quota reached. Please check back later.' : msg;
}

async function fetchAndCacheBriefing(params: {
  userId: string;
  userEmail?: string | null;
  displayName?: string | null;
  today: string;
  cacheKey: string;
  stores: ReturnType<typeof useCoachStoreInputs>;
}): Promise<AICoachResponse> {
  const userName = resolveCoachUserName(params.displayName, params.userEmail);
  const context = buildCoachContextPayload({ today: params.today, ...params.stores });
  const result = await requestDailyCoachBriefing({ userName, context, forceRefresh: true });
  localStorage.setItem(params.cacheKey, JSON.stringify({ date: params.today, userName, data: result }));
  return result;
}

function useCoachCacheHydration(params: {
  userId?: string;
  userEmail?: string | null;
  displayName?: string | null;
  email?: string | null;
  isLoadingUser: boolean;
  hasData: boolean;
  loading: boolean;
  onHydrate: (cached: AICoachResponse) => void;
}) {
  const { userId, userEmail, displayName, email, isLoadingUser, hasData, loading, onHydrate } = params;
  useEffect(() => {
    if (!userId || !email) return;
    if (isLoadingUser || hasData || loading) return;
    const cached = readCachedCoachAdvice(
      `ai_coach_advice_${userId}`,
      getIstIsoDate(),
      resolveCoachUserName(displayName, userEmail)
    );
    if (cached) onHydrate(cached);
  }, [userId, userEmail, email, isLoadingUser, hasData, loading, displayName, onHydrate]);
}

function useCoachBriefingController() {
  const { user } = useAuth();
  const [data, setData] = useState<AICoachResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stores = useCoachStoreInputs();

  const { displayName, email, isLoading: isLoadingUser, loadUser } = useUserStore(
    useShallow((s) => ({
      displayName: s.displayName,
      email: s.email,
      isLoading: s.isLoading,
      loadUser: s.loadUser,
    }))
  );

  const isFinanceEnabled = !stores.settings?.habitOnlyMode && stores.settings?.showFinance !== false;
  const anomalies = useMemo(
    () => (isFinanceEnabled ? stores.getSpendingAnomalies().slice(0, 2) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isFinanceEnabled, stores.getSpendingAnomalies, stores.financeTransactions]
  );

  useEffect(() => {
    if (user) loadUser();
  }, [user, loadUser]);

  useCoachCacheHydration({
    userId: user?.id,
    userEmail: user?.email,
    displayName,
    email,
    isLoadingUser,
    hasData: Boolean(data),
    loading,
    onHydrate: setData,
  });

  const fetchAdvice = async (force = false) => {
    if (!user || isLoadingUser) return;
    const today = getIstIsoDate();
    const cacheKey = `ai_coach_advice_${user.id}`;
    const cached = !force ? readCachedCoachAdvice(cacheKey, today) : null;
    if (cached) {
      setData(cached);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchAndCacheBriefing({
        userId: user.id,
        userEmail: user.email,
        displayName,
        today,
        cacheKey,
        stores,
      });
      setData(result);
    } catch (err: unknown) {
      setError(formatCoachErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, isFinanceEnabled, anomalies, fetchAdvice };
}

export function AICoachWidget({ onOpenAskFinances }: AICoachWidgetProps) {
  const router = useRouter();
  const { data, loading, error, isFinanceEnabled, anomalies, fetchAdvice } = useCoachBriefingController();

  const animatedFocus = useTypewriter(data?.focus || '', 15, !loading);

  // Always keep greeting synchronized with the current client time of day
  const liveGreeting = useMemo(() => {
    if (!data?.greeting) return '';
    const { greeting: timeGreeting } = getTimeGreeting();
    if (/^good\s+(morning|afternoon|evening|night)/i.test(data.greeting)) {
      return data.greeting.replace(/^good\s+(morning|afternoon|evening|night)/i, timeGreeting);
    }
    return data.greeting;
  }, [data?.greeting]);

function CoachAnomalyAlerts({
  anomalies,
  onNavigate,
}: {
  anomalies: ReturnType<ReturnType<typeof useFinanceStore.getState>['getSpendingAnomalies']>;
  onNavigate: (target: string) => void;
}) {
  if (anomalies.length === 0) return null;
  return (
    <div className="space-y-2">
      {anomalies.map((alert) => {
        const isCritical = alert.severity === 'critical';
        return (
          <div
            key={alert.id}
            className={cn(
              'rounded-xl border p-3 flex items-start justify-between gap-2.5 text-xs',
              isCritical ? 'border-rose-500/30 bg-rose-500/5' : 'border-amber-500/30 bg-amber-500/5'
            )}
          >
            <div className="flex items-start gap-2 min-w-0">
              <AlertTriangle className={cn('w-4 h-4 shrink-0 mt-0.5', isCritical ? 'text-rose-500' : 'text-amber-500')} />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{alert.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{alert.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(alert.actionTarget)}
              className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
            >
              {alert.actionLabel}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function CoachBriefingSection(props: {
  loading: boolean;
  error: string | null;
  data: AICoachResponse | null;
  liveGreeting: string;
  animatedFocus: string;
  onRetry: () => void;
}) {
  const { loading, error, data, liveGreeting, animatedFocus, onRetry } = props;
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-5 space-y-2 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-xs">Preparing today&apos;s briefing...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-border bg-background p-4 text-center space-y-2.5">
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">AI Coach Unavailable</p>
        <p className="text-xs text-muted-foreground">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={loading} className="rounded-xl text-xs">
          Try Again
        </Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-center space-y-2.5">
        <p className="text-xs font-semibold text-foreground">Ready for your daily Life OS briefing?</p>
        <p className="text-[11px] text-muted-foreground">Synthesize your active habits and pending tasks into one clear focus target.</p>
        <Button type="button" size="sm" onClick={onRetry} className="rounded-xl text-xs gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Generate Daily Briefing
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground">{liveGreeting}</h3>
      <div className="flex gap-2.5 bg-background p-3.5 rounded-xl border border-border">
        <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <Lightbulb className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Focus of the Moment</p>
          <p className="text-xs sm:text-sm text-foreground/90 mt-0.5 leading-relaxed">{animatedFocus}</p>
        </div>
      </div>
      <div className="flex gap-2 items-start text-muted-foreground">
        <Quote className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <p className="text-xs italic">&ldquo;{data.quote}&rdquo;</p>
      </div>
    </div>
  );
}

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-none overflow-hidden relative h-full flex flex-col tour-ai-coach-widget">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
          <Sparkles className="w-4 h-4 text-primary" />
          AI Coach &amp; Alerts
        </CardTitle>
        <div className="flex items-center gap-1">
          {isFinanceEnabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (onOpenAskFinances ? onOpenAskFinances() : router.push('/finance?ask=1'))}
              className="h-8 px-2.5 text-xs gap-1 rounded-xl"
            >
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              Ask Life OS
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fetchAdvice(true)}
            disabled={loading}
            aria-label="Refresh AI briefing"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn('w-3.5 h-3.5 transition-all duration-500', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
        <CoachAnomalyAlerts
          anomalies={anomalies}
          onNavigate={(target) =>
            router.push(target === 'finance' || target === 'budgets' ? '/finance' : `/finance?tab=${target}`)
          }
        />
        <CoachBriefingSection
          loading={loading}
          error={error}
          data={data}
          liveGreeting={liveGreeting}
          animatedFocus={animatedFocus}
          onRetry={() => fetchAdvice(true)}
        />
      </CardContent>
    </Card>
  );
}
