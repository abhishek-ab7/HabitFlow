'use client';

import type React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Dumbbell,
  Flame,
  RotateCcw,
  Share2,
  Sparkles,
  Target,
  Trophy,
  Wallet,
} from 'lucide-react';
import type {
  YearInReviewFinanceProps,
  YearInReviewFitnessProps,
  YearInReviewStats2026,
} from '@/lib/analytics/year-in-review-metrics';

export interface WrappedSlide {
  id: string;
  title: string;
  subtitle: string;
  gradient: string;
  content: React.ReactNode;
}

function buildWelcomeSlide(): WrappedSlide {
  return {
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
  };
}

function buildStreaksSlide(bestStreak: number): WrappedSlide {
  return {
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
            {bestStreak} <span className="text-2xl text-amber-500">Days</span>
          </h2>
          <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
            Your longest uninterrupted habit streak of 2026. That is pure commitment to your daily goals!
          </p>
        </div>
      </div>
    ),
  };
}

function buildTopCategorySlide(topCategory: string, topCategoryCount: number): WrappedSlide {
  return {
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
            {topCategory || 'N/A'}
          </h2>
          <div className="text-sm text-muted-foreground">
            with <span className="font-bold text-white">{topCategoryCount}</span> completions
          </div>
          <p className="text-xs text-muted-foreground max-w-xs mt-2">
            This was your primary focus area in 2026. Balancing multiple areas builds ultimate resilience.
          </p>
        </div>
      </div>
    ),
  };
}

function buildConsistencySlide(stats2026: YearInReviewStats2026): WrappedSlide {
  return {
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
  };
}

export function buildCoreWrappedSlides(stats2026: YearInReviewStats2026): WrappedSlide[] {
  return [
    buildWelcomeSlide(),
    buildStreaksSlide(stats2026.bestStreak),
    buildTopCategorySlide(stats2026.topCategory, stats2026.topCategoryCount),
    buildConsistencySlide(stats2026),
  ];
}

export function buildScorecardSlide(params: {
  stats2026: YearInReviewStats2026;
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

export function buildDomainWrappedSlides(
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
