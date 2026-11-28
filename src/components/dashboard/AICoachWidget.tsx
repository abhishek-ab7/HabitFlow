'use client';

import { useMemo, useCallback } from 'react';
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
import { cn } from '@/lib/utils';
import { formatLiveGreeting } from './ai-coach/coach-context';
import { useCoachBriefingController, useTypewriter } from './ai-coach/useCoachController';
import { SpecialistBadgeStrip } from './ai-coach/SpecialistBadgeStrip';
import { CoachActionCard } from './ai-coach/CoachActionCard';

interface AICoachWidgetProps {
  onOpenAskFinances?: () => void;
}

export function AICoachWidget({ onOpenAskFinances }: AICoachWidgetProps) {
  const router = useRouter();
  const handleNavigateTarget = useCallback(
    (target: string) => {
      router.push(target === 'finance' || target === 'budgets' ? '/finance' : `/finance?tab=${target}`);
    },
    [router]
  );

  const {
    data,
    loading,
    error,
    isFinanceEnabled,
    anomalies,
    consultedSpecialists,
    visibleProposals,
    fetchAdvice,
    acceptProposal,
    dismissProposal,
  } = useCoachBriefingController(handleNavigateTarget);

  const animatedFocus = useTypewriter(data?.focus || '', 15, !loading);
  const liveGreeting = useMemo(() => formatLiveGreeting(data?.greeting), [data?.greeting]);
  const handleAskLifeOs = () => (onOpenAskFinances ? onOpenAskFinances() : router.push('/finance?ask=1'));

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-none overflow-hidden relative h-full flex flex-col tour-ai-coach-widget">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
          <Sparkles className="w-4 h-4 text-primary" />
          AI Coach &amp; Alerts
        </CardTitle>
        <div className="flex items-center gap-1">
          {isFinanceEnabled && (
            <Button type="button" variant="outline" size="sm" onClick={handleAskLifeOs} className="h-8 px-2.5 text-xs gap-1 rounded-xl">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              Ask Life OS
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" onClick={() => fetchAdvice(true)} disabled={loading} aria-label="Refresh AI briefing" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <RefreshCw className={cn('w-3.5 h-3.5 transition-all duration-500', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
        {anomalies.length > 0 && (
          <div className="space-y-2">
            {anomalies.map((alert) => {
              const isCritical = alert.severity === 'critical';
              return (
                <div key={alert.id} className={cn('rounded-xl border p-3 flex items-start justify-between gap-2.5 text-xs', isCritical ? 'border-rose-500/30 bg-rose-500/5' : 'border-amber-500/30 bg-amber-500/5')}>
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertTriangle className={cn('w-4 h-4 shrink-0 mt-0.5', isCritical ? 'text-rose-500' : 'text-amber-500')} />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{alert.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{alert.description}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => handleNavigateTarget(alert.actionTarget)} className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0">
                    {alert.actionLabel}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-5 space-y-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs">Preparing today&apos;s briefing...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-border bg-background p-4 text-center space-y-2.5">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">AI Coach Unavailable</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => fetchAdvice(true)} disabled={loading} className="rounded-xl text-xs">
              Try Again
            </Button>
          </div>
        ) : !data ? (
          <div className="rounded-xl border border-dashed border-border p-4 text-center space-y-2.5">
            <p className="text-xs font-semibold text-foreground">Ready for your daily Life OS briefing?</p>
            <p className="text-[11px] text-muted-foreground">Synthesize your active habits and pending tasks into one clear focus target.</p>
            <Button type="button" size="sm" onClick={() => fetchAdvice(true)} className="rounded-xl text-xs gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Generate Daily Briefing
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">{liveGreeting}</h3>
            <SpecialistBadgeStrip specialists={consultedSpecialists} />
            <div className="flex gap-2.5 bg-background p-3.5 rounded-xl border border-border">
              <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Lightbulb className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Focus of the Moment</p>
                <p className="text-xs sm:text-sm text-foreground/90 mt-0.5 leading-relaxed">{animatedFocus}</p>
              </div>
            </div>
            <CoachActionCard proposals={visibleProposals} onAccept={acceptProposal} onDismiss={dismissProposal} />
            <div className="flex gap-2 items-start text-muted-foreground">
              <Quote className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs italic">&ldquo;{data.quote}&rdquo;</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
