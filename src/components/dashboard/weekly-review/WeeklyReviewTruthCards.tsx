'use client';

import React from 'react';
import { AlertTriangle, Flame, Scale, Wallet } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { MoodType } from '@/lib/types';
import type { ReviewDayInfo } from './weekly-review-analytics';

const MOOD_EMOJIS: Record<MoodType, string> = {
  happy: '😊',
  calm: '😌',
  neutral: '😐',
  sad: '😢',
  stressed: '🤯',
};

export function Truth1FinanceCard({ data }: {
  data: {
    safeToSpendMonthly: number;
    safeToSpendDaily: number;
    remainingDays: number;
    ccFloatInr: number;
    emiPrincipalInr: number;
    borrowedRemainingInr: number;
    debtRepayProgressPct: number;
  };
}) {
  return (
    <div data-testid="sunday-truth-1" className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider inline-flex items-center gap-1">
          <Wallet className="w-3.5 h-3.5" /> 1. Safe-to-Spend &amp; Debt / CC Float
        </span>
        <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">{data.debtRepayProgressPct}% repaid</span>
      </div>
      <div className="text-lg font-bold font-mono text-foreground">
        {formatINR(data.safeToSpendMonthly)} safe
        <span className="text-xs font-normal text-muted-foreground ml-1.5">
          ({formatINR(data.safeToSpendDaily)}/day · {data.remainingDays}d left)
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        CC Float: <strong className="text-foreground">{formatINR(data.ccFloatInr)}</strong> · Borrowed Debt:{' '}
        <strong className="text-foreground">{formatINR(data.borrowedRemainingInr)}</strong> · EMIs:{' '}
        <strong className="text-foreground">{formatINR(data.emiPrincipalInr)}</strong>
      </p>
    </div>
  );
}

export function Truth2BodyCard({ data }: {
  data: {
    latestRollingWeightKg: number | null;
    weeklyWeightDeltaKg: number | null;
    latestWaistInches: number | null;
    waistDeltaInches: number | null;
    workouts7dCount: number;
    avgSteps7d: number;
  };
}) {
  const weightDelta = data.weeklyWeightDeltaKg;
  const waistDelta = data.waistDeltaInches;
  return (
    <div data-testid="sunday-truth-2" className="p-4 rounded-xl border border-sky-500/25 bg-sky-500/5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400 tracking-wider inline-flex items-center gap-1">
          <Scale className="w-3.5 h-3.5" /> 2. 7-Day Weight &Delta;, Waist &Delta;, Workouts &amp; Steps
        </span>
        <span className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400">{data.workouts7dCount} workouts</span>
      </div>
      <div className="text-lg font-bold font-mono text-foreground">
        {data.latestRollingWeightKg !== null ? `${data.latestRollingWeightKg} kg` : 'Weight n/a'}
        {weightDelta !== null && (
          <span className="text-xs font-semibold ml-1.5 text-muted-foreground">({weightDelta >= 0 ? '+' : ''}{weightDelta} kg 7d &Delta;)</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Waist: <strong className="text-foreground">{data.latestWaistInches !== null ? `${data.latestWaistInches}"` : 'n/a'}</strong>
        {waistDelta !== null && ` (${waistDelta >= 0 ? '+' : ''}${waistDelta}" Δ)`} · Avg Steps:{' '}
        <strong className="text-foreground">{data.avgSteps7d.toLocaleString('en-IN')}/day</strong>
      </p>
    </div>
  );
}

export function Truth3JunkCard({ data, isFitnessEnabled }: {
  data: {
    junkSpend14dInr: number;
    junkSpend30dInr: number;
    emptyKcal14d: number;
    emptyKcal30d: number;
    fatLossDragKg30d: number;
    topTriggerLabel: string | null;
    triggerMultiplier: number | null;
  };
  isFitnessEnabled: boolean;
}) {
  return (
    <div data-testid="sunday-truth-3" className="p-4 rounded-xl border border-amber-500/25 bg-amber-500/5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider inline-flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          {isFitnessEnabled ? '3. Junk Spend & Empty kcal + Top Trigger' : 'Junk Spend & Pattern Trigger'}
        </span>
        {isFitnessEnabled && <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">{data.fatLossDragKg30d} kg drag</span>}
      </div>
      <div className="text-lg font-bold font-mono text-foreground">
        {formatINR(data.junkSpend14dInr)}
        <span className="text-xs font-normal text-muted-foreground ml-1.5">
          (14d){isFitnessEnabled ? ` · ${data.emptyKcal14d.toLocaleString('en-IN')} kcal` : ''}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        30d Total: <strong className="text-foreground">{formatINR(data.junkSpend30dInr)}</strong>
        {isFitnessEnabled ? ` (${data.emptyKcal30d.toLocaleString('en-IN')} kcal)` : ''} · Top Trigger:{' '}
        <strong className="text-foreground">
          {data.topTriggerLabel || 'None detected'}
          {data.triggerMultiplier ? ` (${data.triggerMultiplier}x)` : ''}
        </strong>
      </p>
    </div>
  );
}

export function TruthHabitsMoodCard(params: {
  last7Days: ReviewDayInfo[];
  weeklyCompletionRate: number;
  bestHabitName: string | null;
  bestHabitRate: number | null;
  getMoodForDate: (dateStr: string) => MoodType | undefined;
}) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider inline-flex items-center gap-1">
          <Flame className="w-3.5 h-3.5 text-primary" /> Habits &amp; 7-Day Mood Pulse
        </span>
        <span className="text-[11px] font-mono font-bold text-foreground">{params.weeklyCompletionRate}% week</span>
      </div>
      <div className="flex justify-between items-center pt-1">
        {params.last7Days.map((day) => {
          const mood = params.getMoodForDate(day.dateStr);
          return (
            <div key={day.dateStr} className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-muted-foreground">{day.dayName}</span>
              <span className="text-base">{mood ? MOOD_EMOJIS[mood] : '⚪'}</span>
            </div>
          );
        })}
      </div>
      {params.bestHabitName && (
        <p className="text-[11px] text-muted-foreground truncate">
          Anchor Habit: <strong className="text-foreground">{params.bestHabitName}</strong> ({params.bestHabitRate}%)
        </p>
      )}
    </div>
  );
}
