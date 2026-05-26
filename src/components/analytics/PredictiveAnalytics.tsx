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

export function PredictiveAnalytics() {
  const { habits, completions } = useHabitStore();
  const { tasks } = useTaskStore();

  const statistics = useMemo(() => {
    // 1. Task Success Rates by Priority
    const completedTasks = tasks.filter(t => t.status === 'done');
    const activeTasks = tasks.filter(t => t.status !== 'archived');
    
    const getPriorityRate = (priority: 'high' | 'medium' | 'low') => {
      const priorityTasks = activeTasks.filter(t => t.priority === priority);
      if (priorityTasks.length === 0) return 0;
      const completed = priorityTasks.filter(t => t.status === 'done').length;
      return Math.round((completed / priorityTasks.length) * 100);
    };

    const highPriorityRate = getPriorityRate('high');
    const mediumPriorityRate = getPriorityRate('medium');
    const lowPriorityRate = getPriorityRate('low');

    // 2. Estimated Time vs Actual Time Correlation
    const tasksWithEstimation = tasks.filter(t => t.estimatedTime && t.estimatedTime > 0);
    const completedWithTime = tasksWithEstimation.filter(t => t.status === 'done' && t.actualTime && t.actualTime > 0);
    
    let estimationErrorPercent = 0;
    let avgEstTime = 0;
    let avgActTime = 0;

    if (completedWithTime.length > 0) {
      const totalEst = completedWithTime.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);
      const totalAct = completedWithTime.reduce((sum, t) => sum + (t.actualTime || 0), 0);
      avgEstTime = Math.round(totalEst / completedWithTime.length);
      avgActTime = Math.round(totalAct / completedWithTime.length);
      estimationErrorPercent = Math.round(((totalAct - totalEst) / totalEst) * 100);
    }

    // 3. Category Correlations (Habit Completion -> Task Completion)
    // Map dates of habit completions to tasks
    const habitCompletionDates = new Set(
      completions.filter(c => c.completed && c.status !== 'frozen').map(c => c.date)
    );

    // Filter tasks completed on days when habits were completed vs not completed
    const tasksOnHabitDays = activeTasks.filter(t => {
      if (!t.due_date) return false;
      const dateStr = t.due_date.split('T')[0];
      return habitCompletionDates.has(dateStr);
    });

    const tasksOnNonHabitDays = activeTasks.filter(t => {
      if (!t.due_date) return false;
      const dateStr = t.due_date.split('T')[0];
      return !habitCompletionDates.has(dateStr);
    });

    const getTaskCompletionRate = (list: typeof activeTasks) => {
      if (list.length === 0) return 0;
      const completed = list.filter(t => t.status === 'done').length;
      return Math.round((completed / list.length) * 100);
    };

    const completionRateOnHabitDays = getTaskCompletionRate(tasksOnHabitDays);
    const completionRateOnNonHabitDays = getTaskCompletionRate(tasksOnNonHabitDays);
    const correlationLift = completionRateOnHabitDays - completionRateOnNonHabitDays;

    // 4. Weekday Productivity Predictions
    const taskCompletionsByDay = Array(7).fill(0);
    const taskTotalByDay = Array(7).fill(0);

    activeTasks.forEach(t => {
      if (t.due_date) {
        const day = new Date(t.due_date).getDay();
        taskTotalByDay[day]++;
        if (t.status === 'done') {
          taskCompletionsByDay[day]++;
        }
      }
    });

    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const ratesByDay = taskTotalByDay.map((total, idx) => {
      return {
        day: weekdays[idx],
        rate: total > 0 ? Math.round((taskCompletionsByDay[idx] / total) * 100) : 0,
        count: total
      };
    });

    const sortedDays = [...ratesByDay].sort((a, b) => b.rate - a.rate);
    const bestDay = sortedDays[0];
    const worstDay = sortedDays[sortedDays.length - 1];

    // Generate smart insights
    const insights: string[] = [];

    if (correlationLift > 5) {
      insights.push(`Completing your habits gives a ${correlationLift}% boost to your daily task completion rates. Maintain your streaks to crush your tasks!`);
    } else {
      insights.push("Completing habits early creates a positive psychological momentum for daily productivity. Try starting your day with a health habit!");
    }

    if (estimationErrorPercent > 10) {
      insights.push(`You currently underestimate task durations by an average of ${estimationErrorPercent}%. Try allocating 1.5x more time to new tasks.`);
    } else if (estimationErrorPercent < -10) {
      insights.push(`You overestimate task durations by ${Math.abs(estimationErrorPercent)}%. Try challenging yourself to complete them faster!`);
    } else if (completedWithTime.length > 0) {
      insights.push("Your task time estimations are highly accurate. Excellent planning skills!");
    }

    if (bestDay && bestDay.rate > 0) {
      insights.push(`Your most productive day is ${bestDay.day} (${bestDay.rate}% rate). Schedule your most complex tasks for this day.`);
    }

    return {
      highPriorityRate,
      mediumPriorityRate,
      lowPriorityRate,
      avgEstTime,
      avgActTime,
      estimationErrorPercent,
      completionRateOnHabitDays,
      completionRateOnNonHabitDays,
      correlationLift,
      bestDay,
      worstDay,
      insights
    };
  }, [habits, completions, tasks]);

  return (
    <Card className="border border-border/60 bg-card rounded-2xl shadow-xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-80 h-80 bg-radial-gradient from-primary/5 to-transparent blur-3xl pointer-events-none" />

      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Predictive Analytics & Correlations
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Machine-learning insights comparing habit streaks, task velocities, and time estimations.
        </p>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Task Completion Rate by Priority */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <Percent className="h-4 w-4 text-emerald-500" />
              Task Success by Priority
            </h4>

            <div className="space-y-3.5 bg-muted/20 border border-border/40 p-4 rounded-xl">
              {/* High Priority */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-rose-500 font-bold">High Priority</span>
                  <span className="font-bold">{statistics.highPriorityRate}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${statistics.highPriorityRate}%` }} />
                </div>
              </div>

              {/* Medium Priority */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-amber-500 font-bold">Medium Priority</span>
                  <span className="font-bold">{statistics.mediumPriorityRate}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${statistics.mediumPriorityRate}%` }} />
                </div>
              </div>

              {/* Low Priority */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-sky-500 font-bold">Low Priority</span>
                  <span className="font-bold">{statistics.lowPriorityRate}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${statistics.lowPriorityRate}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Time Estimation Error */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-500" />
              Planning Accuracy
            </h4>

            <div className="bg-muted/20 border border-border/40 p-4 rounded-xl flex flex-col justify-between h-[135px]">
              {statistics.avgEstTime > 0 ? (
                <>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Avg. Estimate</div>
                      <div className="text-xl font-extrabold text-foreground">{statistics.avgEstTime} mins</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Avg. Actual</div>
                      <div className="text-xl font-extrabold text-foreground">{statistics.avgActTime} mins</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40 flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Estimation Bias:</span>
                    <span className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded border",
                      statistics.estimationErrorPercent > 0
                        ? "border-rose-500/20 bg-rose-500/10 text-rose-500"
                        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                    )}>
                      {statistics.estimationErrorPercent > 0 
                        ? `Underestimated by ${statistics.estimationErrorPercent}%`
                        : `Overestimated by ${Math.abs(statistics.estimationErrorPercent)}%`
                      }
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic text-center">
                  Log estimated time when creating tasks and enter actual time on cards to view accuracy feedback.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Habits vs Tasks Correlation Lift */}
        <div className="bg-muted/20 border border-border/40 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Streak & Task Correlation
            </h4>
            <p className="text-xs text-muted-foreground">
              Compares task success rates on days when you completed your habit streaks vs days when you did not.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center">
              <div className="text-[9px] uppercase font-bold text-muted-foreground/60 tracking-wider">Habit Days</div>
              <div className="text-lg font-bold text-emerald-500">{statistics.completionRateOnHabitDays}%</div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="text-center">
              <div className="text-[9px] uppercase font-bold text-muted-foreground/60 tracking-wider">Non-Habit Days</div>
              <div className="text-lg font-bold text-muted-foreground">{statistics.completionRateOnNonHabitDays}%</div>
            </div>
            {statistics.correlationLift > 0 && (
              <>
                <div className="h-8 w-px bg-border/60" />
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg px-2.5 py-1 text-center">
                  <div className="text-[9px] uppercase font-bold tracking-wider">Lift Boost</div>
                  <div className="text-lg font-black leading-none">+{statistics.correlationLift}%</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* AI Predictive Insights List */}
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
