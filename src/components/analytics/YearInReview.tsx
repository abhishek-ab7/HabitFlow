'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  Brain,
  Wallet,
  Dumbbell
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface YearInReviewFinanceProps {
  enabled: boolean;
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  savingsRatePct: number;
  netWorthInr: number;
}

export interface YearInReviewFitnessProps {
  enabled: boolean;
  workoutCount: number;
  totalVolumeKg: number;
  avgProteinG: number;
  latestWeightKg: number | null;
  junkFreeStreakDays: number;
}

interface YearInReviewProps {
  financeSummary?: YearInReviewFinanceProps;
  fitnessSummary?: YearInReviewFitnessProps;
}

function compute2026Stats(
  habits: ReturnType<typeof useHabitStore.getState>['habits'],
  completions: ReturnType<typeof useHabitStore.getState>['completions'],
  goals: ReturnType<typeof useGoalStore.getState>['goals'],
  tasks: ReturnType<typeof useTaskStore.getState>['tasks']
) {
  const completions2026 = completions.filter((c) => c.date.startsWith('2026') && c.completed);
  const completionsByDate: Record<string, number> = {};
  for (const c of completions2026) {
    completionsByDate[c.date] = (completionsByDate[c.date] || 0) + 1;
  }

  let bestStreak = 0;
  let tempStreak = 0;
  let lastDate: Date | null = null;
  for (const dateStr of Object.keys(completionsByDate).sort()) {
    const currentDate = new Date(dateStr);
    const diffDays = lastDate ? Math.ceil(Math.abs(currentDate.getTime() - lastDate.getTime()) / 86400000) : 0;
    tempStreak = lastDate && diffDays <= 1 ? tempStreak + 1 : 1;
    if (tempStreak > bestStreak) bestStreak = tempStreak;
    lastDate = currentDate;
  }

  const categoryCounts: Record<string, number> = {};
  const habitsMap = new Map(habits.map((h) => [h.id, h]));
  for (const c of completions2026) {
    const habit = habitsMap.get(c.habitId);
    if (habit) categoryCounts[habit.category] = (categoryCounts[habit.category] || 0) + 1;
  }

  const topEntry = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const topCategory = topEntry ? topEntry[0] : 'None';
  const topCategoryCount = topEntry ? topEntry[1] : 0;

  const completedTasks = tasks.filter((t) => t.status === 'done' && t.due_date?.startsWith('2026')).length;
  const completedGoals = goals.filter((g) => g.status === 'completed' && g.deadline?.startsWith('2026')).length;

  return {
    totalCompletions: completions2026.length,
    bestStreak,
    topCategory: topCategory.charAt(0).toUpperCase() + topCategory.slice(1),
    topCategoryCount,
    completedTasks,
    completedGoals,
    totalMilestonesCompleted: completions2026.length + completedTasks + completedGoals,
  };
}

async function copyShareTextFallback(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to execCommand
    }
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    return copied;
  } catch {
    return false;
  }
}

async function shareScorecardBlob(blob: Blob, canvas: HTMLCanvasElement, text: string, shareToastId: string | number): Promise<void> {
  const file = new File([blob], 'habitflow-2026-wrapped.png', { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My 2026 Habit Scorecard | HabitFlow', text });
      toast.dismiss(shareToastId);
      toast.success('Stats shared successfully!');
      return;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        toast.dismiss(shareToastId);
        return;
      }
    }
  }

  if (navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob, 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      toast.dismiss(shareToastId);
      toast.success('Scorecard image and text copied to clipboard!');
      return;
    } catch {
      // fall through to download
    }
  }

  const textCopied = await copyShareTextFallback(text);
  try {
    const link = document.createElement('a');
    link.download = 'habitflow-2026-wrapped.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.dismiss(shareToastId);
    toast.success(textCopied ? 'Stats copied to clipboard & image downloaded!' : 'Scorecard image downloaded!');
  } catch {
    toast.dismiss(shareToastId);
    toast.error('Failed to share or download scorecard.');
  }
}

