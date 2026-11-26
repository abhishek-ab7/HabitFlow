"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { isAIEnabled } from "@/lib/ai-features-flag"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Calendar as CalendarIcon, Flag, Target, Sparkles, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Database } from "@/lib/supabase/types"
import { useTaskStore } from "@/lib/stores/task-store"
import { getLocalIsoDate } from "@/lib/finance/credit-card-cycles"

type Goal = Database['public']['Tables']['goals']['Row']

interface CreateTaskModalProps {
    onTaskCreated?: () => void
    defaultDate?: Date
    open?: boolean
    onOpenChange?: (open: boolean) => void
    hideTrigger?: boolean
}

function CreateTaskScheduleFields({
    dueDate,
    setDueDate,
    priority,
    setPriority,
    selectedGoalId,
    setSelectedGoalId,
    goals,
    estimatedTime,
    setEstimatedTime,
    recurrenceRule,
    setRecurrenceRule,
}: {
    dueDate: string;
    setDueDate: (v: string) => void;
    priority: "low" | "medium" | "high";
    setPriority: (v: "low" | "medium" | "high") => void;
    selectedGoalId: string | null;
    setSelectedGoalId: (v: string | null) => void;
    goals: Goal[];
    estimatedTime: number;
    setEstimatedTime: (v: number) => void;
    recurrenceRule: string;
    setRecurrenceRule: (v: string) => void;
}) {
    return (
        <>
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
                            onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
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

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Estimated Time (mins)</label>
                    <Input
                        type="number"
                        min="0"
                        value={estimatedTime || ''}
                        onChange={(e) => setEstimatedTime(Number(e.target.value))}
                        placeholder="e.g. 30"
                        className="bg-background/50 border-border/50 focus:bg-background"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Recurrence</label>
                    <select
                        value={recurrenceRule}
                        onChange={(e) => setRecurrenceRule(e.target.value)}
                        className="w-full h-10 rounded-md border border-border/50 bg-background/50 px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none"
                    >
                        <option value="">None</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </div>
            </div>
        </>
    );
}

function CreateTaskSubtasksSection({
    title,
    subtasks,
    newSubtask,
    setNewSubtask,
    isGenerating,
    onGenerateSubtasks,
    onAddSubtask,
    onRemoveSubtask,
}: {
    title: string;
    subtasks: { id: string; title: string; completed: boolean }[];
    newSubtask: string;
    setNewSubtask: (v: string) => void;
    isGenerating: boolean;
    onGenerateSubtasks: () => void;
    onAddSubtask: () => void;
    onRemoveSubtask: (id: string) => void;
}) {
    return (
        <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Subtasks</label>
                {isAIEnabled() && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onGenerateSubtasks}
                        disabled={isGenerating || !title}
                        className="h-7 text-xs gap-1.5 bg-invest/10 border-invest/25 hover:border-invest/50 text-invest"
                    >
                        {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-invest" />}
                        Auto-Generate
                    </Button>
                )}
            </div>

            <div className="space-y-2">
                {subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2 group">
                        <div className="flex-1 bg-muted/30 rounded px-2 py-1.5 text-sm">
                            {subtask.title}
                        </div>
                        <button
                            type="button"
                            onClick={() => onRemoveSubtask(subtask.id)}
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
                                onAddSubtask()
                            }
                        }}
                    />
                    <Button type="button" size="sm" variant="ghost" onClick={onAddSubtask} className="h-8 w-8 p-0">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

async function createTaskWithSubtasks(params: {
    addTask: ReturnType<typeof useTaskStore.getState>['addTask'];
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    dueDate: string;
    selectedGoalId: string | null;
    isUrgent: boolean;
    isImportant: boolean;
    estimatedTime: number;
    recurrenceRule: string;
    subtasks: { id: string; title: string; completed: boolean }[];
}) {
    const parentTask = await params.addTask({
        title: params.title,
        description: params.description,
        priority: params.priority,
        due_date: params.dueDate ? new Date(params.dueDate).toISOString() : undefined,
        goal_id: params.selectedGoalId === "none" ? undefined : params.selectedGoalId || undefined,
        isUrgent: params.isUrgent,
        isImportant: params.isImportant,
        estimatedTime: params.estimatedTime > 0 ? params.estimatedTime : undefined,
        recurrenceRule: params.recurrenceRule || undefined,
        depth: 0,
        parentTaskId: null
    });

    for (const subtask of params.subtasks) {
        await params.addTask({
            title: subtask.title,
            priority: params.priority,
            parentTaskId: parentTask.id,
            depth: 1,
            isUrgent: false,
            isImportant: false
        });
    }
}

