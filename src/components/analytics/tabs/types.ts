import type { LifeOsAnalyticsSnapshot } from '@/lib/analytics/life-os-aggregator';

export type AnalyticsTabId = 'pulse' | 'habits' | 'finance' | 'fitness' | 'review';

export interface AnalyticsTabProps {
  snapshot: LifeOsAnalyticsSnapshot;
  onSelectTab: (tab: AnalyticsTabId) => void;
}
