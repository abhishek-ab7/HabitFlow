"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Calendar as CalendarIcon, Flag, Target, Sparkles, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Database } from "@/lib/supabase/types"

type Goal = Database['public']['Tables']['goals']['Row']

interface CreateTaskModalProps {
    onTaskCreated?: () => void
    defaultDate?: Date
}

export function CreateTaskModal({ onTaskCreated, defaultDate }: CreateTaskModalProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [priority, setPriority] = useState<"low" | "medium" | "high">("medium")
    const [dueDate, setDueDate] = useState(defaultDate ? defaultDate.toISOString().split('T')[0] : "")
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
    const [subtasks, setSubtasks] = useState<{ id: string; title: string; completed: boolean }[]>([])
    const [newSubtask, setNewSubtask] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)

    const [goals, setGoals] = useState<Goal[]>([])

    const supabase = createClient()

    useEffect(() => {
        if (open) {
            fetchGoals()
        }
    }, [open])

    const fetchGoals = async () => {
        const { data } = await supabase
            .from("goals")
            .select("*")
            .eq("is_archived", false)
            .order("title")

        if (data) {
            setGoals(data)
        }
    }

    const handleGenerateSubtasks = async () => {
        if (!title) {
            toast.error("Please enter a task title first")
            return
        }

        setIsGenerating(true)
        try {
            const response = await fetch('/api/ai/generate-subtasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error)

            const generated = data.subtasks.map((st: string) => ({
                id: crypto.randomUUID(),
                title: st,
                completed: false
            }))

            setSubtasks(prev => [...prev, ...generated])
            toast.success("Subtasks generated!")
        } catch (error) {
            console.error(error)
            toast.error("Failed to generate subtasks")
        } finally {
            setIsGenerating(false)
        }
    }

    const addSubtask = () => {
        if (!newSubtask.trim()) return
        setSubtasks(prev => [...prev, {
            id: crypto.randomUUID(),
            title: newSubtask,
            completed: false
        }])
        setNewSubtask("")
    }

    const removeSubtask = (id: string) => {
        setSubtasks(prev => prev.filter(s => s.id !== id))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        setLoading(true)
        try {
            const { error } = await (supabase.from("tasks") as any).insert({
                title,
                description,
                priority,
                due_date: dueDate ? new Date(dueDate).toISOString() : null,
                goal_id: selectedGoalId === "none" ? null : selectedGoalId,
                user_id: (await supabase.auth.getUser()).data.user?.id!,
                metadata: { subtasks } as any
            })

            if (error) throw error

            toast.success("Task created successfully")
            setOpen(false)
            resetForm()
            onTaskCreated?.()
        } catch (error) {
            console.error(error)
            toast.error("Failed to create task")
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setTitle("")
        setDescription("")
        setPriority("medium")
        setDueDate("")
        setSelectedGoalId(null)
        setSubtasks([])
        setNewSubtask("")
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 bg-primary/90 hover:bg-primary shadow-lg hover:shadow-primary/25 transition-all duration-300">
                    <Plus className="h-4 w-4" />
                    <span>New Task</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-card/95 backdrop-blur-xl border-border/50">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent w-fit">
                        Create Task
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Input
                            placeholder="What needs to be done?"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-background/50 border-border/50 focus:bg-background transition-all font-medium text-lg"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Textarea
                            placeholder="Add details..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-background/50 border-border/50 focus:bg-background transition-all min-h-[80px] resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground ml-1">Due Date</label>
                            <div className="relative">
                                <Input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="bg-background/50 border-border/50 focus:bg-background pl-9"
                                />
                                <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground ml-1">Priority</label>
                            <div className="relative">
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as any)}
                                    className="w-full h-10 rounded-md border border-border/50 bg-background/50 px-3 pl-9 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none"
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                                <Flag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground ml-1">Link to Goal (Optional)</label>
                        <div className="relative">
                            <select
                                value={selectedGoalId || "none"}
                                onChange={(e) => setSelectedGoalId(e.target.value === "none" ? null : e.target.value)}
                                className="w-full h-10 rounded-md border border-border/50 bg-background/50 px-3 pl-9 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none"
                            >
                                <option value="none">No Goal</option>
                                {goals.map((goal) => (
                                    <option key={goal.id} value={goal.id}>
                                        {goal.title}
                                    </option>
                                ))}
                            </select>
                            <Target className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>

                    {/* Subtasks Section */}
                    <div className="space-y-3 pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Subtasks</label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleGenerateSubtasks}
                                disabled={isGenerating || !title}
                                className="h-7 text-xs gap-1.5 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20 hover:border-purple-500/50"
                            >
                                {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-purple-500" />}
                                Auto-Generate
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {subtasks.map((subtask) => (
                                <div key={subtask.id} className="flex items-center gap-2 group">
                                    <div className="flex-1 bg-muted/30 rounded px-2 py-1.5 text-sm">
                                        {subtask.title}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeSubtask(subtask.id)}
                                        className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}

                            <div className="flex gap-2">
                                <Input
                                    value={newSubtask}
                                    onChange={(e) => setNewSubtask(e.target.value)}
                                    placeholder="Add a step..."
                                    className="h-8 text-sm"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            addSubtask()
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={addSubtask}
                                    className="h-8 w-8 p-0"
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !title}
                            className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-md transition-all duration-300 transform active:scale-95"
                        >
                            {loading ? "Creating..." : "Create Task"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
