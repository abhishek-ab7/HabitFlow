'use client';

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useShallow } from 'zustand/react/shallow';
import { CreateTaskModal } from "./CreateTaskModal";
import { SmartTaskInput } from "./SmartTaskInput";
import { TaskCard } from "./TaskCard";

const EisenhowerMatrix = dynamic(
  () => import("./EisenhowerMatrix").then((m) => ({ default: m.EisenhowerMatrix })),
  {
    ssr: false,
    loading: () => <div className="h-96 rounded-2xl border border-border bg-card animate-pulse" />,
  }
);
import { toast } from "sonner";
import { useTaskStore } from "@/lib/stores/task-store";
import { TaskListSkeleton } from "@/components/ui/Skeletons";
import { EmptyTasksIllustration } from "@/components/ui/illustrations";
import { PageHeader } from "@/components/ui/page-header";
import { List, Grid2X2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/hooks/use-feedback";
import { GuidedTour, TourTriggerButton, usePageTour, PAGE_TOURS } from "@/components/tour";

function buildSubtasksMap<T extends { parentTaskId?: string | null; status: string }>(tasks: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const t of tasks) {
        if (!t.parentTaskId || t.status === 'archived') continue;
        const list = map.get(t.parentTaskId);
        if (list) list.push(t);
        else map.set(t.parentTaskId, [t]);
    }
    return map;
}

function TasksListBody({
    activeTasks,
    completedTasks,
    completedLimit,
    subtasksByParentId,
    onComplete,
    onShowMoreCompleted,
}: {
    activeTasks: ReturnType<typeof useTaskStore.getState>['tasks'];
    completedTasks: ReturnType<typeof useTaskStore.getState>['tasks'];
    completedLimit: number;
    subtasksByParentId: Map<string, ReturnType<typeof useTaskStore.getState>['tasks']>;
    onComplete: (id: string) => Promise<void>;
    onShowMoreCompleted: () => void;
}) {
    return (
        <div className="max-w-3xl mx-auto w-full space-y-8 tour-task-list">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        Active
                        <span className="font-mono tabular-nums text-foreground">{activeTasks.length}</span>
                    </h2>
                </div>
                {activeTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center rounded-xl border border-dashed border-border">
                        All active tasks completed.
                    </p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {activeTasks.map((task) => (
                            <div key={task.id} className="cv-auto">
                                <TaskCard task={task} subtasks={subtasksByParentId.get(task.id)} onComplete={onComplete} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {completedTasks.length > 0 && (
                <div className="space-y-3 pt-6 border-t border-border/60">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        Completed
                        <span className="font-mono tabular-nums">{completedTasks.length}</span>
                    </h2>
                    <div className="flex flex-col gap-3 opacity-65">
                        {completedTasks.slice(0, completedLimit).map((task) => (
                            <div key={task.id} className="cv-auto">
                                <TaskCard task={task} subtasks={subtasksByParentId.get(task.id)} onComplete={onComplete} />
                            </div>
                        ))}
                    </div>
                    {completedTasks.length > completedLimit && (
                        <Button type="button" variant="outline" size="sm" onClick={onShowMoreCompleted} className="w-full">
                            Show more completed ({completedTasks.length - completedLimit} remaining)
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

export default function TasksPageContent() {
    const { tasks, loadTasks, isLoading, toggleTaskComplete, addTask } = useTaskStore(
        useShallow((s) => ({
            tasks: s.tasks,
            loadTasks: s.loadTasks,
            isLoading: s.isLoading,
            toggleTaskComplete: s.toggleTaskComplete,
            addTask: s.addTask,
        }))
    );

    const [viewMode, setViewMode] = useState<'list' | 'eisenhower'>('list');
    const [completedLimit, setCompletedLimit] = useState(20);
    const feedback = useFeedback();
    const { isOpen: isTourOpen, startTour, closeTour, completeTour } = usePageTour('tasks');

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const handleTaskComplete = useCallback(async (id: string) => {
        const target = tasks.find((t) => t.id === id);
        if (target?.status === 'done') feedback.uncheck();
        else feedback.complete();
        try {
            await toggleTaskComplete(id);
            toast.success("Task updated");
        } catch {
            feedback.error();
            toast.error("Failed to update task");
        }
    }, [tasks, toggleTaskComplete, feedback]);

    const subtasksByParentId = useMemo(() => buildSubtasksMap(tasks), [tasks]);

    const handleQuickAddTask = async (task: { title: string; dueDate?: Date; tags?: string[] }) => {
        feedback.success();
        try {
            await addTask({
                title: task.title,
                priority: 'medium',
                due_date: task.dueDate?.toISOString(),
                tags: task.tags || [],
                isUrgent: false,
                isImportant: false
            });
            toast.success("Task created");
        } catch (error) {
            toast.error("Failed to create task");
            console.error(error);
        }
    };

    const activeTasks = useMemo(() => tasks.filter((t) => t.status !== 'done' && t.status !== 'archived' && !t.parentTaskId), [tasks]);
    const completedTasks = useMemo(() => tasks.filter((t) => t.status === 'done' && !t.parentTaskId), [tasks]);
    const hasAnyVisibleTasks = tasks.some((t) => t.status !== 'archived');

    return (
        <div className="w-full overflow-x-hidden px-4 py-6 sm:py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-6 pb-24 md:pb-12">
            <PageHeader
                title="My Tasks"
                description="Manage your daily priorities and project to-dos."
                actions={
                    <>
                        <TourTriggerButton onClick={startTour} pageTitle="Tasks" />
                        <div className="inline-flex items-center gap-1 bg-muted p-1 rounded-xl border border-border/60 tour-task-views">
                            {([['list', 'List', List], ['eisenhower', 'Eisenhower', Grid2X2]] as const).map(([mode, label, Icon]) => (
                                <Button
                                    key={mode}
                                    variant={viewMode === mode ? 'default' : 'ghost'}
                                    size="sm"
                                    className="h-8 px-2.5 rounded-lg text-xs font-medium"
                                    onClick={() => { feedback.tap(); setViewMode(mode); }}
                                >
                                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                                    {label}
                                </Button>
                            ))}
                        </div>
                        <CreateTaskModal onTaskCreated={loadTasks} />
                    </>
                }
            />

            <div className="max-w-3xl mx-auto w-full tour-task-input">
                <SmartTaskInput onAddTask={handleQuickAddTask} />
            </div>

            {isLoading && tasks.length === 0 ? (
                <TaskListSkeleton />
            ) : !hasAnyVisibleTasks ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                    <EmptyTasksIllustration />
                    <div>
                        <h3 className="text-lg font-medium">No tasks yet</h3>
                        <p className="text-sm text-muted-foreground">Get started by creating your first task.</p>
                    </div>
                </div>
            ) : viewMode === 'list' ? (
                <TasksListBody
                    activeTasks={activeTasks}
                    completedTasks={completedTasks}
                    completedLimit={completedLimit}
                    subtasksByParentId={subtasksByParentId}
                    onComplete={handleTaskComplete}
                    onShowMoreCompleted={() => setCompletedLimit((c) => c + 20)}
                />
            ) : (
                <EisenhowerMatrix tasks={tasks} onComplete={handleTaskComplete} />
            )}

            <GuidedTour {...PAGE_TOURS.tasks} isOpen={isTourOpen} onClose={closeTour} onComplete={completeTour} />
        </div>
    );
}
