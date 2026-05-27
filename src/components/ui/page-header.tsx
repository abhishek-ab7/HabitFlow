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
    <div className={cn(
      "relative overflow-hidden rounded-[32px] bg-gradient-to-br from-white via-indigo-50/50 to-purple-50 dark:from-slate-900 dark:via-purple-950/20 dark:to-slate-900 p-8 md:p-10 border border-slate-200/50 dark:border-slate-800/50 shadow-xl",
      className
    )}>
      {/* Noise/Grain texture layer */}
      <div className="absolute inset-0 bg-noise opacity-[0.015] dark:opacity-[0.03] pointer-events-none mix-blend-overlay" />
      <div className="absolute inset-0 bg-white/20 dark:bg-slate-900/5 backdrop-blur-3xl z-0" />
      
      <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-3">
          {(badgeText || badgeIcon) && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-wider">
              {badgeIcon}
              {badgeText}
            </div>
          )}
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-slate-800 dark:text-white">
            {title}
          </h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-2xl font-semibold leading-relaxed">
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
        <div className="relative z-10 mt-8 border-t border-slate-200/40 dark:border-slate-800/30 pt-6">
          {children}
        </div>
      )}
    </div>
  );
}
