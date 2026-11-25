'use client';

import React, { useEffect, useState } from 'react';
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
import { addDays, getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { useFitnessStore } from '@/lib/stores/fitness';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useAuth } from '@/providers/auth-provider';
import Link from 'next/link';
import { FuelTab } from './FuelTab';
import { BodyTrendCharts } from './BodyTrendCharts';
import { GymWorkoutTab } from './GymWorkoutTab';
import { SupplementsRoiTab } from './SupplementsRoiTab';
import { RoutineAndQuitTab } from './RoutineAndQuitTab';
import { cn } from '@/lib/utils';
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

export function FitnessPageContent() {
  const { user } = useAuth();
  const userId = user?.id || 'local-demo-user';

  const settings = useGamificationStore((s) => s.settings);
  const updateUserSettings = useGamificationStore((s) => s.updateUserSettings);
  const isFitnessEnabled = isFitnessModuleEnabled(settings);

  const profile = useFitnessStore((s) => s.profile);
  const dailyLogs = useFitnessStore((s) => s.dailyLogs);
  const hasLoaded = useFitnessStore((s) => s.hasLoaded);

  const loadFitnessData = useFitnessStore((s) => s.loadFitnessData);
  const upsertProfile = useFitnessStore((s) => s.upsertProfile);
  const upsertDailyLog = useFitnessStore((s) => s.upsertDailyLog);

  const todayIso = getLocalIsoDate();
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [activeTab, setActiveTab] = useState<FitnessTabId>('fuel');
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const [profileForm, setProfileForm] = useState<FitnessProfileFormData>({
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
  });

  useEffect(() => {
    if (!hasLoaded || !user?.id) {
      loadFitnessData(userId).catch(() => undefined);
    }
  }, [hasLoaded, user?.id, userId, loadFitnessData]);

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      heightCm: profile.heightCm ?? 175,
      currentWeightKg: profile.currentWeightKg ?? 74,
      targetWeightKg: profile.targetWeightKg ?? 68,
      targetWaistInches: profile.targetWaistInches ?? 31,
      calorieTarget: profile.calorieTarget,
      proteinTargetG: profile.proteinTargetG,
      waterTargetMl: profile.waterTargetMl,
      stepsTarget: profile.stepsTarget,
      sleepTargetHours: profile.sleepTargetHours,
      lowEnergyCalorieCeiling:
        profile.lowEnergyCalorieCeiling ?? profile.calorieTarget + 250,
      lowEnergyStepsTarget: profile.lowEnergyStepsTarget ?? 3500,
      activityLevel: profile.activityLevel,
      goalType: profile.goalType,
      dietPreference: profile.dietPreference,
    });
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsertProfile(profileForm, userId);
    if (profileForm.currentWeightKg) {
      await upsertDailyLog(
        selectedDate,
        { weightKg: profileForm.currentWeightKg },
        userId
      );
    }
    toast.success('Body & Fitness targets saved!');
    setProfileModalOpen(false);
  };

  const tabs: Array<{ id: FitnessTabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'fuel', label: 'Fuel & Check-In', icon: Flame },
    { id: 'body', label: 'Body Trends', icon: Scale },
    { id: 'workouts', label: 'Workouts', icon: Dumbbell },
    { id: 'supplements', label: 'Supplements', icon: Pill },
    { id: 'routines', label: 'Routines & Quit', icon: Shield },
  ];

  if (!isFitnessEnabled) {
    return (
      <div
        data-testid="fitness-module-disabled"
        className="max-w-xl mx-auto px-4 py-14 text-center space-y-4"
      >
        <div className="mx-auto w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
          <Dumbbell className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-foreground">
          Body &amp; Fitness Module is Turned Off
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {settings?.habitOnlyMode
            ? 'Habit-Only Mode is currently active in Settings, so Body, Diet, Workouts, and Supplements are hidden.'
            : 'You turned off the Body & Fitness app in Settings. Your saved meals, weight trends, workouts, and supplements remain safely preserved.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Button
            type="button"
            onClick={async () => {
              await updateUserSettings({
                showFitness: true,
                ...(settings?.habitOnlyMode ? { habitOnlyMode: false } : {}),
              });
              toast.success('Body & Fitness turned on');
            }}
          >
            Turn On Body &amp; Fitness
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/settings">Open Settings</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 space-y-5">
      {/* Header */}
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
          {/* Date Switcher */}
          <div className="inline-flex items-center rounded-xl border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => addDays(d, -1))}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(todayIso)}
              className="px-2.5 py-1 text-xs font-semibold text-foreground"
            >
              {selectedDate === todayIso ? 'Today' : selectedDate}
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              disabled={selectedDate >= todayIso}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-35"
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setProfileModalOpen(true)}
            className="gap-1.5"
          >
            <Settings2 className="h-3.5 w-3.5" /> Targets
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => window.dispatchEvent(new Event('open-quick-capture'))}
            className="gap-1.5"
          >
            <Zap className="h-3.5 w-3.5" /> 10s Capture
          </Button>
        </div>
      </div>

      {/* 30-Second Onboarding Banner when profile hasn't been configured */}
      {(!profile || profile.currentWeightKg == null) && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              30-Second Setup: Set your starting weight &amp; calorie/protein targets
            </p>
            <p className="text-xs text-muted-foreground">
              Currently using defaults ({profile?.calorieTarget ?? 2000} kcal ·{' '}
              {profile?.proteinTargetG ?? 130}g protein · {profile?.stepsTarget ?? 8000}{' '}
              steps)
            </p>
          </div>
          <Button size="sm" onClick={() => setProfileModalOpen(true)}>
            Configure Now
          </Button>
        </div>
      )}

      {/* 4-Tab Shell Navigation */}
      <div
        role="tablist"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/70"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                active
                  ? 'border-primary text-foreground bg-muted/40'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Today & Fuel */}
      {activeTab === 'fuel' && <FuelTab selectedDate={selectedDate} userId={userId} />}

      {/* TAB 2: Body Trends (Weight + Waist + Charts) */}
      {activeTab === 'body' && (
        <BodyTrendCharts
          selectedDate={selectedDate}
          dailyLogs={dailyLogs}
          profile={profile}
          onSaveBodyMetrics={async (patch) => {
            await upsertDailyLog(selectedDate, patch, userId);
          }}
        />
      )}

      {/* TAB 3: Workouts + Progressive Overload + Rest Timer */}
      {activeTab === 'workouts' && (
        <GymWorkoutTab selectedDate={selectedDate} userId={userId} />
      )}

      {/* TAB 4: Supplements Stock, Daily Stack & ₹/25g Protein ROI */}
      {activeTab === 'supplements' && (
        <SupplementsRoiTab selectedDate={selectedDate} userId={userId} />
      )}

      {/* TAB 5: Anchor Routines & Anti-Habits (Quit Trackers) */}
      {activeTab === 'routines' && (
        <RoutineAndQuitTab selectedDate={selectedDate} userId={userId} />
      )}

      {/* Profile / Targets Configuration Modal */}
      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Body &amp; Daily Fuel Targets</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveProfile} className="space-y-3.5">
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
                      if (w && w > 30) {
                        const s = computeSuggestedTargets(
                          w,
                          next.goalType || 'fat_loss',
                          next.activityLevel || 'moderate'
                        );
                        next.calorieTarget = s.calorieTarget;
                        next.proteinTargetG = s.proteinTargetG;
                      }
                      return next;
                    });
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Target Weight (kg)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={profileForm.targetWeightKg ?? ''}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      targetWeightKg: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Height (cm)</label>
                <Input
                  type="number"
                  value={profileForm.heightCm ?? ''}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      heightCm: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Target Waist (in)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={profileForm.targetWaistInches ?? ''}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      targetWaistInches: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Goal</label>
                <select
                  value={profileForm.goalType || 'fat_loss'}
                  onChange={(e) => {
                    const goalType = e.target.value as FitnessGoalType;
                    setProfileForm((prev) => {
                      const s = computeSuggestedTargets(
                        prev.currentWeightKg || 74,
                        goalType,
                        prev.activityLevel || 'moderate'
                      );
                      return { ...prev, goalType, ...s };
                    });
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
                    setProfileForm((prev) => {
                      const s = computeSuggestedTargets(
                        prev.currentWeightKg || 74,
                        prev.goalType || 'fat_loss',
                        activityLevel
                      );
                      return { ...prev, activityLevel, ...s };
                    });
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
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      dietPreference: e.target.value as DietPreference,
                    })
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="non_veg">Non-Veg</option>
                  <option value="eggetarian">Eggetarian</option>
                  <option value="veg">Veg</option>
                  <option value="vegan">Vegan</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60">
              <div className="space-y-1">
                <label className="text-xs font-medium">Calorie Target</label>
                <Input
                  type="number"
                  value={profileForm.calorieTarget ?? 2000}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      calorieTarget: Number(e.target.value) || 2000,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Protein Target (g)</label>
                <Input
                  type="number"
                  value={profileForm.proteinTargetG ?? 130}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      proteinTargetG: Number(e.target.value) || 130,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Daily Steps</label>
                <Input
                  type="number"
                  value={profileForm.stepsTarget ?? 8000}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      stepsTarget: Number(e.target.value) || 8000,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Water Target (ml)</label>
                <Input
                  type="number"
                  step="250"
                  value={profileForm.waterTargetMl ?? 3000}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      waterTargetMl: Number(e.target.value) || 3000,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Sleep Target (hrs)</label>
                <Input
                  type="number"
                  step="0.5"
                  value={profileForm.sleepTargetHours ?? 7.5}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      sleepTargetHours: Number(e.target.value) || 7.5,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Low-Energy Ceiling (kcal)</label>
                <Input
                  type="number"
                  step="50"
                  value={profileForm.lowEnergyCalorieCeiling ?? 2250}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      lowEnergyCalorieCeiling: Number(e.target.value) || 2250,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Low-Energy Steps</label>
                <Input
                  type="number"
                  step="500"
                  value={profileForm.lowEnergyStepsTarget ?? 3500}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      lowEnergyStepsTarget: Number(e.target.value) || 3500,
                    })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setProfileModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Targets</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
