'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Percent, 
  Clock, 
  Brain,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { cn } from '@/lib/utils';

function getTaskCompletionRate(list: { status: string }[]): number {
  if (list.length === 0) return 0;
  const completed = list.filter((t) => t.status === 'done').length;
  return Math.round((completed / list.length) * 100);
}

function computeTimeEstimationStats(tasks: ReturnType<typeof useTaskStore.getState>['tasks']) {
  const completedWithTime = tasks.filter(
    (t) => t.estimatedTime && t.estimatedTime > 0 && t.status === 'done' && t.actualTime && t.actualTime > 0
  );
  if (completedWithTime.length === 0) {
    return { avgEstTime: 0, avgActTime: 0, estimationErrorPercent: 0, hasTimedTasks: false };
  }
  const totalEst = completedWithTime.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);
  const totalAct = completedWithTime.reduce((sum, t) => sum + (t.actualTime || 0), 0);
  return {
    avgEstTime: Math.round(totalEst / completedWithTime.length),
    avgActTime: Math.round(totalAct / completedWithTime.length),
    estimationErrorPercent: Math.round(((totalAct - totalEst) / totalEst) * 100),
    hasTimedTasks: true,
  };
}

function computeBestWorstWeekdays(activeTasks: ReturnType<typeof useTaskStore.getState>['tasks']) {
  const completions = Array(7).fill(0);
  const totals = Array(7).fill(0);
  for (const t of activeTasks) {
    if (!t.due_date) continue;
    const day = new Date(t.due_date).getDay();
    totals[day]++;
    if (t.status === 'done') completions[day]++;
  }
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const sorted = totals
    .map((total, idx) => ({ day: weekdays[idx], rate: total > 0 ? Math.round((completions[idx] / total) * 100) : 0, count: total }))
    .sort((a, b) => b.rate - a.rate);
  return { bestDay: sorted[0], worstDay: sorted[sorted.length - 1] };
}

function buildPredictiveInsights(params: {
  correlationLift: number;
  estimationErrorPercent: number;
  hasTimedTasks: boolean;
  bestDayRate: number;
  bestDayName: string;
}): string[] {
  const insights: string[] = [
    params.correlationLift > 5
      ? `Completing your habits gives a ${params.correlationLift}% boost to your daily task completion rates. Maintain your streaks to crush your tasks!`
      : 'Completing habits early creates a positive psychological momentum for daily productivity. Try starting your day with a health habit!',
  ];
  if (params.estimationErrorPercent > 10) {
    insights.push(`You currently underestimate task durations by an average of ${params.estimationErrorPercent}%. Try allocating 1.5x more time to new tasks.`);
  } else if (params.estimationErrorPercent < -10) {
    insights.push(`You overestimate task durations by ${Math.abs(params.estimationErrorPercent)}%. Try challenging yourself to complete them faster!`);
  } else if (params.hasTimedTasks) {
    insights.push('Your task time estimations are highly accurate. Excellent planning skills!');
  }
  if (params.bestDayRate > 0) {
    insights.push(`Your most productive day is ${params.bestDayName} (${params.bestDayRate}% rate). Schedule your most complex tasks for this day.`);
  }
  return insights;
}

function computePredictiveStatistics(
  tasks: ReturnType<typeof useTaskStore.getState>['tasks'],
  completions: ReturnType<typeof useHabitStore.getState>['completions']
) {
  const activeTasks = tasks.filter((t) => t.status !== 'archived');
  const rateFor = (p: 'high' | 'medium' | 'low') => getTaskCompletionRate(activeTasks.filter((t) => t.priority === p));

  const habitDates = new Set(completions.filter((c) => c.completed && c.status !== 'frozen').map((c) => c.date));
  const datedTasks = activeTasks.filter((t) => Boolean(t.due_date));
  const onHabitDays = datedTasks.filter((t) => habitDates.has(t.due_date!.split('T')[0]));
  const onNonHabitDays = datedTasks.filter((t) => !habitDates.has(t.due_date!.split('T')[0]));

  const completionRateOnHabitDays = getTaskCompletionRate(onHabitDays);
  const completionRateOnNonHabitDays = getTaskCompletionRate(onNonHabitDays);
  const correlationLift = completionRateOnHabitDays - completionRateOnNonHabitDays;
  const timeStats = computeTimeEstimationStats(tasks);
  const { bestDay, worstDay } = computeBestWorstWeekdays(activeTasks);

  return {
    highPriorityRate: rateFor('high'),
    mediumPriorityRate: rateFor('medium'),
    lowPriorityRate: rateFor('low'),
    ...timeStats,
    completionRateOnHabitDays,
    completionRateOnNonHabitDays,
    correlationLift,
    bestDay,
    worstDay,
    insights: buildPredictiveInsights({
      correlationLift,
      estimationErrorPercent: timeStats.estimationErrorPercent,
      hasTimedTasks: timeStats.hasTimedTasks,
      bestDayRate: bestDay?.rate ?? 0,
      bestDayName: bestDay?.day ?? '',
    }),
  };
}

