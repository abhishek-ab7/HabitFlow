'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Check, Target, Compass, Play, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/providers/auth-provider';
import { useUserStore } from '@/lib/stores/user-store';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { toast } from 'sonner';

interface FocusModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FocusModeOverlay({ isOpen, onClose }: FocusModeOverlayProps) {
  const { user } = useAuth();
  const displayName = useUserStore((s) => s.displayName);
  const addXp = useGamificationStore((s) => s.addXp);

  const { habits, completions } = useHabitStore(
    useShallow((s) => ({
      habits: s.habits,
      completions: s.completions,
    }))
  );

  const tasks = useTaskStore((s) => s.tasks);

  // Compute greeting name
  const greetingName = useMemo(() => {
    if (displayName && displayName.trim()) {
      return displayName.trim().split(/\s+/)[0];
    }
    if (user?.email) {
      const prefix = user.email.split('@')[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return 'Habit Hero';
  }, [displayName, user]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [xpClaimedToday, setXpClaimedToday] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userId = user?.id || 'guest';
      const claimed = localStorage.getItem(`focus_mode_xp_claimed_${userId}_${todayStr}`) === 'true';
      setXpClaimedToday(claimed);
    }
  }, [user, todayStr]);

  // Compute today's focus items (habits and tasks)
  const focusItems = useMemo(() => {
    const todayCompletedHabitIds = new Set(
      completions.filter((c) => c.date === todayStr && c.completed).map((c) => c.habitId)
    );

    const activeHabits = habits.filter((h) => !h.archived);
    
    const habitItems = activeHabits.map((h) => ({
      id: h.id,
      title: h.name,
      type: 'habit' as const,
      completed: todayCompletedHabitIds.has(h.id),
      icon: h.icon || '🎯',
    }));

    const pendingTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'archived');
    const todayTasks = pendingTasks.filter((t) => {
      if (!t.due_date) return false;
      return t.due_date.split('T')[0] <= todayStr;
    });

    const taskItems = todayTasks.map((t) => ({
      id: t.id,
      title: t.title,
      type: 'task' as const,
      completed: false,
      icon: '📝',
    }));

    return [...habitItems, ...taskItems];
  }, [habits, completions, tasks, todayStr]);

  const { completedCount, totalCount, percentage } = useMemo(() => {
    const total = focusItems.length;
    const completed = focusItems.filter((i) => i.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completedCount: completed, totalCount: total, percentage: pct };
  }, [focusItems]);

  const handleSkip = () => {
    const userId = user?.id || 'guest';
    localStorage.setItem(`focus_mode_started_${userId}_${todayStr}`, 'true');
    onClose();
  };

  const handleStartDay = async () => {
    const userId = user?.id || 'guest';
    if (xpClaimedToday) {
      toast.error('You have already started the day and claimed your XP today!');
      return;
    }

    // Save completion flags for today
    localStorage.setItem(`focus_mode_started_${userId}_${todayStr}`, 'true');
    localStorage.setItem(`focus_mode_xp_claimed_${userId}_${todayStr}`, 'true');
    setXpClaimedToday(true);
    
    try {
      // Award 10 XP
      await addXp(10);
      toast.success('Day started! +10 XP awarded 🚀', {
        icon: <Award className="w-5 h-5 text-amber-500 fill-amber-500/20" />
      });
      
      // Dynamic import of canvas confetti
      const confetti = (await import('canvas-confetti')).default;
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });
    } catch (e) {
      console.error(e);
    }
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
            onClick={handleSkip}
            className="rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
            title="Skip focus screen"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="max-w-2xl w-full bg-card/40 dark:bg-slate-900/30 border border-border/80 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden backdrop-blur-2xl"
        >
          {/* Subtle glowing elements */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-8 relative z-10 text-center md:text-left">
            {/* Header Greeting */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-semibold border border-indigo-200/50 dark:border-indigo-800/30">
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                Focus Mode active
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                Good Morning, <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">{greetingName}</span> 🌅
              </h1>
              <p className="text-muted-foreground text-sm max-w-md">
                Here is your roadmap for today. Let's make continuous progress and start the day strong.
              </p>
            </div>

            {/* Today's Focus List */}
            <div className="space-y-4 text-left">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-500" />
                  Today's Focus ({focusItems.length})
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {completedCount}/{totalCount} Completed
                </span>
              </div>

              {focusItems.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm italic border border-dashed border-border/60 rounded-2xl bg-muted/5">
                  No focus tasks or habits configured for today yet.
                </div>
              ) : (
                <div className="grid gap-3 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin">
                  {focusItems.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/50 shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0 select-none">{item.icon}</span>
                        <span className="text-sm font-semibold text-foreground truncate">
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground border">
                          {item.type}
                        </span>
                        {item.completed ? (
                          <div className="w-5 h-5 rounded-full bg-success/20 text-success flex items-center justify-center border border-success/30">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-muted-foreground/30 flex items-center justify-center bg-card" />
                        )}
                      </div>
                    </div>
                  ))}
                  {focusItems.length > 5 && (
                    <div className="text-xs font-semibold text-muted-foreground text-center pt-1.5">
                      + {focusItems.length - 5} more focus items today
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Progress metrics */}
            {totalCount > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-muted-foreground">Focus Progress</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{percentage}%</span>
                </div>
                <Progress
                  value={percentage}
                  className="h-3 bg-secondary"
                  indicatorClassName="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                />
              </div>
            )}

            {/* Action panel */}
            <div className="flex flex-col sm:flex-row gap-3 items-center pt-4 justify-between border-t border-border/40">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-amber-500" />
                "Start Day" grants you 10 XP towards levels.
              </div>
              <div className="flex gap-3 w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  className="w-full sm:w-auto h-11 px-6 rounded-2xl border-border/80"
                >
                  Skip
                </Button>
                <Button
                  onClick={handleStartDay}
                  disabled={xpClaimedToday}
                  className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold h-11 px-8 rounded-2xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  {xpClaimedToday ? 'Day Started' : 'Start Day'}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
