'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  MessageSquareText,
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
import { Button } from '@/components/ui/button';
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

  useEffect(() => {
    loadFinanceData(user?.id);
  }, [loadFinanceData, user?.id]);

  // Handle Web Share Target / Shortcuts / Tasker (?sms=... or ?text=...) once loaded
  useEffect(() => {
    if (isLoading || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const incoming = params.get('sms') || params.get('text');
    if (incoming && incoming.trim()) {
      setSharedSmsText(incoming);
      setIsSmsModalOpen(true);
      params.delete('sms');
      params.delete('text');
      params.delete('title');
      params.delete('url');
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
    <div className="container max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-28 md:py-6 md:pb-16 space-y-5">
      {/* Compact Header & Month Switcher */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Finance
        </h1>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-xl border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, -1))}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs sm:text-sm font-semibold text-foreground min-w-[84px] text-center whitespace-nowrap font-mono tabular-nums">
              {formatMonthDisplay(selectedMonth)}
            </span>
            <button
              type="button"
              onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, 1))}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSharedSmsText(null);
              setIsSmsModalOpen(true);
            }}
            className="min-h-[40px] sm:min-h-[44px] px-3 rounded-xl gap-1.5 whitespace-nowrap"
            title="Fetch expenses from SMS or notifications"
          >
            <MessageSquareText className="w-4 h-4 text-primary" />
            <span className="text-xs sm:text-sm">SMS</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenBudgetModal()}
            className="hidden sm:inline-flex min-h-[44px] px-3.5 rounded-xl gap-1.5 whitespace-nowrap"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Budgets
          </Button>

          <Button
            type="button"
            onClick={handleOpenNewTx}
            className="hidden md:inline-flex min-h-[44px] px-4 rounded-xl gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </Button>
        </div>
      </div>

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
          {activeTab === 'accounts' && <AccountsTab />}
        </div>
      )}

      {/* Floating Thumb-Zone Add Button */}
      <button
        type="button"
        onClick={handleOpenNewTx}
        aria-label="Add expense or income"
        className="fixed bottom-20 right-20 md:bottom-6 md:right-24 z-40 h-12 md:h-14 px-5 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-95 active:scale-95 transition-transform flex items-center gap-2 text-sm font-semibold whitespace-nowrap"
      >
        <Plus className="w-5 h-5" />
        <span>Add</span>
      </button>

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
    </div>
  );
}