function PrioritySuccessBar({ label, rate, textClass, barClass }: { label: string; rate: number; textClass: string; barClass: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-semibold">
        <span className={cn('font-bold', textClass)}>{label}</span>
        <span className="font-bold">{rate}%</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', barClass)} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

function PlanningAccuracyCard({
  avgEstTime,
  avgActTime,
  estimationErrorPercent,
}: {
  avgEstTime: number;
  avgActTime: number;
  estimationErrorPercent: number;
}) {
  const isUnder = estimationErrorPercent > 0;
  const biasLabel = isUnder
    ? `Underestimated by ${estimationErrorPercent}%`
    : `Overestimated by ${Math.abs(estimationErrorPercent)}%`;
  const biasTone = isUnder
    ? 'border-rose-500/20 bg-rose-500/10 text-rose-500'
    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500';

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
        <Clock className="h-4 w-4 text-amber-500" />
        Planning Accuracy
      </h4>
      <div className="bg-muted/20 border border-border/40 p-4 rounded-xl flex flex-col justify-between h-[135px]">
        {avgEstTime > 0 ? (
          <>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Avg. Estimate</div>
                <div className="text-xl font-extrabold text-foreground">{avgEstTime} mins</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Avg. Actual</div>
                <div className="text-xl font-extrabold text-foreground">{avgActTime} mins</div>
              </div>
            </div>
            <div className="pt-2 border-t border-border/40 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Estimation Bias:</span>
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded border', biasTone)}>{biasLabel}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic text-center">
            Log estimated time when creating tasks and enter actual time on cards to view accuracy feedback.
          </div>
        )}
      </div>
    </div>
  );
}

function StreakTaskCorrelationCard({
  completionRateOnHabitDays,
  completionRateOnNonHabitDays,
  correlationLift,
}: {
  completionRateOnHabitDays: number;
  completionRateOnNonHabitDays: number;
  correlationLift: number;
}) {
  return (
    <div className="bg-muted/20 border border-border/40 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="space-y-1">
        <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          Streak &amp; Task Correlation
        </h4>
        <p className="text-xs text-muted-foreground">
          Compares task success rates on days when you completed your habit streaks vs days when you did not.
        </p>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="text-center">
          <div className="text-[9px] uppercase font-bold text-muted-foreground/60 tracking-wider">Habit Days</div>
          <div className="text-lg font-bold text-emerald-500">{completionRateOnHabitDays}%</div>
        </div>
        <div className="h-8 w-px bg-border/60" />
        <div className="text-center">
          <div className="text-[9px] uppercase font-bold text-muted-foreground/60 tracking-wider">Non-Habit Days</div>
          <div className="text-lg font-bold text-muted-foreground">{completionRateOnNonHabitDays}%</div>
        </div>
        {correlationLift > 0 && (
          <>
            <div className="h-8 w-px bg-border/60" />
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg px-2.5 py-1 text-center">
              <div className="text-[9px] uppercase font-bold tracking-wider">Lift Boost</div>
              <div className="text-lg font-black leading-none">+{correlationLift}%</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function PredictiveAnalytics() {
  const { habits, completions } = useHabitStore();
  const { tasks } = useTaskStore();

  const statistics = useMemo(
    () => computePredictiveStatistics(tasks, completions),
    [habits, completions, tasks]
  );

  return (
    <Card className="border border-border/60 bg-card rounded-2xl shadow-xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-80 h-80 bg-radial-gradient from-primary/5 to-transparent blur-3xl pointer-events-none" />

      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Predictive Analytics &amp; Correlations
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Machine-learning insights comparing habit streaks, task velocities, and time estimations.
        </p>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <Percent className="h-4 w-4 text-emerald-500" />
              Task Success by Priority
            </h4>
            <div className="space-y-3.5 bg-muted/20 border border-border/40 p-4 rounded-xl">
              <PrioritySuccessBar label="High Priority" rate={statistics.highPriorityRate} textClass="text-rose-500" barClass="bg-rose-500" />
              <PrioritySuccessBar label="Medium Priority" rate={statistics.mediumPriorityRate} textClass="text-amber-500" barClass="bg-amber-500" />
              <PrioritySuccessBar label="Low Priority" rate={statistics.lowPriorityRate} textClass="text-sky-500" barClass="bg-sky-500" />
            </div>
          </div>

          <PlanningAccuracyCard
            avgEstTime={statistics.avgEstTime}
            avgActTime={statistics.avgActTime}
            estimationErrorPercent={statistics.estimationErrorPercent}
          />
        </div>

        <StreakTaskCorrelationCard
          completionRateOnHabitDays={statistics.completionRateOnHabitDays}
          completionRateOnNonHabitDays={statistics.completionRateOnNonHabitDays}
          correlationLift={statistics.correlationLift}
        />

        <div className="space-y-3 pt-4 border-t border-border/40">
          <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            Predictive Coaching Insights
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {statistics.insights.map((insight, idx) => (
              <div key={idx} className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex gap-2.5 items-start">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-foreground leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
