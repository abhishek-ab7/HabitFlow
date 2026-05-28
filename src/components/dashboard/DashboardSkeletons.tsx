'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Shimmer layout helper to give premium dark/light mode texture
function SkeletonContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function HeroSectionSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl mb-8 bg-card/30 border border-white/5 p-8 md:p-10">
      <div className="space-y-4 max-w-xl">
        <Skeleton className="h-8 w-12 rounded-lg" />
        <Skeleton className="h-10 w-[70%] rounded-xl" />
        <Skeleton className="h-5 w-[90%] rounded-lg" />
        <Skeleton className="h-4 w-[40%] rounded-lg" />
      </div>
    </div>
  );
}

export function MoodCheckInSkeleton() {
  return (
    <div className="bg-card/30 backdrop-blur-md border border-white/5 p-6 rounded-3xl mb-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-lg" />
        </div>
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-12 rounded-2xl shrink-0" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function MomentumCardSkeleton() {
  return (
    <div className="bg-card/45 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center gap-6 mb-6">
      {/* Pulse Ring Circle */}
      <div className="relative w-[100px] h-[100px] rounded-full border-[8px] border-muted/20 flex items-center justify-center shrink-0">
        <Skeleton className="absolute inset-2 rounded-full" />
      </div>
      <div className="flex-1 space-y-3 w-full">
        <Skeleton className="h-7 w-48 rounded-lg mx-auto sm:mx-0" />
        <Skeleton className="h-4 w-[90%] sm:w-[80%] rounded-lg mx-auto sm:mx-0" />
        <div className="flex flex-wrap justify-center sm:justify-start gap-4 pt-1">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function MetricCardsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="relative overflow-hidden bg-card/30 border border-white/5 h-full">
          <CardContent className="p-6 flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-9 w-20 rounded-lg" />
              <Skeleton className="h-3.5 w-32 rounded" />
            </div>
            <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TodayTasksSkeleton() {
  return (
    <section className="bg-card/30 backdrop-blur-2xl rounded-3xl border border-white/5 shadow-2xl p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-7 w-36 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-28 rounded ml-12" />
        </div>
        <Skeleton className="h-9 w-20 rounded-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-muted/30 border border-border/10 rounded-2xl flex flex-col justify-between h-[120px] space-y-2">
            <div className="space-y-2">
              <Skeleton className="h-5 w-[85%] rounded" />
              <Skeleton className="h-4 w-[50%] rounded" />
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HabitOverviewSkeleton() {
  return (
    <section className="bg-card/30 backdrop-blur-2xl rounded-3xl border border-white/5 shadow-2xl p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-7 w-44 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-48 rounded ml-12" />
        </div>
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-muted/20 border border-border/5 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="h-6 w-6 rounded-lg shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-40 rounded" />
                <Skeleton className="h-2.5 w-[60%] rounded-full" />
              </div>
            </div>
            <Skeleton className="h-8 w-16 rounded-xl" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function FocusGoalSkeleton() {
  return (
    <section className="bg-card/30 backdrop-blur-2xl rounded-3xl border border-white/5 shadow-2xl p-6 md:p-8 space-y-6 h-full flex flex-col justify-between">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-7 w-32 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-40 rounded ml-12" />
          </div>
          <Skeleton className="h-9 w-20 rounded-xl" />
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/5 rounded-2xl gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
            <div className="relative w-14 h-14 rounded-full border-4 border-muted/20 flex items-center justify-center shrink-0">
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="pt-4 border-t border-border/10">
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>
    </section>
  );
}

export function AICoachSkeleton() {
  return (
    <div className="bg-card/30 backdrop-blur-2xl rounded-3xl border border-white/5 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-6 w-32 rounded" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-[90%] rounded" />
        <Skeleton className="h-4 w-[75%] rounded" />
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}

export function PersonalizedQuoteSkeleton() {
  return (
    <div className="bg-card/30 backdrop-blur-2xl rounded-3xl border border-white/5 p-6 flex items-center gap-4">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-3 w-[40%] rounded" />
      </div>
    </div>
  );
}

export function QuickActionsSkeleton() {
  return (
    <div className="bg-card/30 backdrop-blur-2xl rounded-3xl border border-white/5 p-6 space-y-4">
      <Skeleton className="h-6 w-32 rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    </div>
  );
}

export function WeeklyReviewSkeleton() {
  return (
    <div className="bg-card/30 backdrop-blur-2xl rounded-3xl border border-white/5 p-6 space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-40 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="h-[120px] w-full flex items-end gap-2 px-2">
        {[40, 60, 20, 80, 50, 90, 30].map((height, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <Skeleton className="w-full rounded-t-lg" style={{ height: `${height}px` }} />
            <Skeleton className="h-3 w-6 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
