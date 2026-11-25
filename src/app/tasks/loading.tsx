import { DashboardCenterLoader } from '@/components/dashboard/DashboardCenterLoader';

export default function TasksLoading() {
  return (
    <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-6xl mx-auto flex flex-col items-center justify-center min-h-[360px]">
      <DashboardCenterLoader />
    </div>
  );
}
