import { Suspense } from 'react';
import DashboardContent from '@/components/dashboard/DashboardContent';
import { DashboardCenterLoader } from '@/components/dashboard/DashboardCenterLoader';

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto flex flex-col items-center justify-center min-h-[500px]">
        <DashboardCenterLoader />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
