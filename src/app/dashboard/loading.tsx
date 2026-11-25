import { DashboardCenterLoader } from '@/components/dashboard/DashboardCenterLoader';

export default function DashboardLoading() {
  return (
    <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto flex flex-col items-center justify-center min-h-[420px]">
      <DashboardCenterLoader />
    </div>
  );
}
