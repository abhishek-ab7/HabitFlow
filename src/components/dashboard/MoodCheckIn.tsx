'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, subDays } from 'date-fns';
import { useMoodStore } from '@/lib/stores/mood-store';
import type { MoodType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MOODS: {
  value: MoodType;
  label: string;
  emoji: string;
  color: string;
  activeColor: string;
}[] = [
  {
    value: 'happy',
    label: 'Happy',
    emoji: '😊',
    color: 'hover:bg-amber-500/10 hover:border-amber-500/30',
    activeColor:
      'bg-amber-500/20 border-amber-500/50 ring-2 ring-amber-500/25',
  },
  {
    value: 'calm',
    label: 'Calm',
    emoji: '😌',
    color: 'hover:bg-emerald-500/10 hover:border-emerald-500/30',
    activeColor:
      'bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/25',
  },
  {
    value: 'neutral',
    label: 'Neutral',
    emoji: '😐',
    color: 'hover:bg-slate-500/10 hover:border-slate-500/30',
    activeColor:
      'bg-slate-500/20 border-slate-500/50 ring-2 ring-slate-500/25',
  },
  {
    value: 'sad',
    label: 'Sad',
    emoji: '😢',
    color: 'hover:bg-blue-500/10 hover:border-blue-500/30',
    activeColor: 'bg-blue-500/20 border-blue-500/50 ring-2 ring-blue-500/25',
  },
  {
    value: 'stressed',
    label: 'Stressed',
    emoji: '🤯',
    color: 'hover:bg-rose-500/10 hover:border-rose-500/30',
    activeColor: 'bg-rose-500/20 border-rose-500/50 ring-2 ring-rose-500/25',
  },
];

interface MoodCheckInProps {
  compact?: boolean;
}

export function MoodCheckIn({ compact = false }: MoodCheckInProps) {
  const { loadMoodLogs, logMood, getMoodForDate } = useMoodStore();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const activeMood = getMoodForDate(todayStr);

  useEffect(() => {
    const start = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    loadMoodLogs(start, todayStr).catch(console.error);
  }, [loadMoodLogs, todayStr]);

  const handleMoodSelect = async (mood: MoodType) => {
    try {
      await logMood(todayStr, mood);
      toast.success(`Mood logged as ${mood}`, {
        description: 'Saved to your daily emotional & spend correlation metrics.',
        duration: 2500,
      });
    } catch (error) {
      console.error('Failed to log mood:', error);
      toast.error('Could not save mood check-in');
    }
  };

  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-1"
        role="group"
        aria-label="Today's mood check-in"
      >
        <span className="hidden xl:inline text-[11px] font-medium text-muted-foreground mr-1">
          Mood
        </span>
        {MOODS.map((m) => {
          const isSelected = activeMood === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => handleMoodSelect(m.value)}
              aria-label={`Log mood: ${m.label}`}
              aria-pressed={isSelected}
              title={`Mood: ${m.label}`}
              className={cn(
                'w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border/70 bg-background/80 flex items-center justify-center transition-all active:scale-95',
                isSelected ? m.activeColor : m.color
              )}
            >
              <span className="text-base leading-none">{m.emoji}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-5 surface-card"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm sm:text-base tracking-tight text-foreground">
            How are you feeling today?
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track your emotional trend alongside habit consistency and spending.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {MOODS.map((m) => {
            const isSelected = activeMood === m.value;
            return (
              <motion.button
                key={m.value}
                type="button"
                onClick={() => handleMoodSelect(m.value)}
                aria-label={`Log mood: ${m.label}`}
                aria-pressed={isSelected}
                className={cn(
                  'flex flex-col items-center justify-center w-11 h-11 rounded-xl border border-border bg-background transition-all duration-200',
                  isSelected ? m.activeColor : m.color
                )}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                title={m.label}
              >
                <span className="text-lg leading-none">{m.emoji}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
