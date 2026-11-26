'use client';

import React from 'react';
import { Droplets, Moon, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SLEEP_PRESETS = [5.5, 6, 6.5, 7, 7.5, 8, 8.5];
const ENERGY_PRESETS = [
  { val: 1, label: '1 · Drained' },
  { val: 2, label: '2 · Low' },
  { val: 3, label: '3 · Okay' },
  { val: 4, label: '4 · Good' },
  { val: 5, label: '5 · Peak' },
];

export function FuelHydrationAndSleepStrip(params: {
  waterMl: number;
  waterTargetMl: number;
  waterPct: number;
  sleepHours?: number | null;
  energyLevel?: number | null;
  onIncrementWater: (deltaMl: number) => void;
  onSelectSleep: (hrs: number) => void;
  onSelectEnergy: (val: number) => void;
}) {
  const { waterMl, waterTargetMl, waterPct, sleepHours, energyLevel, onIncrementWater, onSelectSleep, onSelectEnergy } = params;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-sky-500" />
            <span className="text-sm font-semibold text-foreground">Water Intake</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">{waterMl} / {waterTargetMl} ml ({Math.round(waterPct)}%)</span>
        </div>

        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${Math.min(100, waterPct)}%` }} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => onIncrementWater(250)} className="h-8 text-xs">+250 ml</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => onIncrementWater(500)} className="h-8 text-xs">+500 ml</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => onIncrementWater(1000)} className="h-8 text-xs">+1 L Bottle</Button>
          {waterMl >= 250 && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onIncrementWater(-250)} className="h-8 text-xs text-muted-foreground">-250 ml</Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold text-foreground">Sleep &amp; Energy Check-In</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {sleepHours != null ? `${sleepHours}h sleep` : 'Log sleep'} · {energyLevel != null ? `Energy ${energyLevel}/5` : 'Rate energy'}
          </span>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground block">Sleep Duration</span>
            <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-1.5">
              {SLEEP_PRESETS.map((hrs) => (
                <button
                  key={hrs} type="button" onClick={() => onSelectSleep(hrs)}
                  className={cn('px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-medium border transition-colors text-center', sleepHours === hrs ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-background border-border hover:bg-muted')}
                >
                  {hrs}h
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" /> Energy Level</span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {ENERGY_PRESETS.map((p) => (
                <button
                  key={p.val} type="button" onClick={() => onSelectEnergy(p.val)}
                  className={cn('px-2 py-1.5 sm:py-1 rounded-lg text-xs font-medium border transition-colors text-center truncate', energyLevel === p.val ? 'bg-amber-500 text-white border-amber-500' : 'bg-background border-border hover:bg-muted')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