interface WrappedSlide {
  id: string;
  title: string;
  subtitle: string;
  gradient: string;
  content: React.ReactNode;
}

function buildCoreWrappedSlides(stats2026: ReturnType<typeof compute2026Stats>): WrappedSlide[] {
  return [
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
            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-4xl font-black tracking-tight text-white">
              Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">2026</span> in Review
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-muted-foreground text-sm max-w-sm">
              Let&apos;s look back at the consistency, milestones, and discipline that defined your year.
            </motion.p>
          </div>
        </div>
      ),
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
            transition={{ scale: { repeat: Infinity, duration: 2, ease: 'easeInOut' }, opacity: { duration: 0.5 } }}
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
      ),
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
      ),
    },
    {
      id: 'consistency',
      title: 'Personal Consistency',
      subtitle: 'Consistency Summary',
      gradient: 'from-teal-950 via-slate-900 to-zinc-900',
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-6 px-4">
          <motion.div
            initial={{ scale: 0.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="w-28 h-28 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 p-0.5 flex items-center justify-center shadow-[0_0_50px_rgba(20,184,166,0.3)]"
          >
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
              <CheckCircle className="h-14 w-14 text-teal-400" />
            </div>
          </motion.div>
          <div className="space-y-2">
            <h3 className="text-muted-foreground text-xs uppercase font-bold tracking-widest">Total Actions Logged</h3>
            <h2 className="text-5xl font-black text-white font-mono">
              {stats2026.totalMilestonesCompleted.toLocaleString()}
            </h2>
            <div className="flex justify-center gap-6 mt-3 text-xs text-muted-foreground bg-slate-950/60 py-2 px-4 rounded-xl border border-white/5">
              <div><span className="block font-bold text-white">{stats2026.totalCompletions}</span>Habits</div>
              <div className="w-px bg-white/10" />
              <div><span className="block font-bold text-white">{stats2026.completedTasks}</span>Tasks</div>
              <div className="w-px bg-white/10" />
              <div><span className="block font-bold text-white">{stats2026.completedGoals}</span>Goals</div>
            </div>
          </div>
        </div>
      ),
    },
  ];
}

