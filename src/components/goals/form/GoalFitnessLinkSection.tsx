'use client';

import React from 'react';
import { Dumbbell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FitnessDailyLog, FitnessGoalLinkType, FitnessProfile } from '@/lib/types';
import { FITNESS_LINK_OPTIONS } from './goal-form-helpers';

const TARGET_UNIT_LABEL: Partial<Record<FitnessGoalLinkType, string>> = {
  target_weight: 'kg',
  target_waist: 'in',
  monthly_workouts: 'workouts/mo',
  daily_steps_avg: 'steps/day',
};

const TARGET_PLACEHOLDER: Partial<Record<FitnessGoalLinkType, string>> = {
  target_weight: 'e.g. 74',
  target_waist: 'e.g. 31',
  monthly_workouts: 'e.g. 16',
  daily_steps_avg: 'e.g. 9000',
};

function getBaselinePlaceholder(params: {
  fitnessLinkType: FitnessGoalLinkType;
  fitnessProfile: FitnessProfile | null;
  fitnessDailyLogs: FitnessDailyLog[];
}): string {
  if (params.fitnessLinkType === 'target_weight' && params.fitnessProfile?.currentWeightKg) {
    return `e.g. ${params.fitnessProfile.currentWeightKg}`;
  }
  const latestWaist = params.fitnessDailyLogs.find((l) => l.waistInches)?.waistInches;
  if (params.fitnessLinkType === 'target_waist' && latestWaist) return `e.g. ${latestWaist}`;
  return 'Optional baseline';
}

export function GoalFitnessLinkSection(params: {
  enabled: boolean;
  setEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  fitnessLinkType: FitnessGoalLinkType;
  setFitnessLinkType: React.Dispatch<React.SetStateAction<FitnessGoalLinkType>>;
  fitnessTargetValue: string;
  setFitnessTargetValue: React.Dispatch<React.SetStateAction<string>>;
  fitnessStartingValue: string;
  setFitnessStartingValue: React.Dispatch<React.SetStateAction<string>>;
  fitnessProfile: FitnessProfile | null;
  fitnessDailyLogs: FitnessDailyLog[];
}) {
  const { enabled, setEnabled, fitnessLinkType, setFitnessLinkType } = params;
  const showBaseline = fitnessLinkType === 'target_weight' || fitnessLinkType === 'target_waist';

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500"><Dumbbell className="h-4 w-4" /></div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="enable-fit-link" className="text-sm font-semibold text-foreground cursor-pointer">Live Fitness Telemetry Link</label>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px] px-1.5 py-0 font-medium">Life OS Link</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Auto-calculate progress from weight, waist, workouts, or 14d step average</p>
          </div>
        </div>
        <Checkbox id="enable-fit-link" checked={enabled} onCheckedChange={(c) => setEnabled(Boolean(c))} />
      </div>

      {enabled && (
        <div className="space-y-4 pt-2 border-t border-emerald-500/20">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Fitness Metric Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FITNESS_LINK_OPTIONS.map((m) => {
                const Icon = m.icon;
                const isSel = fitnessLinkType === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setFitnessLinkType(m.id)}
                    className={cn(
                      'p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all text-xs',
                      isSel ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500' : 'border-border/60 bg-background/50 hover:bg-muted text-muted-foreground'
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Icon className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{m.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{m.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="fitness-target-value" className="text-xs font-semibold text-foreground block mb-1">
                Target ({TARGET_UNIT_LABEL[fitnessLinkType] ?? 'steps/day'}) *
              </label>
              <Input
                id="fitness-target-value"
                type="number"
                step="0.1"
                placeholder={TARGET_PLACEHOLDER[fitnessLinkType] ?? 'e.g. 9000'}
                value={params.fitnessTargetValue}
                onChange={(e) => params.setFitnessTargetValue(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            {showBaseline && (
              <div>
                <label htmlFor="fitness-starting-value" className="text-xs font-semibold text-foreground block mb-1">
                  Starting Baseline ({fitnessLinkType === 'target_weight' ? 'kg' : 'in'})
                </label>
                <Input
                  id="fitness-starting-value"
                  type="number"
                  step="0.1"
                  placeholder={getBaselinePlaceholder({ fitnessLinkType, fitnessProfile: params.fitnessProfile, fitnessDailyLogs: params.fitnessDailyLogs })}
                  value={params.fitnessStartingValue}
                  onChange={(e) => params.setFitnessStartingValue(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
