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
import { getTimeGreeting } from '@/lib/design-tokens';
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

export function AICoachWidget({ onOpenAskFinances }: AICoachWidgetProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<AICoachResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const habits = useHabitStore((s) => s.habits);
  const tasks = useTaskStore((s) => s.tasks);
  const settings = useGamificationStore((s) => s.settings);
  const financeTransactions = useFinanceStore((s) => s.transactions);
  const getSpendingAnomalies = useFinanceStore((s) => s.getSpendingAnomalies);

  const {
    displayName,
    email,
    isLoading: isLoadingUser,
    loadUser,
  } = useUserStore(
    useShallow((s) => ({
      displayName: s.displayName,
      email: s.email,
      isLoading: s.isLoading,
      loadUser: s.loadUser,
    }))
  );

  const isFinanceEnabled =
    !settings?.habitOnlyMode && settings?.showFinance !== false;

  const anomalies = useMemo(() => {
    if (!isFinanceEnabled) return [];
    return getSpendingAnomalies().slice(0, 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinanceEnabled, getSpendingAnomalies, financeTransactions]);

  useEffect(() => {
    if (user) loadUser();
  }, [user, loadUser]);

  useEffect(() => {
    if (user && !isLoadingUser && email && !data && !loading) {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `ai_coach_advice_${user.id}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          let currentUserName = 'Habit Hero';
          if (displayName && displayName.trim()) {
            const firstWord = displayName.trim().split(/\s+/)[0];
            currentUserName =
              firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
          } else if (user.email) {
            const emailPrefix = user.email.split('@')[0];
            const match = emailPrefix.match(/^[a-zA-Z]+/);
            if (match && match[0]) {
              const name = match[0];
              currentUserName = name.charAt(0).toUpperCase() + name.slice(1);
            } else {
              currentUserName = user.email;
            }
          }

          if (parsed.date === today && parsed.userName === currentUserName) {
            setData(parsed.data);
          }
        } catch (e) {
          console.error('Cache parse error', e);
        }
      }
    }
  }, [user, isLoadingUser, email, displayName, data, loading]);

  const fetchAdvice = async (force = false) => {
    if (!user || isLoadingUser) return;

    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `ai_coach_advice_${user.id}`;

    if (!force) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.date === today) {
            setData(parsed.data);
            return;
          }
        } catch {
          // ignore
        }
      }
    }

    setLoading(true);
    setError(null);

    try {
      const todaysHabits = habits.filter((h) => !h.archived);
      const todayEnd = `${today}T23:59:59`;
      const unfinishedTasks = tasks.filter((t) => {
        if (t.status === 'done' || t.status === 'archived' || t.parentTaskId) return false;
        if (!t.due_date) return false;
        return t.due_date <= todayEnd;
      });

      let userName = 'Habit Hero';
      if (displayName && displayName.trim()) {
        const firstWord = displayName.trim().split(/\s+/)[0];
        userName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
      } else if (user.email) {
        const emailPrefix = user.email.split('@')[0];
        const match = emailPrefix.match(/^[a-zA-Z]+/);
        if (match && match[0]) {
          const name = match[0];
          userName = name.charAt(0).toUpperCase() + name.slice(1);
        } else {
          userName = user.email;
        }
      }

      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userData: { userName },
          context: {
            todaysHabits: todaysHabits.map((h) => h.name),
            unfinishedTasks: unfinishedTasks.map((t) => t.title),
            mode: 'briefing',
          },
          forceRefresh: force,
        }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('DAILY_QUOTA_EXCEEDED');
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData?.error || errData?.details || `Server error (${res.status})`
        );
      }

      const result = await res.json();
      if (!result.greeting || !result.focus || !result.quote) {
        throw new Error('Invalid response from AI');
      }

      setData(result);
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ date: today, userName, data: result })
      );
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to reach AI Coach.';
      setError(
        msg === 'DAILY_QUOTA_EXCEEDED'
          ? 'Daily coach quota reached. Please check back later.'
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

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
              onClick={() =>
                onOpenAskFinances
                  ? onOpenAskFinances()
                  : router.push('/finance?ask=1')
              }
              className="h-8 px-2.5 text-xs gap-1 rounded-xl"
            >
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              Ask Finances
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
            <RefreshCw
              className={cn(
                'w-3.5 h-3.5 transition-all duration-500',
                loading && 'animate-spin'
              )}
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
        {/* Proactive Finance Anomaly Alerts */}
        {anomalies.length > 0 && (
          <div className="space-y-2">
            {anomalies.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'rounded-xl border p-3 flex items-start justify-between gap-2.5 text-xs',
                  alert.severity === 'critical'
                    ? 'border-rose-500/30 bg-rose-500/5'
                    : 'border-amber-500/30 bg-amber-500/5'
                )}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <AlertTriangle
                    className={cn(
                      'w-4 h-4 shrink-0 mt-0.5',
                      alert.severity === 'critical'
                        ? 'text-rose-500'
                        : 'text-amber-500'
                    )}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{alert.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {alert.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      alert.actionTarget === 'finance' ||
                        alert.actionTarget === 'budgets'
                        ? '/finance'
                        : `/finance?tab=${alert.actionTarget}`
                    )
                  }
                  className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
                >
                  {alert.actionLabel}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Daily Coaching Section */}
        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-5 space-y-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs">Preparing today&apos;s briefing...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-border bg-background p-4 text-center space-y-2.5">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              AI Coach Unavailable
            </p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchAdvice(true)}
              disabled={loading}
              className="rounded-xl text-xs"
            >
              Try Again
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">{liveGreeting}</h3>

            <div className="flex gap-2.5 bg-background p-3.5 rounded-xl border border-border">
              <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Lightbulb className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Focus of the Moment
                </p>
                <p className="text-xs sm:text-sm text-foreground/90 mt-0.5 leading-relaxed">
                  {animatedFocus}
                </p>
              </div>
            </div>

            <div className="flex gap-2 items-start text-muted-foreground">
              <Quote className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs italic">&ldquo;{data.quote}&rdquo;</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-center space-y-2.5">
            <p className="text-xs font-semibold text-foreground">
              Ready for your daily Life OS briefing?
            </p>
            <p className="text-[11px] text-muted-foreground">
              Synthesize your active habits and pending tasks into one clear focus target.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => fetchAdvice(true)}
              className="rounded-xl text-xs gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate Daily Briefing
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
