"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { TaskCard } from "@/components/tasks/TaskCard"
import { Loader2, CalendarCheck, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import type { Database } from "@/lib/supabase/types"

type Task = Database['public']['Tables']['tasks']['Row']

export function TodayTasksWidget() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        fetchTodayTasks()
    }, [])

    const fetchTodayTasks = async () => {
        const today = new Date().toISOString().split('T')[0]

        // Fetch tasks due today or overdue
        const { data } = await supabase
            .from("tasks")
            .select("*")
            .neq("status", "done")
            .neq("status", "archived")
            .lte("due_date", today + "T23:59:59")
            .order("due_date", { ascending: true })
            .limit(5)

        if (data) {
            setTasks(data)
        }
        setLoading(false)
    }

    const handleTaskComplete = async (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id))
        await supabase.from("tasks").update({ status: 'done' }).eq("id", id)
    }

    if (loading) return (
        <div className="h-full min-h-[300px] flex items-center justify-center bg-card/50 rounded-xl border border-border/50">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    )

    return (
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <CalendarCheck className="h-5 w-5 text-primary" />
                    Today's Focus
                </h2>
                <Button variant="ghost" size="sm" onClick={() => router.push('/tasks')} className="gap-1 text-muted-foreground hover:text-primary">
                    View All <ArrowRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 space-y-3">
                {tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8 opacity-70">
                        <p className="text-muted-foreground">No tasks due today.</p>
                        <Button variant="link" onClick={() => router.push('/tasks')} className="text-primary">
                            Add a task
                        </Button>
                    </div>
                ) : (
                    tasks.map(task => (
                        <TaskCard key={task.id} task={task} onComplete={handleTaskComplete} />
                    ))
                )}
            </div>
        </div>
    )
}
