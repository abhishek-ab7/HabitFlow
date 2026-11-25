'use client';

import React, { useState, useEffect } from 'react';
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
import { ActivityTab } from './ActivityTab';
import { TrackersTab } from './TrackersTab';
import { AccountsTab } from './AccountsTab';
import { AddTransactionModal } from './AddTransactionModal';
import { MonthlyBudgetModal } from './MonthlyBudgetModal';
import { SmsImportModal } from './SmsImportModal';
import { AskFinancesDrawer } from './AskFinancesDrawer';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useAuth } from '@/providers/auth-provider';

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

export function FinancePageContent() {
  const isFitnessEnabled = isFitnessModuleEnabled(
    useGamificationStore((s) => s.settings)
  );
  const isLoading = useFinanceStore((s) => s.isLoading);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const setSelectedMonth = useFinanceStore((s) => s.setSelectedMonth);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
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
    loadFinanceData(user?.id);
  }, [loadFinanceData, user?.id]);

  // Handle deep-links (?sms=..., ?tab=..., ?ask=1) once loaded
  useEffect(() => {
    if (isLoading || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    let mutated = false;

    const incoming = params.get('sms') || params.get('text');
    if (incoming && incoming.trim()) {
      setSharedSmsText(incoming);
      setIsSmsModalOpen(true);
      params.delete('sms');
      params.delete('text');
      params.delete('title');
      params.delete('url');
      mutated = true;
    }

    const tabParam = params.get('tab');
    if (
      tabParam === 'overview' ||
      tabParam === 'activity' ||
      tabParam === 'trackers' ||
      tabParam === 'accounts'
    ) {
      setActiveTab(tabParam);
      params.delete('tab');
      mutated = true;
    }

    if (params.get('ask') === '1') {
      setIsAskAiOpen(true);
      params.delete('ask');
      mutated = true;
    }

    if (params.get('add') === '1') {
      setIsAddTxModalOpen(true);
      params.delete('add');
      mutated = true;
    }

    if (mutated) {
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
      window.history.replaceState({}, '', nextUrl);
    }
  }, [isLoading]);

  const summary = getMonthlySummary(selectedMonth);

  const handleOpenNewTx = () => {
    setEditingTx(null);
    setDefaultCommitmentId(null);
    setIsAddTxModalOpen(true);
  };

  useEffect(() => {
    const onOpenAddEntry = () => {
      setEditingTx(null);
      setDefaultCommitmentId(null);
      setIsAddTxModalOpen(true);
    };
    window.addEventListener('open-finance-add-entry', onOpenAddEntry);
    return () => window.removeEventListener('open-finance-add-entry', onOpenAddEntry);
  }, []);

  const handleOpenOffsetForCommitment = (commitmentId: string) => {
    setEditingTx(null);
    setDefaultCommitmentId(commitmentId);
    setIsAddTxModalOpen(true);
  };

  const handleOpenEditTx = (tx: FinanceTransaction) => {
    setDefaultCommitmentId(null);
    setEditingTx(tx);
    setIsAddTxModalOpen(true);
  };

  const handleOpenBudgetModal = (categoryId?: string) => {
    setFocusCategoryId(categoryId || null);
    setIsBudgetModalOpen(true);
  };

  return (
    <div className="container max-w-6xl mx-auto overflow-x-hidden px-4 sm:px-6 pt-5 pb-24 md:py-6 md:pb-12 space-y-5">
      {/* Standardized Header & Month Switcher */}
      <PageHeader
        title="Finance"
        actions={
          <>
            <div className="inline-flex items-center rounded-xl border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, -1))}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs sm:text-sm font-semibold text-foreground min-w-[82px] text-center whitespace-nowrap font-mono tabular-nums">
                {formatMonthDisplay(selectedMonth)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, 1))}
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
              onClick={() => setIsAskAiOpen(true)}
              className="h-9 px-2.5 sm:px-3 rounded-xl gap-1.5 whitespace-nowrap"
              title={
                isFitnessEnabled
                  ? 'Ask Life OS across Finance, Fitness & Habits'
                  : 'Ask AI about your finances'
              }
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs sm:text-sm">
                {isFitnessEnabled ? 'Ask Life OS' : 'Ask Finances'}
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSharedSmsText(null);
                setIsSmsModalOpen(true);
              }}
              className="h-9 px-2.5 sm:px-3 rounded-xl gap-1.5 whitespace-nowrap"
              title="Fetch expenses from SMS or notifications"
            >
              <MessageSquareText className="w-4 h-4 text-primary" />
              <span className="text-xs sm:text-sm">SMS</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenBudgetModal()}
              className="hidden sm:inline-flex h-9 px-3 rounded-xl gap-1.5 whitespace-nowrap"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Budgets
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleOpenNewTx}
              className="hidden md:inline-flex h-9 px-3.5 rounded-xl gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </Button>
          </>
        }
      />

      {/* 4-Tab Finance V2 Architecture */}
      <div
        role="tablist"
        aria-label="Finance sections"
        className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-muted max-w-xl"
      >
        {(
          [
            { id: 'overview', label: 'Overview', badge: 0 },
            {
              id: 'activity',
              label: 'Activity',
              badge: summary.needsReviewCount || 0,
            },
            { id: 'trackers', label: 'Bills & Debt', badge: 0 },
            { id: 'accounts', label: 'Accounts', badge: 0 },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[42px] px-2 sm:px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-mono">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="h-44 rounded-2xl bg-muted/50 animate-pulse" />
          <div className="h-64 rounded-2xl bg-muted/50 animate-pulse" />
        </div>
      ) : (
        <div>
          {activeTab === 'overview' && (
            <OverviewTab
              onEditTransaction={handleOpenEditTx}
              onOpenBudgetModal={handleOpenBudgetModal}
              onOpenTrackersTab={() => setActiveTab('trackers')}
              onOpenActivityTab={() => setActiveTab('activity')}
              onOpenAddTransaction={handleOpenNewTx}
              onOpenAskAi={() => setIsAskAiOpen(true)}
            />
          )}
          {activeTab === 'activity' && (
            <ActivityTab
              onEditTransaction={handleOpenEditTx}
              onOpenAddTransaction={handleOpenNewTx}
              onOpenSmsImport={() => {
                setSharedSmsText(null);
                setIsSmsModalOpen(true);
              }}
            />
          )}
          {activeTab === 'trackers' && (
            <TrackersTab onLogOffsetExpense={handleOpenOffsetForCommitment} />
          )}
          {activeTab === 'accounts' && (
            <AccountsTab onOpenBudgetModal={handleOpenBudgetModal} />
          )}
        </div>
      )}


      {/* Keypad Bottom Sheet / Quick-Add Modal */}
      <AddTransactionModal
        open={isAddTxModalOpen}
        onOpenChange={setIsAddTxModalOpen}
        editingTransaction={editingTx}
        defaultCommitmentId={defaultCommitmentId}
        onOpenSmsImport={() => {
          setIsAddTxModalOpen(false);
          setSharedSmsText(null);
          setIsSmsModalOpen(true);
        }}
      />

      {/* Monthly & Category Budget Setting Sheet */}
      <MonthlyBudgetModal
        open={isBudgetModalOpen}
        onOpenChange={setIsBudgetModalOpen}
        focusCategoryId={focusCategoryId}
      />

      {/* SMS & Notification Expense Importer */}
      <SmsImportModal
        open={isSmsModalOpen}
        onOpenChange={setIsSmsModalOpen}
        initialText={sharedSmsText}
      />

      {/* Ask Life OS Cross-Domain Q&A Drawer */}
      <AskFinancesDrawer
        open={isAskAiOpen}
        onOpenChange={setIsAskAiOpen}
        userId={user?.id}
      />
    </div>
  );
}
