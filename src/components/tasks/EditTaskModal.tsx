"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { isAIEnabled } from "@/lib/ai-features-flag"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar as CalendarIcon, Flag, Target, Sparkles, X, Plus, CheckCircle2, Circle, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Database } from "@/lib/supabase/types"
import { useTaskStore } from "@/lib/stores/task-store"
import type { Task } from "@/lib/types"

type Goal = Database['public']['Tables']['goals']['Row']

interface EditTaskModalProps {
    task: Task
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function EditTaskModal({ task, isOpen, onOpenChange }: EditTaskModalProps) {
    const [loading, setLoading] = useState(false)
    const [title, setTitle] = useState(task.title)
    const [description, setDescription] = useState(task.description || "")
    const [priority, setPriority] = useState<"low" | "medium" | "high">(task.priority)
    const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.split('T')[0] : "")
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(task.goal_id || null)
    const [isUrgent, setIsUrgent] = useState(task.isUrgent ?? false)
    const [isImportant, setIsImportant] = useState(task.isImportant ?? false)
    const [estimatedTime, setEstimatedTime] = useState<number>(task.estimatedTime ?? 0)
    const [actualTime, setActualTime] = useState<number>(task.actualTime ?? 0)
    const [recurrenceRule, setRecurrenceRule] = useState<string>(task.recurrenceRule || "")
    
