'use client';

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
  Mail,
  Lock,
  Save,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { UserSettings } from '@/lib/types';
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid';
import { SyncStatusPanel } from '@/components/sync/SyncStatusPanel';
import { SettingsHero } from '@/components/settings/SettingsHero';
import { AvatarSelector } from '@/components/settings/AvatarSelector';
import { PasswordChangeModal } from '@/components/settings/password-change-modal';
import { useUserStore } from '@/lib/stores/user-store';
import { Avatar } from '@/lib/avatars';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const { isSyncing } = useSync();
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
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const { displayName, email, setDisplayName, saveDisplayNameToServer, loadUser } = useUserStore();

  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) return;

      loadUser(); // Load user profile store

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
          updatedAt: new Date().toISOString(),
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
  }, [user, isAuthenticated, loadUser]);

  const handleSaveDisplayName = async () => {
    try {
      // NEW: Use explicit save function from user store
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
      await getSyncEngine().syncAll();
      toast.success('Synced all data (Tasks, Goals, Habits, Routines) from cloud. Refreshing...');
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
    <div className="container relative min-h-screen px-4 py-8 md:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Visual Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <FadeIn>
        {/* ROW 1: HERO (Span 3) */}
        <SettingsHero
          avatarId={settings.avatarId || 'avatar-1'}
          level={settings.level}
          xp={settings.xp}
          streakShield={settings.streakShield}
          onAvatarClick={() => setShowAvatarSelector(true)}
          className="mb-8"
        />

        <BentoGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:auto-rows-auto">

          {/* ROW 2: ACCOUNT (Span 2) */}
          <BentoGridItem
            title="Account & Security"
            icon={<User className="h-5 w-5 text-indigo-500" />}
            span={2}
            className="md:col-span-2"
            description="Manage your profile and security preferences"
          >
            <div className="flex flex-col gap-6 mt-6 pb-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email Field */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</Label>
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-hover:text-foreground transition-colors">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="flex items-center h-11 w-full rounded-xl border border-border/50 bg-muted/30 px-10 text-sm text-foreground/80 font-medium cursor-not-allowed">
                      <span className="truncate">{email || user?.email || 'No email linked'}</span>
                    </div>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/50" />
                    </div>
                  </div>
                </div>

                {/* Display Name Field */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</Label>
                  <div className="flex gap-2">
                    <div className="relative group flex-1">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-indigo-500 transition-colors">
                        <User className="h-4 w-4" />
                      </div>
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="How should we call you?"
                        className="h-11 pl-10 rounded-xl border-border/50 bg-background/50 focus:bg-background transition-all focus:ring-2 focus:ring-indigo-500/20"
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
                      className="h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground border border-primary/20 shadow-lg shadow-primary/25 hover:shadow-primary/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 font-medium tracking-wide"
                    >
                      <Save className="h-4 w-4 mr-2 stroke-[2.5]" />
                      Save
                    </Button>
                  </div>
                </div>
              </div>

              {/* Action Area */}
              <div className="flex items-center justify-between pt-6 border-t border-border/40 mt-4">
                <div className="text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-emerald-500" />
                    Account is secure
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="h-9 px-4 rounded-lg border-indigo-500/20 hover:bg-indigo-500/5 hover:text-indigo-600 hover:border-indigo-500/30 transition-all text-xs font-medium"
                >
                  <Lock className="h-3.5 w-3.5 mr-2 text-indigo-500" />
                  Change Password
                </Button>
              </div>
            </div>
          </BentoGridItem>

          {/* ROW 2 & 3: Layout Reordering */}

          <BentoGridItem
            title="Data Vault"
            icon={<Database className="h-5 w-5 text-emerald-500" />}
            span={1}
            description="Manage local backups"
            className="md:col-span-1"
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
                  <span>Backup</span>
                </Button>

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
                    <span>Restore</span>
                  </Button>
                </div>
              </div>

              {/* Duplicate Maintenance */}
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
            </div>
          </BentoGridItem>

          {/* ROW 3: Cloud Sync (Span 2) */}
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
            >
              <div className="mt-2">
                <SyncStatusPanel />
              </div>
            </BentoGridItem>
          )}

          {/* ROW 3: Appearance (Span 1) */}
          <BentoGridItem
            title="Appearance"
            icon={<Palette className="h-5 w-5 text-purple-500" />}
            span={1}
            className="md:col-span-1"
          >
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { value: 'light', icon: Sun, label: 'Light' },
                { value: 'dark', icon: Moon, label: 'Dark' },
                { value: 'system', icon: Monitor, label: 'Auto' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value as 'light' | 'dark' | 'system')}
                  className={cn(
                    "p-3 rounded-xl flex items-center justify-center transition-all border outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    theme === opt.value
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 scale-105"
                      : "bg-background/50 hover:bg-background border-border text-muted-foreground hover:text-foreground"
                  )}
                  title={opt.label}
                >
                  <opt.icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </BentoGridItem>

          {isAuthenticated && (
            <BentoGridItem
              title="Debug Tools"
              icon={<RefreshCw className="h-5 w-5 text-orange-500" />}
              span={1}
              description="Force sync actions"
              className="md:col-span-1"
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

          {/* 6. Danger Zone */}
          <BentoGridItem
            title="Danger Zone"
            icon={<Trash2 className="h-5 w-5 text-red-500" />}
            span={1}
            className="border-red-500/20 bg-red-500/5 hover:bg-red-500/10 md:col-span-1"
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

      <PasswordChangeModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
}
