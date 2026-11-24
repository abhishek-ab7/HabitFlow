'use client';

// Force HMR refresh
import { useEffect, useState } from 'react';
import {
  Moon,
  Sun,
  Monitor,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Database,
  Palette,
  ShieldAlert,
  CloudCog,
  User,
  Lock,
  Save,
  Volume2,
  VolumeX,
  Vibrate,
  VibrateOff,
  Mail,
  BookOpen,
  HelpCircle,
  Layers,
  Check,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FadeIn } from '@/components/motion';
import { useTheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';
import { useSync } from '@/providers/sync-provider';
import { db, getSettings, updateSettings } from '@/lib/db';
import { cleanupAllDuplicates, countAllDuplicates } from '@/lib/cleanup';
import { forcePushAllHabits } from '@/lib/force-sync';
import { getSyncEngine } from '@/lib/sync';
import { getSupabaseClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { UserSettings } from '@/lib/types';
import {
  ACCENT_OVERRIDES,
  COLOR_THEMES,
  DEFAULT_ACCENT_OVERRIDE,
  DEFAULT_COLOR_THEME,
  getColorThemeById,
} from '@/lib/themes';
import { SyncStatusPanel } from '@/components/sync/SyncStatusPanel';
import { SettingsHero } from '@/components/settings/SettingsHero';
import { AvatarSelector } from '@/components/settings/AvatarSelector';
import { PasswordChangeModal } from '@/components/settings/password-change-modal';
import { DataVaultCard } from '@/components/settings/DataVaultCard';
import { McpConnectionsCard } from '@/components/settings/McpConnectionsCard';
import { useUserStore } from '@/lib/stores/user-store';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import type { Avatar } from '@/lib/avatars';

export default function SettingsPageContent() {
  const {
    theme,
    setTheme,
    resolvedTheme,
    colorTheme,
    setColorTheme,
    accentOverride,
    setAccentOverride,
    resetAppearance,
  } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const { isSyncing, isStoragePersistent } = useSync();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [duplicateCounts, setDuplicateCounts] = useState<{
    habits: number;
    goals: number;
    completions: number;
  } | null>(null);

  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const { displayName, email, setDisplayName, saveDisplayNameToServer, loadUser } = useUserStore();
  const { streakShield, loadGamification, setStreakShields } = useGamificationStore();

  const handleReplayTour = () => {
    localStorage.removeItem('habitflow_dashboard_tutorial_completed');
    toast.success('Tour reset! Redirecting to dashboard...');
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1000);
  };

  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) return;

      loadUser(); // Load user profile store
      loadGamification(); // Load settings & streak shields from DB

      let s = await getSettings(user.id);

      // Create default settings if none exist
      if (!s) {
        const defaultSettings: UserSettings = {
          id: crypto.randomUUID(),
          userId: user.id,
          theme: 'system',
          accent: 'mint',
          userName: '',
          weekStartsOn: 0,
          showMotivationalQuotes: true,
          defaultCategory: 'health',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          xp: 0,
          level: 1,
          gems: 0,
          streakShield: 0,
          avatarId: 'avatar-1',
          showTasks: true,
          showGoals: true,
          showMilestones: true,
          habitOnlyMode: false,
        };
        await db.userSettings.add(defaultSettings);
        s = defaultSettings;
      }

      setSettings(s);

      // Check for duplicates
      const counts = await countAllDuplicates();
      setDuplicateCounts(counts);
    };

    if (isAuthenticated) {
      loadSettings();
    }
  }, [user, isAuthenticated, loadUser, loadGamification]);

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
    if (settings && user?.id) {
      await updateSettings({ userId: user.id, avatarId: avatar.id });
      setSettings({ ...settings, avatarId: avatar.id });
      setShowAvatarSelector(false);
      toast.success('Avatar updated');
    }
  };

  const handleCleanupDuplicates = async () => {
    setIsCleaning(true);
    try {
      const removed = await cleanupAllDuplicates();
      const total = removed.habits + removed.goals + removed.completions;

      if (total > 0) {
        toast.success(
          `Cleaned up ${total} duplicate(s)`
        );
      } else {
        toast.success('No duplicates found!');
      }

      setDuplicateCounts({ habits: 0, goals: 0, completions: 0 });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error('Failed to cleanup duplicates');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleToggleSound = async () => {
    if (!settings || !user?.id) return;
    const newValue = !settings.soundEnabled;
    await updateSettings({ userId: user.id, soundEnabled: newValue });
    setSettings({ ...settings, soundEnabled: newValue });
    localStorage.setItem('feedback_settings', JSON.stringify({
      sound: newValue,
      haptics: settings.hapticsEnabled
    }));
    toast.success(newValue ? 'Sound enabled' : 'Sound disabled');
  };

  const handleToggleHaptics = async () => {
    if (!settings || !user?.id) return;
    const newValue = !settings.hapticsEnabled;
    await updateSettings({ userId: user.id, hapticsEnabled: newValue });
    setSettings({ ...settings, hapticsEnabled: newValue });
    localStorage.setItem('feedback_settings', JSON.stringify({
      sound: settings.soundEnabled,
      haptics: newValue
    }));
    toast.success(newValue ? 'Haptics enabled' : 'Haptics disabled');
  };

  const handleToggleSetting = async (key: keyof UserSettings) => {
    if (!settings || !user?.id) return;
    const newValue = settings[key] === undefined ? false : !settings[key];
    const { updateUserSettings } = useGamificationStore.getState();
    await updateUserSettings({ [key]: newValue });
    setSettings({ ...settings, [key]: newValue });
    toast.success("Workspace layout updated!");
  };

  const handleClearAllData = async () => {
    if (!user?.id) {
      toast.error('Not authenticated');
      return;
    }
    try {
      const { getSyncEngine } = await import('@/lib/sync');
      getSyncEngine().reset();

      const supabase = getSupabaseClient() as any;
      const uid = user.id;

      // 1. Clear remote Supabase data in parallel
      await Promise.all([
        supabase.from('habit_completions').delete().eq('user_id', uid),
        supabase.from('completions').delete().eq('user_id', uid),
        supabase.from('milestones').delete().eq('user_id', uid),
        supabase.from('tasks').delete().eq('user_id', uid),
        supabase.from('mood_logs').delete().eq('user_id', uid),
      ]);

      await supabase.from('habits').delete().eq('user_id', uid);
      await supabase.from('goals').delete().eq('user_id', uid);

      // 2. Reset settings in Supabase to defaults rather than deleting the row
      await supabase.from('user_settings').update({
        user_name: user.user_metadata?.full_name || 'Anonymous',
        avatar_id: 'avatar-1',
        week_start_day: 0,
        default_category: 'health',
        xp: 0,
        level: 1,
        gems: 0,
        streak_shield: 0,
        stats: {
          vitality: 1,
          intelligence: 1,
          discipline: 1,
          charisma: 1,
          wealth: 1,
          creativity: 1,
        },
        unlocked_themes: [],
        motivation_text: '',
        dashboard_layout: [],
        updated_at: new Date().toISOString(),
      } as any).eq('user_id', uid);

      // 3. Clear all local Dexie DB tables
      await db.habits.clear();
      await db.completions.clear();
      await db.goals.clear();
      await db.milestones.clear();
      await db.tasks.clear();
      await db.userSettings.clear();
      await db.moodLogs.clear();

      // 5. Add default settings locally to ensure hydration sync on reload starts fresh
      const defaultSettings = {
        id: crypto.randomUUID(),
        userId: uid,
        theme: 'system',
        accent: 'mint',
        userName: user.user_metadata?.full_name || 'Anonymous',
        weekStartsOn: 0,
        showMotivationalQuotes: true,
        defaultCategory: 'health',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        xp: 0,
        level: 1,
        gems: 0,
        streakShield: 0,
        avatarId: 'avatar-1',
        showTasks: true,
        showGoals: true,
        showMilestones: true,
        habitOnlyMode: false,
        stats: {
          vitality: 1,
          intelligence: 1,
          discipline: 1,
          charisma: 1,
          wealth: 1,
          creativity: 1,
        },
        unlockedThemes: [],
        motivation_text: '',
        dashboardLayout: [],
      };
      await db.userSettings.add(defaultSettings as any);

      // 6. Delete all cached local storage keys related to habitflow, onboarding, and focus modes
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('habitflow_') || 
          key.startsWith('focus_mode_') || 
          key.startsWith('sync_version_') ||
          key === 'habit_sync_pending'
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

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
      if (result.failed > 0) {
        toast.warning(`${result.failed} habits failed to sync`);
      }
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

  if (!settings) {
    return (
      <div className="w-full px-4 py-8 md:px-6 max-w-6xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse space-y-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted mx-auto" />
          <div className="h-4 w-32 bg-muted rounded mx-auto" />
          <span className="text-muted-foreground text-sm">Loading Profile...</span>
        </div>
      </div>
    );
  }

  const hasDuplicates =
    duplicateCounts &&
    (duplicateCounts.habits > 0 || duplicateCounts.goals > 0 || duplicateCounts.completions > 0);
  const showDevTools = isAuthenticated && process.env.NODE_ENV === 'development';

  return (
    <div className="w-full relative min-h-screen px-4 py-6 md:px-6 md:py-8 max-w-6xl mx-auto">
      <FadeIn className="space-y-6">
        {/* HERO */}
        <SettingsHero
          avatarId={settings.avatarId || 'avatar-1'}
          streakShield={streakShield}
          onAvatarClick={() => setShowAvatarSelector(true)}
          onRefillShields={async () => {
            await setStreakShields(3);
            toast.success('Streak shields refilled to 3!');
          }}
        />

        {/* MAIN TWO-RAIL SETTINGS WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT RAIL (Primary Identity + Appearance) */}
          <div className="lg:col-span-8 flex flex-col gap-6 min-w-0">
            {/* ACCOUNT & SECURITY */}
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start gap-3 pb-5 border-b border-border">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground tracking-tight">
                    Account &amp; Security
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manage your profile details and password
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-5">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Email Address
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="flex items-center h-10 w-full rounded-xl border border-border bg-muted/40 pl-9 pr-3 text-sm text-foreground/85 font-medium cursor-not-allowed">
                      <span className="truncate">{email || user?.email || 'No email linked'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Full Name
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1 min-w-0">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                        <User className="h-4 w-4" />
                      </div>
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your full name"
                        className="h-10 pl-9 rounded-xl border-border bg-background focus:bg-background transition-all focus:ring-2 focus:ring-ring/30"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveDisplayName();
                          }
                        }}
                      />
                    </div>
                    <Button
                      onClick={handleSaveDisplayName}
                      className="h-10 px-4 rounded-xl font-medium whitespace-nowrap shrink-0"
                    >
                      <Save className="h-4 w-4 mr-1.5" />
                      Save
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-5 border-t border-border">
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-success shrink-0" />
                  <span>Account credentials active</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="h-9 px-3.5 rounded-lg text-xs font-medium whitespace-nowrap"
                >
                  <Lock className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Change Password
                </Button>
              </div>
            </section>

            {/* APPEARANCE */}
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start gap-3 pb-5 border-b border-border">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Palette className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground tracking-tight">
                    Appearance
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Customize surface brightness, theme palette, and accent color
                  </p>
                </div>
              </div>

              {(() => {
                const activeMode = mounted ? theme : 'system';
                const activeResolved = mounted ? resolvedTheme : 'light';
                const activeColorTheme = mounted ? colorTheme : DEFAULT_COLOR_THEME;
                const activeAccentOverride = mounted ? accentOverride : DEFAULT_ACCENT_OVERRIDE;
                const activeThemeMeta = getColorThemeById(activeColorTheme);
                const activeThemePreview =
                  activeResolved === 'dark'
                    ? activeThemeMeta.darkPreview
                    : activeThemeMeta.lightPreview;
                const isCustomized =
                  mounted &&
                  (activeColorTheme !== DEFAULT_COLOR_THEME ||
                    activeAccentOverride !== DEFAULT_ACCENT_OVERRIDE);

                return (
                  <div className="space-y-5 pt-5">
                    {/* 1. Surface Mode Segmented Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Surface Mode
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {activeMode === 'system'
                            ? `Following OS (${activeResolved === 'dark' ? 'Dark' : 'Light'})`
                            : activeMode === 'dark'
                            ? 'Dark surface'
                            : 'Light surface'}
                        </span>
                      </div>
                      <div
                        role="radiogroup"
                        aria-label="Surface mode"
                        className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60"
                      >
                        {(
                          [
                            { value: 'light', icon: Sun, label: 'Light' },
                            { value: 'dark', icon: Moon, label: 'Dark' },
                            { value: 'system', icon: Monitor, label: 'System' },
                          ] as const
                        ).map((opt) => {
                          const isSelected = activeMode === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => setTheme(opt.value)}
                              className={cn(
                                'min-h-[38px] px-3 py-1.5 rounded-lg flex items-center justify-center gap-2 text-xs font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
                                isSelected
                                  ? 'bg-card text-foreground shadow-xs border border-border'
                                  : 'text-muted-foreground hover:text-foreground border border-transparent'
                              )}
                            >
                              <opt.icon className="w-3.5 h-3.5 shrink-0" />
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Theme Palette Gallery */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Theme Palette
                        </span>
                        <span className="text-xs font-medium text-foreground">
                          {activeThemeMeta.name}
                        </span>
                      </div>
                      <div
                        role="radiogroup"
                        aria-label="Theme palette"
                        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                      >
                        {COLOR_THEMES.map((item) => {
                          const isSelected = activeColorTheme === item.id;
                          const preview =
                            activeResolved === 'dark' ? item.darkPreview : item.lightPreview;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => setColorTheme(item.id)}
                              className={cn(
                                'group relative flex flex-col text-left rounded-xl overflow-hidden border transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]',
                                isSelected
                                  ? 'border-primary ring-1 ring-primary/30 shadow-xs'
                                  : 'border-border hover:border-foreground/25'
                              )}
                            >
                              <div
                                className="w-full p-2.5 border-b"
                                style={{
                                  backgroundColor: preview.bg,
                                  borderColor: preview.border,
                                }}
                                aria-hidden="true"
                              >
                                <div
                                  className="rounded-lg p-2 space-y-2 border"
                                  style={{
                                    backgroundColor: preview.card,
                                    borderColor: preview.border,
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div
                                      className="h-1.5 w-12 rounded-sm opacity-35"
                                      style={{
                                        backgroundColor:
                                          activeResolved === 'dark' ? '#e5e7eb' : '#1f2937',
                                      }}
                                    />
                                    <span
                                      className="w-2 h-2 rounded-sm shrink-0"
                                      style={{ backgroundColor: preview.secondary }}
                                    />
                                  </div>

                                  <div
                                    className="h-1.5 w-full rounded-sm overflow-hidden"
                                    style={{ backgroundColor: preview.border }}
                                  >
                                    <div
                                      className="h-full w-2/3 rounded-sm"
                                      style={{ backgroundColor: preview.primary }}
                                    />
                                  </div>

                                  <div className="flex items-center justify-between gap-2 pt-0.5">
                                    <span
                                      className="h-2.5 w-9 rounded-sm"
                                      style={{ backgroundColor: preview.primary }}
                                    />
                                    <span
                                      className="h-1.5 w-6 rounded-sm opacity-60"
                                      style={{ backgroundColor: preview.secondary }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="p-2.5 bg-card flex items-start justify-between gap-2 flex-1">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-foreground leading-snug truncate">
                                    {item.name}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-1">
                                    {item.tagline}
                                  </p>
                                </div>
                                {isSelected && (
                                  <span className="w-4 h-4 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3. Accent Color Override Row */}
                    <div className="space-y-2.5 pt-4 border-t border-border">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Accent Color Override
                        </span>
                        {isCustomized && (
                          <button
                            type="button"
                            onClick={resetAppearance}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1 hover:bg-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>

                      <div
                        role="radiogroup"
                        aria-label="Accent color override"
                        className="flex flex-wrap items-center gap-2"
                      >
                        {ACCENT_OVERRIDES.map((item) => {
                          const isSelected = activeAccentOverride === item.id;
                          const swatchColor =
                            activeResolved === 'dark' ? item.swatchDark : item.swatchLight;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => setAccentOverride(item.id)}
                              title={item.label}
                              className={cn(
                                'min-h-[36px] pl-2 pr-3 py-1.5 rounded-lg inline-flex items-center gap-2 border text-xs font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
                                isSelected
                                  ? 'border-primary bg-primary/10 text-foreground'
                                  : 'border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {item.id === 'theme' ? (
                                <span
                                  className="relative flex items-center justify-center w-3.5 h-3.5 rounded-sm overflow-hidden border border-border/80 shrink-0"
                                  aria-hidden="true"
                                >
                                  <span
                                    className="w-1/2 h-full"
                                    style={{ backgroundColor: activeThemePreview.primary }}
                                  />
                                  <span
                                    className="w-1/2 h-full"
                                    style={{ backgroundColor: activeThemePreview.secondary }}
                                  />
                                </span>
                              ) : (
                                <span
                                  className="relative flex items-center justify-center w-3.5 h-3.5 rounded-sm border border-black/15 dark:border-white/20 shrink-0"
                                  style={{ backgroundColor: swatchColor }}
                                  aria-hidden="true"
                                >
                                  {isSelected && (
                                    <Check
                                      className={cn(
                                        'w-2.5 h-2.5 stroke-[3]',
                                        item.id === 'ink' && activeResolved === 'dark'
                                          ? 'text-zinc-950'
                                          : 'text-white'
                                      )}
                                    />
                                  )}
                                </span>
                              )}
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. Non-interactive Theme Token Preview */}
                    <div
                      aria-label="Theme color preview"
                      className="rounded-xl bg-background border border-border p-3 space-y-2 select-none pointer-events-none"
                    >
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        <span>Palette Preview</span>
                        <span>Sample only</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-xs">
                            <span className="w-3.5 h-3.5 rounded bg-success/15 text-success flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                            </span>
                            <span className="font-medium text-foreground">Streak</span>
                            <span className="font-mono tabular-nums text-muted-foreground">5/6</span>
                          </div>

                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-xs">
                            <span className="text-muted-foreground">Surface</span>
                            <span className="font-mono font-semibold tabular-nums text-foreground">
                              ₹420
                            </span>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium whitespace-nowrap">
                          <span>Primary Accent</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>
          </div>

          {/* RIGHT RAIL (Cloud Sync, Workspace Modules, Sensory Feedback, Data Vault) */}
          <div className="lg:col-span-4 flex flex-col gap-6 min-w-0">
            {/* CLOUD SYNC */}
            {isAuthenticated && (
              <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <CloudCog className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-foreground tracking-tight">
                        Cloud Sync
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        {isSyncing ? 'Syncing local changes...' : 'Supabase background sync'}
                      </p>
                    </div>
                  </div>
                </div>
                <SyncStatusPanel />
              </section>
            )}

            {/* WORKSPACE MODULES */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-border">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground tracking-tight">
                    Workspace Modules
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Configure active Life OS sections
                  </p>
                </div>
              </div>

              <div className="divide-y divide-border">
                <div className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">Habit-Only Mode</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Focused habit tracker view
                    </p>
                  </div>
                  <Button
                    variant={settings.habitOnlyMode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleSetting('habitOnlyMode')}
                    className="h-8 px-3 text-xs font-medium whitespace-nowrap shrink-0"
                  >
                    {settings.habitOnlyMode ? 'Active' : 'Off'}
                  </Button>
                </div>

                <div
                  className={cn(
                    'flex items-center justify-between gap-3 py-3 transition-opacity',
                    settings.habitOnlyMode && 'opacity-45 pointer-events-none'
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">Tasks Module</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Checklists &amp; daily tasks
                    </p>
                  </div>
                  <Button
                    variant={settings.showTasks !== false ? 'default' : 'outline'}
                    size="sm"
                    disabled={!!settings.habitOnlyMode}
                    onClick={() => handleToggleSetting('showTasks')}
                    className="h-8 px-3 text-xs font-medium whitespace-nowrap shrink-0"
                  >
                    {settings.showTasks !== false ? 'Enabled' : 'Hidden'}
                  </Button>
                </div>

                <div
                  className={cn(
                    'flex items-center justify-between gap-3 pt-3 transition-opacity',
                    settings.habitOnlyMode && 'opacity-45 pointer-events-none'
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      Goals &amp; Milestones
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Long-term SMART targets
                    </p>
                  </div>
                  <Button
                    variant={settings.showGoals !== false ? 'default' : 'outline'}
                    size="sm"
                    disabled={!!settings.habitOnlyMode}
                    onClick={() => handleToggleSetting('showGoals')}
                    className="h-8 px-3 text-xs font-medium whitespace-nowrap shrink-0"
                  >
                    {settings.showGoals !== false ? 'Enabled' : 'Hidden'}
                  </Button>
                </div>
              </div>
            </section>

            {/* SENSORY FEEDBACK */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-border">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Volume2 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground tracking-tight">
                    Sensory Feedback
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Audio and tactile responses
                  </p>
                </div>
              </div>

              <div className="divide-y divide-border">
                <div className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        'p-1.5 rounded-lg shrink-0',
                        settings.soundEnabled
                          ? 'bg-primary/12 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {settings.soundEnabled ? (
                        <Volume2 className="w-3.5 h-3.5" />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">Sound Effects</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        Pops and completion chimes
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={settings.soundEnabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={handleToggleSound}
                    className="h-8 px-3 text-xs font-medium whitespace-nowrap shrink-0"
                  >
                    {settings.soundEnabled ? 'On' : 'Off'}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        'p-1.5 rounded-lg shrink-0',
                        settings.hapticsEnabled
                          ? 'bg-primary/12 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {settings.hapticsEnabled ? (
                        <Vibrate className="w-3.5 h-3.5" />
                      ) : (
                        <VibrateOff className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">Haptics</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        Subtle vibration on tap
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={settings.hapticsEnabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={handleToggleHaptics}
                    className="h-8 px-3 text-xs font-medium whitespace-nowrap shrink-0"
                  >
                    {settings.hapticsEnabled ? 'On' : 'Off'}
                  </Button>
                </div>
              </div>
            </section>

            {/* DATA VAULT */}
            <DataVaultCard
              isStoragePersistent={!!isStoragePersistent}
              hasDuplicates={!!hasDuplicates}
              duplicateCounts={duplicateCounts || { habits: 0, goals: 0 }}
              handleCleanupDuplicates={handleCleanupDuplicates}
              isCleaning={isCleaning}
            />

            {/* MODEL CONTEXT PROTOCOL (MCP) CONNECTIONS */}
            <McpConnectionsCard />
          </div>
        </div>

        {/* BOTTOM UTILITY ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* HELP & GUIDES */}
          <section
            className={cn(
              'rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4',
              showDevTools ? 'lg:col-span-5' : 'lg:col-span-6'
            )}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <HelpCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground tracking-tight">
                  Help &amp; Guides
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Replay the guided tour or explore the platform reference.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReplayTour}
                className="h-9 px-3 text-xs gap-1.5 whitespace-nowrap"
                title="Restart Guided Tour"
              >
                <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                <span>Replay Tour</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-9 px-3 text-xs gap-1.5 whitespace-nowrap"
              >
                <Link href="/tutorial">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span>Help Guides</span>
                </Link>
              </Button>
            </div>
          </section>

          {/* DEBUG TOOLS (DEV ONLY) */}
          {showDevTools && (
            <section className="lg:col-span-3 rounded-2xl border border-border bg-card p-5 flex flex-col justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground tracking-tight">
                  Developer Sync
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manual cloud override actions
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleForcePush}
                  disabled={isForceSyncing}
                  className="h-9 px-2.5 text-xs gap-1.5 whitespace-nowrap"
                  title="Overwrite Cloud Data"
                >
                  <Upload className="h-3.5 w-3.5 shrink-0" />
                  <span>Push</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleForcePull}
                  disabled={isForceSyncing}
                  className="h-9 px-2.5 text-xs gap-1.5 whitespace-nowrap"
                  title="Overwrite Local Data"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  <span>Pull</span>
                </Button>
              </div>
            </section>
          )}

          {/* DANGER ZONE */}
          <section
            className={cn(
              'rounded-2xl border border-destructive/25 bg-destructive/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4',
              showDevTools ? 'lg:col-span-4' : 'lg:col-span-6'
            )}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-destructive/15 text-destructive shrink-0">
                <Trash2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground tracking-tight">
                  Danger Zone
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permanently clear local habits, goals, and synced workspace data.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowClearDataDialog(true)}
              className="h-9 px-4 text-xs font-medium whitespace-nowrap shrink-0"
            >
              Reset All
            </Button>
          </section>
        </div>
      </FadeIn>

      <AvatarSelector
        open={showAvatarSelector}
        onOpenChange={setShowAvatarSelector}
        selectedAvatarId={settings.avatarId}
        onSelect={handleUpdateAvatar}
      />

      <ConfirmDialog
        open={showClearDataDialog}
        onOpenChange={setShowClearDataDialog}
        title="Clear All Data?"
        description="This will permanently delete all local habits, completions, and goals. This action cannot be undone."
        confirmLabel="Clear All Data"
        variant="destructive"
        onConfirm={handleClearAllData}
      />

      <PasswordChangeModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
}
