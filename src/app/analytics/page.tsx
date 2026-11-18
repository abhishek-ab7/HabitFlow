import { Suspense } from 'react';
import { AnalyticsPageContent } from '@/components/analytics';
import { Skeleton } from '@/components/ui/skeleton';

export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-muted rounded w-48" />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-80 bg-muted rounded-xl" />
            <div className="h-80 bg-muted rounded-xl" />
            <div className="h-80 bg-muted rounded-xl md:col-span-2" />
          </div>
        </div>
      </div>
    }>
      <AnalyticsPageContent />
    </Suspense>
  );
}
