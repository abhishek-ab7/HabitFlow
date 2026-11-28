import type { PomodoroMode } from '@/lib/stores/pomodoro-store';

export const MODE_LABELS: Record<PomodoroMode, string> = {
  focus: 'Focusing',
  short_break: 'Short Break',
  long_break: 'Long Break',
  starter_2m: '2m Starter',
  urge_10m: '10m Urge Surf',
  gym_rest: 'Gym Rest',
};

export const MODE_PILL_SHORT: Record<PomodoroMode, string> = {
  focus: 'Focus',
  short_break: 'Break',
  long_break: 'Long',
  starter_2m: '2m Start',
  urge_10m: 'Urge',
  gym_rest: 'Rest',
};

export const MODE_COLORS: Record<
  PomodoroMode,
  { text: string; bg: string; border: string; pillBg: string; dot: string }
> = {
  focus: {
    text: 'text-rose-500',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    pillBg: 'bg-rose-500',
    dot: 'bg-rose-500',
  },
  short_break: {
    text: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    pillBg: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  long_break: {
    text: 'text-sky-500',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    pillBg: 'bg-sky-500',
    dot: 'bg-sky-500',
  },
  starter_2m: {
    text: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    pillBg: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
  urge_10m: {
    text: 'text-violet-500',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    pillBg: 'bg-violet-500',
    dot: 'bg-violet-500',
  },
  gym_rest: {
    text: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    pillBg: 'bg-cyan-500',
    dot: 'bg-cyan-500',
  },
};

export function formatTimerDisplay(secs: number): string {
  const safe = Math.max(0, Math.floor(secs));
  const mins = Math.floor(safe / 60);
  const remainingSecs = safe % 60;
  return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
}

export const MODE_OPTIONS = [
  { id: 'focus', label: 'Focus' },
  { id: 'short_break', label: 'Break' },
  { id: 'long_break', label: 'Long' },
  { id: 'starter_2m', label: '2m Start' },
  { id: 'urge_10m', label: '10m Urge' },
  { id: 'gym_rest', label: '90s Rest' },
] as const;
