'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  badgeText?: string;
  badgeIcon?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  variant?: 'plain' | 'surface';
  className?: string;
}

/**
 * Standardized responsive PageHeader across HabitFlow workspaces.
 * Maintains a consistent typographic scale (text-2xl sm:text-3xl font-bold tracking-tight)
 * and clean alignment for 1–3 right-side header controls without noisy icon clutter.
 */
export function PageHeader({
  title,
  description,
  badgeText,
  badgeIcon,
  actions,
  children,
  variant = 'plain',
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        variant === 'surface'
          ? 'relative overflow-hidden surface-hero p-5 sm:p-6 md:p-7'
          : 'w-full',
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          {(badgeText || badgeIcon) && (
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              {badgeIcon}
              {badgeText}
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {children && (
        <div
          className={cn(
            'mt-4',
            variant === 'surface' && 'border-t border-border/60 pt-4'
          )}
        >
          {children}
        </div>
      )}
    </header>
  );
}
