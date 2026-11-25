'use client';

import React from 'react';
import {
  ANALYTICS_RANGE_OPTIONS,
  type AnalyticsRangeKey,
  toAnalyticsRangeKey,
  toLegacyTimeRange,
} from '@/lib/analytics/life-os-aggregator';
import { TimeRange } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TimeRangePillProps {
  value: AnalyticsRangeKey;
  onChange: (range: AnalyticsRangeKey) => void;
  className?: string;
}

export function TimeRangePillSelector({ value, onChange, className }: TimeRangePillProps) {
  return (
    <div
      role="group"
      aria-label="Analytics time range"
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1 shrink-0',
        className
      )}
    >
      {ANALYTICS_RANGE_OPTIONS.map((option) => {
        const isActive = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={isActive}
            title={option.label}
            onClick={() => onChange(option.key)}
            className={cn(
              'px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              isActive
                ? 'bg-background text-foreground border border-border/80 shadow-xs font-semibold'
                : 'border border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {option.shortLabel}
          </button>
        );
      })}
    </div>
  );
}

interface LegacyTimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
}

export function TimeRangeTabs({ value, onChange, className }: LegacyTimeRangeSelectorProps) {
  const normalized = toAnalyticsRangeKey(value);
  return (
    <TimeRangePillSelector
      value={normalized}
      onChange={(next) => onChange(toLegacyTimeRange(next))}
      className={className}
    />
  );
}

export function TimeRangeSelector({ value, onChange, className }: LegacyTimeRangeSelectorProps) {
  return <TimeRangeTabs value={value} onChange={onChange} className={className} />;
}
