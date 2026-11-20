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
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid';
import { SyncStatusPanel } from '@/components/sync/SyncStatusPanel';
import { SettingsHero } from '@/components/settings/SettingsHero';
import { AvatarSelector } from '@/components/settings/AvatarSelector';
import { PasswordChangeModal } from '@/components/settings/password-change-modal';
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
  const [isExporting, setIsExporting] = useState(false);
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

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const habits = await db.habits.toArray();
      const completions = await db.completions.toArray();
      const goals = await db.goals.toArray();
      const milestones = await db.milestones.toArray();
      const settingsData = await db.userSettings.toArray();

      const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        habits,
        completions,
        goals,
        milestones,
        settings: settingsData,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `habit-flow-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSVData = async () => {
    setIsExporting(true);
    try {
      const habits = await db.habits.toArray();
      const completions = await db.completions.toArray();

      const habitMap = new Map(habits.map(h => [h.id, h]));
      const headers = ['Date', 'Habit Name', 'Category', 'Target Value', 'Logged Value', 'Unit', 'Status', 'Completed', 'Notes'];

      const rows = completions.map(c => {
        const habit = habitMap.get(c.habitId);
        const habitName = habit ? habit.name : 'Unknown Habit';
        const category = habit ? habit.category : 'N/A';
        const targetValue = habit && habit.isQuantitative ? habit.targetValue || 0 : 'N/A';
        const loggedValue = habit && habit.isQuantitative ? c.value || 0 : 'N/A';
        const unit = habit && habit.isQuantitative ? habit.unit || '' : 'N/A';
        const status = c.status || (c.completed ? 'completed' : 'missed');
        const completedStr = c.completed ? 'TRUE' : 'FALSE';
        const noteStr = c.note || '';

        const escapeCSVField = (val: any) => {
          const stringified = String(val);
          if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
            return `"${stringified.replace(/"/g, '""')}"`;
          }
          return stringified;
        };

        return [
          escapeCSVField(c.date),
          escapeCSVField(habitName),
          escapeCSVField(category),
          escapeCSVField(targetValue),
          escapeCSVField(loggedValue),
          escapeCSVField(unit),
          escapeCSVField(status),
          escapeCSVField(completedStr),
          escapeCSVField(noteStr)
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `habit-flow-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('CSV Data exported successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to export CSV data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.version || !data.habits) {
        throw new Error('Invalid backup file');
      }

      await db.habits.clear();
      await db.completions.clear();
      await db.goals.clear();
      await db.milestones.clear();

      if (data.habits?.length) await db.habits.bulkAdd(data.habits);
      if (data.completions?.length) await db.completions.bulkAdd(data.completions);
      if (data.goals?.length) await db.goals.bulkAdd(data.goals);
      if (data.milestones?.length) await db.milestones.bulkAdd(data.milestones);

      toast.success('Data imported successfully. Refreshing...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error('Failed to import data');
    }
    event.target.value = '';
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
      <div className="w-full px-4 py-8 max-w-[1600px] mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto" />
          <div className="h-4 w-32 bg-muted rounded mx-auto" />
          <span className="text-muted-foreground">Loading Profile...</span>
        </div>
      </div>
    );
  }

  const hasDuplicates = duplicateCounts && (duplicateCounts.habits > 0 || duplicateCounts.goals > 0 || duplicateCounts.completions > 0);

  return (
    <div className="w-full relative min-h-screen px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-8">
      <FadeIn>
        {/* HERO */}
        <SettingsHero
          avatarId={settings.avatarId || 'avatar-1'}
          streakShield={streakShield}
          onAvatarClick={() => setShowAvatarSelector(true)}
          onRefillShields={async () => {
            await setStreakShields(3);
            toast.success('Streak shields refilled to 3!');
          }}
          className="mb-8"
        />

        <BentoGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:auto-rows-auto">
          {/* ACCOUNT */}
          <BentoGridItem
            title="Account & Security"
            icon={<User className="h-5 w-5 text-primary" />}
            span={2}
            className="md:col-span-2"
            description="Manage your profile and security preferences"
            disableHover
          >
            <div className="flex flex-col gap-6 mt-6 pb-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</Label>
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-hover:text-foreground transition-colors">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="flex items-center h-11 w-full rounded-xl border border-border bg-muted/40 px-10 text-sm text-foreground/85 font-medium cursor-not-allowed">
                      <span className="truncate">{email || user?.email || 'No email linked'}</span>
                    </div>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="h-2 w-2 rounded-full bg-success" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</Label>
                  <div className="flex gap-2">
                    <div className="relative group flex-1">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                        <User className="h-4 w-4" />
                      </div>
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your full name"
                        className="h-11 pl-10 rounded-xl border-border bg-background focus:bg-background transition-all focus:ring-2 focus:ring-ring/30"
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
                      className="h-11 px-6 rounded-xl font-medium tracking-wide"
                    >
                      <Save className="h-4 w-4 mr-2 stroke-[2.5]" />
                      Save
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-border mt-4">
                <div className="text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-success" />
                    Account is secure
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="h-9 px-4 rounded-lg text-xs font-medium"
                >
                  <Lock className="h-3.5 w-3.5 mr-2 text-primary" />
                  Change Password
                </Button>
              </div>
            </div>
          </BentoGridItem>

          {/* DATA VAULT */}
          <BentoGridItem
            title="Data Vault"
            icon={<Database className="h-5 w-5 text-emerald-500" />}
            span={1}
            description="Manage local backups"
            className="md:col-span-1"
            disableHover
          >
            <div className="flex flex-col gap-3 mt-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="w-full justify-center gap-1.5 h-9 px-2 text-xs border-dashed border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/50"
                  title="Backup to JSON"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  <span>JSON Backup</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSVData}
                  disabled={isExporting}
                  className="w-full justify-center gap-1.5 h-9 px-2 text-xs border-dashed border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/50"
                  title="Export to CSV"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  <span>CSV Export</span>
                </Button>
              </div>

              <div className="relative w-full">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center gap-1.5 h-9 px-2 text-xs border-dashed border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/50"
                  title="Restore from JSON"
                >
                  <Upload className="h-3.5 w-3.5 shrink-0" />
                  <span>Restore JSON</span>
                </Button>
              </div>

              {hasDuplicates && (
                <div className="mt-8 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-600">
                    <ShieldAlert className="w-3 h-3 shrink-0" />
                    <span className="truncate">{duplicateCounts.habits + duplicateCounts.goals} duplicates found</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={handleCleanupDuplicates} disabled={isCleaning} className="h-7 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 w-full">
                    Fix Now
                  </Button>
                </div>
              )}

              {/* Storage Protection active badge */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/40 mt-1">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate">Storage Protection</span>
                  <span className="text-[10px] text-muted-foreground truncate">WebKit eviction prevention</span>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5", 
                    isStoragePersistent 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  )}
                >
                  {isStoragePersistent ? "Active" : "Standard"}
                </Badge>
              </div>
            </div>
          </BentoGridItem>

          {/* APPEARANCE */}
          <BentoGridItem
            title="Appearance"
            icon={<Palette className="h-5 w-5 text-primary" />}
            span={2}
            className="md:col-span-2"
            description="Customize surface brightness, theme palette, and accent color"
            disableHover
          >
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
                <div className="space-y-5 mt-4">
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
                              'min-h-[40px] px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-xs font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
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

                  {/* 2. Theme Palette Gallery (2-col mobile, 3-col desktop) */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Theme Palette
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {activeThemeMeta.name}
                      </span>
                    </div>
                    <div
                      role="radiogroup"
                      aria-label="Theme palette"
                      className="grid grid-cols-2 md:grid-cols-3 gap-3"
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
                            {/* Top Half: Miniature Live App Preview */}
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
                                {/* Mini top row: bar + secondary chart dot */}
                                <div className="flex items-center justify-between gap-2">
                                  <div
                                    className="h-1.5 w-12 rounded-full opacity-35"
                                    style={{
                                      backgroundColor:
                                        activeResolved === 'dark' ? '#e5e7eb' : '#1f2937',
                                    }}
                                  />
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: preview.secondary }}
                                  />
                                </div>

                                {/* Mini progress bar */}
                                <div
                                  className="h-1.5 w-full rounded-full overflow-hidden"
                                  style={{ backgroundColor: preview.border }}
                                >
                                  <div
                                    className="h-full w-2/3 rounded-full"
                                    style={{ backgroundColor: preview.primary }}
                                  />
                                </div>

                                {/* Mini primary accent pill + subtle secondary line */}
                                <div className="flex items-center justify-between gap-2 pt-0.5">
                                  <span
                                    className="h-3 w-10 rounded-md"
                                    style={{ backgroundColor: preview.primary }}
                                  />
                                  <span
                                    className="h-1.5 w-6 rounded-full opacity-60"
                                    style={{ backgroundColor: preview.secondary }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Bottom Half: Name, Tagline & Checkmark */}
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
                                <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Optional Accent Color Override Row */}
                  <div className="space-y-2.5 pt-1 border-t border-border/60">
                    <div className="flex items-center justify-between gap-2 pt-3">
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
                              'min-h-[38px] pl-2 pr-3 py-1.5 rounded-full inline-flex items-center gap-2 border text-xs font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
                              isSelected
                                ? 'border-primary bg-accent/60 text-foreground'
                                : 'border-border bg-muted/35 hover:bg-muted/70 text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {item.id === 'theme' ? (
                              <span
                                className="relative flex items-center justify-center w-4 h-4 rounded-full overflow-hidden border border-border/80 shrink-0"
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
                                className="relative flex items-center justify-center w-4 h-4 rounded-full border border-black/15 dark:border-white/20 shrink-0"
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

                  {/* 4. Live Mini Preview Strip */}
                  <div
                    aria-label="Live theme preview"
                    className="rounded-xl bg-background border border-border p-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-xs">
                        <span className="w-4 h-4 rounded-md bg-success/15 text-success flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[2.5]" />
                        </span>
                        <span className="font-medium text-foreground">Gym</span>
                        <span aria-hidden="true" className="text-muted-foreground">·</span>
                        <span className="font-mono tabular-nums text-muted-foreground">5/6 wk</span>
                      </div>

                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs">
                        <span className="text-muted-foreground">Safe today:</span>
                        <span className="font-mono font-semibold tabular-nums text-foreground">
                          ₹420
                        </span>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium shadow-xs select-none whitespace-nowrap">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Entry</span>
                    </span>
                  </div>
                </div>
              );
            })()}
          </BentoGridItem>

          {/* SENSORY FEEDBACK */}
          <BentoGridItem
            title="Sensory Feedback"
            icon={<Volume2 className="h-5 w-5 text-primary" />}
            span={1}
            className="md:col-span-1"
            disableHover
          >
            <div className="flex flex-col gap-3 mt-4">
              <div className="flex items-center justify-between p-3 surface-subtle">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", settings.soundEnabled ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground")}>
                    {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">Sound Effects</span>
                    <span className="text-[10px] text-muted-foreground">Pops and chimes</span>
                  </div>
                </div>
                <Button 
                  variant={settings.soundEnabled ? "default" : "outline"} 
                  size="sm" 
                  onClick={handleToggleSound}
                  className="h-8 px-3 text-xs"
                >
                  {settings.soundEnabled ? "On" : "Off"}
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 surface-subtle">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", settings.hapticsEnabled ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground")}>
                    {settings.hapticsEnabled ? <Vibrate className="w-4 h-4" /> : <VibrateOff className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">Haptics</span>
                    <span className="text-[10px] text-muted-foreground">Vibrations on complete</span>
                  </div>
                </div>
                <Button 
                  variant={settings.hapticsEnabled ? "default" : "outline"} 
                  size="sm" 
                  onClick={handleToggleHaptics}
                  className="h-8 px-3 text-xs"
                >
                  {settings.hapticsEnabled ? "On" : "Off"}
                </Button>
              </div>
            </div>
          </BentoGridItem>

          {/* CLOUD SYNC */}
          {isAuthenticated && (
            <BentoGridItem
              span={2}
              title={
                <div className="flex items-center gap-2">
                  <span>Cloud Sync</span>
                  {isSyncing && <span className="text-xs text-muted-foreground animate-pulse font-normal ml-2">(Syncing...)</span>}
                </div>
              }
              icon={<CloudCog className="h-5 w-5 text-blue-500" />}
              className="md:col-span-2 lg:col-span-2"
              disableHover
            >
              <div className="mt-2">
                <SyncStatusPanel />
              </div>
            </BentoGridItem>
          )}

          {/* HELP & ACADEMY */}
          <BentoGridItem
            title="Help & Academy"
            icon={<HelpCircle className="h-5 w-5 text-info" />}
            span={1}
            className="md:col-span-1"
            disableHover
          >
            <div className="flex flex-col gap-3 mt-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Replay the interactive guided tour or read the detailed platform guide.
              </p>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleReplayTour}
                className="w-full justify-center gap-1.5 h-9 px-2 text-xs border-dashed hover:border-primary/40 hover:bg-accent/50"
                title="Restart Guided Tour"
              >
                <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                <span>Replay Walkthrough</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full justify-center gap-1.5 h-9 px-2 text-xs border-dashed hover:border-primary/40 hover:bg-accent/50"
              >
                <Link href="/tutorial" className="flex items-center justify-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span>View Help Guides</span>
                </Link>
              </Button>
            </div>
          </BentoGridItem>

          {/* WORKSPACE MODULES */}
          <BentoGridItem
            title="Workspace Modules"
            icon={<Layers className="h-5 w-5 text-primary" />}
            span={1}
            className="md:col-span-1"
            disableHover
          >
            <div className="flex flex-col gap-3 mt-4">
              <div className="flex items-center justify-between p-3 surface-subtle">
                <div className="flex flex-col text-left">
                  <span className="text-sm font-semibold text-foreground">Habit-Only Mode</span>
                  <span className="text-[10px] text-muted-foreground max-w-[200px]">Focused, minimal habit tracker view</span>
                </div>
                <Button 
                  variant={settings.habitOnlyMode ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => handleToggleSetting('habitOnlyMode')}
                  className="h-8 px-3 text-xs font-semibold"
                >
                  {settings.habitOnlyMode ? "Active" : "Disabled"}
                </Button>
              </div>

              <div className={cn("flex items-center justify-between p-3 surface-subtle transition-all", settings.habitOnlyMode && "opacity-40 pointer-events-none")}>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-semibold text-foreground">Tasks Module</span>
                  <span className="text-[10px] text-muted-foreground">Checklists & daily tasks</span>
                </div>
                <Button 
                  variant={settings.showTasks !== false ? "default" : "outline"} 
                  size="sm" 
                  disabled={!!settings.habitOnlyMode}
                  onClick={() => handleToggleSetting('showTasks')}
                  className="h-8 px-3 text-xs font-semibold"
                >
                  {settings.showTasks !== false ? "Enabled" : "Hidden"}
                </Button>
              </div>

              <div className={cn("flex items-center justify-between p-3 surface-subtle transition-all", settings.habitOnlyMode && "opacity-40 pointer-events-none")}>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-semibold text-foreground">Goals & Milestones</span>
                  <span className="text-[10px] text-muted-foreground">Long-term SMART goal-setting</span>
                </div>
                <Button 
                  variant={settings.showGoals !== false ? "default" : "outline"} 
                  size="sm" 
                  disabled={!!settings.habitOnlyMode}
                  onClick={() => handleToggleSetting('showGoals')}
                  className="h-8 px-3 text-xs font-semibold"
                >
                  {settings.showGoals !== false ? "Enabled" : "Hidden"}
                </Button>
              </div>
            </div>
          </BentoGridItem>

          {/* DEBUG TOOLS */}
          {isAuthenticated && process.env.NODE_ENV === 'development' && (
            <BentoGridItem
              title="Debug Tools"
              icon={<RefreshCw className="h-5 w-5 text-orange-500" />}
              span={1}
              description="Force sync actions"
              className="md:col-span-1"
              disableHover
            >
              <div className="flex flex-col gap-3 mt-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleForcePush}
                    disabled={isForceSyncing}
                    className="w-full justify-center gap-1.5 h-9 px-2 text-xs hover:bg-orange-500/10 hover:text-orange-600"
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
                    className="w-full justify-center gap-1.5 h-9 px-2 text-xs hover:bg-blue-500/10 hover:text-blue-600"
                    title="Overwrite Local Data"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span>Pull</span>
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  ⚠️ Advanced tools - use with caution
                </p>
              </div>
            </BentoGridItem>
          )}

          {/* DANGER ZONE */}
          <BentoGridItem
            title="Danger Zone"
            icon={<Trash2 className="h-5 w-5 text-red-500" />}
            span={1}
            className="border-red-500/20 bg-red-500/5 md:col-span-1"
            disableHover
          >
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-4">
                Permanently delete all local data
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowClearDataDialog(true)}
                className="w-full"
              >
                Reset All
              </Button>
            </div>
          </BentoGridItem>
        </BentoGrid>
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
