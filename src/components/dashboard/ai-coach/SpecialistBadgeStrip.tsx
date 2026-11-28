'use client';

import { Wallet, Brain, Dumbbell, Target } from 'lucide-react';
import type { CoachSpecialistId } from '@/lib/ai/graphs/coach-swarm-types';
import { cn } from '@/lib/utils';

const SPECIALIST_META: Record<
  CoachSpecialistId,
  { label: string; icon: typeof Wallet; tone: string }
> = {
  cfo: {
    label: 'Personal CFO',
    icon: Wallet,
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  habit: {
    label: 'Habit Psychologist',
    icon: Brain,
    tone: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  fitness: {
    label: 'Fitness Coach',
    icon: Dumbbell,
    tone: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  goal: {
    label: 'Goal Strategist',
    icon: Target,
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
};

interface SpecialistBadgeStripProps {
  specialists?: CoachSpecialistId[];
}

export function SpecialistBadgeStrip({ specialists }: SpecialistBadgeStripProps) {
  if (!specialists || specialists.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="specialist-badge-strip">
      {specialists.map((id) => {
        const meta = SPECIALIST_META[id];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <span
            key={id}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
              meta.tone
            )}
          >
            <Icon className="w-3 h-3 shrink-0" />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}
