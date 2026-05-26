'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function TaskListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="p-5 rounded-2xl border border-border/40 bg-card/25 space-y-4">
          <div className="flex items-start gap-4">
            {/* Checkbox circle */}
            <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              {/* Title & Badge */}
              <div className="flex justify-between items-center gap-2">
                <Skeleton className="h-5 w-3/4 rounded" />
                <Skeleton className="h-4 w-6 rounded" />
              </div>
              {/* Description */}
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-2/3 rounded" />
            </div>
          </div>
          {/* Metadata */}
          <div className="flex gap-4 pt-1">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HabitListSkeleton() {
  return (
    <div className="space-y-4 w-full">
      <div className="flex justify-between items-center pb-2 border-b border-border/30">
        <Skeleton className="h-6 w-32 rounded" />
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="w-8 h-8 rounded-lg" />
          ))}
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card/15">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 7 }).map((_, j) => (
              <Skeleton key={j} className="w-8 h-8 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GoalListSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-6 rounded-2xl border border-border/40 bg-card/25 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5 flex-1 mr-4">
              <Skeleton className="h-5 w-3/4 rounded" />
              <Skeleton className="h-3.5 w-1/3 rounded" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-12 rounded" />
              <Skeleton className="h-3 w-8 rounded" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          {/* Milestones count */}
          <div className="pt-2 flex justify-between items-center text-xs">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-12 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
