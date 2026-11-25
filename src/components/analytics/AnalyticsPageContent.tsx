'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Activity, Award, CheckSquare, Sparkles, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { TimeRangePillSelector } from '@/components/analytics/time-range-selector';
import {
  type AnalyticsRangeKey,
  toAnalyticsRangeKey,
} from '@/lib/analytics/life-os-aggregator';
import { useLifeOsAnalytics } from '@/lib/analytics/use-life-os-analytics';
import { useFeedback } from '@/hooks/use-feedback';
import { cn } from '@/lib/utils';
import type { AnalyticsTabId, AnalyticsTabProps } from './tabs/types';

function TabLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading analytics tab">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-border bg-muted/40" />
        ))}
      </div>
      <div className="h-60 rounded-2xl border border-border bg-muted/40" />
    </div>
  );
}

const PulseAnalyticsTab = dynamic<AnalyticsTabProps>(() => import('./tabs/PulseAnalyticsTab'), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const HabitsAnalyticsTab = dynamic<AnalyticsTabProps>(() => import('./tabs/HabitsAnalyticsTab'), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const FinanceAnalyticsTab = dynamic<AnalyticsTabProps>(() => import('./tabs/FinanceAnalyticsTab'), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const FitnessAnalyticsTab = dynamic<AnalyticsTabProps>(() => import('./tabs/FitnessAnalyticsTab'), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});
const ReviewAnalyticsTab = dynamic<AnalyticsTabProps>(() => import('./tabs/ReviewAnalyticsTab'), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />,
});

const TAB_CONFIG: Array<{
  id: AnalyticsTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'pulse', label: 'Pulse', icon: Sparkles },
  { id: 'habits', label: 'Habits', icon: CheckSquare },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'fitness', label: 'Fitness', icon: Activity },
  { id: 'review', label: 'Review', icon: Award },
];

export default function AnalyticsPageContent() {
  const searchParams = useSearchParams();
  const feedback = useFeedback();
  const tabRefs = useRef<Partial<Record<AnalyticsTabId, HTMLButtonElement | null>>>({});

  const [range, setRange] = useState<AnalyticsRangeKey>(() =>
    toAnalyticsRangeKey(searchParams?.get('range'))
  );
  const { snapshot, showFinance, showFitness } = useLifeOsAnalytics(range);

  const visibleTabs = useMemo(
    () =>
      TAB_CONFIG.filter((t) => {
        if (t.id === 'finance' && !showFinance) return false;
        if (t.id === 'fitness' && !showFitness) return false;
        return true;
      }),
    [showFinance, showFitness]
  );

  const parseTabParam = useCallback(
    (raw?: string | null): AnalyticsTabId => {
      const normalized = raw === 'overview' ? 'pulse' : raw === 'wrapped' ? 'review' : raw;
      const match = visibleTabs.find((t) => t.id === normalized);
      return match ? match.id : 'pulse';
    },
    [visibleTabs]
  );

  const [activeTab, setActiveTab] = useState<AnalyticsTabId>(() =>
    parseTabParam(searchParams?.get('tab'))
  );

  useEffect(() => {
    const paramTab = searchParams?.get('tab');
    const paramRange = searchParams?.get('range');
    if (paramTab) setActiveTab(parseTabParam(paramTab));
    if (paramRange) setRange(toAnalyticsRangeKey(paramRange));
  }, [searchParams, parseTabParam]);

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab('pulse');
    }
  }, [visibleTabs, activeTab]);

  const updateUrlParams = useCallback((nextTab: AnalyticsTabId, nextRange: AnalyticsRangeKey) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', nextTab);
    url.searchParams.set('range', nextRange);
    window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
  }, []);

  const handleSelectTab = useCallback(
    (nextTab: AnalyticsTabId) => {
      feedback.tap();
      const resolved = parseTabParam(nextTab);
      setActiveTab(resolved);
      updateUrlParams(resolved, range);
      tabRefs.current[resolved]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    },
    [feedback, parseTabParam, range, updateUrlParams]
  );

  const handleRangeChange = useCallback(
    (nextRange: AnalyticsRangeKey) => {
      feedback.tap();
      setRange(nextRange);
      updateUrlParams(activeTab, nextRange);
    },
    [feedback, activeTab, updateUrlParams]
  );

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (visibleTabs.length === 0) return;
      const currentIndex = visibleTabs.findIndex((t) => t.id === activeTab);
      let targetIndex = -1;
      if (event.key === 'ArrowRight') targetIndex = (currentIndex + 1) % visibleTabs.length;
      else if (event.key === 'ArrowLeft')
        targetIndex = (currentIndex - 1 + visibleTabs.length) % visibleTabs.length;
      else if (event.key === 'Home') targetIndex = 0;
      else if (event.key === 'End') targetIndex = visibleTabs.length - 1;
      if (targetIndex === -1) return;
      event.preventDefault();
      const next = visibleTabs[targetIndex];
      handleSelectTab(next.id);
      tabRefs.current[next.id]?.focus();
    },
    [visibleTabs, activeTab, handleSelectTab]
  );

  return (
    <div className="w-full max-w-[1440px] mx-auto px-3.5 sm:px-6 lg:px-8 pb-24 md:pb-10">
      <div className="sticky top-0 z-20 -mx-3.5 sm:-mx-6 lg:-mx-8 px-3.5 sm:px-6 lg:px-8 pt-3 sm:pt-5 pb-3 bg-background/90 backdrop-blur-md border-b border-border/60 space-y-3">
        <PageHeader
          title="Analytics"
          description="Habits, money & body patterns in one view"
          actions={<TimeRangePillSelector value={range} onChange={handleRangeChange} />}
        />

        <div
          role="tablist"
          aria-label="Analytics domains"
          onKeyDown={handleTabKeyDown}
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide snap-x snap-proximity pb-0.5"
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                type="button"
                role="tab"
                id={`analytics-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`analytics-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handleSelectTab(tab.id)}
                className={cn(
                  'flex-none snap-start inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  isActive
                    ? 'bg-primary text-primary-foreground border-2 border-primary font-semibold shadow-xs'
                    : 'bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-muted/40'
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
                {isActive && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`analytics-panel-${activeTab}`}
        aria-labelledby={`analytics-tab-${activeTab}`}
        className="pt-4 sm:pt-6 min-w-0"
      >
        {activeTab === 'pulse' && (
          <PulseAnalyticsTab snapshot={snapshot} onSelectTab={handleSelectTab} />
        )}
        {activeTab === 'habits' && (
          <HabitsAnalyticsTab snapshot={snapshot} onSelectTab={handleSelectTab} />
        )}
        {activeTab === 'finance' && showFinance && (
          <FinanceAnalyticsTab snapshot={snapshot} onSelectTab={handleSelectTab} />
        )}
        {activeTab === 'fitness' && showFitness && (
          <FitnessAnalyticsTab snapshot={snapshot} onSelectTab={handleSelectTab} />
        )}
        {activeTab === 'review' && (
          <ReviewAnalyticsTab snapshot={snapshot} onSelectTab={handleSelectTab} />
        )}
      </div>
    </div>
  );
}
