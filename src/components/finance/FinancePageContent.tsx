'use client';

import React, { useCallback, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';
import {
  useFinanceStore,
  getCurrentMonthKey,
} from '@/lib/stores/finance-store';
import type { FinanceTransaction } from '@/lib/types';
import { OverviewTab } from './OverviewTab';
import { useFeedback } from '@/hooks/use-feedback';

const TabSkeleton = () => (
  <div className="space-y-4">
    <div className="h-44 rounded-2xl bg-muted/50 animate-pulse" />
    <div className="h-64 rounded-2xl bg-muted/50 animate-pulse" />
  </div>
);

const ActivityTab = dynamic(
  () => import('./ActivityTab').then((m) => ({ default: m.ActivityTab })),
  { ssr: false, loading: TabSkeleton }
);
const TrackersTab = dynamic(
  () => import('./TrackersTab').then((m) => ({ default: m.TrackersTab })),
  { ssr: false, loading: TabSkeleton }
);
const AccountsTab = dynamic(
  () => import('./AccountsTab').then((m) => ({ default: m.AccountsTab })),
  { ssr: false, loading: TabSkeleton }
);
const AddTransactionModal = dynamic(
  () => import('./AddTransactionModal').then((m) => ({ default: m.AddTransactionModal })),
  { ssr: false }
);
const MonthlyBudgetModal = dynamic(
  () => import('./MonthlyBudgetModal').then((m) => ({ default: m.MonthlyBudgetModal })),
  { ssr: false }
);
const SmsImportModal = dynamic(
  () => import('./SmsImportModal').then((m) => ({ default: m.SmsImportModal })),
  { ssr: false }
);
const AskFinancesDrawer = dynamic(
  () => import('./AskFinancesDrawer').then((m) => ({ default: m.AskFinancesDrawer })),
  { ssr: false }
);
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useAuth } from '@/providers/auth-provider';
import { GuidedTour, TourTriggerButton, usePageTour, PAGE_TOURS } from '@/components/tour';

type ActiveTab = 'overview' | 'activity' | 'trackers' | 'accounts';

function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const date = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1 + deltaMonths, 1);
  return getCurrentMonthKey(date);
}

function formatMonthDisplay(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const date = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

const VALID_FINANCE_TABS = new Set<ActiveTab>(['overview', 'activity', 'trackers', 'accounts']);
const FINANCE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'trackers', label: 'Bills & Debt' },
  { id: 'accounts', label: 'Accounts' },
] as const;

function consumeParamFlag(params: URLSearchParams, key: string, onTrigger: () => void): boolean {
  if (params.get(key) !== '1') return false;
  onTrigger();
  params.delete(key);
  return true;
}

function consumeSmsDeepLink(params: URLSearchParams, onSmsText: (text: string) => void): boolean {
  const incoming = params.get('sms') || params.get('text');
  if (!incoming?.trim()) return false;
  onSmsText(incoming);
  ['sms', 'text', 'title', 'url'].forEach((k) => params.delete(k));
  return true;
}

function consumeTabDeepLink(params: URLSearchParams, onTab: (tab: ActiveTab) => void): boolean {
  const tabParam = params.get('tab') as ActiveTab | null;
  if (!tabParam || !VALID_FINANCE_TABS.has(tabParam)) return false;
  onTab(tabParam);
  params.delete('tab');
  return true;
}

function applyFinanceDeepLinks(callbacks: {
  onSmsText: (text: string) => void;
  onTab: (tab: ActiveTab) => void;
  onAskAi: () => void;
  onAddTx: () => void;
}): void {
  const params = new URLSearchParams(window.location.search);
  const mutated = [
    consumeSmsDeepLink(params, callbacks.onSmsText),
    consumeTabDeepLink(params, callbacks.onTab),
    consumeParamFlag(params, 'ask', callbacks.onAskAi),
    consumeParamFlag(params, 'add', callbacks.onAddTx),
  ].some(Boolean);

  if (mutated) {
    const nextSearch = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
  }
}

