'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Moon,
  Sun,
  Monitor,
  Download,
  Upload,
  Trash2,
  Cloud,
  RefreshCw,
  Database,
  Calendar,
  LogOut,
  Palette,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FadeIn } from '@/components/motion';
import { useTheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';
import { useSync } from '@/providers/sync-provider';
import { db, getSettings, updateSettings } from '@/lib/db';
import { cleanupAllDuplicates, countAllDuplicates } from '@/lib/cleanup';
import { forcePushAllHabits, forcePullAllHabits } from '@/lib/force-sync';
import { cn } from '@/lib/utils';
import type { UserSettings, Category } from '@/lib/types';
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid';
import { ProfileStatsCard } from '@/components/settings/ProfileStatsCard';
import { AvatarSelector } from '@/components/settings/AvatarSelector';
import { Avatar } from '@/lib/avatars';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, user, signOut } = useAuth(); // Added signOut if available, or I might need to implement/check
  const { isSyncing, triggerSync, syncStatus } = useSync();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [duplicateCounts, setDuplicateCounts] = useState<{
    habits: number;
    goals: number;
    completions: number;
  } | null>(null);

  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [isForceSyncing, setIsForceSyncing] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) return;

      let s = await getSettings(user.id);

      // Create default settings if none exist
      if (!s) {
        const defaultSettings: UserSettings = {
          id: crypto.randomUUID(),
          userId: user.id,
          theme: 'system',
          userName: '',
          weekStartsOn: 0,
          showMotivationalQuotes: true,
          defaultCategory: 'health',
          createdAt: new Date().toISOString(),
          xp: 0,
          level: 1,
          gems: 0,
          streakShield: 0,
          avatarId: 'avatar-1',
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
  }, [user, isAuthenticated]);

  const handleUpdateName = async (name: string) => {
    if (settings && user?.id) {
      await updateSettings({ userId: user.id, userName: name });
      setSettings({ ...settings, userName: name });
      toast.success('Name updated');
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
    try {
      await db.habits.clear();
      await db.completions.clear();
      await db.goals.clear();
      await db.milestones.clear();
      toast.success('All data cleared. Refreshing...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error('Failed to clear data');
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
      const result = await forcePullAllHabits();
      toast.success(`Pulled ${result.total} habits from cloud. Refreshing...`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error('Force pull failed: ' + (error as Error).message);
    } finally {
      setIsForceSyncing(false);
    }
  };

  if (!settings) {
    return (
      <div className="container px-4 py-8 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto" />
          <div className="h-4 w-32 bg-muted rounded mx-auto" />
          <span className="text-muted-foreground">Loading Profile...</span>
        </div>
      </div>
    );
  }

  // Calculate stats for duplicate warning
  const hasDuplicates = duplicateCounts && (duplicateCounts.habits > 0 || duplicateCounts.goals > 0 || duplicateCounts.completions > 0);

  return (
    <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      <FadeIn>
        <BentoGrid>
          {/* 1. Profile Hero Section */}
          <ProfileStatsCard
            userName={settings.userName || ''}
            avatarId={settings.avatarId}
            level={settings.level}
            xp={settings.xp}
            streakShield={settings.streakShield}
            onUpdateName={handleUpdateName}
            onAvatarClick={() => setShowAvatarSelector(true)}
          />

          {/* 2. Theme Selector */}
          <BentoGridItem
            title="Appearance"
            icon={<Palette className="h-5 w-5 text-purple-500" />}
            className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20"
          >
            <div className="flex gap-2 mt-2">
              {[
                { value: 'light', icon: Sun },
                { value: 'dark', icon: Moon },
                { value: 'system', icon: Monitor },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value as any)}
                  className={cn(
                    "flex-1 p-3 rounded-xl flex items-center justify-center transition-all bg-white/50 dark:bg-black/20 hover:scale-105",
                    theme === opt.value ? "ring-2 ring-primary shadow-lg bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/80 dark:hover:bg-black/40"
                  )}
                >
                  <opt.icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </BentoGridItem>

          {/* 3. Sync Status */}
          {isAuthenticated && (
            <BentoGridItem
              title="Cloud Sync"
              icon={<Cloud className={cn("h-5 w-5 text-blue-500", isSyncing && "animate-pulse")} />}
              description={isSyncing ? "Syncing changes..." : `Status: ${syncStatus.message || 'Connected'}`}
              className={cn(
                "border-l-4",
                syncStatus.type === 'error' ? "border-l-red-500 bg-red-50/50 dark:bg-red-900/10" : "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10"
              )}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => triggerSync()}
                disabled={isSyncing}
                className="w-full mt-2 bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 text-xs"
              >
                <RefreshCw className={cn("h-3 w-3 mr-2", isSyncing && "animate-spin")} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </BentoGridItem>
          )}

          {/* 3.5 Force Sync Debug Panel (DEV ONLY) */}
          {isAuthenticated && (
            <BentoGridItem
              span={2}
              title="🔧 Force Sync (Debug)"
              icon={<Database className="h-5 w-5 text-red-500" />}
              className="bg-red-50/30 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30"
            >
              <div className="space-y-2 mt-2">
                <p className="text-xs text-muted-foreground">
                  Use these tools to manually sync data when auto-sync fails.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleForcePush}
                    disabled={isForceSyncing}
                    className="h-auto py-3 flex-col gap-1 border-dashed hover:border-solid hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-xs">Push Local → Cloud</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleForcePull}
                    disabled={isForceSyncing}
                    className="h-auto py-3 flex-col gap-1 border-dashed hover:border-solid hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600"
                  >
                    <Download className="h-4 w-4" />
                    <span className="text-xs">Pull Cloud → Local</span>
                  </Button>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                  ⚠️ Force Push will overwrite cloud data with local habits.
                </p>
              </div>
            </BentoGridItem>
          )}

          {/* 4. Integrations Placeholder */}
          <BentoGridItem
            title="Connect"
            icon={<Calendar className="h-5 w-5 text-orange-500" />}
            description="Link Google Calendar"
            onClick={() => toast.info('Integration coming soon')}
          />

          {/* 5. Data Management (Span 2) */}
          <BentoGridItem
            span={2}
            title="Data Vault"
            icon={<Database className="h-5 w-5 text-emerald-600" />}
            className=""
          >
            <div className="grid grid-cols-2 gap-3 mt-2">
              <Button variant="outline" onClick={handleExportData} disabled={isExporting} className="h-auto py-3 flex-col gap-1 border-dashed hover:border-solid hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600">
                <Download className="h-4 w-4" />
                <span className="text-xs">Backup JSON</span>
              </Button>

              <div className="relative">
                <input type="file" accept=".json" onChange={handleImportData} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <Button variant="outline" className="w-full h-full h-auto py-3 flex-col gap-1 border-dashed hover:border-solid hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600">
                  <Upload className="h-4 w-4" />
                  <span className="text-xs">Restore JSON</span>
                </Button>
              </div>
            </div>

            {/* Duplicate Warning */}
            {hasDuplicates && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between"
              >
                <div className="text-xs text-amber-700 dark:text-amber-400 flex flex-col">
                  <span className="font-bold flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Maintenance Required</span>
                  <span>{duplicateCounts.habits + duplicateCounts.goals + duplicateCounts.completions} duplicate items found.</span>
                </div>
                <Button size="sm" variant="ghost" onClick={handleCleanupDuplicates} disabled={isCleaning} className="text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100">
                  {isCleaning ? 'Fixing...' : 'Fix Now'}
                </Button>
              </motion.div>
            )}
          </BentoGridItem>

          {/* 6. Danger Zone */}
          <BentoGridItem
            title="Danger Zone"
            icon={<Trash2 className="h-5 w-5 text-red-500" />}
            className="bg-red-50/30 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30"
          >
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowClearDataDialog(true)}
              className="w-full mt-2"
            >
              Reset Everything
            </Button>
          </BentoGridItem>

          {/* 7. Sign Out (If auth supported in future properly) */}
          {/* <BentoGridItem 
             title="Sign Out" 
             icon={<LogOut className="h-5 w-5 text-neutral-500" />}
             onClick={() => signOut()}
           /> */}
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
    </div>
  );
}
