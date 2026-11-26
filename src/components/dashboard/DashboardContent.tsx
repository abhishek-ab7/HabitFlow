'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
import { getTimeGreeting } from '@/lib/design-tokens';
import { BentoGrid } from './BentoGrid';
import { DashboardCenterLoader } from './DashboardCenterLoader';
import { useFeedback } from '@/hooks/use-feedback';
import { toast } from 'sonner';
import { DashboardEmptyState, DashboardHeaderBar } from './sections/DashboardHeaderBar';
import { DashboardDeterministicAlerts, DashboardFitnessHero } from './sections/DashboardFitnessAndAlerts';
import { DashboardHeroRow, buildBentoWidgets } from './sections/DashboardHeroAndBento';
import { useDashboardViewModel } from './sections/useDashboardViewModel';

const OnboardingWizard = dynamic(() => import('@/components/dashboard/OnboardingWizard'), { ssr: false });
const DashboardTour = dynamic(() => import('@/components/dashboard/DashboardTour'), { ssr: false });
const AddTransactionModal = dynamic(() => import('@/components/finance/AddTransactionModal').then((m) => ({ default: m.AddTransactionModal })), { ssr: false });
const SmsImportModal = dynamic(() => import('@/components/finance/SmsImportModal').then((m) => ({ default: m.SmsImportModal })), { ssr: false });
const AskFinancesDrawer = dynamic(() => import('@/components/finance/AskFinancesDrawer').then((m) => ({ default: m.AskFinancesDrawer })), { ssr: false });

function DashboardModals(params: {
  isQuickExpenseOpen: boolean;
  setIsQuickExpenseOpen: (v: boolean) => void;
  isSmsModalOpen: boolean;
  setIsSmsModalOpen: (v: boolean) => void;
  isAskAiOpen: boolean;
  setIsAskAiOpen: (v: boolean) => void;
  showTour: boolean;
  onCloseTour: () => void;
}) {
  const { isQuickExpenseOpen, setIsQuickExpenseOpen, isSmsModalOpen, setIsSmsModalOpen, isAskAiOpen, setIsAskAiOpen, showTour, onCloseTour } = params;
  return (
    <>
      {isQuickExpenseOpen && (
        <AddTransactionModal
          open={isQuickExpenseOpen}
          onOpenChange={setIsQuickExpenseOpen}
          onOpenSmsImport={() => { setIsQuickExpenseOpen(false); setIsSmsModalOpen(true); }}
        />
      )}
      {isSmsModalOpen && <SmsImportModal open={isSmsModalOpen} onOpenChange={setIsSmsModalOpen} />}
      {isAskAiOpen && <AskFinancesDrawer open={isAskAiOpen} onOpenChange={setIsAskAiOpen} />}
      {showTour && <DashboardTour onClose={onCloseTour} />}
    </>
  );
}

function DashboardFitnessSection({ vm }: { vm: ReturnType<typeof useDashboardViewModel> }) {
  const feedback = useFeedback();
  const showFitnessHero = vm.isFitnessEnabled && (vm.workspaceLens === 'all' || vm.workspaceLens === 'fitness');
  if (!showFitnessHero) return null;

  const handleToggleLowEnergy = async () => {
    const next = !vm.todayFuelSummary.lowEnergyMode;
    feedback.toggle(next);
    const { restedHabitIds } = await vm.toggleLowEnergyMode(vm.todayIsoStr, next, vm.userId);
    if (!next) return void toast.success('Normal targets restored');
    toast.success(restedHabitIds.length > 0 ? `Low-Energy Day ON (${restedHabitIds.length} gym habit rested)` : 'Minimum Viable Day ON');
  };

  return (
    <DashboardFitnessHero
      todayFuelSummary={vm.todayFuelSummary}
      onToggleLowEnergy={handleToggleLowEnergy}
      onAddWater={() => { feedback.complete(); vm.incrementFitnessWater(250, vm.todayIsoStr, vm.userId); toast.success('+250ml water logged'); }}
    />
  );
}

function DashboardWorkspaceBody({ vm }: { vm: ReturnType<typeof useDashboardViewModel> }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [isQuickExpenseOpen, setIsQuickExpenseOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isAskAiOpen, setIsAskAiOpen] = useState(false);

  const todayDateObj = new Date();
  const todayStr = format(todayDateObj, 'yyyy-MM-dd');
  const firstName = vm.displayName?.trim() ? vm.displayName.trim().split(/\s+/)[0] : undefined;

  return (
    <div className="w-full overflow-x-hidden px-4 py-4 sm:py-5 md:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-5 pb-24 md:pb-12">
      <DashboardHeaderBar
        greeting={getTimeGreeting().greeting} firstName={firstName} todayDisplay={format(todayDateObj, 'EEE, d MMM')}
        currentMaxStreak={vm.currentMaxStreak} streakShield={vm.settings?.streakShield ?? 0}
        isFinanceEnabled={vm.isFinanceEnabled} isFitnessEnabled={vm.isFitnessEnabled}
        workspaceLens={vm.workspaceLens} onSelectLens={(lens) => { feedback.tap(); vm.setWorkspaceLens(lens); }}
      />

      <DashboardHeroRow
        vm={vm} todayStr={todayStr}
        onOpenQuickExpense={() => setIsQuickExpenseOpen(true)}
        onOpenSms={() => setIsSmsModalOpen(true)}
        onOpenAskAi={() => setIsAskAiOpen(true)}
      />

      <DashboardFitnessSection vm={vm} />

      <DashboardDeterministicAlerts
        crossAlerts={vm.crossDomainReport?.alerts ?? []} financeAnomalies={vm.financeAnomalies}
        isFinanceEnabled={vm.isFinanceEnabled} onOpenAskAi={() => setIsAskAiOpen(true)} onNavigate={(path) => router.push(path)}
      />

      <BentoGrid widgets={buildBentoWidgets(vm, () => setIsAskAiOpen(true))} />

      <DashboardModals
        isQuickExpenseOpen={isQuickExpenseOpen} setIsQuickExpenseOpen={setIsQuickExpenseOpen}
        isSmsModalOpen={isSmsModalOpen} setIsSmsModalOpen={setIsSmsModalOpen}
        isAskAiOpen={isAskAiOpen} setIsAskAiOpen={setIsAskAiOpen}
        showTour={vm.showTour} onCloseTour={() => vm.setShowTour(false)}
      />
    </div>
  );
}

export default function DashboardContent() {
  const vm = useDashboardViewModel();

  if (vm.isInitializing) {
    return (
      <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto flex flex-col items-center justify-center min-h-[500px]">
        <DashboardCenterLoader />
      </div>
    );
  }
  if (vm.showOnboarding) return <OnboardingWizard onComplete={() => vm.setShowOnboarding(false)} />;
  if (vm.isEmpty) {
    return (
      <DashboardEmptyState
        displayName={vm.displayName} currentMaxStreak={vm.currentMaxStreak} isTasksEnabled={vm.isTasksEnabled}
        onLoadDemo={vm.habitSlice.initializeWithDemoData} onStartFresh={() => vm.setShowOnboarding(true)}
      />
    );
  }
  return <DashboardWorkspaceBody vm={vm} />;
}
