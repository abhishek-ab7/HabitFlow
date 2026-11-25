'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface AnalyticsKpiItem {
  id: string;
  label: string;
  value: string;
  subtitle?: string;
  deltaText?: string;
  deltaTone?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  onClick?: () => void;
}

interface AnalyticsKpiGridProps {
  items: AnalyticsKpiItem[];
  className?: string;
}

const DELTA_TONE_CLASSES: Record<NonNullable<AnalyticsKpiItem['deltaTone']>, string> = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-rose-600 dark:text-rose-400',
  neutral: 'text-muted-foreground',
};

function AnalyticsKpiGridInner({ items, className }: AnalyticsKpiGridProps) {
  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5', className)}>
      {items.map((item) => {
        const Comp = item.onClick ? 'button' : 'div';
        return (
          <Comp
            key={item.id}
            {...(item.onClick ? { type: 'button' as const, onClick: item.onClick } : {})}
            className={cn(
              'flex flex-col justify-between gap-2 rounded-2xl border border-border bg-card p-3.5 sm:p-4 text-left transition-colors',
              item.onClick && 'hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground truncate">
                {item.label}
              </span>
              {item.icon && (
                <span className="shrink-0 text-muted-foreground" aria-hidden="true">
                  {item.icon}
                </span>
              )}
            </div>

            <div className="text-[22px] sm:text-[26px] font-bold tracking-tight text-foreground tabular-nums leading-none">
              {item.value}
            </div>

            {(item.deltaText || item.subtitle) && (
              <div className="flex items-center justify-between gap-1.5 text-[11px] leading-tight">
                {item.deltaText ? (
                  <span
                    className={cn(
                      'font-medium tabular-nums truncate',
                      DELTA_TONE_CLASSES[item.deltaTone ?? 'neutral']
                    )}
                  >
                    {item.deltaText}
                  </span>
                ) : (
                  <span />
                )}
                {item.subtitle && (
                  <span className="text-muted-foreground truncate">{item.subtitle}</span>
                )}
              </div>
            )}
          </Comp>
        );
      })}
    </div>
  );
}

export const AnalyticsKpiGrid = React.memo(AnalyticsKpiGridInner);
