'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description: string;
  badgeText?: string;
  badgeIcon?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  badgeText,
  badgeIcon,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden surface-hero p-6 md:p-8',
        className
      )}
    >
      <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-2.5">
          {(badgeText || badgeIcon) && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
              {badgeIcon}
              {badgeText}
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
            {description}
          </p>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {children && (
        <div className="relative z-10 mt-6 border-t border-border/60 pt-5">
          {children}
        </div>
      )}
    </div>
  );
}
