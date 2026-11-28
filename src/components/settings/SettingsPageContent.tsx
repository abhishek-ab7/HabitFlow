'use client';

import dynamic from 'next/dynamic';
import { CloudCog } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FadeIn } from '@/components/motion';
import { SyncStatusPanel } from '@/components/sync/SyncStatusPanel';
import { SettingsHero } from '@/components/settings/SettingsHero';
import { AccountSecurityCard } from './sections/AccountSecurityCard';
import { AppearanceSettingsCard } from './sections/AppearanceSettingsCard';
import { SensoryFeedbackCard, WorkspaceModulesCard } from './sections/WorkspaceModulesCard';
import { SettingsUtilityRow } from './sections/SettingsUtilityRow';
import { useSettingsPageController } from './sections/useSettingsPageController';

const AvatarSelector = dynamic(
  () => import('@/components/settings/AvatarSelector').then((m) => ({ default: m.AvatarSelector })),
  { ssr: false }
);
const PasswordChangeModal = dynamic(
  () => import('@/components/settings/password-change-modal').then((m) => ({ default: m.PasswordChangeModal })),
  { ssr: false }
);
const DataVaultCard = dynamic(
  () => import('@/components/settings/DataVaultCard').then((m) => ({ default: m.DataVaultCard })),
  { ssr: false, loading: () => <div className="h-44 rounded-2xl border border-border bg-card animate-pulse" /> }
);
const McpConnectionsCard = dynamic(
  () => import('@/components/settings/McpConnectionsCard').then((m) => ({ default: m.McpConnectionsCard })),
  { ssr: false, loading: () => <div className="h-44 rounded-2xl border border-border bg-card animate-pulse" /> }
);
const ExternalMcpSourcesCard = dynamic(
  () => import('@/components/settings/ExternalMcpSourcesCard').then((m) => ({ default: m.ExternalMcpSourcesCard })),
  { ssr: false, loading: () => <div className="h-44 rounded-2xl border border-border bg-card animate-pulse" /> }
);

function SettingsLoadingSkeleton() {
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

function CloudSyncCard({ isSyncing }: { isSyncing: boolean }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0"><CloudCog className="h-4 w-4" /></div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">Cloud Sync</h2>
            <p className="text-[11px] text-muted-foreground">{isSyncing ? 'Syncing local changes...' : 'Supabase background sync'}</p>
          </div>
        </div>
      </div>
      <SyncStatusPanel />
    </section>
  );
}

function SettingsModals({ vm }: { vm: ReturnType<typeof useSettingsPageController> }) {
  return (
    <>
      {vm.showAvatarSelector && (
        <AvatarSelector open={vm.showAvatarSelector} onOpenChange={vm.setShowAvatarSelector} selectedAvatarId={vm.settings?.avatarId} onSelect={vm.handleUpdateAvatar} />
      )}
      <ConfirmDialog
        open={vm.showClearDataDialog}
        onOpenChange={vm.setShowClearDataDialog}
        title="Clear All Data?"
        description="This will permanently delete all local habits, completions, and goals. This action cannot be undone."
        confirmLabel="Clear All Data"
        variant="destructive"
        onConfirm={vm.handleClearAllData}
      />
      {vm.isPasswordModalOpen && (
        <PasswordChangeModal isOpen={vm.isPasswordModalOpen} onClose={() => vm.setIsPasswordModalOpen(false)} />
      )}
    </>
  );
}

function SettingsWorkspaceGrid({
  vm,
  hasDuplicates,
  showDevTools,
}: {
  vm: ReturnType<typeof useSettingsPageController>;
  hasDuplicates: boolean;
  showDevTools: boolean;
}) {
  const settings = vm.settings!;
  return (
    <>
      <SettingsHero
        avatarId={settings.avatarId || 'avatar-1'}
        streakShield={vm.streakShield}
        onAvatarClick={() => vm.setShowAvatarSelector(true)}
        onRefillShields={vm.handleRefillShields}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 flex flex-col gap-6 min-w-0">
          <AccountSecurityCard
            displayEmail={vm.email || vm.user?.email || 'No email linked'}
            displayName={vm.displayName}
            setDisplayName={vm.setDisplayName}
            onSaveDisplayName={vm.handleSaveDisplayName}
            onOpenPasswordModal={() => vm.setIsPasswordModalOpen(true)}
          />
          <AppearanceSettingsCard
            mounted={vm.mounted}
            theme={vm.theme}
            setTheme={vm.setTheme}
            resolvedTheme={vm.resolvedTheme}
            colorTheme={vm.colorTheme}
            setColorTheme={vm.setColorTheme}
            accentOverride={vm.accentOverride}
            setAccentOverride={vm.setAccentOverride}
            resetAppearance={vm.resetAppearance}
          />
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6 min-w-0">
          {vm.isAuthenticated && <CloudSyncCard isSyncing={vm.isSyncing} />}
          <WorkspaceModulesCard settings={settings} onToggleSetting={vm.handleToggleSetting} />
          <SensoryFeedbackCard settings={settings} onToggleSound={vm.handleToggleSound} onToggleHaptics={vm.handleToggleHaptics} />
          <DataVaultCard
            isStoragePersistent={Boolean(vm.isStoragePersistent)}
            hasDuplicates={hasDuplicates}
            duplicateCounts={vm.duplicateCounts || { habits: 0, goals: 0 }}
            handleCleanupDuplicates={vm.handleCleanupDuplicates}
            isCleaning={vm.isCleaning}
          />
        </div>
      </div>

      <McpConnectionsCard />
      <ExternalMcpSourcesCard />

      <SettingsUtilityRow
        showDevTools={showDevTools}
        isForceSyncing={vm.isForceSyncing}
        onResetAllTours={vm.handleResetAllTours}
        onReplayTour={(tourKey, path) => vm.handleReplaySpecificTour({ tourKey, path })}
        onForcePush={vm.handleForcePush}
        onForcePull={vm.handleForcePull}
        onOpenClearDialog={() => vm.setShowClearDataDialog(true)}
      />
    </>
  );
}

export default function SettingsPageContent() {
  const vm = useSettingsPageController();
  if (!vm.settings) return <SettingsLoadingSkeleton />;

  const counts = vm.duplicateCounts;
  const hasDuplicates = Boolean(counts && (counts.habits > 0 || counts.goals > 0 || counts.completions > 0));
  const showDevTools = vm.isAuthenticated && process.env.NODE_ENV === 'development';

  return (
    <div className="w-full relative min-h-screen px-4 py-6 md:px-6 md:py-8 max-w-6xl mx-auto">
      <FadeIn className="space-y-6">
        <SettingsWorkspaceGrid vm={vm} hasDuplicates={hasDuplicates} showDevTools={showDevTools} />
      </FadeIn>
      <SettingsModals vm={vm} />
    </div>
  );
}
