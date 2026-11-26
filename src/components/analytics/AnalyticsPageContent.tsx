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

function AnalyticsTabStrip(props: {
  visibleTabs: typeof TAB_CONFIG;
  activeTab: AnalyticsTabId;
  tabRefs: React.MutableRefObject<Partial<Record<AnalyticsTabId, HTMLButtonElement | null>>>;
  onSelectTab: (tab: AnalyticsTabId) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const { visibleTabs, activeTab, tabRefs, onSelectTab, onKeyDown } = props;
  return (
    <div
      role="tablist"
      aria-label="Analytics domains"
      onKeyDown={onKeyDown}
      className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide snap-x snap-proximity pb-0.5"
    >
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[tab.id] = el; }}
            type="button"
            role="tab"
            id={`analytics-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`analytics-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelectTab(tab.id)}
            className={cn(
              'flex-none snap-start inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              isActive
                ? 'bg-primary text-primary-foreground border-2 border-primary font-semibold shadow-xs'
                : 'bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-muted/40'
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{tab.label}</span>
            {isActive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

function AnalyticsTabPanel(props: {
  activeTab: AnalyticsTabId;
  snapshot: AnalyticsTabProps['snapshot'];
  showFinance: boolean;
  showFitness: boolean;
  onSelectTab: (tab: AnalyticsTabId) => void;
}) {
  const { activeTab, snapshot, showFinance, showFitness, onSelectTab } = props;
  const views: Record<AnalyticsTabId, React.ReactNode> = {
    pulse: <PulseAnalyticsTab snapshot={snapshot} onSelectTab={onSelectTab} />,
    habits: <HabitsAnalyticsTab snapshot={snapshot} onSelectTab={onSelectTab} />,
    finance: showFinance ? <FinanceAnalyticsTab snapshot={snapshot} onSelectTab={onSelectTab} /> : null,
    fitness: showFitness ? <FitnessAnalyticsTab snapshot={snapshot} onSelectTab={onSelectTab} /> : null,
    review: <ReviewAnalyticsTab snapshot={snapshot} onSelectTab={onSelectTab} />,
  };

  return (
    <div role="tabpanel" id={`analytics-panel-${activeTab}`} aria-labelledby={`analytics-tab-${activeTab}`} className="pt-4 sm:pt-6 min-w-0">
      {views[activeTab]}
    </div>
  );
}

function resolveTargetTabIndex(key: string, currentIndex: number, length: number): number {
  if (key === 'ArrowRight') return (currentIndex + 1) % length;
  if (key === 'ArrowLeft') return (currentIndex - 1 + length) % length;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  return -1;
}

function updateAnalyticsUrlParams(nextTab: AnalyticsTabId, nextRange: AnalyticsRangeKey) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('tab', nextTab);
  url.searchParams.set('range', nextRange);
  window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
}

function resolveAnalyticsTabId(raw: string | null | undefined, visibleTabs: typeof TAB_CONFIG): AnalyticsTabId {
  const normalized = raw === 'overview' ? 'pulse' : raw === 'wrapped' ? 'review' : raw;
  return visibleTabs.find((t) => t.id === normalized)?.id ?? 'pulse';
}

function useAnalyticsUrlSync(params: {
  searchParams: ReturnType<typeof useSearchParams>;
  visibleTabs: typeof TAB_CONFIG;
  activeTab: AnalyticsTabId;
  parseTabParam: (raw?: string | null) => AnalyticsTabId;
  setActiveTab: (tab: AnalyticsTabId) => void;
  setRange: (range: AnalyticsRangeKey) => void;
}) {
  const { searchParams, visibleTabs, activeTab, parseTabParam, setActiveTab, setRange } = params;
  useEffect(() => {
    const paramTab = searchParams?.get('tab');
    const paramRange = searchParams?.get('range');
    if (paramTab) setActiveTab(parseTabParam(paramTab));
    if (paramRange) setRange(toAnalyticsRangeKey(paramRange));
  }, [searchParams, parseTabParam, setActiveTab, setRange]);

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab('pulse');
  }, [visibleTabs, activeTab, setActiveTab]);
}

function navigateAnalyticsTabsByKey(params: {
  event: React.KeyboardEvent<HTMLDivElement>;
  visibleTabs: typeof TAB_CONFIG;
  activeTab: AnalyticsTabId;
  onSelectTab: (tab: AnalyticsTabId) => void;
  tabRefs: React.MutableRefObject<Partial<Record<AnalyticsTabId, HTMLButtonElement | null>>>;
}) {
  const { event, visibleTabs, activeTab, onSelectTab, tabRefs } = params;
  if (visibleTabs.length === 0) return;
  const targetIndex = resolveTargetTabIndex(event.key, visibleTabs.findIndex((t) => t.id === activeTab), visibleTabs.length);
  if (targetIndex === -1) return;
  event.preventDefault();
  const next = visibleTabs[targetIndex];
  onSelectTab(next.id);
  tabRefs.current[next.id]?.focus();
}

function useAnalyticsPageController() {
  const searchParams = useSearchParams();
  const feedback = useFeedback();
  const tabRefs = useRef<Partial<Record<AnalyticsTabId, HTMLButtonElement | null>>>({});

  const [range, setRange] = useState<AnalyticsRangeKey>(() => toAnalyticsRangeKey(searchParams?.get('range')));
  const { snapshot, showFinance, showFitness } = useLifeOsAnalytics(range);

  const visibleTabs = useMemo(
    () => TAB_CONFIG.filter((t) => (t.id !== 'finance' || showFinance) && (t.id !== 'fitness' || showFitness)),
    [showFinance, showFitness]
  );

  const parseTabParam = useCallback(
    (raw?: string | null) => resolveAnalyticsTabId(raw, visibleTabs),
    [visibleTabs]
  );

  const [activeTab, setActiveTab] = useState<AnalyticsTabId>(() => parseTabParam(searchParams?.get('tab')));
  useAnalyticsUrlSync({ searchParams, visibleTabs, activeTab, parseTabParam, setActiveTab, setRange });

  const handleSelectTab = useCallback(
    (nextTab: AnalyticsTabId) => {
      feedback.tap();
      const resolved = parseTabParam(nextTab);
      setActiveTab(resolved);
      updateAnalyticsUrlParams(resolved, range);
      tabRefs.current[resolved]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    },
    [feedback, parseTabParam, range]
  );

  const handleRangeChange = useCallback(
    (nextRange: AnalyticsRangeKey) => {
      feedback.tap();
      setRange(nextRange);
      updateAnalyticsUrlParams(activeTab, nextRange);
    },
    [feedback, activeTab]
  );

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) =>
      navigateAnalyticsTabsByKey({ event, visibleTabs, activeTab, onSelectTab: handleSelectTab, tabRefs }),
    [visibleTabs, activeTab, handleSelectTab]
  );

  return {
    range, snapshot, showFinance, showFitness,
    visibleTabs, activeTab, tabRefs,
    handleSelectTab, handleRangeChange, handleTabKeyDown,
  };
}

export default function AnalyticsPageContent() {
  const c = useAnalyticsPageController();

  return (
    <div className="w-full max-w-[1440px] mx-auto px-3.5 sm:px-6 lg:px-8 pb-24 md:pb-10">
      <div className="sticky top-0 z-20 -mx-3.5 sm:-mx-6 lg:-mx-8 px-3.5 sm:px-6 lg:px-8 pt-3 sm:pt-5 pb-3 bg-background/90 backdrop-blur-md border-b border-border/60 space-y-3">
        <PageHeader
          title="Analytics"
          description="Habits, money & body patterns in one view"
          actions={<TimeRangePillSelector value={c.range} onChange={c.handleRangeChange} />}
        />
        <AnalyticsTabStrip visibleTabs={c.visibleTabs} activeTab={c.activeTab} tabRefs={c.tabRefs} onSelectTab={c.handleSelectTab} onKeyDown={c.handleTabKeyDown} />
      </div>

      <AnalyticsTabPanel activeTab={c.activeTab} snapshot={c.snapshot} showFinance={c.showFinance} showFitness={c.showFitness} onSelectTab={c.handleSelectTab} />
    </div>
  );
}
