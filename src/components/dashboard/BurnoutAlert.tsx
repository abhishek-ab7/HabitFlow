'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, TrendingDown } from 'lucide-react';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';

interface BurnoutCheck {
  burnoutRisk: 'low' | 'medium' | 'high';
  score: number;
  indicators: string[];
  recommendations: string[];
}

export function BurnoutAlert() {
  const [burnout, setBurnout] = useState<BurnoutCheck | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const { habits, completions } = useHabitStore();
  const { tasks } = useTaskStore();

  useEffect(() => {
    async function checkBurnout() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const now = new Date();
        
        // Calculate completion rates for last 7 days
        const last7Days = completions.filter(c => {
          const date = new Date(c.date);
          const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays <= 7 && diffDays >= 0;
        });

        // Calculate completion rates for last 30 days
        const last30Days = completions.filter(c => {
          const date = new Date(c.date);
          const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays <= 30 && diffDays >= 0;
        });

        // Calculate completion rates for previous 7 days (8-14 days ago)
        const previous7Days = completions.filter(c => {
          const date = new Date(c.date);
          const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays > 7 && diffDays <= 14;
        });

        // Calculate streaks and consecutive skips
        const activeHabits = habits.filter(h => !h.archived);
        const streakData = activeHabits.map(habit => {
          const habitCompletions = completions
            .filter(c => c.habitId === habit.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          let currentStreak = 0;
          let consecutiveSkips = 0;
          let foundFirstCompletion = false;

          // Calculate current streak
          for (let i = 0; i < 30; i++) {
            const checkDate = new Date(now);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = checkDate.toISOString().split('T')[0];
            
            const completed = habitCompletions.some(c => c.date === dateStr);
            
            if (completed) {
              currentStreak++;
              foundFirstCompletion = true;
            } else if (foundFirstCompletion) {
              consecutiveSkips = i - currentStreak;
              break;
            }
          }

          return {
            habitName: habit.name,
            currentStreak,
            consecutiveSkips
          };
        });

        const activeHabitsCount = activeHabits.length;
        const last7DaysRate = activeHabitsCount > 0 
          ? (last7Days.length / (activeHabitsCount * 7)) * 100 
          : 0;
        const last30DaysRate = activeHabitsCount > 0 
          ? (last30Days.length / (activeHabitsCount * 30)) * 100 
          : 0;
        const previous7DaysRate = activeHabitsCount > 0 
          ? (previous7Days.length / (activeHabitsCount * 7)) * 100 
          : 0;

        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const baselineTasksPerWeek = 10; // Baseline assumption

        const response = await fetch('/api/ai/burnout-check', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': user.id
          },
          body: JSON.stringify({
            completionRates: {
              last7Days: last7DaysRate,
              last30Days: last30DaysRate,
              previous7Days: previous7DaysRate
            },
            streakData,
            taskVelocity: {
              current: completedTasks,
              baseline: baselineTasksPerWeek
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.burnoutRisk !== 'low') {
            setBurnout(data);
          }
        }
      } catch (error) {
        console.error('Failed to check burnout:', error);
      } finally {
        setLoading(false);
      }
    }

    checkBurnout();
  }, [habits.length, completions.length, tasks.length, user]);

  if (loading || !burnout || dismissed || burnout.burnoutRisk === 'low') {
    return null;
  }

  const isHighRisk = burnout.burnoutRisk === 'high';

  return (
    <Card className={cn(
      'mb-6 border-2',
      isHighRisk 
        ? 'bg-red-50 dark:bg-red-950/20 border-red-500' 
        : 'bg-amber-50 dark:bg-amber-950/20 border-amber-500'
    )}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            'rounded-full p-2',
            isHighRisk 
              ? 'bg-red-100 dark:bg-red-900/50' 
              : 'bg-amber-100 dark:bg-amber-900/50'
          )}>
            <AlertTriangle className={cn(
              'h-5 w-5',
              isHighRisk ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
            )} />
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className={cn(
                  'font-bold text-lg',
                  isHighRisk ? 'text-red-900 dark:text-red-100' : 'text-amber-900 dark:text-amber-100'
                )}>
                  {isHighRisk ? '🔥 High Burnout Risk Detected' : '⚠️ Burnout Warning'}
                </h3>
                <p className={cn(
                  'text-sm mt-1',
                  isHighRisk ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'
                )}>
                  Burnout Score: {burnout.score}/100
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 -mt-1"
                onClick={() => setDismissed(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4" />
                  <p className="font-semibold text-sm">Warning Signs</p>
                </div>
                <ul className="text-sm space-y-1">
                  {burnout.indicators.slice(0, 3).map((indicator, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>{indicator}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="font-semibold text-sm">Recommendations</p>
                </div>
                <ul className="text-sm space-y-1">
                  {burnout.recommendations.slice(0, 3).map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                size="sm" 
                variant={isHighRisk ? 'destructive' : 'default'}
                className="text-xs"
              >
                Enter Recovery Mode
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="text-xs"
                onClick={() => setDismissed(true)}
              >
                I'll Be Careful
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