function buildScorecardSlide(params: {
  stats2026: ReturnType<typeof compute2026Stats>;
  financeSummary?: YearInReviewFinanceProps;
  fitnessSummary?: YearInReviewFitnessProps;
  onReplay: () => void;
  onShare: () => void;
}): WrappedSlide {
  const { stats2026, financeSummary, fitnessSummary, onReplay, onShare } = params;
  return {
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
            <span>Top Focus Area:</span>
            <span className="font-bold text-sky-400 text-sm">{stats2026.topCategory}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span>Tasks &amp; Goals Completed:</span>
            <span className="font-bold text-emerald-400 text-sm">{stats2026.completedTasks} Tasks · {stats2026.completedGoals} Goals</span>
          </div>
          {financeSummary?.enabled && (
            <div className="flex justify-between items-center py-1 border-t border-white/5">
              <span>2026 Savings Rate:</span>
              <span className="font-bold text-sky-400 text-sm tabular-nums">{financeSummary.savingsRatePct}%</span>
            </div>
          )}
          {fitnessSummary?.enabled && (
            <div className="flex justify-between items-center py-1 border-t border-white/5">
              <span>Workouts Logged:</span>
              <span className="font-bold text-orange-400 text-sm tabular-nums">{fitnessSummary.workoutCount} sessions</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 w-full mt-2 pointer-events-auto hide-in-share">
          <button onClick={onReplay} className="flex-1 py-2 px-3 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-white font-medium flex items-center justify-center gap-1.5 transition-colors">
            <RotateCcw className="h-3.5 w-3.5" /> Replay
          </button>
          <button onClick={onShare} className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-xs text-white font-bold flex items-center justify-center gap-1.5 transition-colors">
            <Share2 className="h-3.5 w-3.5" /> Share Stats
          </button>
        </div>
      </div>
    ),
  };
}

function buildDomainWrappedSlides(
  financeSummary?: YearInReviewFinanceProps,
  fitnessSummary?: YearInReviewFitnessProps
): WrappedSlide[] {
  const extra: WrappedSlide[] = [];
  if (financeSummary?.enabled) {
    extra.push({
      id: 'finance-wrapped',
      title: 'Wealth & Discipline',
      subtitle: '2026 Finance Wrapped',
      gradient: 'from-sky-950 via-slate-900 to-zinc-900',
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-6 px-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-400 p-0.5 flex items-center justify-center shadow-[0_0_40px_rgba(14,165,233,0.3)]">
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
              <Wallet className="h-12 w-12 text-sky-400" />
            </div>
          </div>
          <div className="space-y-2 w-full max-w-xs">
            <h3 className="text-muted-foreground text-xs uppercase font-bold tracking-widest">Savings &amp; Net Worth</h3>
            <h2 className="text-4xl font-black text-white tabular-nums">
              {financeSummary.savingsRatePct}% <span className="text-lg text-sky-400 font-semibold">Saved</span>
            </h2>
            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <div className="rounded-xl bg-slate-950/60 p-2.5 border border-white/10">
                <span className="block text-muted-foreground">Invested</span>
                <span className="font-bold text-white tabular-nums">₹{financeSummary.totalInvestment.toLocaleString('en-IN')}</span>
              </div>
              <div className="rounded-xl bg-slate-950/60 p-2.5 border border-white/10">
                <span className="block text-muted-foreground">Net Worth</span>
                <span className="font-bold text-emerald-400 tabular-nums">₹{Math.round(financeSummary.netWorthInr).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      ),
    });
  }
  if (fitnessSummary?.enabled) {
    extra.push({
      id: 'fitness-wrapped',
      title: 'Body & Iron',
      subtitle: '2026 Fitness Wrapped',
      gradient: 'from-orange-950 via-slate-900 to-zinc-900',
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-6 px-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 p-0.5 flex items-center justify-center shadow-[0_0_40px_rgba(249,115,22,0.3)]">
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
              <Dumbbell className="h-12 w-12 text-orange-400" />
            </div>
          </div>
          <div className="space-y-2 w-full max-w-xs">
            <h3 className="text-muted-foreground text-xs uppercase font-bold tracking-widest">Training Output</h3>
            <h2 className="text-4xl font-black text-white tabular-nums">
              {fitnessSummary.workoutCount} <span className="text-lg text-orange-400 font-semibold">Workouts</span>
            </h2>
            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <div className="rounded-xl bg-slate-950/60 p-2.5 border border-white/10">
                <span className="block text-muted-foreground">Avg Protein</span>
                <span className="font-bold text-white tabular-nums">{fitnessSummary.avgProteinG}g / day</span>
              </div>
              <div className="rounded-xl bg-slate-950/60 p-2.5 border border-white/10">
                <span className="block text-muted-foreground">Total Volume</span>
                <span className="font-bold text-orange-300 tabular-nums">{fitnessSummary.totalVolumeKg.toLocaleString('en-IN')} kg</span>
              </div>
            </div>
          </div>
        </div>
      ),
    });
  }
  return extra;
}

