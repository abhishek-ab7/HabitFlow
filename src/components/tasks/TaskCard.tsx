"use client"

import { useState } from "react"
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion"
import { CheckCircle2, Circle, Calendar, Tag, Sparkles, Play, Pause, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { isAIEnabled } from "@/lib/ai-features-flag"
import { format } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Task } from "@/lib/types"
import { usePomodoroStore } from "@/lib/stores/pomodoro-store"
import { useTaskStore } from "@/lib/stores/task-store"

interface TaskCardProps {
    task: Task
    onComplete?: (id: string) => void
    onUpdate?: (task: Task) => void
    isOverlay?: boolean
    compact?: boolean
}

interface AIPriority {
  suggestedPriority: string;
  reasoning: string;
  urgencyScore: number;
}

export function TaskCard({ task, onComplete, compact }: TaskCardProps) {
    const [aiPriority, setAIPriority] = useState<AIPriority | null>(null);
    const [loadingPriority, setLoadingPriority] = useState(false);
    
    const { removeTask, editTask, addTask } = useTaskStore();
    
    const { 
        activeTaskId, 
        isRunning: isTimerRunning, 
        timeLeft, 
        startTimer, 
        pauseTimer, 
        resumeTimer 
    } = usePomodoroStore();

    const isCurrentTaskActive = activeTaskId === task.id;

    const formatMinutesSeconds = (secs: number) => {
        const mins = Math.floor(secs / 60);
        const remaining = secs % 60;
        return `${mins}:${remaining.toString().padStart(2, '0')}`;
    };

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

    const getAIPriority = async () => {
        setLoadingPriority(true);
        try {
            const response = await fetch('/api/ai/prioritize-task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: {
                        id: task.id,
                        title: task.title,
                        description: task.description || '',
                        due_date: task.due_date,
                        priority: task.priority,
                        tags: task.tags
                    },
                    userContext: {
                        currentTime: new Date().toISOString()
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                setAIPriority(data);
                toast.success('AI priority calculated!');
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to get AI priority');
            }
        } catch (error) {
            console.error('AI priority error:', error);
            toast.error('Failed to get AI priority');
        } finally {
            setLoadingPriority(false);
        }
    };

    const x = useMotionValue(0);

    // Transform values for checking/completing (drag right)
    const checkScale = useTransform(x, [0, 80], [0.7, 1.25]);
    const checkOpacity = useTransform(x, [0, 50], [0, 1]);

    // Transform values for deleting (drag left)
    const trashScale = useTransform(x, [-80, 0], [1.25, 0.7]);
    const trashOpacity = useTransform(x, [-50, 0], [1, 0]);

    return (
        <div className="relative overflow-hidden rounded-2xl w-full">
            {/* Backdrop Actions */}
            <div className="absolute inset-0 flex items-center justify-between pointer-events-none rounded-2xl">
                {/* Complete Backdrop (Visible when dragging right) */}
                <motion.div 
                    style={{ opacity: checkOpacity }}
                    className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-emerald-500/80 to-emerald-500/10 flex items-center pl-6 rounded-l-2xl"
                >
                    <motion.div style={{ scale: checkScale }}>
                        <CheckCircle2 className="h-6 w-6 text-white stroke-[2.5] drop-shadow-md" />
                    </motion.div>
                </motion.div>

                {/* Delete Backdrop (Visible when dragging left) */}
                <motion.div 
                    style={{ opacity: trashOpacity }}
                    className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-red-500/80 to-red-500/10 flex items-center justify-end pr-6 rounded-r-2xl"
                >
                    <motion.div style={{ scale: trashScale }}>
                        <Trash2 className="h-6 w-6 text-white drop-shadow-md" />
                    </motion.div>
                </motion.div>
            </div>

            {/* Draggable Card */}
            <motion.div
                layout
                drag="x"
                dragDirectionLock
                dragConstraints={{ left: -100, right: 100 }}
                dragElastic={{ left: 0.6, right: 0.6 }}
                style={{ x }}
                onDragEnd={async (event, info) => {
                    const threshold = 60;
                    if (info.offset.x > threshold) {
                        if (onComplete) {
                            onComplete(task.id);
                        }
                    } else if (info.offset.x < -threshold) {
                        try {
                            await removeTask(task.id);
                            toast.success("Task deleted", {
                                action: {
                                    label: "Undo",
                                    onClick: async () => {
                                        try {
                                            await addTask({
                                                title: task.title,
                                                description: task.description || undefined,
                                                priority: task.priority,
                                                due_date: task.due_date || undefined,
                                                estimatedTime: task.estimatedTime,
                                                actualTime: task.actualTime,
                                                metadata: task.metadata || undefined,
                                                tags: task.tags
                                            });
                                            toast.success("Task restored");
                                        } catch (undoErr) {
                                            toast.error("Failed to restore task");
                                            console.error(undoErr);
                                        }
                                    }
                                }
                            });
                        } catch (err) {
                            toast.error("Failed to delete task");
                            console.error(err);
                        }
                    }
                }}
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

                            <div className="flex items-center gap-1.5 shrink-0">
                                {/* Enhanced Priority Badge */}
                                {task.priority && (
                                    <span className={cn(
                                        "px-1.5 py-0.5 text-[8px] uppercase tracking-widest rounded-md border font-bold transition-all",
                                        priorityStyles[task.priority as keyof typeof priorityStyles] || priorityStyles.medium
                                    )}>
                                        {task.priority.charAt(0)}
                                    </span>
                                )}

                                {/* AI Priority Badge */}
                                {aiPriority && !compact && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Badge 
                                                    variant="outline" 
                                                    className="flex items-center gap-1 border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[8px] px-1.5 py-0.5"
                                                >
                                                    <Sparkles className="h-2.5 w-2.5" />
                                                    AI: {aiPriority.suggestedPriority.charAt(0).toUpperCase()}
                                                    <span className="ml-0.5">({aiPriority.urgencyScore})</span>
                                                </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs">
                                                <p className="text-sm">{aiPriority.reasoning}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                                {/* Delete Task Button */}
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-40 md:opacity-0 md:group-hover:opacity-60 md:hover:!opacity-100 transition-all duration-200 cursor-pointer"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (confirm("Are you sure you want to delete this task?")) {
                                            try {
                                                await removeTask(task.id);
                                                toast.success("Task deleted successfully");
                                            } catch (err) {
                                                toast.error("Failed to delete task");
                                                console.error(err);
                                            }
                                        }
                                    }}
                                    title="Delete task"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
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
                                        type: "keyframes",
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

                            {task.estimatedTime !== undefined && task.estimatedTime > 0 && (
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium bg-muted/40 px-2 py-0.5 rounded border border-border/50">
                                    <span>Est: {task.estimatedTime}m</span>
                                    {task.actualTime !== undefined && task.actualTime > 0 ? (
                                        <span className={cn(
                                            "ml-1 font-bold",
                                            task.actualTime > task.estimatedTime ? "text-rose-500" : "text-emerald-500"
                                        )}>
                                            Act: {task.actualTime}m
                                        </span>
                                    ) : (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const act = prompt("Enter actual time spent (in minutes):");
                                                if (act !== null) {
                                                    const mins = parseInt(act);
                                                    if (!isNaN(mins)) {
                                                        editTask(task.id, { actualTime: mins });
                                                    }
                                                }
                                            }}
                                            className="ml-1 text-primary hover:underline hover:text-primary/80 font-bold"
                                        >
                                            + Act
                                        </button>
                                    )}
                                </div>
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

                            {/* AI Priority Button */}
                            {isAIEnabled() && !aiPriority && !compact && task.status !== 'done' && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={getAIPriority}
                                    disabled={loadingPriority}
                                    className="h-6 px-2 text-[10px] gap-1 text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                                >
                                    <Sparkles className="h-3 w-3" />
                                    {loadingPriority ? 'Analyzing...' : 'AI Priority'}
                                </Button>
                            )}

                            {/* Pomodoro Timer Trigger */}
                            {task.status !== 'done' && (
                                <div className="flex items-center">
                                    {isCurrentTaskActive ? (
                                        isTimerRunning ? (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    pauseTimer();
                                                }}
                                                className="h-6 px-2 text-[10px] gap-1 text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 rounded-md font-semibold"
                                            >
                                                <Pause className="h-3 w-3 fill-current animate-pulse" />
                                                <span>Focusing ({formatMinutesSeconds(timeLeft)})</span>
                                            </Button>
                                        ) : (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    resumeTimer();
                                                }}
                                                className="h-6 px-2 text-[10px] gap-1 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 rounded-md font-semibold"
                                            >
                                                <Play className="h-3 w-3 fill-current" />
                                                <span>Paused ({formatMinutesSeconds(timeLeft)})</span>
                                            </Button>
                                        )
                                    ) : (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                startTimer(task.id, task.title);
                                            }}
                                            className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5 rounded-md font-medium"
                                        >
                                            <Play className="h-3 w-3" />
                                            <span>Start Focus</span>
                                        </Button>
                                    )}
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
        </div>
    );
}
