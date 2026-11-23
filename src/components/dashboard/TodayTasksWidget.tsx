"use client"

import { useEffect, useState } from "react"
import { useShallow } from 'zustand/react/shallow'
import { TaskCard } from "@/components/tasks/TaskCard"
import { motion, AnimatePresence } from "framer-motion"
import { CalendarCheck, ArrowRight, Loader2, CheckSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useTaskStore } from "@/lib/stores/task-store"

interface TodayTasksWidgetProps {
    isHydrated?: boolean;
}

export function TodayTasksWidget({ isHydrated = false }: TodayTasksWidgetProps) {
    const { loadTasks, tasks, toggleTaskComplete, isLoading } = useTaskStore(
        useShallow((s) => ({
            loadTasks: s.loadTasks,
            tasks: s.tasks,
            toggleTaskComplete: s.toggleTaskComplete,
            isLoading: s.isLoading,
        }))
    )

    const router = useRouter()
    const [mounted, setMounted] = useState(isHydrated)

    useEffect(() => {
        if (tasks.length === 0) {
            loadTasks()
        }
        if (mounted) return;
        setMounted(true)
    }, [loadTasks, tasks.length, mounted])

    // Hydration safety: Don't render date-dependent logic until mounted
    if (!mounted) {
        return (
            <section className="surface-card overflow-hidden h-[180px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
            </section>
        )
    }

    const today = new Date().toISOString().split('T')[0]

    const allFocusTasks = tasks.filter(t => {
        if (t.status === 'done' || t.status === 'archived' || t.parentTaskId) return false;
        return !t.due_date || t.due_date <= (today + "T23:59:59");
    }).sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return a.title.localeCompare(b.title);
    });

    const todayTasks = allFocusTasks.slice(0, 6);

    const handleTaskComplete = async (id: string) => {
        await toggleTaskComplete(id)
    }

    if (isLoading && tasks.length === 0) return (
        <div className="h-full min-h-[180px] flex items-center justify-center surface-card">
            <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
        </div>
    )

    return (
        <section className="surface-card overflow-hidden tour-tasks-widget">
            <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 shrink-0 text-primary flex items-center justify-center">
                            <CalendarCheck className="h-4 w-4" />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-snug">
                                Today&apos;s Focus
                            </h2>
                            <p className="text-xs text-muted-foreground font-mono tabular-nums">
                                {allFocusTasks.length > 0
                                    ? `${allFocusTasks.length} ${allFocusTasks.length === 1 ? 'task' : 'tasks'} queued for today`
                                    : "All tasks clear for today"}
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/tasks')}
                        className="group shrink-0 gap-1 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-all h-9 text-xs px-2.5 sm:px-3"
                    >
                        <span>All Tasks</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                        {todayTasks.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="col-span-full flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-5"
                            >
                                <div className="flex items-center gap-3 text-center sm:text-left">
                                    <div className="p-2.5 rounded-xl bg-muted/60 border border-border/60 shrink-0 hidden sm:flex">
                                        <CheckSquare className="h-5 w-5 text-muted-foreground/70" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-semibold text-foreground">Clear for takeoff</p>
                                        <p className="text-xs text-muted-foreground">No pending tasks due today. Add one or review your habits.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => router.push('/habits')}
                                        className="rounded-xl h-9 text-xs px-3.5"
                                    >
                                        Open Habits
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => router.push('/tasks')}
                                        className="rounded-xl h-9 text-xs px-4"
                                    >
                                        Create Task
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            todayTasks.map((task, index) => (
                                <motion.div
                                    key={task.id}
                                    layout
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        transition: { delay: index * 0.04 }
                                    }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                >
                                    <TaskCard task={task} onComplete={handleTaskComplete} compact />
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </section>
    )
}
