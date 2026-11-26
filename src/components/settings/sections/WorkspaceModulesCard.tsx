'use client';

import React from 'react';
import { Layers, Vibrate, VibrateOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UserSettings } from '@/lib/types';

function ModuleToggleRow(params: {
  title: string;
  subtitle: string;
  enabled: boolean;
  disabled: boolean;
  activeLabel: string;
  inactiveLabel: string;
  onClick: () => void;
  testId?: string;
  roleSwitch?: boolean;
  isLast?: boolean;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 transition-opacity', params.isLast ? 'pt-3' : 'py-3', params.disabled && 'opacity-45 pointer-events-none')}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{params.title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{params.subtitle}</p>
      </div>
      <Button
        type="button"
        role={params.roleSwitch ? 'switch' : undefined}
        aria-checked={params.roleSwitch ? !params.disabled && params.enabled : undefined}
        aria-label={params.roleSwitch ? `Toggle ${params.title}` : undefined}
        data-testid={params.testId}
        variant={params.enabled ? 'default' : 'outline'}
        size="sm"
        disabled={params.disabled}
        onClick={params.onClick}
        className="h-8 px-3 text-xs font-medium whitespace-nowrap shrink-0"
      >
        {params.enabled ? params.activeLabel : params.inactiveLabel}
      </Button>
    </div>
  );
}

export function WorkspaceModulesCard({
  settings,
  onToggleSetting,
}: {
  settings: UserSettings;
  onToggleSetting: (key: keyof UserSettings) => void;
}) {
  const habitOnly = Boolean(settings.habitOnlyMode);
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2.5 pb-3 border-b border-border">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0"><Layers className="h-4 w-4" /></div>
        <div>
          <h2 className="text-sm font-semibold text-foreground tracking-tight">Workspace Modules</h2>
          <p className="text-[11px] text-muted-foreground">Configure active Life OS sections</p>
        </div>
      </div>

      <div className="divide-y divide-border">
        <ModuleToggleRow title="Habit-Only Mode" subtitle="Focused habit tracker view" enabled={habitOnly} disabled={false} activeLabel="Active" inactiveLabel="Off" onClick={() => onToggleSetting('habitOnlyMode')} />
        <ModuleToggleRow title="Tasks Module" subtitle="Checklists & daily tasks" enabled={settings.showTasks !== false} disabled={habitOnly} activeLabel="Enabled" inactiveLabel="Hidden" onClick={() => onToggleSetting('showTasks')} />
        <ModuleToggleRow title="Goals & Milestones" subtitle="Long-term SMART targets" enabled={settings.showGoals !== false} disabled={habitOnly} activeLabel="Enabled" inactiveLabel="Hidden" onClick={() => onToggleSetting('showGoals')} />
        <ModuleToggleRow title="Body & Fitness" subtitle="Turn on/off /fitness app, meals, workouts, supplements & fitness alerts" enabled={settings.showFitness !== false} disabled={habitOnly} activeLabel="On" inactiveLabel="Off" onClick={() => onToggleSetting('showFitness')} testId="toggle-fitness-module" roleSwitch />
        <ModuleToggleRow title="Personal Finance" subtitle="Expenses, credit cards, EMIs & cash flow" enabled={settings.showFinance !== false} disabled={habitOnly} activeLabel="Enabled" inactiveLabel="Hidden" onClick={() => onToggleSetting('showFinance')} isLast />
      </div>
    </section>
  );
}

export function SensoryFeedbackCard({
  settings,
  onToggleSound,
  onToggleHaptics,
}: {
  settings: UserSettings;
  onToggleSound: () => void;
  onToggleHaptics: () => void;
}) {
  const soundOn = settings.soundEnabled !== false;
  const hapticsOn = settings.hapticsEnabled !== false;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2.5 pb-3 border-b border-border">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0"><Volume2 className="h-4 w-4" /></div>
        <div>
          <h2 className="text-sm font-semibold text-foreground tracking-tight">Sensory Feedback</h2>
          <p className="text-[11px] text-muted-foreground">Audio and tactile responses</p>
        </div>
      </div>

      <div className="divide-y divide-border">
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn('p-1.5 rounded-lg shrink-0', soundOn ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground')}>
              {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">Sound Effects</p>
              <p className="text-[11px] text-muted-foreground truncate">Pops and completion chimes</p>
            </div>
          </div>
          <Button variant={soundOn ? 'default' : 'outline'} size="sm" onClick={onToggleSound} className="h-8 px-3 text-xs font-medium whitespace-nowrap shrink-0">
            {soundOn ? 'On' : 'Off'}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn('p-1.5 rounded-lg shrink-0', hapticsOn ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground')}>
              {hapticsOn ? <Vibrate className="w-3.5 h-3.5" /> : <VibrateOff className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">Haptics</p>
              <p className="text-[11px] text-muted-foreground truncate">Subtle vibration on tap</p>
            </div>
          </div>
          <Button variant={hapticsOn ? 'default' : 'outline'} size="sm" onClick={onToggleHaptics} className="h-8 px-3 text-xs font-medium whitespace-nowrap shrink-0">
            {hapticsOn ? 'On' : 'Off'}
          </Button>
        </div>
      </div>
    </section>
  );
}
