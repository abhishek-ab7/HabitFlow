import type React from 'react';
import { Briefcase, Dumbbell, Moon, Sun } from 'lucide-react';
import type { Habit, HabitAnchorBlock, HabitCompletion, HabitFormData } from '@/lib/types';

export const ANCHOR_BLOCKS: Array<{
  id: HabitAnchorBlock;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
}> = [
  {
    id: 'morning',
    title: 'Morning Anchor',
    subtitle: 'Hydrate, weigh-in, sunlight & morning stack',
    icon: Sun,
    accentClass: 'text-amber-500 bg-amber-500/10',
  },
  {
    id: 'work',
    title: 'Work Anchor',
    subtitle: 'Deep focus blocks, steps break & protein check',
    icon: Briefcase,
    accentClass: 'text-sky-500 bg-sky-500/10',
  },
  {
    id: 'gym',
    title: 'Gym Anchor',
    subtitle: 'Training session, pre/post supplements & workout habits',
    icon: Dumbbell,
    accentClass: 'text-emerald-500 bg-emerald-500/10',
  },
  {
    id: 'night',
    title: 'Night Shutdown',
    subtitle: 'Zero-junk wrap-up, sleep check-in & quit streaks',
    icon: Moon,
    accentClass: 'text-indigo-500 bg-indigo-500/10',
  },
];

export const STARTER_QUIT_TRACKERS: Array<{
  key: string;
  label: string;
  description: string;
  payload: HabitFormData;
}> = [
  {
    key: 'no_junk_food',
    label: 'No Junk Food',
    description: 'Auto-reverses if any Junk Food meal or expense is logged today',
    payload: {
      name: 'No Junk Food',
      icon: '🛡️',
      category: 'health',
      targetDaysPerWeek: 7,
      frequencyType: 'daily',
      polarity: 'quit',
      anchorBlock: 'night',
      autoTrackRule: 'zero_junk_today',
      difficulty: 'hard',
    },
  },
  {
    key: 'no_late_scroll',
    label: 'No Late-Night Scrolling',
    description: 'Protect sleep recovery by parking phone before bed',
    payload: {
      name: 'No Late-Night Scrolling',
      icon: '📵',
      category: 'personal',
      targetDaysPerWeek: 7,
      frequencyType: 'daily',
      polarity: 'quit',
      anchorBlock: 'night',
      autoTrackRule: 'none',
      difficulty: 'medium',
    },
  },
  {
    key: 'no_impulse_cc',
    label: 'No Impulse CC Swipes',
    description: 'Links with FlowFinance No-Spend Days on discretionary cards',
    payload: {
      name: 'No Impulse CC Swipes',
      icon: '💳',
      category: 'finance',
      targetDaysPerWeek: 7,
      frequencyType: 'daily',
      polarity: 'quit',
      anchorBlock: 'night',
      autoTrackRule: 'no_spend_day',
      difficulty: 'hard',
    },
  },
];

export function getQuitCardTone(junkTriggered: boolean, isClean: boolean) {
  if (junkTriggered) return 'border-rose-500/50 bg-rose-500/5';
  if (isClean) return 'border-emerald-500/40 bg-emerald-500/5';
  return 'border-rose-500/25 bg-background';
}
export function getAnchorRowTone(done: boolean, rest: boolean, isQuit: boolean) {
  if (done) return 'border-emerald-500/30 bg-emerald-500/5';
  if (rest) return 'border-teal-500/30 bg-teal-500/5';
  if (isQuit) return 'border-rose-500/25 bg-background';
  return 'border-border bg-background';
}

export function isHabitDoneOnDate(completions: HabitCompletion[], habitId: string, selectedDate: string) {
  return completions.some((c) => c.habitId === habitId && c.date === selectedDate && c.completed && c.status !== 'rest' && !c.skipped);
}

export function isHabitRestOnDate(completions: HabitCompletion[], habitId: string, selectedDate: string) {
  return completions.some((c) => c.habitId === habitId && c.date === selectedDate && (c.status === 'rest' || c.skipped));
}

export function isQuitOrZeroJunkHabit(h: Habit): boolean {
  return h.polarity === 'quit' || h.autoTrackRule === 'zero_junk_today' || h.autoTrackRule === 'no_junk_food';
}
