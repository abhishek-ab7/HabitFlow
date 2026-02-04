'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link2, Sparkles, Loader2, Zap, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useHabitStore } from '@/lib/stores/habit-store';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import type { HabitStack } from '@/lib/ai/types';

export function HabitStackSuggestions() {
  const [stacks, setStacks] = useState<HabitStack[]>([]);
  const [loading, setLoading] = useState(false);
  const [activatingStack, setActivatingStack] = useState<number | null>(null);
  const { habits, completions } = useHabitStore();
  const { user } = useAuth();
  const supabase = createClient();

  const activeHabits = habits.filter(h => !h.archived);

  const fetchStacks = async () => {
    if (activeHabits.length < 2) return;

    setLoading(true);
    try {
      // Calculate completion rates for last 30 days
      const now = new Date();
      const habitData = activeHabits.map(h => {
        const habitCompletions = completions.filter(c => {
          const completionDate = new Date(c.date);
          const daysDiff = (now.getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24);
          return c.habitId === h.id && daysDiff <= 30;
        });

        const completionRate = (habitCompletions.length / 30) * 100;

        // Calculate current streak
        let currentStreak = 0;
        for (let i = 0; i < 30; i++) {
          const checkDate = new Date(now);
          checkDate.setDate(checkDate.getDate() - i);
          const dateStr = checkDate.toISOString().split('T')[0];
          const completed = habitCompletions.some(c => c.date === dateStr);
          if (completed) {
            currentStreak++;
          } else {
            break;
          }
        }

        return {
          id: h.id,
          name: h.name,
          category: h.category,
          completionRate,
          currentStreak
        };
      });

      const response = await fetch('/api/ai/suggest-habit-stacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingHabits: habitData,
          userContext: {
            availableTimeSlots: ['morning', 'evening'],
            topPerformingHabits: habitData.filter(h => h.completionRate > 70).map(h => h.name)
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch stacks');
      }

      const data = await response.json();
      setStacks(data.stacks || []);
      toast.success(`Found ${data.stacks.length} habit stack${data.stacks.length !== 1 ? 's' : ''}!`);
    } catch (error: any) {
      console.error('Habit stack error:', error);
      toast.error(error.message || 'Failed to generate habit stacks');
    } finally {
      setLoading(false);
    }
  };



  const handleActivateStack = async (stack: HabitStack, stackIndex: number) => {
    if (!user) {
      toast.error('You must be logged in to activate stacks');
      return;
    }

    setActivatingStack(stackIndex);
    try {
      // Save the stack to database
      const { data: savedStack, error: stackError } = await (supabase
        .from('habit_stacks') as any)
        .insert({
          user_id: user.id,
          name: stack.name,
          description: stack.description,
          trigger_habit_id: stack.triggerHabitId,
          stacked_habit_ids: stack.stackedHabitIds, // Array of habit IDs in the stack
          suggested_order: stack.suggestedOrder,
          ai_reasoning: stack.reasoning, // Fixed: database uses ai_reasoning, not reasoning
          difficulty: stack.difficulty,
          estimated_time_minutes: stack.estimatedTimeMinutes,
          expected_success_rate: stack.expectedSuccessRate,
          is_active: true
        })
        .select()
        .single();

      if (stackError) {
        console.error('Supabase error:', stackError);
        throw new Error(stackError.message || 'Failed to save stack');
      }

      // TODO: Optionally reorder habits based on suggestedOrder
      // This would require updating habit.order_index for the habits in the stack

      toast.success(`🎉 "${stack.name}" activated! Try following the suggested order.`);
    } catch (error: any) {
      console.error('Failed to activate stack:', error);
      toast.error(error.message || 'Failed to activate stack. Please try again.');
    } finally {
      setActivatingStack(null);
    }
  };

  if (activeHabits.length < 2) {
    return (
      <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
        <CardContent className="pt-6 text-center py-8">
          <Link2 className="h-12 w-12 mx-auto mb-3 text-amber-400 opacity-50" />
          <p className="text-sm text-muted-foreground">
            Create at least 2 habits to get stacking suggestions!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Link2 className="h-5 w-5" />
            Smart Habit Stacking
          </CardTitle>
          {stacks.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStacks}
              disabled={loading}
              className="h-7 gap-1"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && stacks.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            <span className="ml-2 text-sm text-muted-foreground">Analyzing your habits...</span>
          </div>
        ) : stacks.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground mb-3">
              Get AI-powered habit stacking suggestions
            </p>
            <Button onClick={fetchStacks} variant="default" className="gap-2 bg-amber-600 hover:bg-amber-700">
              <Sparkles className="h-4 w-4" />
              Generate Stack Suggestions
            </Button>
          </div>
        ) : (
          stacks.map((stack, index) => (
            <div key={index} className="border rounded-lg p-4 bg-white/50 dark:bg-gray-900/50 space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">{stack.name}</h4>
                  <p className="text-xs text-muted-foreground">{stack.description}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {stack.difficulty}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <Zap className="h-3 w-3" />
                  Suggested Order:
                </div>
                {stack.suggestedOrder?.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm pl-5">
                    <span className="text-amber-600 dark:text-amber-500 font-bold shrink-0">{i + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                <span>⏱️ {stack.estimatedTimeMinutes} min</span>
                <span>📈 {stack.expectedSuccessRate}% success rate</span>
              </div>

              <p className="text-xs italic text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                💡 {stack.reasoning}
              </p>

              <Button
                size="sm"
                className="w-full bg-amber-600 hover:bg-amber-700"
                onClick={() => handleActivateStack(stack, index)}
                disabled={activatingStack === index}
              >
                {activatingStack === index ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    <Link2 className="h-3 w-3 mr-1" />
                    Activate Stack
                  </>
                )}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
