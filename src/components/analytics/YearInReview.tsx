'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flame, 
  Target, 
  Sparkles, 
  Award, 
  Trophy, 
  Zap, 
  Volume2, 
  VolumeX, 
  ChevronRight, 
  ChevronLeft, 
  Share2, 
  RotateCcw,
  CheckCircle,
  TrendingUp,
  Brain
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function YearInReview() {
  const { habits, completions } = useHabitStore();
  const { goals } = useGoalStore();
  const { tasks } = useTaskStore();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  const slideDuration = 8000; // 8 seconds per slide

  // 1. Calculate 2026 data
  const stats2026 = useMemo(() => {
    const completions2026 = completions.filter(c => c.date.startsWith('2026'));
    const totalCompletions = completions2026.filter(c => c.completed).length;

    // Calculate completion rate in 2026
    const completionsByDate: Record<string, number> = {};
    completions2026.forEach(c => {
      if (c.completed) {
        completionsByDate[c.date] = (completionsByDate[c.date] || 0) + 1;
      }
    });

    const activeHabits = habits.filter(h => !h.archived);
    
    // Streak calculations for 2026
    // Sort completion dates
    const completionDates = Object.keys(completionsByDate).sort();
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    let lastDate: Date | null = null;

    completionDates.forEach(dateStr => {
      const currentDate = new Date(dateStr);
      if (lastDate === null) {
        tempStreak = 1;
      } else {
        const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) {
          tempStreak++;
        } else {
          if (tempStreak > bestStreak) {
            bestStreak = tempStreak;
          }
          tempStreak = 1;
        }
      }
      lastDate = currentDate;
    });

    if (tempStreak > bestStreak) {
      bestStreak = tempStreak;
    }

    // Top Category in 2026
    const categoryCounts: Record<string, number> = {};
    const habitsMap = new Map(habits.map(h => [h.id, h]));
    completions2026.forEach(c => {
      if (c.completed) {
        const habit = habitsMap.get(c.habitId);
        if (habit) {
          categoryCounts[habit.category] = (categoryCounts[habit.category] || 0) + 1;
        }
      }
    });

    let topCategory = 'None';
    let topCategoryCount = 0;
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      if (count > topCategoryCount) {
        topCategory = cat;
        topCategoryCount = count;
      }
    });

    // Total Tasks Completed in 2026
    const completedTasks2026 = tasks.filter(t => t.status === 'done' && t.due_date?.startsWith('2026')).length;

    // Total XP in 2026 (Completions = 10 XP, Tasks = 20 XP, Goals = 100 XP)
    const completedGoals2026 = goals.filter(g => g.status === 'completed' && g.deadline?.startsWith('2026')).length;
    const estimatedXP = totalCompletions * 10 + completedTasks2026 * 20 + completedGoals2026 * 100;

    return {
      totalCompletions,
      bestStreak,
      topCategory: topCategory.charAt(0).toUpperCase() + topCategory.slice(1),
      topCategoryCount,
      completedTasks: completedTasks2026,
      completedGoals: completedGoals2026,
      estimatedXP
    };
  }, [habits, completions, goals, tasks]);

  // Slides configuration
  const slides = [
    {
      id: 'welcome',
      title: 'Your 2026 Journey',
      subtitle: 'HabitFlow Wrapped',
      gradient: 'from-emerald-950 via-slate-900 to-zinc-900',
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-6 px-4">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
            className="w-32 h-32 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.3)]"
          >
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
              <Sparkles className="h-16 w-16 text-emerald-400 animate-pulse" />
            </div>
          </motion.div>
          <div className="space-y-2">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl font-black tracking-tight text-white"
            >
              Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">2026</span> in Review
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-muted-foreground text-sm max-w-sm"
            >
              Let's look back at the consistency, milestones, and discipline that defined your year.
            </motion.p>
          </div>
        </div>
      )
    },
    {
      id: 'streaks',
      title: 'Unstoppable Flame',
      subtitle: 'Your Streaks',
      gradient: 'from-amber-950 via-slate-900 to-zinc-900',
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-6 px-4">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [1, 1.15, 1], opacity: 1 }}
            transition={{ 
              scale: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
              opacity: { duration: 0.5 }
            }}
            className="w-28 h-28 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 p-0.5 flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.3)]"
          >
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
              <Flame className="h-14 w-14 text-amber-500" />
            </div>
          </motion.div>
          <div className="space-y-2">
            <h3 className="text-muted-foreground text-xs uppercase font-bold tracking-widest">Max Consistency</h3>
            <h2 className="text-5xl font-black text-white font-mono">
              {stats2026.bestStreak} <span className="text-2xl text-amber-500">Days</span>
            </h2>
            <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
              Your longest uninterrupted habit streak of 2026. That is pure commitment to your daily goals!
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'categories',
      title: 'Focused Energy',
      subtitle: 'Top Category',
      gradient: 'from-sky-950 via-slate-900 to-zinc-900',
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-6 px-4">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 12 }}
            className="w-28 h-28 rounded-full bg-gradient-to-tr from-sky-500 to-cyan-400 p-0.5 flex items-center justify-center shadow-[0_0_50px_rgba(14,165,233,0.3)]"
          >
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
              <Target className="h-14 w-14 text-sky-400" />
            </div>
          </motion.div>
          <div className="space-y-2">
            <h3 className="text-muted-foreground text-xs uppercase font-bold tracking-widest">Top Category</h3>
            <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
              {stats2026.topCategory || 'N/A'}
            </h2>
            <div className="text-sm text-muted-foreground">
              with <span className="font-bold text-white">{stats2026.topCategoryCount}</span> completions
            </div>
            <p className="text-xs text-muted-foreground max-w-xs mt-2">
              This was your primary focus area in 2026. Balancing multiple areas builds ultimate resilience.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'xp',
      title: 'Power Leveling',
      subtitle: 'XP & RPG stats',
      gradient: 'from-rose-950 via-slate-900 to-zinc-900',
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-6 px-4">
          <motion.div
            initial={{ scale: 0.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="w-28 h-28 rounded-full bg-gradient-to-tr from-rose-500 to-red-400 p-0.5 flex items-center justify-center shadow-[0_0_50px_rgba(244,63,94,0.3)]"
          >
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
              <Zap className="h-14 w-14 text-rose-500" />
            </div>
          </motion.div>
          <div className="space-y-2">
            <h3 className="text-muted-foreground text-xs uppercase font-bold tracking-widest">Estimated Experience Points</h3>
            <h2 className="text-5xl font-black text-white font-mono">
              +{stats2026.estimatedXP.toLocaleString()} <span className="text-2xl text-rose-500">XP</span>
            </h2>
            <div className="flex justify-center gap-6 mt-3 text-xs text-muted-foreground bg-slate-950/60 py-2 px-4 rounded-xl border border-white/5">
              <div>
                <span className="block font-bold text-white">{stats2026.totalCompletions}</span>
                Habits
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <span className="block font-bold text-white">{stats2026.completedTasks}</span>
                Tasks
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <span className="block font-bold text-white">{stats2026.completedGoals}</span>
                Goals
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'summary',
      title: 'Year Overview',
      subtitle: 'The 2026 Scorecard',
      gradient: 'from-emerald-950 via-slate-900 to-zinc-900',
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-5 px-6">
          <Trophy className="h-12 w-12 text-yellow-500 animate-bounce" />
          <h2 className="text-2xl font-bold text-white">Your 2026 Habit Scorecard</h2>
          
          <div className="w-full space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-left text-xs text-muted-foreground">
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span>Total Habit Completions:</span>
              <span className="font-bold text-white text-sm">{stats2026.totalCompletions}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span>Best Continuous Streak:</span>
              <span className="font-bold text-amber-500 text-sm">{stats2026.bestStreak} Days</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span>Top Focus Skill:</span>
              <span className="font-bold text-sky-400 text-sm">{stats2026.topCategory}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span>RPG Character Rank Gained:</span>
              <span className="font-bold text-rose-500 text-sm">+{Math.round(stats2026.estimatedXP / 200)} Levels</span>
            </div>
          </div>

          <div className="flex gap-2 w-full mt-2 pointer-events-auto">
            <button
              onClick={() => {
                setCurrentSlide(0);
                setProgress(0);
                setIsPlaying(true);
              }}
              className="flex-1 py-2 px-3 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-white font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Replay
            </button>
            <button
              onClick={async () => {
                const text = `I completed ${stats2026.totalCompletions} habits in 2026 with a ${stats2026.bestStreak} day streak in HabitFlow! 🚀 #HabitFlowWrapped`;
                let copied = false;
                
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  try {
                    await navigator.clipboard.writeText(text);
                    copied = true;
                  } catch (e) {
                    console.error('Clipboard API failed, trying fallback:', e);
                  }
                }
                
                if (!copied) {
                  try {
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.opacity = '0';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    copied = document.execCommand('copy');
                    document.body.removeChild(textArea);
                  } catch (err) {
                    console.error('Fallback copy failed:', err);
                  }
                }

                if (copied) {
                  toast.success('Wrapped stats copied to clipboard!');
                } else {
                  toast.error('Failed to copy stats to clipboard.');
                }
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-xs text-white font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" /> Share Stats
            </button>
          </div>
        </div>
      )
    }
  ];

  // Auto-advance logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      const step = 100 / (slideDuration / 100);
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            setCurrentSlide(curr => {
              if (curr === slides.length - 1) {
                setIsPlaying(false);
                return curr;
              }
              return curr + 1;
            });
            return 0;
          }
          return prev + step;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentSlide]);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
      setProgress(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      setProgress(100);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
      setProgress(0);
      setIsPlaying(true);
    }
  };

  return (
    <Card className="border border-border/60 bg-card rounded-2xl shadow-xl overflow-hidden max-w-md mx-auto relative h-[520px]">
      {/* Slide Background Gradient */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-b transition-all duration-1000 ease-in-out opacity-90",
        slides[currentSlide].gradient
      )} />

      {/* Grid Overlay for Premium Feel */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Progress Bars (Instagram style) */}
      <div className="absolute top-4 left-4 right-4 flex gap-1.5 z-30">
        {slides.map((_, idx) => (
          <div key={idx} className="h-1 bg-white/20 flex-1 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-100 ease-linear rounded-full"
              style={{
                width: 
                  idx < currentSlide 
                    ? '100%' 
                    : idx === currentSlide 
                      ? `${progress}%` 
                      : '0%'
              }}
            />
          </div>
        ))}
      </div>

      {/* Slide Navigation Overlay (Left / Right halves) */}
      <div className="absolute inset-x-0 top-12 bottom-12 z-10 flex">
        <div 
          onClick={handlePrev}
          className="w-1/3 h-full cursor-w-resize"
          title="Previous slide"
        />
        <div 
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-1/3 h-full cursor-pointer"
          title={isPlaying ? "Pause" : "Resume"}
        />
        <div 
          onClick={handleNext}
          className="w-1/3 h-full cursor-e-resize"
          title="Next slide"
        />
      </div>

      {/* Header Info */}
      <div className="absolute top-8 left-6 right-6 z-20 flex justify-between items-center">
        <div>
          <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider font-mono">
            {slides[currentSlide].subtitle}
          </span>
          <h4 className="text-sm font-bold text-white/90">
            {slides[currentSlide].title}
          </h4>
        </div>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white transition-colors hover:bg-white/10"
        >
          {isPlaying ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Main Slide Content */}
      <div className="absolute inset-0 pt-16 pb-12 flex flex-col justify-center z-20 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full"
          >
            {slides[currentSlide].content}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation Indicators */}
      <div className="absolute bottom-4 inset-x-6 z-20 flex justify-between items-center">
        <button
          onClick={handlePrev}
          disabled={currentSlide === 0}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-20 transition-all hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[10px] font-bold text-white/40 tracking-widest font-mono">
          {currentSlide + 1} / {slides.length}
        </span>
        <button
          onClick={handleNext}
          disabled={currentSlide === slides.length - 1}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-20 transition-all hover:bg-white/10"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
