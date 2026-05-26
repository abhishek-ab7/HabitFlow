'use client';

import { useEffect, useState, useMemo } from "react";
import { useShallow } from 'zustand/react/shallow';
import { CreateTaskModal, SmartTaskInput, TaskCard, EisenhowerMatrix } from "@/components/tasks";
import { toast } from "sonner";
import { useTaskStore } from "@/lib/stores/task-store";
import { TaskListSkeleton } from "@/components/ui/Skeletons";
import { EmptyTasksIllustration } from "@/components/ui/illustrations";
import { List, Grid2X2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TasksPageContent() {
    const { tasks, loadTasks, isLoading, toggleTaskComplete, editTask, addTask } = useTaskStore(
        useShallow((s) => ({
            tasks: s.tasks,
            loadTasks: s.loadTasks,
            isLoading: s.isLoading,
            toggleTaskComplete: s.toggleTaskComplete,
            editTask: s.editTask,
            addTask: s.addTask,
        }))
    );

    const [viewMode, setViewMode] = useState<'list' | 'eisenhower'>('list');

    // Initial load
    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const handleTaskComplete = async (id: string) => {
        try {
            await toggleTaskComplete(id);
            toast.success("Task updated");
        } catch (error) {
            toast.error("Failed to update task");
        }
    };

    const handleQuickAddTask = async (task: { title: string; dueDate?: Date; tags?: string[] }) => {
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

    // Memoize active & completed tasks
    const activeTasks = useMemo(() =>
        tasks.filter(t => t.status !== 'done' && t.status !== 'archived'),
        [tasks]
    );

    const completedTasks = useMemo(() =>
        tasks.filter(t => t.status === 'done'),
        [tasks]
    );

    return (
        <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-[1400px] mx-auto space-y-8 h-[calc(100vh-4rem)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
                        My Tasks
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your daily tasks and project to-dos.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                        <Button
                            variant={viewMode === 'list' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setViewMode('list')}
                        >
                            <List className="h-4 w-4 mr-1" />
                            List View
                        </Button>
                        <Button
                            variant={viewMode === 'eisenhower' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setViewMode('eisenhower')}
                        >
                            <Grid2X2 className="h-4 w-4 mr-1" />
                            Eisenhower
                        </Button>
                    </div>
                    <CreateTaskModal onTaskCreated={loadTasks} />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 space-y-6 flex flex-col">
                {/* Quick Add Input */}
                <div className="max-w-3xl mx-auto w-full shrink-0">
                    <SmartTaskInput onAddTask={handleQuickAddTask} />
                </div>

                {isLoading && tasks.length === 0 ? (
                    <TaskListSkeleton />
                ) : tasks.filter(t => t.status !== 'archived').length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                        <div>
                            <EmptyTasksIllustration />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium">No tasks yet</h3>
                            <p className="text-muted-foreground">Get started by creating your first task.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0">
                        {viewMode === 'list' ? (
                            <div className="space-y-8 overflow-y-auto h-full pr-2 pb-8 scrollbar-thin">
                                {/* Active Tasks */}
                                <div className="space-y-4">
                                    <h2 className="text-xl font-semibold flex items-center gap-2">
                                        Active <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{activeTasks.length}</span>
                                    </h2>
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {activeTasks.map((task) => (
                                            <TaskCard
                                                key={task.id}
                                                task={task}
                                                onComplete={handleTaskComplete}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Completed Tasks */}
                                {completedTasks.length > 0 && (
                                    <div className="space-y-4 pt-8 border-t border-border/40">
                                        <h2 className="text-xl font-semibold text-muted-foreground flex items-center gap-2">
                                            Completed <span className="text-sm font-normal bg-muted px-2 py-0.5 rounded-full">{completedTasks.length}</span>
                                        </h2>
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
                                            {completedTasks.map((task) => (
                                                <TaskCard
                                                    key={task.id}
                                                    task={task}
                                                    onComplete={handleTaskComplete}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <EisenhowerMatrix tasks={tasks} onComplete={handleTaskComplete} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