function FinanceTabBar(props: {
  activeTab: ActiveTab;
  needsReviewCount: number;
  onSelectTab: (tab: ActiveTab) => void;
}) {
  const { activeTab, needsReviewCount, onSelectTab } = props;
  return (
    <div role="tablist" aria-label="Finance sections" className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-muted w-full max-w-xl tour-finance-tabs">
      {FINANCE_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const badge = tab.id === 'activity' ? needsReviewCount : 0;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectTab(tab.id)}
            className={`min-h-[42px] px-2 sm:px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap flex items-center justify-center gap-1.5 tour-finance-${tab.id} ${
              isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{tab.label}</span>
            {badge > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-mono">{badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function FinanceHeaderActions(props: {
  selectedMonth: string;
  isFitnessEnabled: boolean;
  onShiftMonth: (delta: number) => void;
  onOpenAskAi: () => void;
  onStartTour: () => void;
  onOpenSms: () => void;
  onOpenBudget: () => void;
  onOpenNewTx: () => void;
}) {
  return (
    <>
      <div className="inline-flex items-center rounded-xl border border-border bg-card p-0.5">
        <button
          type="button"
          onClick={() => props.onShiftMonth(-1)}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-2 text-xs sm:text-sm font-semibold text-foreground min-w-[82px] text-center whitespace-nowrap font-mono tabular-nums">
          {formatMonthDisplay(props.selectedMonth)}
        </span>
        <button
          type="button"
          onClick={() => props.onShiftMonth(1)}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={props.onOpenAskAi}
        className="h-9 px-2.5 sm:px-3 rounded-xl gap-1.5 whitespace-nowrap"
        title={props.isFitnessEnabled ? 'Ask Life OS across Finance, Fitness & Habits' : 'Ask AI about your finances'}
      >
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-xs sm:text-sm">{props.isFitnessEnabled ? 'Ask Life OS' : 'Ask Finances'}</span>
      </Button>

      <TourTriggerButton onClick={props.onStartTour} pageTitle="Finance Hub" />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={props.onOpenSms}
        className="h-9 px-2.5 sm:px-3 rounded-xl gap-1.5 whitespace-nowrap tour-finance-sms"
        title="Fetch expenses from SMS or notifications"
      >
        <MessageSquareText className="w-4 h-4 text-primary" />
        <span className="text-xs sm:text-sm">SMS</span>
      </Button>

      <Button type="button" variant="outline" size="sm" onClick={props.onOpenBudget} className="hidden sm:inline-flex h-9 px-3 rounded-xl gap-1.5 whitespace-nowrap">
        <SlidersHorizontal className="w-4 h-4" />
        Budgets
      </Button>

      <Button type="button" size="sm" onClick={props.onOpenNewTx} className="hidden md:inline-flex h-9 px-3.5 rounded-xl gap-1.5 whitespace-nowrap">
        <Plus className="w-4 h-4" />
        Add Entry
      </Button>
    </>
  );
}

function FinanceTabPanel(props: {
  activeTab: ActiveTab;
  isLoading: boolean;
  onEditTransaction: (tx: FinanceTransaction) => void;
  onOpenBudgetModal: (categoryId?: string) => void;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenAddTransaction: () => void;
  onOpenAskAi: () => void;
  onOpenSmsImport: () => void;
  onLogOffsetExpense: (commitmentId: string) => void;
}) {
  if (props.isLoading) return <TabSkeleton />;
  return (
    <div>
      {props.activeTab === 'overview' && (
        <OverviewTab
          onEditTransaction={props.onEditTransaction}
          onOpenBudgetModal={props.onOpenBudgetModal}
          onOpenTrackersTab={() => props.onSelectTab('trackers')}
          onOpenActivityTab={() => props.onSelectTab('activity')}
          onOpenAddTransaction={props.onOpenAddTransaction}
          onOpenAskAi={props.onOpenAskAi}
        />
      )}
      {props.activeTab === 'activity' && (
        <ActivityTab
          onEditTransaction={props.onEditTransaction}
          onOpenAddTransaction={props.onOpenAddTransaction}
          onOpenSmsImport={props.onOpenSmsImport}
        />
      )}
      {props.activeTab === 'trackers' && <TrackersTab onLogOffsetExpense={props.onLogOffsetExpense} />}
      {props.activeTab === 'accounts' && <AccountsTab onOpenBudgetModal={props.onOpenBudgetModal} />}
    </div>
  );
}

function FinancePageModals(props: {
  isAddTxModalOpen: boolean;
  setIsAddTxModalOpen: (open: boolean) => void;
  editingTx: FinanceTransaction | null;
  defaultCommitmentId: string | null;
  onOpenSmsFromTxModal: () => void;
  isBudgetModalOpen: boolean;
  setIsBudgetModalOpen: (open: boolean) => void;
  focusCategoryId: string | null;
  isSmsModalOpen: boolean;
  setIsSmsModalOpen: (open: boolean) => void;
  sharedSmsText: string | null;
  isAskAiOpen: boolean;
  setIsAskAiOpen: (open: boolean) => void;
  userId?: string;
}) {
  return (
    <>
      {props.isAddTxModalOpen && (
        <AddTransactionModal
          open={props.isAddTxModalOpen}
          onOpenChange={props.setIsAddTxModalOpen}
          editingTransaction={props.editingTx}
          defaultCommitmentId={props.defaultCommitmentId}
          onOpenSmsImport={props.onOpenSmsFromTxModal}
        />
      )}
      {props.isBudgetModalOpen && (
        <MonthlyBudgetModal open={props.isBudgetModalOpen} onOpenChange={props.setIsBudgetModalOpen} focusCategoryId={props.focusCategoryId} />
      )}
      {props.isSmsModalOpen && (
        <SmsImportModal open={props.isSmsModalOpen} onOpenChange={props.setIsSmsModalOpen} initialText={props.sharedSmsText} />
      )}
      {props.isAskAiOpen && (
        <AskFinancesDrawer open={props.isAskAiOpen} onOpenChange={props.setIsAskAiOpen} userId={props.userId} />
      )}
    </>
  );
}
function useFinancePageController() {
  const isFitnessEnabled = isFitnessModuleEnabled(useGamificationStore((s) => s.settings));
  const isLoading = useFinanceStore((s) => s.isLoading);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const setSelectedMonth = useFinanceStore((s) => s.setSelectedMonth);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const feedback = useFeedback();
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinanceTransaction | null>(null);
  const [defaultCommitmentId, setDefaultCommitmentId] = useState<string | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [focusCategoryId, setFocusCategoryId] = useState<string | null>(null);
  const { user } = useAuth();
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [sharedSmsText, setSharedSmsText] = useState<string | null>(null);
  const [isAskAiOpen, setIsAskAiOpen] = useState(false);

  useEffect(() => {
    loadFinanceData(user?.id, false);
  }, [loadFinanceData, user?.id]);

  useEffect(() => {
    if (isLoading || typeof window === 'undefined') return;
    applyFinanceDeepLinks({
      onSmsText: (text) => {
        setSharedSmsText(text);
        setIsSmsModalOpen(true);
      },
      onTab: setActiveTab,
      onAskAi: () => setIsAskAiOpen(true),
      onAddTx: () => setIsAddTxModalOpen(true),
    });
  }, [isLoading]);

  const handleOpenNewTx = () => {
    setEditingTx(null);
    setDefaultCommitmentId(null);
    setIsAddTxModalOpen(true);
  };

  useEffect(() => {
    window.addEventListener('open-finance-add-entry', handleOpenNewTx);
    return () => window.removeEventListener('open-finance-add-entry', handleOpenNewTx);
  }, []);

  const handleOpenOffsetForCommitment = (commitmentId: string) => {
    setEditingTx(null);
    setDefaultCommitmentId(commitmentId);
    setIsAddTxModalOpen(true);
  };

  const handleOpenEditTx = useCallback((tx: FinanceTransaction) => {
    setDefaultCommitmentId(null);
    setEditingTx(tx);
    setIsAddTxModalOpen(true);
  }, []);

  const handleOpenBudgetModal = (categoryId?: string) => {
    setFocusCategoryId(categoryId || null);
    setIsBudgetModalOpen(true);
  };

  const openSmsModal = () => {
    setSharedSmsText(null);
    setIsSmsModalOpen(true);
  };

  return {
    isFitnessEnabled,
    isLoading,
    selectedMonth,
    setSelectedMonth,
    summary: getMonthlySummary(selectedMonth),
    activeTab,
    setActiveTab,
    feedback,
    isAddTxModalOpen,
    setIsAddTxModalOpen,
    editingTx,
    defaultCommitmentId,
    isBudgetModalOpen,
    setIsBudgetModalOpen,
    focusCategoryId,
    userId: user?.id,
    isSmsModalOpen,
    setIsSmsModalOpen,
    sharedSmsText,
    isAskAiOpen,
    setIsAskAiOpen,
    handleOpenNewTx,
    handleOpenOffsetForCommitment,
    handleOpenEditTx,
    handleOpenBudgetModal,
    openSmsModal,
  };
}

export function FinancePageContent() {
  const c = useFinancePageController();
  const { isOpen: isTourOpen, startTour, closeTour, completeTour } = usePageTour('finance');

  return (
    <div className="container max-w-6xl mx-auto overflow-x-hidden px-4 sm:px-6 pt-5 pb-24 md:py-6 md:pb-12 space-y-5">
      <PageHeader
        title="Finance"
        actions={
          <FinanceHeaderActions
            selectedMonth={c.selectedMonth}
            isFitnessEnabled={c.isFitnessEnabled}
            onShiftMonth={(delta) => {
              c.feedback.tap();
              c.setSelectedMonth(shiftMonthKey(c.selectedMonth, delta));
            }}
            onOpenAskAi={() => c.setIsAskAiOpen(true)}
            onStartTour={startTour}
            onOpenSms={c.openSmsModal}
            onOpenBudget={() => c.handleOpenBudgetModal()}
            onOpenNewTx={c.handleOpenNewTx}
          />
        }
      />

      <FinanceTabBar
        activeTab={c.activeTab}
        needsReviewCount={c.summary.needsReviewCount || 0}
        onSelectTab={(tab) => {
          c.feedback.tap();
          c.setActiveTab(tab);
        }}
      />

      <FinanceTabPanel
        activeTab={c.activeTab}
        isLoading={c.isLoading}
        onEditTransaction={c.handleOpenEditTx}
        onOpenBudgetModal={c.handleOpenBudgetModal}
        onSelectTab={c.setActiveTab}
        onOpenAddTransaction={c.handleOpenNewTx}
        onOpenAskAi={() => c.setIsAskAiOpen(true)}
        onOpenSmsImport={c.openSmsModal}
        onLogOffsetExpense={c.handleOpenOffsetForCommitment}
      />

      <FinancePageModals
        isAddTxModalOpen={c.isAddTxModalOpen}
        setIsAddTxModalOpen={c.setIsAddTxModalOpen}
        editingTx={c.editingTx}
        defaultCommitmentId={c.defaultCommitmentId}
        onOpenSmsFromTxModal={() => {
          c.setIsAddTxModalOpen(false);
          c.openSmsModal();
        }}
        isBudgetModalOpen={c.isBudgetModalOpen}
        setIsBudgetModalOpen={c.setIsBudgetModalOpen}
        focusCategoryId={c.focusCategoryId}
        isSmsModalOpen={c.isSmsModalOpen}
        setIsSmsModalOpen={c.setIsSmsModalOpen}
        sharedSmsText={c.sharedSmsText}
        isAskAiOpen={c.isAskAiOpen}
        setIsAskAiOpen={c.setIsAskAiOpen}
        userId={c.userId}
      />

      <GuidedTour {...PAGE_TOURS.finance} isOpen={isTourOpen} onClose={closeTour} onComplete={completeTour} />
    </div>
  );
}
