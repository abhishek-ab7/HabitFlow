'use client';

import { useEffect, useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useTaskStore } from '@/lib/stores/task-store';

function getInitialLoadingState() {
  const habitLoaded = typeof useHabitStore.getState === 'function' ? Boolean(useHabitStore.getState()?.hasLoadedHabits) : false;
  const taskLoaded = typeof useTaskStore.getState === 'function' ? Boolean(useTaskStore.getState()?.hasLoaded) : false;
  return !habitLoaded && !taskLoaded;
}

function isTourPending(): boolean {
  if (localStorage.getItem('habitflow_onboarded') !== 'true') return false;
  return localStorage.getItem('habitflow_dashboard_tutorial_completed') !== 'true';
}

async function fetchInitialDashboardData(params: {
  userId: string;
  isFitnessEnabled: boolean;
  loadDashboardLayout: (userId: string) => Promise<void>;
  loadAllMilestones: () => Promise<void>;
  loadCompletions: (start: string, end: string) => Promise<void>;
  loadGamification: () => Promise<void>;
  loadFinanceData: (userId?: string, force?: boolean) => Promise<void>;
  loadFitnessData: (userId?: string, force?: boolean) => Promise<void>;
  loadMoodLogs: (start: string, end: string) => Promise<void>;
}) {
  const today = new Date();
  const start = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
  const end = format(endOfMonth(today), 'yyyy-MM-dd');
  await Promise.all([
    params.loadDashboardLayout(params.userId),
    params.loadAllMilestones(),
    params.loadCompletions(start, end),
    params.loadGamification(),
    params.loadFinanceData(params.userId, false),
    params.isFitnessEnabled ? params.loadFitnessData(params.userId, false) : Promise.resolve(),
    params.loadMoodLogs(start, end),
  ]);
}

function useTourAndOnboardingSync(params: {
  showOnboarding: boolean;
  setShowOnboarding: (v: boolean) => void;
  isInitializing: boolean;
  isEmpty: boolean;
  habitCount: number;
  goalCount: number;
  setShowTour: (v: boolean) => void;
}) {
  const { showOnboarding, setShowOnboarding, isInitializing, isEmpty, habitCount, goalCount, setShowTour } = params;

  useEffect(() => {
    if (showOnboarding || isInitializing) return;
    if (!isEmpty && isTourPending()) setShowTour(true);
  }, [showOnboarding, isInitializing, isEmpty, setShowTour]);

  useEffect(() => {
    if (!showOnboarding) return;
    if (habitCount > 0 || goalCount > 0) {
      setShowOnboarding(false);
      localStorage.setItem('habitflow_onboarded', 'true');
    }
  }, [habitCount, goalCount, showOnboarding, setShowOnboarding]);
}

export function useDashboardInitEffects(params: {
  userId?: string;
  authLoading: boolean;
  isDataReady: boolean;
  isFitnessEnabled: boolean;
  isEmpty: boolean;
  habitCount: number;
  goalCount: number;
  loadDashboardLayout: (userId: string) => Promise<void>;
  loadAllMilestones: () => Promise<void>;
  loadCompletions: (start: string, end: string) => Promise<void>;
  loadGamification: () => Promise<void>;
  loadFinanceData: (userId?: string, force?: boolean) => Promise<void>;
  loadFitnessData: (userId?: string, force?: boolean) => Promise<void>;
  loadMoodLogs: (start: string, end: string) => Promise<void>;
}) {
  const { userId, authLoading, isDataReady, isFitnessEnabled, isEmpty, habitCount, goalCount } = params;
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [isInitializing, setIsInitializing] = useState(getInitialLoadingState);

  useEffect(() => {
    if (authLoading || !isDataReady) return;
    if (!userId) return void setIsInitializing(false);
    let active = true;
    fetchInitialDashboardData({ ...params, userId })
      .then(() => {
        if (localStorage.getItem('habitflow_onboarded') !== 'true' && active) setShowOnboarding(true);
      })
      .catch((err) => console.error('Failed to initialize dashboard data:', err))
      .finally(() => { if (active) setIsInitializing(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId, isDataReady, isFitnessEnabled]);

  useTourAndOnboardingSync({ showOnboarding, setShowOnboarding, isInitializing, isEmpty, habitCount, goalCount, setShowTour });

  return { isInitializing, showOnboarding, setShowOnboarding, showTour, setShowTour };
}