export function YearInReview({ financeSummary, fitnessSummary }: YearInReviewProps = {}) {
  const { habits, completions } = useHabitStore();
  const { goals } = useGoalStore();
  const { tasks } = useTaskStore();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  const cardRef = useRef<HTMLDivElement>(null);
  const slideDuration = 8000;

  const stats2026 = useMemo(
    () => compute2026Stats(habits, completions, goals, tasks),
    [habits, completions, goals, tasks]
  );

  const handleShare = async () => {
    const wasPlaying = isPlaying;
    setIsPlaying(false);
    const text = `I completed ${stats2026.totalCompletions} habits in 2026 with a ${stats2026.bestStreak} day streak on HabitFlow! 🚀 Check out your 2026 scorecard at habitflow.tech #HabitFlowWrapped`;

    const element = cardRef.current;
    if (!element) {
      toast.error('Card element not found.');
      if (wasPlaying) setIsPlaying(true);
      return;
    }

    const shareToastId = toast.loading('Generating your scorecard share card...');
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: null,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('.hide-in-share').forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });
          clonedDoc.querySelectorAll('.show-in-share').forEach((el) => {
            (el as HTMLElement).style.setProperty('display', 'block', 'important');
          });
          const clonedCard = clonedDoc.querySelector('[data-slot="card"]') as HTMLElement | null;
          if (clonedCard) {
            clonedCard.style.height = '520px';
            clonedCard.style.maxHeight = '520px';
            clonedCard.style.borderRadius = '1.5rem';
            clonedCard.style.overflow = 'hidden';
          }
        },
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.dismiss(shareToastId);
          toast.error('Failed to render card image.');
        } else {
          await shareScorecardBlob(blob, canvas, text, shareToastId);
        }
        if (wasPlaying) setIsPlaying(true);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to capture card:', err);
      toast.dismiss(shareToastId);
      toast.error('Failed to capture card image.');
      if (wasPlaying) setIsPlaying(true);
    }
  };

  const slides: WrappedSlide[] = [
    ...buildCoreWrappedSlides(stats2026),
    buildScorecardSlide({
      stats2026,
      financeSummary,
      fitnessSummary,
      onReplay: () => {
        setCurrentSlide(0);
        setProgress(0);
        setIsPlaying(true);
      },
      onShare: handleShare,
    }),
    ...buildDomainWrappedSlides(financeSummary, fitnessSummary),
  ];

  const totalSlides = slides.length;

  // Auto-advance logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      const step = 100 / (slideDuration / 100);
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            setCurrentSlide(curr => {
              if (curr >= totalSlides - 1) {
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
  }, [isPlaying, currentSlide, totalSlides]);

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
    <Card ref={cardRef} className="border border-border/60 bg-card rounded-2xl shadow-xl overflow-hidden max-w-md mx-auto relative h-[520px]">
      {/* Slide Background Gradient */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-b transition-all duration-1000 ease-in-out opacity-90",
        slides[currentSlide].gradient
      )} />

      {/* Grid Overlay for Premium Feel */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Progress Bars (Instagram style) */}
      <div className="absolute top-4 left-4 right-4 flex gap-1.5 z-30 hide-in-share">
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
      <div className="absolute inset-x-0 top-12 bottom-12 z-10 flex hide-in-share">
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
          className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white transition-colors hover:bg-white/10 hide-in-share"
        >
          {isPlaying ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>
        {/* Brand Header for shared image */}
        <div className="hidden show-in-share text-right">
          <span className="text-[9px] font-mono font-bold tracking-widest text-emerald-400 block leading-none">HABITFLOW</span>
          <span className="text-[8px] text-white/40 font-mono block mt-0.5 leading-none">habitflow.tech</span>
        </div>
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
      <div className="absolute bottom-4 inset-x-6 z-20 flex justify-between items-center hide-in-share">
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

      {/* Brand Footer for shared image */}
      <div className="absolute bottom-6 inset-x-0 hidden text-center show-in-share">
        <p className="text-[10px] font-bold tracking-widest uppercase font-mono text-white/50">
          Tracked on <span className="text-emerald-400">HabitFlow</span>
        </p>
        <p className="text-[8px] font-medium tracking-wide text-white/30 font-sans mt-0.5">
          habitflow.tech
        </p>
      </div>
    </Card>
  );
}
