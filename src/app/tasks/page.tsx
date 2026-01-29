"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { TaskCard } from "@/components/tasks/TaskCard"
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal"
import { KanbanBoard } from "@/components/tasks/KanbanBoard"
import { motion } from "framer-motion"
import { Loader2, Inbox } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/supabase/types"

type Task = Database['public']['Tables']['tasks']['Row']

export default function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'list' | 'board'>('list')
    const supabase = createClient()

    useEffect(() => {
        fetchTasks()
    }, [])

    const fetchTasks = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("tasks")
            .select("*")
            .neq("status", "archived")
            .order("created_at", { ascending: false })

        if (error) {
            toast.error("Failed to load tasks")
        } else {
            setTasks(data || [])
        }
        setLoading(false)
    }

    const handleTaskComplete = async (id: string) => {
        // Optimistic update
        setTasks(prev => prev.map(t =>
            t.id === id ? { ...t, status: 'done' } : t
        ))

        const { error } = await (supabase.from("tasks") as any)
            .update({ status: 'done', updated_at: new Date().toISOString() } as any)
            .eq("id", id)

        if (error) {
            toast.error("Failed to update task")
            fetchTasks() // Revert on error
        } else {
            toast.success("Task completed!")
        }
    }

    const handleTaskUpdate = async (updatedTask: Task) => {
        // Optimistic update
        setTasks(prev => prev.map(t =>
            t.id === updatedTask.id ? updatedTask : t
        ))

        const { error } = await (supabase.from("tasks") as any)
            .update({ status: updatedTask.status, updated_at: new Date().toISOString() } as any)
            .eq("id", updatedTask.id)

        if (error) {
            toast.error("Failed to update task status")
            fetchTasks() // Revert
        }
    }

    const activeTasks = tasks.filter(t => t.status !== 'done')
    const completedTasks = tasks.filter(t => t.status === 'done')

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
                    <div className="flex bg-muted p-1 rounded-lg border border-border/50">
                        <button
                            onClick={() => setView('list')}
                            className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-all", view === 'list' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                            List
                        </button>
                        <button
                            onClick={() => setView('board')}
                            className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-all", view === 'board' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                            Board
                        </button>
                    </div>
                    <CreateTaskModal onTaskCreated={fetchTasks} />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
                        <div className="p-4 rounded-full bg-muted/50">
                            <Inbox className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium">No tasks yet</h3>
                            <p className="text-muted-foreground">Get started by creating your first task.</p>
                        </div>
                    </div>
                ) : view === 'board' ? (
                    <KanbanBoard tasks={tasks} onTaskUpdate={handleTaskUpdate} />
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
                                        // No onComplete handler for already completed (unless uncheck supported later)
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
