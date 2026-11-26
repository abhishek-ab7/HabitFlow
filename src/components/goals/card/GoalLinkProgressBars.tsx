'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinancialProgressView } from './goal-card-helpers';

interface FitnessProgressView {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  progressPct: number;
  remainingLabel: string;
}

export function GoalFinancialCompactBar({ progress }: { progress: FinancialProgressView }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-500/5 border border-sky-500/20 px-3 py-2 text-xs">
      <span className="inline-flex items-center gap-1.5 font-medium text-sky-700 dark:text-sky-300">
        <progress.Icon className="h-3.5 w-3.5 text-sky-500" />
        {progress.label}
      </span>
      <span className="font-mono tabular-nums text-foreground font-semibold">
        {formatINR(progress.currentAmount)} / {formatINR(progress.targetAmount)}{' '}
        <span className="text-sky-600 dark:text-sky-400">({progress.progressPct}%)</span>
      </span>
    </div>
  );
}

export function GoalFitnessCompactBar({ progress }: { progress: FitnessProgressView }) {
  return (
    <div data-testid="goal-fitness-progress-bar" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 text-xs">
      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
        <progress.Icon className="h-3.5 w-3.5 text-emerald-500" />
        {progress.label}
      </span>
      <span className="font-mono tabular-nums text-foreground font-semibold">
        {progress.currentValue} / {progress.targetValue} {progress.unit}{' '}
        <span className="text-emerald-600 dark:text-emerald-400">({progress.progressPct}%)</span>
      </span>
    </div>
  );
}

export function GoalFinancialCardSection({ progress }: { progress: FinancialProgressView }) {
  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-sky-700 dark:text-sky-300">
          <progress.Icon className="h-3.5 w-3.5 text-sky-500" />
          {progress.label}
        </span>
        <span className="font-mono text-xs font-bold tabular-nums text-sky-600 dark:text-sky-400">{progress.progressPct}%</span>
      </div>
      <div className="flex items-baseline gap-1 font-mono tabular-nums">
        <span className="text-base font-bold text-foreground">{formatINR(progress.currentAmount)}</span>
        <span className="text-xs text-muted-foreground">/ {formatINR(progress.targetAmount)}</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <motion.div className="h-full bg-sky-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${progress.progressPct}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
      </div>
      {progress.projectionText && <p className="text-[11px] text-muted-foreground truncate">{progress.projectionText}</p>}
    </div>
  );
}

export function GoalFitnessCardSection({ progress }: { progress: FitnessProgressView }) {
  return (
    <div data-testid="goal-fitness-progress-card" className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
          <progress.Icon className="h-3.5 w-3.5 text-emerald-500" />
          {progress.label}
        </span>
        <span className="font-mono text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{progress.progressPct}%</span>
      </div>
      <div className="flex items-baseline gap-1 font-mono tabular-nums">
        <span className="text-base font-bold text-foreground">{progress.currentValue}</span>
        <span className="text-xs text-muted-foreground">/ {progress.targetValue} {progress.unit}</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <motion.div className="h-full bg-emerald-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${progress.progressPct}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
      </div>
      <p className="text-[11px] text-muted-foreground truncate">{progress.remainingLabel}</p>
    </div>
  );
}
