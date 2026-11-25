import { Skeleton } from '@/components/ui/skeleton';

export default function FitnessLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <Skeleton className="h-10 w-56 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
