'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getTimeGreeting, getTimeGradient } from '@/lib/design-tokens';
import { getRandomQuote } from '@/lib/quotes';
import { FadeIn } from '@/components/motion';

import { useHabitStore } from '@/lib/stores/habit-store';
import { useTaskStore } from '@/lib/stores/task-store';

interface HeroSectionProps {
  userName?: string;
  currentStreak?: number;
}

export function HeroSection({ userName, currentStreak }: HeroSectionProps) {
  // Use state to avoid hydration mismatch with time-based values
  const [mounted, setMounted] = useState(false);
  const [timeData, setTimeData] = useState({
    greeting: 'Hello',
    emoji: '👋',
    gradientClass: 'from-slate-100 via-blue-50 to-indigo-100',
    quote: '',
    author: '',
  });

  const getTodayProgress = useHabitStore((s) => s.getTodayProgress);
  const tasks = useTaskStore((s) => s.tasks);

  useEffect(() => {
    const { greeting: baseGreeting, emoji } = getTimeGreeting();
    const gradientClass = getTimeGradient();
    const { quote, author } = getRandomQuote();
    
    let finalGreeting = userName ? `${baseGreeting}, ${userName}` : baseGreeting;
    if (currentStreak !== undefined && currentStreak > 0) {
      finalGreeting = `Day ${currentStreak} streak, ${userName || 'Champion'}! 🔥`;
    }
    
    Promise.resolve().then(() => {
      setMounted(true);
      setTimeData({ greeting: finalGreeting, emoji, gradientClass, quote, author });
    });
  }, [userName, currentStreak]);

  const habitProgress = mounted ? getTodayProgress() : { completed: 0, total: 0 };
  const todayStr = mounted ? new Date().toISOString().split('T')[0] : '';
  const completedTasks = mounted 
    ? tasks.filter(t => t.status === 'done' && t.updated_at && t.updated_at.startsWith(todayStr)).length 
    : 0;
  const activeTasksCount = mounted 
    ? tasks.filter(t => t.status !== 'done' && t.status !== 'archived' && t.due_date && t.due_date <= (todayStr + "T23:59:59")).length 
    : 0;

  const totalTasks = completedTasks + activeTasksCount;
  const completedCount = habitProgress.completed + completedTasks;
  const totalCount = habitProgress.total + totalTasks;
  const scorePercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Render placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="relative overflow-hidden rounded-2xl mb-8">
        <div className="bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-indigo-950/50 dark:to-slate-900 p-8 md:p-10">
          <div className="relative z-10">
            <span className="text-3xl mb-2 block">👋</span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              Hello{userName && <span className="text-primary">, {userName}</span>}
            </h1>
            <p className="text-muted-foreground text-lg italic h-7" />
            <p className="text-sm text-muted-foreground/70 mt-1 h-5" />
          </div>
        </div>
      </div>
    );
  }

  // Circle properties
  const radius = 28;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scorePercentage / 100) * circumference;

  // Accent colors based on completion rate
  const colorClass = scorePercentage >= 80 
    ? 'text-emerald-500 dark:text-emerald-400' 
    : scorePercentage >= 50 
    ? 'text-amber-500 dark:text-amber-400' 
    : 'text-rose-500 dark:text-rose-400';

  const glowClass = scorePercentage >= 80 
    ? 'shadow-emerald-500/20' 
    : scorePercentage >= 50 
    ? 'shadow-amber-500/20' 
    : 'shadow-rose-500/20';

  return (
    <FadeIn className="relative overflow-hidden rounded-2xl mb-8">
      <div className={`bg-gradient-to-br ${timeData.gradientClass} dark:from-slate-900 dark:via-indigo-950/50 dark:to-slate-900 p-8 md:p-10`}>
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute -bottom-32 -left-32 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"
            animate={{
              scale: [1.1, 1, 1.1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <motion.div
            className="flex-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <span className="text-3xl mb-2 block">{timeData.emoji}</span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              {timeData.greeting}
              {userName && <span className="text-primary">, {userName}</span>}
            </h1>
            <p className="text-muted-foreground text-lg italic max-w-xl">
              "{timeData.quote}"
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              — {timeData.author}
            </p>
          </motion.div>

          {/* Daily Score Ring Widget */}
          <motion.div
            className={`flex-shrink-0 flex items-center gap-4 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-white/20 dark:border-slate-800/40 shadow-lg ${glowClass} self-start md:self-auto`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            {/* Circular Ring SVG */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg width="68" height="68" className="transform -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="34"
                  cy="34"
                  r={radius}
                  fill="transparent"
                  className="stroke-muted/20 dark:stroke-slate-800"
                  strokeWidth={strokeWidth}
                />
                {/* Glowing Progress Ring */}
                <circle
                  cx="34"
                  cy="34"
                  r={radius}
                  fill="transparent"
                  className={`${colorClass} transition-all duration-500 ease-out`}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              {/* Inner score percentage text */}
              <span className="absolute text-sm font-bold tracking-tight">
                {scorePercentage}%
              </span>
            </div>

            <div className="space-y-0.5">
              <div className="font-semibold text-sm">Today's Score</div>
              <div className="text-xs text-muted-foreground">
                {completedCount} of {totalCount} completed
              </div>
              <div className={`text-xs font-semibold ${colorClass}`}>
                {scorePercentage === 100 
                  ? "🌟 Perfect day!" 
                  : scorePercentage >= 80 
                  ? "🚀 Incredible momentum!" 
                  : scorePercentage >= 50 
                  ? "📈 Over halfway!" 
                  : scorePercentage > 0 
                  ? "💪 Keep moving!" 
                  : "🌱 Start strong!"}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </FadeIn>
  );
}
