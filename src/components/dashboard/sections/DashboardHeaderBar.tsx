'use client';

import React from 'react';
import { Flame, Shield } from 'lucide-react';
import { MoodCheckIn } from '@/components/dashboard/MoodCheckIn';
import { HeroSection } from '../hero-section';
import { TodayTasksWidget } from '../TodayTasksWidget';
import { EmptyHabitsIllustration } from '@/components/ui/illustrations';

export type WorkspaceLens = 'all' | 'habits' | 'fitness' | 'finance';

export function DashboardEmptyState(params: {
  displayName?: string;
  currentMaxStreak: number;
  isTasksEnabled: boolean;
  onLoadDemo: () => Promise<void>;
  onStartFresh: () => void;
}) {
  const { displayName, currentMaxStreak, isTasksEnabled, onLoadDemo, onStartFresh } = params;
  return (
    <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto">
      <HeroSection userName={displayName} currentStreak={currentMaxStreak} />
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-center max-w-md">
          <div className="mb-6 flex justify-center">
            <EmptyHabitsIllustration />
          </div>
          <h2 className="text-2xl font-bold mb-4">Welcome to HabitFlow!</h2>
          <p className="text-muted-foreground mb-8">
            Start building flexible habits, mastering your cashflow, and achieving your goals.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => void onLoadDemo()} className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors">
              Load Demo Data
            </button>
            <button onClick={onStartFresh} className="px-6 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors">
              Start Fresh
            </button>
          </div>
        </div>
      </div>
      <div className="mt-8">{isTasksEnabled && <TodayTasksWidget isHydrated={true} />}</div>
    </div>
  );
}

export function DashboardHeaderBar(params: {
  greeting: string;
  firstName?: string;
  todayDisplay: string;
  currentMaxStreak: number;
  streakShield: number;
  isFinanceEnabled: boolean;
  isFitnessEnabled: boolean;
  workspaceLens: WorkspaceLens;
  onSelectLens: (lens: WorkspaceLens) => void;
}) {
  const { greeting, firstName, todayDisplay, currentMaxStreak, streakShield, isFinanceEnabled, isFitnessEnabled, workspaceLens, onSelectLens } = params;
  const lensTabs: Array<{ id: WorkspaceLens; label: string }> = [
    { id: 'all', label: 'All Life OS' },
    { id: 'habits', label: 'Habits & Focus' },
    ...(isFitnessEnabled ? [{ id: 'fitness' as const, label: 'Body & Fitness' }] : []),
    ...(isFinanceEnabled ? [{ id: 'finance' as const, label: 'Finance & Cashflow' }] : []),
  ];

  return (
    <header className="surface-card px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 tour-hero-section">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
            {greeting}{firstName ? `, ${firstName}` : ''}
          </h1>
          <span className="text-xs text-muted-foreground font-mono">· {todayDisplay}</span>
        </div>
        <p className="text-xs text-muted-foreground font-mono tabular-nums flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          <span className="inline-flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <strong className="text-foreground">{currentMaxStreak}d</strong> streak
          </span>
          {streakShield > 0 && (
            <span className="inline-flex items-center gap-1">
              · <Shield className="w-3.5 h-3.5 text-cyan-500" />
              <strong className="text-foreground">{streakShield}</strong> shields
            </span>
          )}
        </p>
      </div>

      {(isFinanceEnabled || isFitnessEnabled) && (
        <div role="tablist" aria-label="Dashboard workspace lens" className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted self-start lg:self-center shrink-0 overflow-x-auto max-w-full">
          {lensTabs.map((lens) => (
            <button
              key={lens.id}
              type="button"
              role="tab"
              aria-selected={workspaceLens === lens.id}
              onClick={() => onSelectLens(lens.id)}
              className={`min-h-[36px] px-3 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                workspaceLens === lens.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {lens.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
        <MoodCheckIn compact />
      </div>
    </header>
  );
}