export function CreateTaskModal({ onTaskCreated, defaultDate, open: controlledOpen, onOpenChange: controlledOnOpenChange, hideTrigger }: CreateTaskModalProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = (val: boolean) => {
        if (isControlled) {
            controlledOnOpenChange?.(val)
        } else {
            setInternalOpen(val)
        }
    }
    const [loading, setLoading] = useState(false)
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [priority, setPriority] = useState<"low" | "medium" | "high">("medium")
    const [dueDate, setDueDate] = useState(defaultDate ? getLocalIsoDate(defaultDate) : "")
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
    const [isUrgent, setIsUrgent] = useState(false)
    const [isImportant, setIsImportant] = useState(false)
    const [estimatedTime, setEstimatedTime] = useState<number>(0)
    const [recurrenceRule, setRecurrenceRule] = useState<string>("")
    const [subtasks, setSubtasks] = useState<{ id: string; title: string; completed: boolean }[]>([])
    const [newSubtask, setNewSubtask] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)
    const { addTask } = useTaskStore()

    const [goals, setGoals] = useState<Goal[]>([])

    const supabase = createClient()

    const fetchGoals = async () => {
        const { data } = await supabase
            .from("goals")
            .select("*")
            // Supabase query uses 'is_archived' (snake_case database column name), not the local model's 'archived' attribute
            .eq("is_archived", false)
            .order("title")

        if (data) {
            setGoals(data)
        }
    }

    useEffect(() => {
        if (open) {
            fetchGoals()
        }
    }, [open])

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
            await createTaskWithSubtasks({
                addTask,
                title,
                description,
                priority,
                dueDate,
                selectedGoalId,
                isUrgent,
                isImportant,
                estimatedTime,
                recurrenceRule,
                subtasks,
            })

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
        setIsUrgent(false)
        setIsImportant(false)
        setEstimatedTime(0)
        setRecurrenceRule("")
        setSubtasks([])
        setNewSubtask("")
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!hideTrigger && !isControlled && (
                <DialogTrigger asChild>
                    <Button className="gap-2 bg-primary/90 hover:bg-primary shadow-lg hover:shadow-primary/25 transition-all duration-300">
                        <Plus className="h-4 w-4" />
                        <span>New Task</span>
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col bg-card border-border rounded-2xl">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="text-xl font-bold text-foreground">
                        Create Task
                    </DialogTitle>
                    <DialogDescription>
                        Add a new task to your list. Fill in the details below.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
                    <div className="flex-1 overflow-y-auto space-y-4 my-4 pr-1 scrollbar-hide">
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

                    <CreateTaskScheduleFields
                        dueDate={dueDate}
                        setDueDate={setDueDate}
                        priority={priority}
                        setPriority={setPriority}
                        selectedGoalId={selectedGoalId}
                        setSelectedGoalId={setSelectedGoalId}
                        goals={goals}
                        estimatedTime={estimatedTime}
                        setEstimatedTime={setEstimatedTime}
                        recurrenceRule={recurrenceRule}
                        setRecurrenceRule={setRecurrenceRule}
                    />

                    <div className="flex items-center gap-6 py-2 bg-muted/20 px-3 rounded-lg border border-border/30">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isUrgent"
                                checked={isUrgent}
                                onChange={(e) => setIsUrgent(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer bg-background"
                            />
                            <label htmlFor="isUrgent" className="text-xs font-semibold select-none cursor-pointer">
                                Urgent Task
                            </label>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isImportant"
                                checked={isImportant}
                                onChange={(e) => setIsImportant(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer bg-background"
                            />
                            <label htmlFor="isImportant" className="text-xs font-semibold select-none cursor-pointer">
                                Important Task
                            </label>
                        </div>
                    </div>

                    <CreateTaskSubtasksSection
                        title={title}
                        subtasks={subtasks}
                        newSubtask={newSubtask}
                        setNewSubtask={setNewSubtask}
                        isGenerating={isGenerating}
                        onGenerateSubtasks={handleGenerateSubtasks}
                        onAddSubtask={addSubtask}
                        onRemoveSubtask={removeSubtask}
                    />
                    </div>

                    <div className="pt-3 flex justify-end gap-2 border-t border-border/50 shrink-0">
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
                            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all duration-200 transform active:scale-95"
                        >
                            {loading ? "Creating..." : "Create Task"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
