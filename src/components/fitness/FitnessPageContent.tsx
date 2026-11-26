'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Pill,
  Scale,
  Settings2,
  Shield,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useFeedback } from '@/hooks/use-feedback';
import { addDays, getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { useFitnessStore } from '@/lib/stores/fitness';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useAuth } from '@/providers/auth-provider';
import Link from 'next/link';
import { FuelTab } from './FuelTab';

const FitnessTabFallback = () => (
  <div className="h-64 rounded-2xl border border-border bg-card animate-pulse" />
);

const BodyTrendCharts = dynamic(
  () => import('./BodyTrendCharts').then((m) => ({ default: m.BodyTrendCharts })),
  { ssr: false, loading: FitnessTabFallback }
);
const GymWorkoutTab = dynamic(
  () => import('./GymWorkoutTab').then((m) => ({ default: m.GymWorkoutTab })),
  { ssr: false, loading: FitnessTabFallback }
);
const SupplementsRoiTab = dynamic(
  () => import('./SupplementsRoiTab').then((m) => ({ default: m.SupplementsRoiTab })),
  { ssr: false, loading: FitnessTabFallback }
);
const RoutineAndQuitTab = dynamic(
  () => import('./RoutineAndQuitTab').then((m) => ({ default: m.RoutineAndQuitTab })),
  { ssr: false, loading: FitnessTabFallback }
);
import { cn } from '@/lib/utils';
import { GuidedTour, TourTriggerButton, usePageTour, PAGE_TOURS } from '@/components/tour';
import type {
  DietPreference,
  FitnessActivityLevel,
  FitnessGoalType,
  FitnessProfileFormData,
} from '@/lib/types';

type FitnessTabId = 'fuel' | 'body' | 'workouts' | 'supplements' | 'routines';

function computeSuggestedTargets(
  weightKg: number,
  goalType: FitnessGoalType,
  activity: FitnessActivityLevel
) {
  const actMult: Record<FitnessActivityLevel, number> = {
    sedentary: 27,
    light: 30,
    moderate: 33,
    active: 36,
    athlete: 39,
  };
  const maint = Math.round(weightKg * actMult[activity]);
  const delta =
    goalType === 'fat_loss'
      ? -450
      : goalType === 'recomposition'
        ? -150
        : goalType === 'muscle_gain'
          ? 250
          : 0;
  const calorieTarget = Math.max(1400, Math.round((maint + delta) / 50) * 50);
  const proteinTargetG = Math.round(weightKg * (goalType === 'fat_loss' ? 1.8 : 1.7));
  return { calorieTarget, proteinTargetG };
}

const DEFAULT_PROFILE_FORM: FitnessProfileFormData = {
  heightCm: 175,
  currentWeightKg: 74,
  targetWeightKg: 68,
  targetWaistInches: 31,
  calorieTarget: 2000,
  proteinTargetG: 130,
  waterTargetMl: 3000,
  stepsTarget: 8000,
  sleepTargetHours: 7.5,
  lowEnergyCalorieCeiling: 2250,
  lowEnergyStepsTarget: 3500,
  activityLevel: 'moderate',
  goalType: 'fat_loss',
  dietPreference: 'non_veg',
};

function mapProfileToForm(profile: NonNullable<ReturnType<typeof useFitnessStore.getState>['profile']>): FitnessProfileFormData {
  return {
    heightCm: profile.heightCm ?? 175,
    currentWeightKg: profile.currentWeightKg ?? 74,
    targetWeightKg: profile.targetWeightKg ?? 68,
    targetWaistInches: profile.targetWaistInches ?? 31,
    calorieTarget: profile.calorieTarget,
    proteinTargetG: profile.proteinTargetG,
    waterTargetMl: profile.waterTargetMl,
    stepsTarget: profile.stepsTarget,
    sleepTargetHours: profile.sleepTargetHours,
    lowEnergyCalorieCeiling: profile.lowEnergyCalorieCeiling ?? profile.calorieTarget + 250,
    lowEnergyStepsTarget: profile.lowEnergyStepsTarget ?? 3500,
    activityLevel: profile.activityLevel,
    goalType: profile.goalType,
    dietPreference: profile.dietPreference,
  };
}

