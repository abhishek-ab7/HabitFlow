import { Suspense } from "react";
import { TasksPageContent } from "@/components/tasks";
import { TaskListSkeleton } from "@/components/ui/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function TasksPage() {
    return (
        <Suspense fallback={
            <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Skeleton className="h-10 w-48 rounded animate-pulse" />
                        <Skeleton className="h-5 w-72 mt-2 rounded animate-pulse" />
                    </div>
                    <Skeleton className="h-10 w-32 rounded animate-pulse" />
                </div>
                <TaskListSkeleton />
            </div>
        }>
            <TasksPageContent />
        </Suspense>
    );
}
