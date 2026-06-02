import { Suspense } from 'react';
import { HabitsPageContent } from '@/components/habits';
import { HabitListSkeleton } from '@/components/ui/Skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function HabitsPage() {
  return (
    <Suspense fallback={
      <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-9 w-48 mb-2 animate-pulse" />
            <Skeleton className="h-5 w-72 animate-pulse" />
          </div>
          <Skeleton className="h-10 w-32 animate-pulse" />
        </div>
        <HabitListSkeleton />
      </div>
    }>
      <HabitsPageContent />
    </Suspense>
  );
}
