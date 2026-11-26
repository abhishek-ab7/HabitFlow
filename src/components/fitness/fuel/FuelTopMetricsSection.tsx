'use client';

import React, { useState } from 'react';
import { BatteryLow, Footprints } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const MacroRing = React.memo(function MacroRing({
  label, valueText, subText, pct, colorClass, strokeHex,
}: {
  label: string; valueText: string; subText: string; pct: number; colorClass: string; strokeHex: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5">
      <div className="relative h-20 w-20 shrink-0 flex items-center justify-center">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" className="text-muted/35" strokeWidth="7" />
          <circle
            cx="40" cy="40" r={radius} fill="none" stroke={strokeHex} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-500"
          />
        </svg>
        <span className={cn('absolute text-xs font-bold', colorClass)}>{Math.round(pct)}%</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground tracking-tight truncate">{valueText}</p>
        <p className="text-[11px] text-muted-foreground truncate">{subText}</p>
      </div>
    </div>
  );
});

export function LowEnergyBanner(params: {
  lowEnergyMode: boolean;
  stepsTarget: number;
  calorieTarget: number;
  onToggle: () => void;
}) {
  const { lowEnergyMode, stepsTarget, calorieTarget, onToggle } = params;
  return (
    <div className={cn('rounded-2xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 transition-colors', lowEnergyMode ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-card')}>
      <div className="flex items-center gap-2.5 min-w-0">
        <BatteryLow className={cn('h-4 w-4 shrink-0', lowEnergyMode ? 'text-amber-500' : 'text-muted-foreground')} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground">Minimum Viable Day (Low-Energy Mode)</span>
            {lowEnergyMode && <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30 text-[10px]">Active</Badge>}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {lowEnergyMode
              ? `Steps ${stepsTarget.toLocaleString()} · Ceiling ${calorieTarget} kcal · Exercise habits rested · Protein & Zero-Junk active`
              : 'Tired or busy? Shrink steps & calorie floor and rest gym habits without losing momentum.'}
          </p>
        </div>
      </div>
      <Button
        type="button" size="sm" variant={lowEnergyMode ? 'default' : 'outline'}
        data-testid="low-energy-toggle" onClick={onToggle}
        className={cn('h-8 text-xs shrink-0', lowEnergyMode && 'bg-amber-500 hover:bg-amber-600 text-white')}
      >
        {lowEnergyMode ? 'Exit Low-Energy' : 'Enable Low-Energy'}
      </Button>
    </div>
  );
}

function DailyStepsCard(params: {
  steps: number;
  stepsTarget: number;
  stepsPct: number;
  onSaveExact: (val: number) => Promise<void>;
  onAdd2k: () => void;
}) {
  const { steps, stepsTarget, stepsPct, onSaveExact, onAdd2k } = params;
  const [isEditingSteps, setIsEditingSteps] = useState(false);
  const [stepsDraft, setStepsDraft] = useState('');

  const handleSave = async () => {
    await onSaveExact(Math.max(0, Math.round(Number(stepsDraft) || 0)));
    setIsEditingSteps(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 flex flex-col justify-between gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Footprints className="h-4 w-4 text-sky-500" />
          <span className="text-xs font-medium text-muted-foreground">Daily Steps</span>
        </div>
        <span className="text-xs font-bold text-sky-500">{Math.round(stepsPct)}%</span>
      </div>

      {isEditingSteps ? (
        <div className="flex items-center gap-1.5">
          <Input type="number" value={stepsDraft} onChange={(e) => setStepsDraft(e.target.value)} className="h-8 text-sm" placeholder="8000" autoFocus />
          <Button size="sm" className="h-8" onClick={handleSave}>Save</Button>
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-2">
          <button
            type="button"
            onClick={() => { setStepsDraft(String(steps)); setIsEditingSteps(true); }}
            className="text-left group" title="Tap to edit exact step count"
          >
            <span className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{steps.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground ml-1">/ {stepsTarget.toLocaleString()}</span>
          </button>
          <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={onAdd2k}>+2k</Button>
        </div>
      )}

      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${Math.min(100, stepsPct)}%` }} />
      </div>
    </div>
  );
}

export function FuelMacroAndStepsGrid(params: {
  caloriesRemaining: number;
  caloriesConsumed: number;
  calorieTarget: number;
  caloriePct: number;
  lowEnergyMode: boolean;
  proteinConsumedG: number;
  proteinTargetG: number;
  proteinRemainingG: number;
  proteinPct: number;
  steps: number;
  stepsTarget: number;
  stepsPct: number;
  onSaveExactSteps: (val: number) => Promise<void>;
  onAdd2kSteps: () => void;
}) {
  const {
    caloriesRemaining, caloriesConsumed, calorieTarget, caloriePct, lowEnergyMode,
    proteinConsumedG, proteinTargetG, proteinRemainingG, proteinPct,
    steps, stepsTarget, stepsPct, onSaveExactSteps, onAdd2kSteps,
  } = params;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      <MacroRing
        label={caloriesRemaining >= 0 ? 'Calories Left' : 'Calories Over'}
        valueText={`${Math.abs(caloriesRemaining)} kcal`}
        subText={`${caloriesConsumed} / ${calorieTarget} kcal${lowEnergyMode ? ' (ceiling)' : ' eaten'}`}
        pct={caloriePct}
        colorClass={caloriesRemaining < 0 ? 'text-rose-500' : 'text-amber-500'}
        strokeHex={caloriesRemaining < 0 ? '#f43f5e' : '#f59e0b'}
      />
      <MacroRing
        label="Protein Intake"
        valueText={`${proteinConsumedG} / ${proteinTargetG}g`}
        subText={proteinRemainingG > 0 ? `${proteinRemainingG}g remaining today` : 'Daily protein target hit!'}
        pct={proteinPct}
        colorClass="text-emerald-500"
        strokeHex="#10b981"
      />
      <DailyStepsCard steps={steps} stepsTarget={stepsTarget} stepsPct={stepsPct} onSaveExact={onSaveExactSteps} onAdd2k={onAdd2kSteps} />
    </div>
  );
}
