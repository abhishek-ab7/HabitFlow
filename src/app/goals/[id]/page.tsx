"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { isAIEnabled } from "@/lib/ai-features-flag"
import { TaskCard } from "@/components/tasks/TaskCard"
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal"
import { MilestoneGenerator } from "@/components/goals"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Calendar, Flag, Target, Loader2, Plus, Trophy } from "lucide-react"
import { format } from "date-fns"
import { motion } from "framer-motion"
import { toast } from "sonner"
import type { Database } from "@/lib/supabase/types"
import type { GeneratedMilestone } from "@/lib/ai/types"

import type { Task } from "@/lib/types"

type Goal = Database['public']['Tables']['goals']['Row']
type Milestone = Database['public']['Tables']['milestones']['Row']

export default function GoalDetailsPage() {
    const { id } = useParams()
    const router = useRouter()
    const supabase = createClient()

    const [goal, setGoal] = useState<Goal | null>(null)
    const [tasks, setTasks] = useState<Task[]>([])
    const [milestones, setMilestones] = useState<Milestone[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (id) {
            fetchData()
        }
    }, [id])

    const fetchData = async () => {
        setLoading(true)
        try {
            // Fetch Goal
            const { data: goalData, error: goalError } = await supabase
                .from("goals")
                .select("*")
                .eq("id", id as string)
                .single()

            if (goalError) throw goalError
            setGoal(goalData)

            // Fetch Tasks
            const { data: taskData, error: taskError } = await supabase
                .from("tasks")
                .select("*")
                .eq("goal_id", id as string)
                .neq("status", "archived")
                .order("priority", { ascending: false })

            if (taskError) throw taskError
            if (taskError) throw taskError

            const mappedTasks: Task[] = (taskData || []).map((t: any) => ({
                ...t,
                userId: t.user_id,
                // Ensure other fields match if needed
            }))
            setTasks(mappedTasks)

            // Fetch Milestones
            const { data: milestoneData, error: milestoneError } = await supabase
                .from("milestones")
                .select("*")
                .eq("goal_id", id as string)
                .order("order_index")

            if (milestoneError) throw milestoneError
            setMilestones(milestoneData || [])

        } catch (error) {
            console.error(error)
            toast.error("Failed to load goal details")
        } finally {
            setLoading(false)
        }
    }

    const handleTaskComplete = async (taskId: string) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'done' } : t))
        await (supabase.from("tasks") as any).update({ status: 'done' }).eq("id", taskId)
    }

    const handleMilestonesAccepted = async (aiMilestones: GeneratedMilestone[]) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error("You must be logged in to save milestones")
                return
            }

            // Insert AI-generated milestones into milestones table
            const milestonesToInsert = aiMilestones.map((m, index) => ({
                goal_id: id as string,
                user_id: user.id,
                title: m.title,
                description: m.description,
                target_date: m.suggestedDeadline,
                order_index: milestones.length + index,
                is_completed: false
            }))

            const { data: insertedMilestones, error: insertError } = await (supabase
                .from("milestones") as any)
                .insert(milestonesToInsert)
                .select()

            if (insertError) throw insertError

            // Insert metadata into ai_generated_milestones table for tracking
            const metadataToInsert = aiMilestones.map((m, index) => ({
                goal_id: id as string,
                user_id: user.id,
                milestone_id: insertedMilestones?.[index]?.id,
                ai_title: m.title,
                ai_description: m.description,
                ai_target_date: m.suggestedDeadline,
                difficulty: m.difficulty,
                reasoning: m.reasoning,
                is_accepted: true
            }))

            const { error: metadataError } = await (supabase
                .from("ai_generated_milestones") as any)
                .insert(metadataToInsert)

            if (metadataError) {
                console.error("Failed to save AI metadata:", metadataError)
                // Don't throw - milestones are already saved
            }

            toast.success(`${aiMilestones.length} milestones added to your goal!`)
            await fetchData() // Refresh to show new milestones
        } catch (error) {
            console.error("Error saving milestones:", error)
            toast.error("Failed to save milestones. Please try again.")
        }
    }

    if (loading) {
        return (
            <div className="container h-[calc(100vh-4rem)] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!goal) {
        return (
            <div className="container py-8 text-center">
                <h1 className="text-2xl font-bold">Goal not found</h1>
                <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
            </div>
        )
    }

    const activeTasks = tasks.filter(t => t.status !== 'done')
    const completedTasks = tasks.filter(t => t.status === 'done')
    const progress = Math.round((completedTasks.length / (tasks.length || 1)) * 100)

    return (
        <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="space-y-4">
                <Button variant="ghost" className="pl-0 gap-2 text-muted-foreground hover:text-foreground" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" /> Back to Goals
                </Button>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{goal.category === 'career' ? '💼' : '🎯'}</span>
                            <h1 className="text-3xl font-bold tracking-tight">{goal.title}</h1>
                        </div>
                        <p className="text-muted-foreground max-w-2xl text-lg">
                            {goal.description}
                        </p>
                    </div>
                    <CreateTaskModal onTaskCreated={fetchData} />
                </div>

                {/* Stats Bar */}
                <div className="flex flex-wrap gap-4 md:gap-8 p-4 bg-muted/30 rounded-xl border border-border/50">
                    <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-primary" />
                        <span className="font-medium capitalize">{goal.priority} Priority</span>
                    </div>
                    {goal.target_date && (
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span>Target: {format(new Date(goal.target_date), 'MMM d, yyyy')}</span>
                        </div>
                    )}
                    <div className="flex-1 min-w-[200px] flex items-center gap-3">
                        <span className="text-sm font-medium whitespace-nowrap">Task Progress</span>
                        <Progress value={progress} className="h-2" />
                        <span className="text-sm font-bold">{progress}%</span>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Content: Tasks */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Target className="h-5 w-5 text-primary" />
                            Linked Tasks
                        </h2>
                        <span className="text-sm text-muted-foreground">{activeTasks.length} active</span>
                    </div>

                    <div className="space-y-4">
                        {activeTasks.length === 0 && completedTasks.length === 0 ? (
                            <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
                                <p className="text-muted-foreground">No tasks linked to this goal yet.</p>
                                <Button variant="link" className="text-primary mt-2">Create your first task</Button>
                            </div>
                        ) : (
                            activeTasks.map(task => (
                                <TaskCard key={task.id} task={task} onComplete={handleTaskComplete} />
                            ))
                        )}

                        {completedTasks.length > 0 && (
                            <div className="pt-4 opacity-60">
                                <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Completed</h3>
                                <div className="space-y-4">
                                    {completedTasks.map(task => (
                                        <TaskCard key={task.id} task={task} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar: Milestones */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Milestones
                    </h2>
                    <div className="bg-card rounded-xl border border-border/50 p-4 space-y-4">
                        {milestones.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No milestones set.</p>
                        ) : (
                            <div className="relative space-y-0">
                                {milestones.map((m, i) => (
                                    <div key={m.id} className="flex gap-3 pb-6 last:pb-0 relative group">
                                        {i !== milestones.length - 1 && (
                                            <div className="absolute left-[9px] top-6 bottom-0 w-0.5 bg-border group-last:hidden" />
                                        )}
                                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 z-10 bg-background ${m.is_completed ? 'border-green-500 bg-green-500/10' : 'border-muted-foreground'}`} />
                                        <div className="-mt-1">
                                            <p className={`text-sm font-medium ${m.is_completed ? 'text-green-600 line-through' : 'text-foreground'}`}>
                                                {m.title}
                                            </p>
                                            {m.completed_at && (
                                                <p className="text-xs text-muted-foreground">Completed {format(new Date(m.completed_at), 'MMM d')}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* AI Milestone Generator */}
                    {isAIEnabled() && (
                        <MilestoneGenerator 
                            goal={{
                                id: goal.id,
                                userId: goal.user_id,
                                title: goal.title,
                                description: goal.description || '',
                                areaOfLife: (goal.category || 'personal') as any,
                                priority: (goal.priority || 'medium') as any,
                                status: (goal.status || 'in_progress') as any,
                                startDate: goal.created_at || new Date().toISOString(),
                                deadline: goal.target_date || '',
                                isFocus: goal.is_focus || false,
                                createdAt: goal.created_at || new Date().toISOString(),
                                archived: false
                            }}
                            onMilestonesAccepted={handleMilestonesAccepted}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
