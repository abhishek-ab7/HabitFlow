import { Suspense } from 'react';
import { DashboardContent } from '@/components/dashboard';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-6xl mx-auto">
        <Skeleton className="h-40 rounded-2xl mb-8" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
