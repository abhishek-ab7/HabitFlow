"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Circle, Calendar, Tag, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/supabase/types"
import { format } from "date-fns"


type Task = Database['public']['Tables']['tasks']['Row']

interface TaskCardProps {
    task: Task
    onComplete?: (id: string) => void
    onUpdate?: (task: Task) => void
    isOverlay?: boolean
}

export function TaskCard({ task, onComplete }: TaskCardProps) {
    const [isHovered, setIsHovered] = useState(false)

    const priorityColors = {
        low: "text-blue-500 bg-blue-500/10 border-blue-500/20",
        medium: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
        high: "text-red-500 bg-red-500/10 border-red-500/20",
    }

    return (
        <motion.div
            layoutId={task.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className={cn(
                "group relative p-4 rounded-xl border border-border/50",
                "bg-card/40 backdrop-blur-md transition-all duration-300",
                "hover:shadow-lg hover:border-primary/20 hover:bg-card/60",
                task.status === 'done' && "opacity-60 grayscale-[0.5]"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-start gap-4">
                {/* Checkbox Trigger */}
                <button
                    onClick={() => onComplete?.(task.id)}
                    className={cn(
                        "mt-1 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300",
                        task.status === 'done'
                            ? "border-primary bg-primary text-primary-foreground scale-110"
                            : "border-muted-foreground/30 hover:border-primary hover:scale-110"
                    )}
                >
                    {task.status === 'done' ? (
                        <CheckCircle2 className="h-4 w-4" />
                    ) : (
                        <Circle className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </button>



                {/* Content */}
                {/* Content */}
                <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                        <h3 className={cn(
                            "font-medium text-foreground transition-all",
                            task.status === 'done' && "line-through text-muted-foreground"
                        )}>
                            {task.title}
                        </h3>

                        {/* Priority Badge */}
                        {task.priority && (
                            <span className={cn(
                                "px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full border font-semibold",
                                priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.medium
                            )}>
                                {task.priority}
                            </span>
                        )}
                    </div>

                    {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                            {task.description}
                        </p>
                    )}

                    {/* Metadata Row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                        {task.due_date && (
                            <div className={cn(
                                "flex items-center gap-1.5 transition-colors",
                                new Date(task.due_date) < new Date() && task.status !== 'done' && "text-red-500 font-medium"
                            )}>
                                <Calendar className="h-3.5 w-3.5" />
                                <span>{format(new Date(task.due_date), "MMM d, h:mm a")}</span>
                            </div>
                        )}

                        {task.tags && task.tags.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <Tag className="h-3.5 w-3.5" />
                                <span>{task.tags[0]}</span>
                                {task.tags.length > 1 && <span>+{task.tags.length - 1}</span>}
                            </div>
                        )}

                        {/* Subtask Progress */}
                        {task.metadata && typeof task.metadata === 'object' && 'subtasks' in task.metadata && Array.isArray((task.metadata as any).subtasks) && (task.metadata as any).subtasks.length > 0 && (
                            <div className="flex items-center gap-1.5" title="Subtasks">
                                <span className={cn(
                                    "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold border",
                                    (task.metadata as any).subtasks.every((s: any) => s.completed)
                                        ? "bg-green-500/10 text-green-600 border-green-500/20"
                                        : "bg-muted text-muted-foreground border-border"
                                )}>
                                    {(task.metadata as any).subtasks.filter((s: any) => s.completed).length}/{(task.metadata as any).subtasks.length}
                                </span>
                            </div>
                        )}

                        {/* Subtask Progress */}
                        {task.metadata && typeof task.metadata === 'object' && 'subtasks' in task.metadata && Array.isArray((task.metadata as any).subtasks) && (task.metadata as any).subtasks.length > 0 && (
                            <div className="flex items-center gap-1.5" title="Subtasks">
                                <span className={cn(
                                    "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold border",
                                    (task.metadata as any).subtasks.every((s: any) => s.completed)
                                        ? "bg-green-500/10 text-green-600 border-green-500/20"
                                        : "bg-muted text-muted-foreground border-border"
                                )}>
                                    {(task.metadata as any).subtasks.filter((s: any) => s.completed).length}/{(task.metadata as any).subtasks.length}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Glossy Overlay Effect */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500" />
        </motion.div>
    )
}
