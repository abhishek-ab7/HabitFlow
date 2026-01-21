'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import { ArrowRight, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FadeIn } from '@/components/motion';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/design-tokens';
import type { Habit, HabitCompletion, Category } from '@/lib/types';

interface HabitOverviewProps {
  habits: Habit[];
  completions: HabitCompletion[];
}

export function HabitOverview({ habits, completions }: HabitOverviewProps) {
  const today = new Date();
  
  // Generate last 10 days
  const last10Days = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const date = subDays(today, 9 - i);
      return {
        date,
        dateStr: format(date, 'yyyy-MM-dd'),
        dayLabel: format(date, 'EEE')[0], // First letter of day
        isToday: format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'),
      };
    });
  }, [today]);

  // Get completion status for a habit on a specific date
  const getCompletionStatus = (habitId: string, dateStr: string) => {
    return completions.find(c => c.habitId === habitId && c.date === dateStr)?.completed ?? false;
  };

  const getCategoryColor = (category: Category) => {
    return colors.categories[category]?.text || 'text-muted-foreground';
  };

  const getCategoryBg = (category: Category) => {
    return `bg-category-${category}/20`;
  };

  if (habits.length === 0) {
    return (
      <FadeIn delay={0.2}>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No habits yet. Start building your routine!</p>
            <Button asChild>
              <Link href="/habits">Create Your First Habit</Link>
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
    );
  }

  return (
    <FadeIn delay={0.2}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/habits" className="gap-1">
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {/* Header row with dates */}
          <div className="flex items-center mb-4 overflow-x-auto pb-2">
            <div className="w-32 md:w-40 flex-shrink-0" />
            <div className="flex gap-1">
              {last10Days.map(({ dateStr, dayLabel, isToday }) => (
                <div
                  key={dateStr}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center text-xs font-medium rounded-md",
                    isToday 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground"
                  )}
                >
                  {dayLabel}
                </div>
              ))}
            </div>
          </div>

          {/* Habit rows */}
          <div className="space-y-3">
            {habits.slice(0, 5).map((habit, index) => (
              <motion.div
                key={habit.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center overflow-x-auto pb-1"
              >
                {/* Habit info */}
                <div className="w-32 md:w-40 flex-shrink-0 flex items-center gap-2 pr-3">
                  {habit.icon && <span className="text-lg">{habit.icon}</span>}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{habit.name}</p>
                    <Badge 
                      variant="secondary" 
                      className={cn("text-xs px-1.5 py-0", getCategoryBg(habit.category))}
                    >
                      <span className={getCategoryColor(habit.category)}>
                        {habit.category}
                      </span>
                    </Badge>
                  </div>
                </div>

                {/* Day indicators */}
                <div className="flex gap-1">
                  {last10Days.map(({ dateStr, isToday }) => {
                    const isCompleted = getCompletionStatus(habit.id, dateStr);
                    const isFuture = new Date(dateStr) > today;

                    return (
                      <div
                        key={dateStr}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                          isCompleted 
                            ? "bg-success/20 text-success" 
                            : isFuture
                              ? "bg-muted/30 opacity-50"
                              : isToday
                                ? "bg-muted border-2 border-dashed border-muted-foreground/30"
                                : "bg-muted/50"
                        )}
                      >
                        {isCompleted && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          >
                            <Check className="h-4 w-4" />
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>

          {habits.length > 5 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              +{habits.length - 5} more habits
            </p>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
