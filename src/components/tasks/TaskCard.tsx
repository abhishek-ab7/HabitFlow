"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Circle, Calendar, Tag, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import type { Task } from "@/lib/types"

interface TaskCardProps {
    task: Task
    onComplete?: (id: string) => void
    onUpdate?: (task: Task) => void
    isOverlay?: boolean
    compact?: boolean
}

export function TaskCard({ task, onComplete, compact }: TaskCardProps) {
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'

    const priorityStyles = {
        low: "border-blue-500/30 bg-blue-500/5 text-blue-500 shadow-[0_0_15px_-5px_rgba(59,130,246,0.3)]",
        medium: "border-yellow-500/30 bg-yellow-500/5 text-yellow-500 shadow-[0_0_15px_-5px_rgba(234,179,8,0.3)]",
        high: "border-red-500/30 bg-red-500/5 text-red-500 shadow-[0_0_15px_-5px_rgba(239,68,68,0.3)]",
    }

    const subtasks = task.metadata && typeof task.metadata === 'object' && 'subtasks' in task.metadata && Array.isArray((task.metadata as any).subtasks)
        ? (task.metadata as any).subtasks
        : []

    const completedSubtasks = subtasks.filter((s: any) => s.completed).length
    const subtaskProgress = subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            whileHover={{
                y: -4,
                boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
                transition: { duration: 0.2 }
            }}
            className={cn(
                "group relative rounded-2xl border transition-all duration-300",
                compact ? "p-3" : "p-5",
                "bg-card/40 backdrop-blur-xl backdrop-saturate-150",
                "border-white/10 dark:border-white/5 shadow-sm",
                "hover:bg-card/60 hover:border-primary/30",
                task.status === 'done' && "opacity-60 grayscale-[0.3]"
            )}
        >
            <div className={cn("flex items-start", compact ? "gap-2.5" : "gap-4")}>
                {/* Custom Animated Checkbox */}
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onComplete?.(task.id)
                    }}
                    className={cn(
                        "relative flex shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                        compact ? "mt-0.5 h-4 w-4" : "mt-1 h-6 w-6",
                        task.status === 'done'
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/30 group-hover:border-primary"
                    )}
                >
                    <AnimatePresence mode="wait">
                        {task.status === 'done' ? (
                            <motion.div
                                key="checked"
                                initial={{ scale: 0, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                exit={{ scale: 0, rotate: 20 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                                <CheckCircle2 className={cn("stroke-[3px]", compact ? "h-2 w-2" : "h-4 w-4")} />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="unchecked"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="opacity-0 group-hover:opacity-100"
                            >
                                <Circle className={cn("text-primary", compact ? "h-2.5 w-2.5" : "h-4 w-4")} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </button>

                {/* Content */}
                <div className={cn("flex-1 min-w-0", compact ? "space-y-1" : "space-y-3")}>
                    <div className="flex items-start justify-between gap-2">
                        <h3 className={cn(
                            "font-semibold text-foreground tracking-tight transition-all truncate",
                            compact ? "text-sm" : "text-base",
                            task.status === 'done' && "line-through text-muted-foreground font-normal"
                        )}>
                            {task.title}
                        </h3>

                        {/* Enhanced Priority Badge */}
                        {task.priority && (
                            <span className={cn(
                                "shrink-0 px-1.5 py-0.5 text-[8px] uppercase tracking-widest rounded-md border font-bold transition-all",
                                priorityStyles[task.priority as keyof typeof priorityStyles] || priorityStyles.medium
                            )}>
                                {task.priority.charAt(0)}
                            </span>
                        )}
                    </div>

                    {task.description && !compact && (
                        <p className="text-sm text-muted-foreground/80 line-clamp-2 leading-relaxed">
                            {task.description}
                        </p>
                    )}

                    {/* Meta Section */}
                    <div className={cn("flex flex-wrap items-center pt-0.5", compact ? "gap-2" : "gap-4")}>
                        {task.due_date && (
                            <motion.div
                                animate={isOverdue ? {
                                    scale: [1, 1.05, 1],
                                    color: ["#ef4444", "#dc2626", "#ef4444"]
                                } : {}}
                                transition={isOverdue ? {
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                } : {}}
                                className={cn(
                                    "flex items-center gap-1 text-[10px] text-muted-foreground font-medium",
                                    isOverdue && "text-red-500"
                                )}
                            >
                                <Calendar className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
                                <span>{format(new Date(task.due_date), compact ? "MMM d" : "MMM d, h:mm a")}</span>
                            </motion.div>
                        )}

                        {task.tags && task.tags.length > 0 && !compact && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Tag className="h-3.5 w-3.5" />
                                <span className="bg-muted px-1.5 py-0.5 rounded-md border border-border/50">
                                    {task.tags[0]}
                                    {task.tags.length > 1 && ` +${task.tags.length - 1}`}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Enhanced Progress Bar for Subtasks */}
                    {subtasks.length > 0 && !compact && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                <span>Progress</span>
                                <span>{completedSubtasks}/{subtasks.length}</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border/10">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${subtaskProgress}%` }}
                                    className={cn(
                                        "h-full rounded-full transition-all duration-500",
                                        subtaskProgress === 100
                                            ? "bg-gradient-to-r from-green-500 to-emerald-400"
                                            : "bg-gradient-to-r from-primary to-primary/60"
                                    )}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Hover Shine Effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/10 via-white/5 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-700" />

            {/* Ambient Background Light */}
            {task.priority === 'high' && !task.status && (
                <div className="absolute -z-10 -inset-1 blur-2xl opacity-10 bg-red-500 rounded-2xl" />
            )}
        </motion.div>
    )
}
