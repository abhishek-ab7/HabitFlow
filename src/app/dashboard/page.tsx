import { Suspense } from 'react';
import { DashboardContent, DashboardCenterLoader } from '@/components/dashboard';

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-6xl mx-auto flex flex-col items-center justify-center min-h-[500px]">
        <DashboardCenterLoader />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
