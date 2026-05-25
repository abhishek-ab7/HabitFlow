"use client"

import { useEffect, useState, useMemo } from "react"
import { TaskCard, CreateTaskModal, SmartTaskInput } from "@/components/tasks"
import { Loader2, Inbox } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useTaskStore } from "@/lib/stores/task-store"
import type { Task } from "@/lib/types"

export default function TasksPage() {
    const { tasks, loadTasks, isLoading, toggleTaskComplete, editTask, addTask } = useTaskStore()

    // Initial load
    useEffect(() => {
        loadTasks()
    }, [loadTasks])

    const handleTaskComplete = async (id: string) => {
        try {
            await toggleTaskComplete(id)
            toast.success("Task updated")
        } catch (error) {
            toast.error("Failed to update task")
        }
    }

    const handleQuickAddTask = async (task: { title: string; dueDate?: Date; tags?: string[] }) => {
        try {
            await addTask({
                title: task.title,
                priority: 'medium',
                due_date: task.dueDate?.toISOString(),
                tags: task.tags || []
            });
            toast.success("Task created");
            // No need to reload, store updates
        } catch (error) {
            toast.error("Failed to create task");
            console.error(error);
        }
    };

    // ⚡ OPTIMIZATION: Memoize filtered tasks to prevent recalculation on every render
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
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        My Tasks
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your daily tasks and project to-dos.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Note: CreateTaskModal calls onTaskCreated. Since we use store, we can just reload or let store update. 
                        Usually store updates state immediately. But refreshing is safe. */}
                    <CreateTaskModal onTaskCreated={loadTasks} />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 space-y-6">
                {/* Quick Add Input */}
                <div className="max-w-3xl mx-auto w-full">
                    <SmartTaskInput onAddTask={handleQuickAddTask} />
                </div>

                {isLoading && tasks.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : tasks.filter(t => t.status !== 'archived').length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
                        <div className="p-4 rounded-full bg-muted/50">
                            <Inbox className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium">No tasks yet</h3>
                            <p className="text-muted-foreground">Get started by creating your first task.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 overflow-y-auto h-full pr-2">
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
                                            // TaskCard might not have 'onComplete' enabled for completed items, or re-toggle
                                            onComplete={handleTaskComplete}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