const FUEL_TARGET_FIELDS: Array<{
  key: keyof FitnessProfileFormData;
  label: string;
  fallback: number;
  step?: string;
}> = [
  { key: 'calorieTarget', label: 'Calorie Target', fallback: 2000 },
  { key: 'proteinTargetG', label: 'Protein Target (g)', fallback: 130 },
  { key: 'stepsTarget', label: 'Daily Steps', fallback: 8000 },
  { key: 'waterTargetMl', label: 'Water Target (ml)', fallback: 3000, step: '250' },
  { key: 'sleepTargetHours', label: 'Sleep Target (hrs)', fallback: 7.5, step: '0.5' },
  { key: 'lowEnergyCalorieCeiling', label: 'Low-Energy Ceiling (kcal)', fallback: 2250, step: '50' },
  { key: 'lowEnergyStepsTarget', label: 'Low-Energy Steps', fallback: 3500, step: '500' },
];

function FitnessGoalSelectors({
  profileForm,
  setProfileForm,
}: {
  profileForm: FitnessProfileFormData;
  setProfileForm: React.Dispatch<React.SetStateAction<FitnessProfileFormData>>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="space-y-1">
        <label className="text-xs font-medium">Goal</label>
        <select
          value={profileForm.goalType || 'fat_loss'}
          onChange={(e) => {
            const goalType = e.target.value as FitnessGoalType;
            setProfileForm((prev) => ({
              ...prev,
              goalType,
              ...computeSuggestedTargets(prev.currentWeightKg || 74, goalType, prev.activityLevel || 'moderate'),
            }));
          }}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="fat_loss">Fat Loss</option>
          <option value="recomposition">Recomp</option>
          <option value="muscle_gain">Muscle Gain</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Activity</label>
        <select
          value={profileForm.activityLevel || 'moderate'}
          onChange={(e) => {
            const activityLevel = e.target.value as FitnessActivityLevel;
            setProfileForm((prev) => ({
              ...prev,
              activityLevel,
              ...computeSuggestedTargets(prev.currentWeightKg || 74, prev.goalType || 'fat_loss', activityLevel),
            }));
          }}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="sedentary">Sedentary</option>
          <option value="light">Light</option>
          <option value="moderate">Moderate</option>
          <option value="active">Active</option>
          <option value="athlete">Athlete</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Diet</label>
        <select
          value={profileForm.dietPreference || 'non_veg'}
          onChange={(e) => setProfileForm({ ...profileForm, dietPreference: e.target.value as DietPreference })}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="non_veg">Non-Veg</option>
          <option value="eggetarian">Eggetarian</option>
          <option value="veg">Veg</option>
          <option value="vegan">Vegan</option>
        </select>
      </div>
    </div>
  );
}

function FitnessTargetsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileForm: FitnessProfileFormData;
  setProfileForm: React.Dispatch<React.SetStateAction<FitnessProfileFormData>>;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const { open, onOpenChange, profileForm, setProfileForm, onSubmit } = props;
  const patchNumber = (key: keyof FitnessProfileFormData, raw: string, fallback: number | null) =>
    setProfileForm((prev) => ({ ...prev, [key]: raw ? Number(raw) : fallback }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Body &amp; Daily Fuel Targets</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Current Weight (kg)</label>
              <Input
                type="number"
                step="0.1"
                value={profileForm.currentWeightKg ?? ''}
                onChange={(e) => {
                  const w = e.target.value ? Number(e.target.value) : null;
                  setProfileForm((prev) => {
                    const next = { ...prev, currentWeightKg: w };
                    if (w && w > 30) Object.assign(next, computeSuggestedTargets(w, next.goalType || 'fat_loss', next.activityLevel || 'moderate'));
                    return next;
                  });
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Target Weight (kg)</label>
              <Input type="number" step="0.1" value={profileForm.targetWeightKg ?? ''} onChange={(e) => patchNumber('targetWeightKg', e.target.value, null)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Height (cm)</label>
              <Input type="number" value={profileForm.heightCm ?? ''} onChange={(e) => patchNumber('heightCm', e.target.value, null)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Target Waist (in)</label>
              <Input type="number" step="0.1" value={profileForm.targetWaistInches ?? ''} onChange={(e) => patchNumber('targetWaistInches', e.target.value, null)} />
            </div>
          </div>

          <FitnessGoalSelectors profileForm={profileForm} setProfileForm={setProfileForm} />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60">
            {FUEL_TARGET_FIELDS.map((field) => (
              <div key={String(field.key)} className="space-y-1">
                <label className="text-xs font-medium">{field.label}</label>
                <Input
                  type="number"
                  step={field.step}
                  value={(profileForm[field.key] as number | null | undefined) ?? field.fallback}
                  onChange={(e) => patchNumber(field.key, e.target.value, field.fallback)}
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save Targets</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const FITNESS_TABS: Array<{ id: FitnessTabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'fuel', label: 'Fuel & Check-In', icon: Flame },
  { id: 'body', label: 'Body Trends', icon: Scale },
  { id: 'workouts', label: 'Workouts', icon: Dumbbell },
  { id: 'supplements', label: 'Supplements', icon: Pill },
  { id: 'routines', label: 'Routines & Quit', icon: Shield },
];

function FitnessModuleDisabledView({
  habitOnlyMode,
  onEnable,
}: {
  habitOnlyMode?: boolean;
  onEnable: () => void;
}) {
  return (
    <div data-testid="fitness-module-disabled" className="max-w-xl mx-auto px-4 py-14 text-center space-y-4">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
        <Dumbbell className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-bold text-foreground">Body &amp; Fitness Module is Turned Off</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {habitOnlyMode
          ? 'Habit-Only Mode is currently active in Settings, so Body, Diet, Workouts, and Supplements are hidden.'
          : 'You turned off the Body & Fitness app in Settings. Your saved meals, weight trends, workouts, and supplements remain safely preserved.'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Button type="button" onClick={onEnable}>Turn On Body &amp; Fitness</Button>
        <Button type="button" variant="outline" asChild><Link href="/settings">Open Settings</Link></Button>
      </div>
    </div>
  );
}

function FitnessPageHeader({
  selectedDate,
  todayIso,
  onPrevDay,
  onToday,
  onNextDay,
  onStartTour,
  onOpenTargets,
}: {
  selectedDate: string;
  todayIso: string;
  onPrevDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
  onStartTour: () => void;
  onOpenTargets: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-emerald-500" />
          Body, Fuel &amp; Fitness
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Low-friction daily calories, protein, steps, 7-day rolling weight &amp; recovery
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-xl border border-border bg-card p-0.5">
          <button type="button" onClick={onPrevDay} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={onToday} className="px-2.5 py-1 text-xs font-semibold text-foreground">
            {selectedDate === todayIso ? 'Today' : selectedDate}
          </button>
          <button type="button" onClick={onNextDay} disabled={selectedDate >= todayIso} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-35" aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <TourTriggerButton onClick={onStartTour} pageTitle="Fitness Hub" />
        <Button type="button" size="sm" variant="outline" onClick={onOpenTargets} className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" /> Targets
        </Button>
        <Button type="button" size="sm" onClick={() => window.dispatchEvent(new Event('open-quick-capture'))} className="gap-1.5">
          <Zap className="h-3.5 w-3.5" /> 10s Capture
        </Button>
      </div>
    </div>
  );
}

function FitnessTabBar({
  activeTab,
  onSelect,
}: {
  activeTab: FitnessTabId;
  onSelect: (id: FitnessTabId) => void;
}) {
  return (
    <div role="tablist" className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/70 tour-fitness-tabs">
      {FITNESS_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(tab.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-colors border-b-2',
              `tour-fitness-${tab.id}`,
              active ? 'border-primary text-foreground bg-muted/40' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function FitnessTabContent({
  activeTab,
  selectedDate,
  userId,
  dailyLogs,
  profile,
  onSaveBodyMetrics,
}: {
  activeTab: FitnessTabId;
  selectedDate: string;
  userId: string;
  dailyLogs: ReturnType<typeof useFitnessStore.getState>['dailyLogs'];
  profile: ReturnType<typeof useFitnessStore.getState>['profile'];
  onSaveBodyMetrics: (patch: Parameters<ReturnType<typeof useFitnessStore.getState>['upsertDailyLog']>[1]) => Promise<void>;
}) {
  if (activeTab === 'fuel') return <FuelTab selectedDate={selectedDate} userId={userId} />;
  if (activeTab === 'body') {
    return (
      <BodyTrendCharts
        selectedDate={selectedDate}
        dailyLogs={dailyLogs}
        profile={profile}
        onSaveBodyMetrics={onSaveBodyMetrics}
      />
    );
  }
  if (activeTab === 'workouts') return <GymWorkoutTab selectedDate={selectedDate} userId={userId} />;
  if (activeTab === 'supplements') return <SupplementsRoiTab selectedDate={selectedDate} userId={userId} />;
  return <RoutineAndQuitTab selectedDate={selectedDate} userId={userId} />;
}

function useFitnessPageState() {
  const { user } = useAuth();
  const userId = user?.id || 'local-demo-user';

  const settings = useGamificationStore((s) => s.settings);
  const updateUserSettings = useGamificationStore((s) => s.updateUserSettings);
  const isFitnessEnabled = isFitnessModuleEnabled(settings);

  const profile = useFitnessStore((s) => s.profile);
  const dailyLogs = useFitnessStore((s) => s.dailyLogs);
  const hasLoaded = useFitnessStore((s) => s.hasLoaded);
  const currentUserId = useFitnessStore((s) => s.currentUserId);
  const loadFitnessData = useFitnessStore((s) => s.loadFitnessData);
  const upsertProfile = useFitnessStore((s) => s.upsertProfile);
  const upsertDailyLog = useFitnessStore((s) => s.upsertDailyLog);

  const todayIso = getLocalIsoDate();
  const feedback = useFeedback();
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [activeTab, setActiveTab] = useState<FitnessTabId>('fuel');
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<FitnessProfileFormData>(DEFAULT_PROFILE_FORM);
  const tour = usePageTour('fitness');

  useEffect(() => {
    if (!hasLoaded || currentUserId !== userId) loadFitnessData(userId, false).catch(() => undefined);
  }, [hasLoaded, currentUserId, userId, loadFitnessData]);

  useEffect(() => {
    if (profile) setProfileForm(mapProfileToForm(profile));
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsertProfile(profileForm, userId);
    if (profileForm.currentWeightKg) await upsertDailyLog(selectedDate, { weightKg: profileForm.currentWeightKg }, userId);
    toast.success('Body & Fitness targets saved!');
    setProfileModalOpen(false);
  };

  return {
    userId,
    settings,
    updateUserSettings,
    isFitnessEnabled,
    profile,
    dailyLogs,
    upsertDailyLog,
    todayIso,
    feedback,
    selectedDate,
    setSelectedDate,
    activeTab,
    setActiveTab,
    profileModalOpen,
    setProfileModalOpen,
    profileForm,
    setProfileForm,
    handleSaveProfile,
    tour,
  };
}

export function FitnessPageContent() {
  const f = useFitnessPageState();
  const { isOpen: isTourOpen, startTour, closeTour, completeTour } = f.tour;

  if (!f.isFitnessEnabled) {
    return (
      <FitnessModuleDisabledView
        habitOnlyMode={f.settings?.habitOnlyMode}
        onEnable={async () => {
          await f.updateUserSettings({ showFitness: true, ...(f.settings?.habitOnlyMode ? { habitOnlyMode: false } : {}) });
          toast.success('Body & Fitness turned on');
        }}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 space-y-5">
      <FitnessPageHeader
        selectedDate={f.selectedDate}
        todayIso={f.todayIso}
        onPrevDay={() => { f.feedback.tap(); f.setSelectedDate((d) => addDays(d, -1)); }}
        onToday={() => { f.feedback.tap(); f.setSelectedDate(f.todayIso); }}
        onNextDay={() => { f.feedback.tap(); f.setSelectedDate((d) => addDays(d, 1)); }}
        onStartTour={startTour}
        onOpenTargets={() => f.setProfileModalOpen(true)}
      />

      {(!f.profile || f.profile.currentWeightKg == null) && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">30-Second Setup: Set your starting weight &amp; calorie/protein targets</p>
            <p className="text-xs text-muted-foreground">
              Currently using defaults ({f.profile?.calorieTarget ?? 2000} kcal · {f.profile?.proteinTargetG ?? 130}g protein · {f.profile?.stepsTarget ?? 8000} steps)
            </p>
          </div>
          <Button size="sm" onClick={() => f.setProfileModalOpen(true)}>Configure Now</Button>
        </div>
      )}

      <FitnessTabBar
        activeTab={f.activeTab}
        onSelect={(id) => {
          f.feedback.tap();
          f.setActiveTab(id);
        }}
      />

      <FitnessTabContent
        activeTab={f.activeTab}
        selectedDate={f.selectedDate}
        userId={f.userId}
        dailyLogs={f.dailyLogs}
        profile={f.profile}
        onSaveBodyMetrics={async (patch) => {
          await f.upsertDailyLog(f.selectedDate, patch, f.userId);
        }}
      />

      <FitnessTargetsDialog
        open={f.profileModalOpen}
        onOpenChange={f.setProfileModalOpen}
        profileForm={f.profileForm}
        setProfileForm={f.setProfileForm}
        onSubmit={f.handleSaveProfile}
      />

      <GuidedTour {...PAGE_TOURS.fitness} isOpen={isTourOpen} onClose={closeTour} onComplete={completeTour} />
    </div>
  );
}
