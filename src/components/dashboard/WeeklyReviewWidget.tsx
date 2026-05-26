'use client';

import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Calendar, CheckCircle2, Award, Smile, Flame, ChevronRight, X, Sparkles, TrendingUp, AlertCircle, Coffee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useMoodStore } from '@/lib/stores/mood-store';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';

export function WeeklyReviewWidget() {
  const [showFullReview, setShowFullReview] = useState(false);
  const today = new Date();
  const isSunday = today.getDay() === 0;

  const { habits, completions } = useHabitStore(
    useShallow((s) => ({
      habits: s.habits,
      completions: s.completions,
    }))
  );

  const tasks = useTaskStore((s) => s.tasks);
  const getMoodForDate = useMoodStore((s) => s.getMoodForDate);
  const completedSessions = usePomodoroStore((s) => s.completedSessions);

  // Compute 7-day range
  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return {
        dateStr: format(date, 'yyyy-MM-dd'),
        dayName: format(date, 'EEE'),
        dayOfWeek: date.getDay(),
      };
    });
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    const activeHabits = habits.filter((h) => !h.archived);
    if (activeHabits.length === 0 && tasks.length === 0) {
      return null;
    }

    const rangeDateStrings = last7Days.map((d) => d.dateStr);

    // 1. Habit calculations
    const habitStats = activeHabits.map((h) => {
      const habitComps = completions.filter(
        (c) => c.habitId === h.id && rangeDateStrings.includes(c.date)
      );
      const completedCount = habitComps.filter((c) => c.completed && c.status !== 'frozen').length;
      const rate = habitComps.length > 0 ? Math.round((completedCount / habitComps.length) * 100) : 0;
      return { habit: h, rate, completedCount };
    });

    const sortedHabits = [...habitStats].sort((a, b) => b.rate - a.rate);
    const bestHabit = sortedHabits[0];
    const worstHabit = sortedHabits[sortedHabits.length - 1];

    // 2. Most productive day
    const dayPerformances = last7Days.map((day) => {
      const dayComps = completions.filter(
        (c) => c.date === day.dateStr && c.completed && c.status !== 'frozen'
      ).length;
      
      const dayTasks = tasks.filter((t) => {
        if (t.status !== 'done' || !t.updated_at) return false;
        return t.updated_at.startsWith(day.dateStr);
      }).length;

      return {
        dayName: day.dayName,
        total: dayComps + dayTasks,
      };
    });

    const sortedDays = [...dayPerformances].sort((a, b) => b.total - a.total);
    const bestDay = sortedDays[0];

    // 3. Overall completion rate this week
    const totalComps = completions.filter(
      (c) => rangeDateStrings.includes(c.date) && c.completed && c.status !== 'frozen'
    ).length;
    const totalPossible = activeHabits.length * 7;
    const weeklyCompletionRate = totalPossible > 0 ? Math.round((totalComps / totalPossible) * 100) : 0;

    return {
      bestHabit: bestHabit && bestHabit.rate > 0 ? bestHabit : null,
      worstHabit: worstHabit && worstHabit.rate < 100 ? worstHabit : null,
      bestDay: bestDay && bestDay.total > 0 ? bestDay : null,
      weeklyCompletionRate,
      focusHours: Math.round((completedSessions * 25) / 6) / 10, // focus hours rounded to 1 decimal place
    };
  }, [habits, completions, tasks, last7Days, completedSessions]);

  const handleOpenReview = async () => {
    setShowFullReview(true);
    try {
      const confetti = (await import('canvas-confetti')).default;
      confetti({
        particleCount: 50,
        spread: 40,
        origin: { y: 0.7 }
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-50/40 via-white/50 to-purple-50/40 dark:from-indigo-950/20 dark:via-slate-900/30 dark:to-purple-950/20 backdrop-blur-md shadow-lg overflow-hidden h-full flex flex-col justify-between">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            Weekly Summary
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between space-y-4">
          {/* Weekday Visual Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
              <span>Weekly Consistency</span>
              <span>{stats?.weeklyCompletionRate || 0}%</span>
            </div>
            <div className="flex gap-1.5 justify-between">
              {last7Days.map((day) => {
                const dayComps = completions.filter(
                  (c) => c.date === day.dateStr && c.completed && c.status !== 'frozen'
                ).length;
                const activeHabitsCount = habits.filter((h) => !h.archived).length;
                const isDayComplete = activeHabitsCount > 0 && dayComps >= activeHabitsCount;

                return (
                  <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className={cn(
                        "w-full h-8 rounded-md border flex items-center justify-center text-[10px] font-bold transition-all",
                        isDayComplete 
                          ? "bg-success/20 text-success border-success/30" 
                          : dayComps > 0 
                          ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                          : "bg-muted/40 border-transparent text-muted-foreground/30"
                      )}
                    >
                      {dayComps}
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground/60">{day.dayName}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dynamic Sunday Review Prompt */}
          {isSunday ? (
            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/40 dark:border-indigo-800/20 rounded-2xl p-3 text-center space-y-2.5 animate-pulse">
              <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                Sunday Reflection Ready
              </div>
              <p className="text-xs text-muted-foreground max-w-[220px] mx-auto leading-relaxed">
                Take a moment to review your productivity, mood trends, and top achievements this week.
              </p>
              <Button
                size="sm"
                onClick={handleOpenReview}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 rounded-xl shadow-md"
              >
                Launch Weekly Review
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          ) : (
            <div className="text-center p-3 rounded-2xl bg-muted/10 border border-border/40 text-xs text-muted-foreground italic leading-relaxed">
              Your comprehensive Weekly Review unlocks every Sunday morning! Stay consistent.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Screen Review Overlay */}
      <AnimatePresence>
        {showFullReview && stats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/90 dark:bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="absolute top-4 right-4 z-55">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFullReview(false)}
                className="rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.4 }}
              className="max-w-2xl w-full bg-card border border-border/80 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="space-y-6">
                {/* Header */}
                <div className="text-center md:text-left space-y-1">
                  <div className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-semibold border border-indigo-200/50 dark:border-indigo-800/30">
                    <Award className="w-3.5 h-3.5 text-indigo-500" />
                    Weekly Performance Review
                  </div>
                  <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
                    Your Week in Review 📊
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Here is a visual breakdown of your habits, focus parameters, and consistency metrics.
                  </p>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Best Habit */}
                  <div className="p-4 rounded-2xl border bg-success/5 border-success/20 flex gap-3 items-start">
                    <div className="w-9 h-9 rounded-xl bg-success/15 flex items-center justify-center text-success shrink-0">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-success tracking-wider block">Best Habit</span>
                      <span className="font-bold text-sm text-foreground truncate block">
                        {stats.bestHabit ? `${stats.bestHabit.habit.icon || '🎯'} ${stats.bestHabit.habit.name}` : 'No Completions'}
                      </span>
                      {stats.bestHabit && (
                        <span className="text-xs text-muted-foreground font-semibold">{stats.bestHabit.rate}% consistency</span>
                      )}
                    </div>
                  </div>

                  {/* Worst Habit */}
                  <div className="p-4 rounded-2xl border bg-amber-500/5 border-amber-500/20 flex gap-3 items-start">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500 shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider block">Needs Focus</span>
                      <span className="font-bold text-sm text-foreground truncate block">
                        {stats.worstHabit ? `${stats.worstHabit.habit.icon || '🎯'} ${stats.worstHabit.habit.name}` : 'All habits clean'}
                      </span>
                      {stats.worstHabit && (
                        <span className="text-xs text-muted-foreground font-semibold">{stats.worstHabit.rate}% consistency</span>
                      )}
                    </div>
                  </div>

                  {/* Best Day */}
                  <div className="p-4 rounded-2xl border bg-indigo-500/5 border-indigo-500/20 flex gap-3 items-start">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-500 shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider block">Most Productive Day</span>
                      <span className="font-bold text-sm text-foreground block">
                        {stats.bestDay ? `${stats.bestDay.dayName}s` : 'N/A'}
                      </span>
                      {stats.bestDay && (
                        <span className="text-xs text-muted-foreground font-semibold">{stats.bestDay.total} items completed</span>
                      )}
                    </div>
                  </div>

                  {/* Focus Hours */}
                  <div className="p-4 rounded-2xl border bg-rose-500/5 border-rose-500/20 flex gap-3 items-start">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-500 shrink-0">
                      <Coffee className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-rose-500 tracking-wider block">Hours Focused</span>
                      <span className="font-bold text-sm text-foreground block">
                        {stats.focusHours} hours
                      </span>
                      <span className="text-xs text-muted-foreground font-semibold">{completedSessions} sessions logged</span>
                    </div>
                  </div>
                </div>

                {/* Mood History Chart */}
                <div className="border border-border/80 rounded-2xl p-4 space-y-3">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Smile className="w-4 h-4 text-emerald-500" />
                    Mood History (Past 7 Days)
                  </div>
                  <div className="flex justify-between items-center bg-muted/20 border p-3 rounded-2xl">
                    {last7Days.map((day) => {
                      const mood = getMoodForDate(day.dateStr);
                      const moodEmojiMap = {
                        happy: '😊',
                        calm: '😌',
                        neutral: '😐',
                        sad: '😢',
                        stressed: '🤯',
                      };
                      const emoji = mood ? moodEmojiMap[mood] : '⚪';
                      return (
                        <div key={day.dateStr} className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground">{day.dayName}</span>
                          <span className="text-xl" title={mood || 'No Log'}>{emoji}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action button */}
                <div className="flex justify-end pt-2 border-t">
                  <Button
                    onClick={() => setShowFullReview(false)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-2xl shadow-md"
                  >
                    Done Reviewing
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
