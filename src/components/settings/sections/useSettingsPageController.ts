'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';
import { useSync } from '@/providers/sync-provider';
import { db, getSettings, updateSettings } from '@/lib/db';
import { setSensoryPreferences, syncSensoryPrefsFromSettings } from '@/lib/feedback/sensory-engine';
import { useFeedback } from '@/hooks/use-feedback';
import { cleanupAllDuplicates, countAllDuplicates } from '@/lib/cleanup';
import { forcePushAllHabits } from '@/lib/force-sync';
import { getSyncEngine } from '@/lib/sync';
import { useUserStore } from '@/lib/stores/user-store';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import type { Avatar } from '@/lib/avatars';
import type { UserSettings } from '@/lib/types';
import { buildDefaultUserSettings, clearAllWorkspaceData } from './settings-reset-helpers';

const TOUR_STORAGE_KEYS = [
  'habitflow_dashboard_tutorial_completed',
  'habitflow_tour_dashboard_completed',
  'habitflow_tour_habits_completed',
  'habitflow_tour_tasks_completed',
  'habitflow_tour_goals_completed',
  'habitflow_tour_finance_completed',
  'habitflow_tour_fitness_completed',
];

const TOGGLE_FEEDBACK_MESSAGES: Partial<Record<keyof UserSettings, [string, string]>> = {
  showFitness: ['Body & Fitness turned on', 'Body & Fitness turned off'],
  showFinance: ['Personal Finance turned on', 'Personal Finance turned off'],
};

export function useSettingsPageController() {
  const themeCtx = useTheme();
  const { isAuthenticated, user } = useAuth();
  const { isSyncing, isStoragePersistent } = useSync();
  const feedback = useFeedback();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [duplicateCounts, setDuplicateCounts] = useState<{ habits: number; goals: number; completions: number } | null>(null);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const { displayName, email, setDisplayName, saveDisplayNameToServer, loadUser } = useUserStore();
  const { streakShield, loadGamification, setStreakShields, updateUserSettings } = useGamificationStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    const loadSettings = async () => {
      loadUser();
      loadGamification();
      let s = await getSettings(user.id);
      if (!s) {
        s = buildDefaultUserSettings(user.id);
        await db.userSettings.add(s);
      }
      syncSensoryPrefsFromSettings(s);
      setSettings(s);
      setDuplicateCounts(await countAllDuplicates());
    };
    void loadSettings();
  }, [user, isAuthenticated, loadUser, loadGamification]);

  const handleResetAllTours = () => {
    for (const key of TOUR_STORAGE_KEYS) localStorage.removeItem(key);
    toast.success('All page tours reset! You will see guided walkthroughs on each section.');
  };

  const handleReplaySpecificTour = (params: { tourKey: string; path: string }) => {
    localStorage.removeItem(`habitflow_tour_${params.tourKey}_completed`);
    if (params.tourKey === 'dashboard') localStorage.removeItem('habitflow_dashboard_tutorial_completed');
    toast.success(`Reset ${params.tourKey} tour! Redirecting...`);
    setTimeout(() => { window.location.href = params.path; }, 400);
  };

  const handleSaveDisplayName = async () => {
    try {
      await saveDisplayNameToServer();
      toast.success('Display name saved');
    } catch (error) {
      console.error('Failed to save display name:', error);
      toast.error('Failed to save display name');
    }
  };

  const handleUpdateAvatar = async (avatar: Avatar) => {
    if (!settings || !user?.id) return;
    await updateSettings({ userId: user.id, avatarId: avatar.id });
    setSettings({ ...settings, avatarId: avatar.id });
    setShowAvatarSelector(false);
    toast.success('Avatar updated');
  };

  const handleCleanupDuplicates = async () => {
    setIsCleaning(true);
    try {
      const removed = await cleanupAllDuplicates();
      const total = removed.habits + removed.goals + removed.completions;
      toast.success(total > 0 ? `Cleaned up ${total} duplicate(s)` : 'No duplicates found!');
      setDuplicateCounts({ habits: 0, goals: 0, completions: 0 });
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error('Failed to cleanup duplicates');
    } finally {
      setIsCleaning(false);
    }
  };

  const toggleSensoryOption = async (params: {
    key: 'soundEnabled' | 'hapticsEnabled';
    label: string;
    onEnable: () => void;
  }) => {
    if (!settings || !user?.id) return;
    const newValue = settings[params.key] === false;
    setSensoryPreferences({ [params.key]: newValue });
    if (newValue) params.onEnable();
    setSettings({ ...settings, [params.key]: newValue });
    await updateUserSettings({ [params.key]: newValue });
    toast.success(`${params.label} ${newValue ? 'enabled' : 'disabled'}`);
  };

  const handleToggleSound = () =>
    toggleSensoryOption({
      key: 'soundEnabled',
      label: 'Sound',
      onEnable: () => {
        feedback.unlockAudio();
        feedback.toggle(true);
      },
    });

  const handleToggleHaptics = () =>
    toggleSensoryOption({
      key: 'hapticsEnabled',
      label: 'Haptics',
      onEnable: () => feedback.haptic('toggle'),
    });

  const handleToggleSetting = async (key: keyof UserSettings) => {
    if (!settings || !user?.id) return;
    const newValue = settings[key] === undefined ? false : !settings[key];
    await useGamificationStore.getState().updateUserSettings({ [key]: newValue });
    setSettings({ ...settings, [key]: newValue });
    const msgPair = TOGGLE_FEEDBACK_MESSAGES[key];
    toast.success(msgPair ? (newValue ? msgPair[0] : msgPair[1]) : 'Workspace layout updated!');
  };

  const handleClearAllData = async () => {
    if (!user?.id) return void toast.error('Not authenticated');
    try {
      await clearAllWorkspaceData({ userId: user.id, fullName: user.user_metadata?.full_name });
      toast.success('All data permanently deleted. Refreshing...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Failed to clear data:', error);
      toast.error('Failed to clear data: ' + (error as Error).message);
    }
  };

  const handleForcePush = async () => {
    setIsForceSyncing(true);
    try {
      const result = await forcePushAllHabits();
      toast.success(`Pushed ${result.success}/${result.total} habits to cloud`);
      if (result.failed > 0) toast.warning(`${result.failed} habits failed to sync`);
    } catch (error) {
      toast.error('Force push failed: ' + (error as Error).message);
    } finally {
      setIsForceSyncing(false);
    }
  };

  const handleForcePull = async () => {
    setIsForceSyncing(true);
    try {
      await getSyncEngine().syncAll();
      toast.success('Synced all data (Tasks, Goals, Habits) from cloud. Refreshing...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Force pull failed:', error);
      toast.error('Force pull failed: ' + (error as Error).message);
    } finally {
      setIsForceSyncing(false);
    }
  };

  const handleRefillShields = async () => {
    await setStreakShields(3);
    toast.success('Streak shields refilled to 3!');
  };

  return {
    ...themeCtx,
    isAuthenticated, user, isSyncing, isStoragePersistent,
    settings, mounted, duplicateCounts, isCleaning, isForceSyncing,
    showAvatarSelector, setShowAvatarSelector,
    showClearDataDialog, setShowClearDataDialog,
    isPasswordModalOpen, setIsPasswordModalOpen,
    displayName, email, setDisplayName, streakShield,
    handleResetAllTours, handleReplaySpecificTour, handleSaveDisplayName,
    handleUpdateAvatar, handleCleanupDuplicates, handleToggleSound,
    handleToggleHaptics, handleToggleSetting, handleClearAllData,
    handleForcePush, handleForcePull, handleRefillShields,
  };
}
