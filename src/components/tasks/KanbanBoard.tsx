"use client"

import { useState } from "react"
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from "@dnd-kit/core"
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { TaskCard } from "./TaskCard"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/supabase/types"

type Task = Database['public']['Tables']['tasks']['Row']

interface KanbanBoardProps {
    tasks: Task[]
    onTaskUpdate: (task: Task) => void
}

type TaskStatus = 'todo' | 'in_progress' | 'done'

const COLUMNS: { id: TaskStatus; title: string }[] = [
    { id: 'todo', title: 'To Do' },
    { id: 'in_progress', title: 'In Progress' },
    { id: 'done', title: 'Done' },
]

export function KanbanBoard({ tasks, onTaskUpdate }: KanbanBoardProps) {
    const [activeId, setActiveId] = useState<string | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
    }

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event
        if (!over) return

        const activeId = active.id
        const overId = over.id as string

        // Find the containers (columns)
        const activeTask = tasks.find(t => t.id === activeId)
        const overTask = tasks.find(t => t.id === overId)

        // If dragging over a column directly
        const isOverColumn = COLUMNS.some(col => col.id === overId)

        if (activeTask && (overTask || isOverColumn)) {
            const overStatus = isOverColumn
                ? overId as TaskStatus
                : overTask?.status as TaskStatus

            if (activeTask.status !== overStatus) {
                // Optimistic update for drag over different columns handled in DragEnd usually
                // but we can do it here for smoother UI if we managed strict local state order
            }
        }
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        setActiveId(null)

        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        const activeTask = tasks.find(t => t.id === activeId)
        if (!activeTask) return

        // Determine new status
        let newStatus = activeTask.status

        if (COLUMNS.some(col => col.id === overId)) {
            // Dropped on a column header/container
            newStatus = overId
        } else {
            // Dropped on another task
            const overTask = tasks.find(t => t.id === overId)
            if (overTask) {
                newStatus = overTask.status
            }
        }

        if (activeTask.status !== newStatus) {
            onTaskUpdate({ ...activeTask, status: newStatus })
        }
    }

    const activeTask = tasks.find(t => t.id === activeId)

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-full gap-6 overflow-x-auto pb-4">
                {COLUMNS.map((col) => (
                    <div key={col.id} className="flex-1 min-w-[300px] flex flex-col gap-4">
                        <div className="flex items-center justify-between p-1">
                            <h3 className="font-semibold text-muted-foreground flex items-center gap-2">
                                <span className={cn(
                                    "w-2 h-2 rounded-full",
                                    col.id === 'todo' && "bg-slate-400",
                                    col.id === 'in_progress' && "bg-blue-400",
                                    col.id === 'done' && "bg-green-400"
                                )} />
                                {col.title}
                            </h3>
                            <span className="bg-muted px-2 py-0.5 rounded-full text-xs font-medium">
                                {tasks.filter(t => t.status === col.id).length}
                            </span>
                        </div>

                        <div className="flex-1 bg-muted/20 rounded-xl p-4 border border-border/40 space-y-3 min-h-[200px]">
                            <SortableContext
                                id={col.id}
                                items={tasks.filter(t => t.status === col.id).map(t => t.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {tasks
                                    .filter(t => t.status === col.id)
                                    .map((task) => (
                                        <SortableTask key={task.id} task={task} />
                                    ))}
                            </SortableContext>
                            {tasks.filter(t => t.status === col.id).length === 0 && (
                                <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm italic">
                                    Drop items here
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <DragOverlay
                dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({
                        styles: {
                            active: {
                                opacity: "0.5",
                            },
                        },
                    }),
                }}
            >
                {activeTask ? (
                    <div className="w-[300px]">
                        <TaskCard task={activeTask} isOverlay />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}

function SortableTask({ task }: { task: Task }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: task.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <TaskCard task={task} />
        </div>
    )
}
