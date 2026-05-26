'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, subDays } from 'date-fns';
import { useMoodStore } from '@/lib/stores/mood-store';
import type { MoodType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MOODS: { value: MoodType; label: string; emoji: string; color: string; activeColor: string }[] = [
  { 
    value: 'happy', 
    label: 'Happy', 
    emoji: '😊', 
    color: 'hover:bg-amber-500/10 hover:border-amber-500/30 text-amber-500', 
    activeColor: 'bg-amber-500/25 border-amber-500/50 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20' 
  },
  { 
    value: 'calm', 
    label: 'Calm', 
    emoji: '😌', 
    color: 'hover:bg-emerald-500/10 hover:border-emerald-500/30 text-emerald-500', 
    activeColor: 'bg-emerald-500/25 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20' 
  },
  { 
    value: 'neutral', 
    label: 'Neutral', 
    emoji: '😐', 
    color: 'hover:bg-slate-500/10 hover:border-slate-500/30 text-slate-500', 
    activeColor: 'bg-slate-500/25 border-slate-500/50 text-slate-600 dark:text-slate-400 ring-2 ring-slate-500/20' 
  },
  { 
    value: 'sad', 
    label: 'Sad', 
    emoji: '😢', 
    color: 'hover:bg-blue-500/10 hover:border-blue-500/30 text-blue-500', 
    activeColor: 'bg-blue-500/25 border-blue-500/50 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20' 
  },
  { 
    value: 'stressed', 
    label: 'Stressed', 
    emoji: '🤯', 
    color: 'hover:bg-red-500/10 hover:border-red-500/30 text-red-500', 
    activeColor: 'bg-red-500/25 border-red-500/50 text-red-600 dark:text-red-400 ring-2 ring-red-500/20' 
  },
];

export function MoodCheckIn() {
  const { loadMoodLogs, logMood, moodLogs, getMoodForDate } = useMoodStore();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const activeMood = getMoodForDate(todayStr);

  // Load mood logs for the past 7 days to initialize the store
  useEffect(() => {
    const start = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    const end = todayStr;
    loadMoodLogs(start, end).catch(console.error);
  }, [loadMoodLogs, todayStr]);

  const handleMoodSelect = async (mood: MoodType) => {
    try {
      await logMood(todayStr, mood);
      toast.success(`Mood logged as ${mood}!`, {
        description: 'Your check-in is saved to your daily metrics.',
        duration: 3000
      });
    } catch (error) {
      console.error('Failed to log mood:', error);
      toast.error('Could not save mood check-in');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl border border-white/10 dark:border-white/5 bg-card/45 backdrop-blur-md shadow-sm relative overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base tracking-tight text-foreground">How are you feeling today?</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Track your emotional trend alongside habit performance.</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {MOODS.map((m) => {
            const isSelected = activeMood === m.value;
            return (
              <motion.button
                key={m.value}
                type="button"
                onClick={() => handleMoodSelect(m.value)}
                className={cn(
                  "flex flex-col items-center justify-center w-12 h-12 rounded-xl border border-border bg-card/50 transition-all duration-200",
                  isSelected ? m.activeColor : m.color
                )}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                title={m.label}
              >
                <span className="text-xl leading-none">{m.emoji}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
