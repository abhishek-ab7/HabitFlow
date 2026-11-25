'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyticsChartCardProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
  onEmptyAction?: () => void;
  children?: React.ReactNode;
  className?: string;
}

function AnalyticsChartCardInner({
  title,
  subtitle,
  badge,
  headerRight,
  isEmpty = false,
  emptyTitle = 'Not enough data yet',
  emptyDescription = 'Log a few entries in this range to unlock trend clarity.',
  emptyActionLabel,
  emptyActionHref,
  onEmptyAction,
  children,
  className,
}: AnalyticsChartCardProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-3',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-semibold tracking-tight text-foreground">
              {title}
            </h3>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground leading-snug">{subtitle}</p>
          )}
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>

      {isEmpty ? (
        <div className="rounded-xl bg-muted/35 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-foreground">{emptyTitle}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{emptyDescription}</p>
          </div>
          {emptyActionLabel && emptyActionHref && (
            <Link
              href={emptyActionHref}
              className="inline-flex items-center gap-1.5 self-start sm:self-center shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 transition-colors"
            >
              <span>{emptyActionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
          {emptyActionLabel && !emptyActionHref && onEmptyAction && (
            <button
              type="button"
              onClick={onEmptyAction}
              className="inline-flex items-center gap-1.5 self-start sm:self-center shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 transition-colors"
            >
              <span>{emptyActionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <div className="w-full min-w-0">{children}</div>
      )}
    </section>
  );
}

export const AnalyticsChartCard = React.memo(AnalyticsChartCardInner);
