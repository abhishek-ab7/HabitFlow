'use client';

import { useEffect, useState } from 'react';
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  Download,
  Upload,
  Trash2,
  Cloud,
  RefreshCw,
  Database,
  User as UserIcon,
  Palette,
  Settings as SettingsIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/motion';
import { useTheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';
import { useSync } from '@/providers/sync-provider';
import { db, getSettings, updateSettings } from '@/lib/db';
import { cleanupAllDuplicates, countAllDuplicates } from '@/lib/cleanup';
import { cn } from '@/lib/utils';
import type { UserSettings, Category } from '@/lib/types';

const WEEK_START_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 6, label: 'Saturday' },
];

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'health', label: 'Health' },
  { value: 'work', label: 'Work' },
  { value: 'learning', label: 'Learning' },
  { value: 'personal', label: 'Personal' },
  { value: 'finance', label: 'Finance' },
  { value: 'relationships', label: 'Relationships' },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const { isSyncing, triggerSync, syncStatus } = useSync();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [userName, setUserName] = useState('');
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [duplicateCounts, setDuplicateCounts] = useState<{
    habits: number;
    goals: number;
    completions: number;
  } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      let s = await getSettings();

      // Create default settings if none exist
      if (!s) {
        const defaultSettings: UserSettings = {
          id: crypto.randomUUID(),
          theme: 'system',
          userName: '',
          weekStartsOn: 0,
          showMotivationalQuotes: true,
          defaultCategory: 'health',
          createdAt: new Date().toISOString(),
        };
        await db.userSettings.add(defaultSettings);
        s = defaultSettings;
      }

      setSettings(s);
      setUserName(s.userName || '');

      // Check for duplicates
      const counts = await countAllDuplicates();
      setDuplicateCounts(counts);
    };
    loadSettings();
  }, []);

  const handleCleanupDuplicates = async () => {
    setIsCleaning(true);
    try {
      const removed = await cleanupAllDuplicates();
      const total = removed.habits + removed.goals + removed.completions;
      
      if (total > 0) {
        toast.success(
          `Cleaned up ${total} duplicate(s): ${removed.habits} habits, ${removed.goals} goals, ${removed.completions} completions`
        );
      } else {
        toast.success('No duplicates found!');
      }
      
      setDuplicateCounts({ habits: 0, goals: 0, completions: 0 });
      // Refresh the page to update counts
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error('Failed to cleanup duplicates');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSaveUserName = async () => {
    if (settings) {
      await updateSettings({ userName: userName.trim() || undefined });
      setSettings({ ...settings, userName: userName.trim() || undefined });
      toast.success('Name updated');
    }
  };

  const handleWeekStartChange = async (value: number) => {
    if (settings) {
      const weekStartsOn = value as 0 | 1 | 6;
      await updateSettings({ weekStartsOn });
      setSettings({ ...settings, weekStartsOn });
      toast.success('Week start day updated');
    }
  };

  const handleDefaultCategoryChange = async (category: Category) => {
    if (settings) {
      await updateSettings({ defaultCategory: category });
      setSettings({ ...settings, defaultCategory: category });
      toast.success('Default category updated');
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

  if (!settings) {
    return (
      <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-32" />
          <div className="h-48 bg-muted rounded-xl" />
          <div className="h-48 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-3xl mx-auto">
      <FadeIn>
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Customize your Habit Flow experience
          </p>
        </div>
      </FadeIn>

      <StaggerContainer className="space-y-6">
        {/* Cloud Sync Status */}
        {isAuthenticated && (
          <StaggerItem>
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Cloud Sync</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={syncStatus.type === 'success' ? 'default' : syncStatus.type === 'error' ? 'destructive' : 'secondary'}>
                      {syncStatus.type === 'success' ? 'Synced' : syncStatus.type === 'error' ? 'Error' : syncStatus.type === 'syncing' ? 'Syncing' : 'Ready'}
                    </Badge>
                  </div>
                </div>
                <CardDescription>Your data is being backed up to the cloud</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{isSyncing ? 'Synchronizing your changes...' : `Status: ${syncStatus.message || 'Connected'}`}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => triggerSync()}
                    disabled={isSyncing}
                    className="w-full sm:w-auto bg-background"
                  >
                    <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        )}

        {/* Profile Settings */}
        <StaggerItem>
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Personalize your experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Your Name</label>
                <div className="flex gap-2">
                  <Input
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter your name"
                    className="max-w-xs"
                  />
                  <Button onClick={handleSaveUserName} variant="secondary">
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Appearance */}
        <StaggerItem>
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Choose your preferred theme</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {[
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon },
                  { value: 'system', label: 'System', icon: Monitor },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value as 'light' | 'dark' | 'system')}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                      theme === option.value
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <option.icon className={cn(
                      "h-5 w-5",
                      theme === option.value ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Data Management */}
        <StaggerItem>
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Local backup and safety tools</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={handleExportData} disabled={isExporting} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export JSON
                </Button>
                <div className="relative">
                  <input type="file" accept=".json" onChange={handleImportData} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <Button variant="outline" className="gap-2 pointer-events-none">
                    <Upload className="h-4 w-4" />
                    Import JSON
                  </Button>
                </div>
              </div>

              {/* Cleanup Duplicates */}
              {duplicateCounts && (duplicateCounts.habits > 0 || duplicateCounts.goals > 0 || duplicateCounts.completions > 0) && (
                <>
                  <Separator />
                  <div className="pt-2">
                    <h4 className="text-sm font-medium text-warning mb-1">Database Cleanup</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Found {duplicateCounts.habits + duplicateCounts.goals + duplicateCounts.completions} duplicate(s):
                      {duplicateCounts.habits > 0 && ` ${duplicateCounts.habits} habit(s)`}
                      {duplicateCounts.goals > 0 && ` ${duplicateCounts.goals} goal(s)`}
                      {duplicateCounts.completions > 0 && ` ${duplicateCounts.completions} completion(s)`}.
                      This may cause issues with your data.
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleCleanupDuplicates}
                      disabled={isCleaning}
                      className="gap-2 border-warning text-warning hover:bg-warning/10"
                    >
                      <Database className="h-4 w-4" />
                      {isCleaning ? 'Cleaning...' : 'Remove All Duplicates'}
                    </Button>
                  </div>
                </>
              )}

              <Separator />
              <div className="pt-2">
                <h4 className="text-sm font-medium text-destructive mb-1">Danger Zone</h4>
                <p className="text-sm text-muted-foreground mb-3">Permanently delete all local data.</p>
                <Button variant="destructive" onClick={() => setShowClearDataDialog(true)} className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Clear All Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

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
