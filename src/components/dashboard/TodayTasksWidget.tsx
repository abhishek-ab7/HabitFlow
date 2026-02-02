"use client"

import { useEffect, useState } from "react"
import { TaskCard } from "@/components/tasks/TaskCard"
import { motion, AnimatePresence } from "framer-motion"
import { CalendarCheck, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useTaskStore } from "@/lib/stores/task-store"
import type { Task } from "@/lib/types"

export function TodayTasksWidget() {
    const { loadTasks, tasks, toggleTaskComplete, isLoading } = useTaskStore()
    const router = useRouter()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        loadTasks()
        setMounted(true)
    }, [loadTasks])

    // Hydration safety: Don't render date-dependent logic until mounted
    if (!mounted) {
        return (
            <section className="bg-card/30 backdrop-blur-2xl backdrop-saturate-150 rounded-3xl border border-white/10 shadow-2xl overflow-hidden h-[200px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
            </section>
        )
    }

    const today = new Date().toISOString().split('T')[0]

    const allFocusTasks = tasks.filter(t => {
        if (t.status === 'done' || t.status === 'archived') return false;
        return !t.due_date || t.due_date <= (today + "T23:59:59");
    }).sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return a.title.localeCompare(b.title);
    });

    const totalFocusCount = allFocusTasks.length;
    const todayTasks = allFocusTasks.slice(0, 6);

    const handleTaskComplete = async (id: string) => {
        await toggleTaskComplete(id)
    }

    if (isLoading && tasks.length === 0) return (
        <div className="h-full min-h-[200px] flex items-center justify-center bg-card/40 backdrop-blur-xl rounded-2xl border border-white/10">
            <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
        </div>
    )

    return (
        <section className="bg-card/30 backdrop-blur-2xl backdrop-saturate-150 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
            <div className="p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1.5">
                        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                                <CalendarCheck className="h-6 w-6 text-primary" />
                            </div>
                            Today's Focus
                        </h2>
                        <p className="text-sm text-muted-foreground ml-12">
                            {totalFocusCount > 0
                                ? `${totalFocusCount} ${totalFocusCount === 1 ? 'task' : 'tasks'} due.`
                                : "All caught up!"}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/tasks')}
                        className="group gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-all h-9 text-sm px-4"
                    >
                        View All
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                        {todayTasks.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="col-span-full flex flex-col items-center justify-center py-12 text-center space-y-4"
                            >
                                <div className="p-4 rounded-full bg-muted/50 border border-border/50">
                                    <CalendarCheck className="h-8 w-8 text-muted-foreground/40" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-lg font-medium text-muted-foreground">Clear for takeoff!</p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push('/tasks')}
                                    className="rounded-xl border-primary/20 hover:border-primary/40 hover:bg-primary/5 h-10 text-sm px-6"
                                >
                                    Create Task
                                </Button>
                            </motion.div>
                        ) : (
                            todayTasks.map((task, index) => (
                                <motion.div
                                    key={task.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        transition: { delay: index * 0.05 }
                                    }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                >
                                    <TaskCard task={task} onComplete={handleTaskComplete} compact />
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Bottom Glow Effect */}
            <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        </section>
    )
}