    // Subtask management states
    const [newSubtask, setNewSubtask] = useState("")
    const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
    const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)

    const { editTask, addTask, removeTask, toggleTaskComplete, tasks } = useTaskStore()
    const [goals, setGoals] = useState<Goal[]>([])
    const supabase = createClient()

    // Sync form states with task when modal opens
    useEffect(() => {
        if (isOpen) {
            setTitle(task.title)
            setDescription(task.description || "")
            setPriority(task.priority)
            setDueDate(task.due_date ? task.due_date.split('T')[0] : "")
            setSelectedGoalId(task.goal_id || null)
            setIsUrgent(task.isUrgent ?? false)
            setIsImportant(task.isImportant ?? false)
            setEstimatedTime(task.estimatedTime ?? 0)
            setActualTime(task.actualTime ?? 0)
            setRecurrenceRule(task.recurrenceRule || "")
            fetchGoals()
        }
    }, [isOpen, task])

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

    // Filter subtasks from database associated with this task
    const subtasks = tasks.filter(t => t.parentTaskId === task.id && t.status !== 'archived')

    const handleAddSubtask = async () => {
        if (!newSubtask.trim()) return
        try {
            await addTask({
                title: newSubtask.trim(),
                priority: task.priority,
                parentTaskId: task.id,
                depth: (task.depth || 0) + 1,
                isUrgent: false,
                isImportant: false
            })
            setNewSubtask("")
            toast.success("Subtask added")
        } catch (err) {
            console.error(err)
            toast.error("Failed to add subtask")
        }
    }

    const handleSaveSubtaskTitle = async (subtaskId: string) => {
        if (!editingSubtaskTitle.trim()) return
        try {
            await editTask(subtaskId, { title: editingSubtaskTitle.trim() })
            setEditingSubtaskId(null)
            toast.success("Subtask updated")
        } catch (err) {
            console.error(err)
            toast.error("Failed to update subtask")
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

            for (const st of data.subtasks) {
                await addTask({
                    title: st,
                    priority: task.priority,
                    parentTaskId: task.id,
                    depth: (task.depth || 0) + 1,
                    isUrgent: false,
                    isImportant: false
                })
            }

            toast.success("AI subtasks generated and saved!")
        } catch (error) {
            console.error(error)
            toast.error("Failed to generate subtasks")
        } finally {
            setIsGenerating(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        setLoading(true)
        try {
            await editTask(task.id, {
                title,
                description: description || null,
                priority,
                due_date: dueDate ? new Date(dueDate).toISOString() : null,
                goal_id: selectedGoalId === "none" ? null : selectedGoalId || null,
                isUrgent,
                isImportant,
                estimatedTime: estimatedTime > 0 ? estimatedTime : 0,
                actualTime: actualTime > 0 ? actualTime : 0,
                recurrenceRule: recurrenceRule || "",
            })

            toast.success("Task updated successfully")
            onOpenChange(false)
        } catch (error) {
            console.error(error)
            toast.error("Failed to update task")
        } finally {
            setLoading(false)
        }
    }

    const currentDepth = task.depth || 0;
    const canAddSubtasks = currentDepth < 3;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col bg-card/95 backdrop-blur-xl border-border/50 rounded-3xl">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent w-fit">
                        Task Details
                    </DialogTitle>
                    <DialogDescription>
                        View and edit task details, estimated time, and subtasks.
                    </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
                    <div className="flex-1 overflow-y-auto space-y-4 my-4 pr-1 scrollbar-hide">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground ml-1">Task Title</label>
                            <Input
                                placeholder="What needs to be done?"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="bg-background/50 border-border/50 focus:bg-background transition-all font-medium text-lg rounded-xl"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground ml-1">Description</label>
                            <Textarea
                                placeholder="Add details..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="bg-background/50 border-border/50 focus:bg-background transition-all min-h-[80px] resize-none rounded-xl"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground ml-1">Due Date</label>
                                <div className="relative">
                                    <Input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="bg-background/50 border-border/50 focus:bg-background pl-9 rounded-xl"
                                    />
                                    <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground ml-1">Priority</label>
                                <div className="relative">
                                    <select
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value as any)}
                                        className="w-full h-10 rounded-xl border border-border/50 bg-background/50 px-3 pl-9 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none"
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
                            <label className="text-xs font-semibold text-muted-foreground ml-1">Link to Goal (Optional)</label>
                            <div className="relative">
                                <select
                                    value={selectedGoalId || "none"}
                                    onChange={(e) => setSelectedGoalId(e.target.value === "none" ? null : e.target.value)}
                                    className="w-full h-10 rounded-xl border border-border/50 bg-background/50 px-3 pl-9 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none"
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

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground ml-1">Est. Time (mins)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={estimatedTime || ''}
                                    onChange={(e) => setEstimatedTime(Number(e.target.value))}
                                    placeholder="e.g. 30"
                                    className="bg-background/50 border-border/50 focus:bg-background rounded-xl"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground ml-1">Act. Time (mins)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={actualTime || ''}
                                    onChange={(e) => setActualTime(Number(e.target.value))}
                                    placeholder="e.g. 25"
                                    className="bg-background/50 border-border/50 focus:bg-background rounded-xl"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground ml-1">Recurrence</label>
                                <select
                                    value={recurrenceRule}
                                    onChange={(e) => setRecurrenceRule(e.target.value)}
                                    className="w-full h-10 rounded-xl border border-border/50 bg-background/50 px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none"
                                >
                                    <option value="">None</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 py-2 bg-muted/25 px-3 rounded-xl border border-border/30">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="editIsUrgent"
                                    checked={isUrgent}
                                    onChange={(e) => setIsUrgent(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer bg-background"
                                />
                                <label htmlFor="editIsUrgent" className="text-xs font-bold select-none cursor-pointer">
                                    Urgent Task
                                </label>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="editIsImportant"
                                    checked={isImportant}
                                    onChange={(e) => setIsImportant(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer bg-background"
                                />
                                <label htmlFor="editIsImportant" className="text-xs font-bold select-none cursor-pointer">
                                    Important Task
                                </label>
                            </div>
                        </div>

                        {/* Subtasks Management Section */}
                        <div className="space-y-3 pt-3 border-t border-border/50">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold">Subtasks ({subtasks.length})</label>
                                {isAIEnabled() && canAddSubtasks && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleGenerateSubtasks}
                                        disabled={isGenerating}
                                        className="h-7 text-xs gap-1.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20 hover:border-emerald-500/50 rounded-lg"
                                    >
                                        {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-emerald-500" />}
                                        Auto-Generate
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-2">
                                {subtasks.map((subtask) => (
                                    <div key={subtask.id} className="flex items-center gap-2 group bg-muted/20 hover:bg-muted/40 p-2 rounded-xl transition-all border border-border/10">
                                        <button
                                            type="button"
                                            onClick={() => toggleTaskComplete(subtask.id)}
                                            className="text-muted-foreground hover:text-emerald-500 transition-colors"
                                        >
                                            {subtask.status === 'done' ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500 stroke-[2.5]" />
                                            ) : (
                                                <Circle className="h-4 w-4" />
                                            )}
                                        </button>
                                        
                                        <div className="flex-1 min-w-0">
                                            {editingSubtaskId === subtask.id ? (
                                                <Input
                                                    value={editingSubtaskTitle}
                                                    onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                                                    onBlur={() => handleSaveSubtaskTitle(subtask.id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            handleSaveSubtaskTitle(subtask.id)
                                                        } else if (e.key === 'Escape') {
                                                            setEditingSubtaskId(null)
                                                        }
                                                    }}
                                                    className="h-7 text-sm py-0.5 px-2 bg-background border-border/50 focus:bg-background rounded-lg"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onDoubleClick={() => {
                                                        setEditingSubtaskId(subtask.id)
                                                        setEditingSubtaskTitle(subtask.title)
                                                    }}
                                                    className={`text-sm block truncate cursor-pointer ${subtask.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                                                    title="Double click to edit title"
                                                >
                                                    {subtask.title}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (confirm("Delete this subtask?")) {
                                                        await removeTask(subtask.id)
                                                        toast.success("Subtask deleted")
                                                    }
                                                }}
                                                className="text-muted-foreground hover:text-rose-500"
                                                title="Delete subtask"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {canAddSubtasks ? (
                                    <div className="flex gap-2 pt-1.5">
                                        <Input
                                            value={newSubtask}
                                            onChange={(e) => setNewSubtask(e.target.value)}
                                            placeholder="Add subtask step..."
                                            className="h-8 text-sm bg-background/30 rounded-lg border-border/40"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    handleAddSubtask()
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleAddSubtask}
                                            className="h-8 w-8 p-0 hover:bg-emerald-500/10 hover:text-emerald-500 rounded-lg border border-border/20"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground italic text-center pt-1.5">
                                        Subtasks cannot be nested further (maximum depth 3).
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-3 flex justify-end gap-2 border-t border-border/50 shrink-0">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !title}
                            className="bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/95 hover:to-emerald-600/95 text-white shadow-md transition-all duration-300 transform active:scale-95 rounded-xl"
                        >
                            {loading ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
