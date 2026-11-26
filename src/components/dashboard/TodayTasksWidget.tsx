"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useShallow } from 'zustand/react/shallow'
import { TaskCard } from "@/components/tasks/TaskCard"
import { CalendarCheck, ArrowRight, Loader2, CheckSquare, ChevronDown, ChevronRight, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useTaskStore } from "@/lib/stores/task-store"
import { getLocalIsoDate } from "@/lib/finance/credit-card-cycles"
import { useFeedback } from "@/hooks/use-feedback"
import type { Task } from "@/lib/types"

interface TodayTasksWidgetProps {
    isHydrated?: boolean;
}

const PRIORITY_WEIGHT: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
};

export function partitionTop3Mits(allFocusTasks: Task[], todayIso: string): {
    mitTasks: Array<{ task: Task; isExplicitMit: boolean; mitRank: number }>;
    otherTasks: Task[];
} {
    const explicitMits = allFocusTasks
        .filter((t) => t.metadata?.isMitForDate === todayIso)
        .sort((a, b) => {
            const rankA = Number(a.metadata?.mitRank ?? 99);
            const rankB = Number(b.metadata?.mitRank ?? 99);
            return rankA - rankB;
        });

    const selectedExplicit = explicitMits.slice(0, 3);
    const selectedIds = new Set(selectedExplicit.map((t) => t.id));

    const remainingCandidates = allFocusTasks.filter((t) => !selectedIds.has(t.id));
    const slotsNeeded = Math.max(0, 3 - selectedExplicit.length);
    const autoTop = remainingCandidates.slice(0, slotsNeeded);
    autoTop.forEach((t) => selectedIds.add(t.id));

    const mitTasks = [
        ...selectedExplicit.map((task, idx) => ({
            task,
            isExplicitMit: true,
            mitRank: Number(task.metadata?.mitRank ?? idx + 1) || idx + 1,
        })),
        ...autoTop.map((task, idx) => ({
            task,
            isExplicitMit: false,
            mitRank: selectedExplicit.length + idx + 1,
        })),
    ];

    const otherTasks = allFocusTasks.filter((t) => !selectedIds.has(t.id));
    return { mitTasks, otherTasks };
}

function buildSubtasksMap(tasks: Task[]): Map<string, Task[]> {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
        if (!t.parentTaskId || t.status === 'archived') continue;
        const arr = map.get(t.parentTaskId);
        if (arr) arr.push(t);
        else map.set(t.parentTaskId, [t]);
    }
    return map;
}

function compareOptionalDates(aDate?: string | null, bDate?: string | null): number {
    if (aDate && bDate) return aDate.localeCompare(bDate);
    if (aDate === bDate) return 0;
    return aDate ? -1 : 1;
}

function compareMitPriority(a: Task, b: Task, today: string): number {
    const aRank = a.metadata?.isMitForDate === today ? Number(a.metadata?.mitRank ?? 99) : 999;
    const bRank = b.metadata?.isMitForDate === today ? Number(b.metadata?.mitRank ?? 99) : 999;
    return aRank - bRank;
}

function compareFocusTasks(a: Task, b: Task, today: string): number {
    const mitDiff = compareMitPriority(a, b, today);
    if (mitDiff !== 0) return mitDiff;
    const pDiff = (PRIORITY_WEIGHT[a.priority] ?? 2) - (PRIORITY_WEIGHT[b.priority] ?? 2);
    if (pDiff !== 0) return pDiff;
    return compareOptionalDates(a.due_date, b.due_date) || a.title.localeCompare(b.title);
}

function selectActiveFocusTasks(tasks: Task[], mounted: boolean, today: string): Task[] {
    if (!mounted) return [];
    const cutoff = today + 'T23:59:59';
    return tasks
        .filter((t) => t.status !== 'done' && t.status !== 'archived' && !t.parentTaskId && (!t.due_date || t.due_date <= cutoff))
        .sort((a, b) => compareFocusTasks(a, b, today));
}

async function patchTaskMitMeta(
    task: Task,
    patch: { isMitForDate: string | null; mitRank: number | null },
    editTask: (id: string, data: Partial<Task>) => Promise<void>
) {
    const base = task.metadata && typeof task.metadata === 'object' ? task.metadata : {};
    await editTask(task.id, { metadata: { ...base, ...patch } });
}

async function applyMitToggle(
    task: Task,
    today: string,
    allFocusTasks: Task[],
    editTask: (id: string, patch: Partial<Task>) => Promise<void>
) {
    if (task.metadata?.isMitForDate === today) {
        await patchTaskMitMeta(task, { isMitForDate: null, mitRank: null }, editTask);
        return;
    }
    const pinned = allFocusTasks
        .filter((t) => t.metadata?.isMitForDate === today)
        .sort((a, b) => Number(a.metadata?.mitRank ?? 99) - Number(b.metadata?.mitRank ?? 99));
    if (pinned.length >= 3) {
        await patchTaskMitMeta(pinned[pinned.length - 1], { isMitForDate: null, mitRank: null }, editTask);
    }
    await patchTaskMitMeta(task, { isMitForDate: today, mitRank: Math.min(3, pinned.length + 1) }, editTask);
}

function useTodayTasksData(isHydrated: boolean) {
    const { loadTasks, tasks, toggleTaskComplete, editTask, isLoading } = useTaskStore(
        useShallow((s) => ({
            loadTasks: s.loadTasks,
            tasks: s.tasks,
            toggleTaskComplete: s.toggleTaskComplete,
            editTask: s.editTask,
            isLoading: s.isLoading,
        }))
    );
    const [mounted, setMounted] = useState(isHydrated);

    useEffect(() => {
        if (tasks.length === 0) loadTasks();
        if (!mounted) setMounted(true);
    }, [loadTasks, tasks.length, mounted]);

    const today = mounted ? getLocalIsoDate() : '';
    const subtasksByParentId = useMemo(() => buildSubtasksMap(tasks), [tasks]);
    const allFocusTasks = useMemo(
        () => selectActiveFocusTasks(tasks, mounted, today),
        [mounted, tasks, today]
    );
    const { mitTasks, otherTasks } = useMemo(() => partitionTop3Mits(allFocusTasks, today), [allFocusTasks, today]);

    return { mounted, isLoading, tasks, today, subtasksByParentId, allFocusTasks, mitTasks, otherTasks, toggleTaskComplete, editTask };
}

function useTodayTasksState(isHydrated: boolean) {
    const feedback = useFeedback();
    const {
        mounted,
        isLoading,
        tasks,
        today,
        subtasksByParentId,
        allFocusTasks,
        mitTasks,
        otherTasks,
        toggleTaskComplete,
        editTask,
    } = useTodayTasksData(isHydrated);

    const handleTaskComplete = useCallback(async (id: string) => {
        const target = tasks.find((t) => t.id === id);
        if (target?.status === 'done') feedback.uncheck();
        else feedback.complete();
        await toggleTaskComplete(id);
    }, [tasks, toggleTaskComplete, feedback]);

    const canEditMit = typeof editTask === 'function';
    const handleToggleMit = useCallback(async (task: Task) => {
        if (!canEditMit) return;
        await applyMitToggle(task, today, allFocusTasks, editTask);
    }, [canEditMit, editTask, allFocusTasks, today]);

    return {
        mounted,
        isLoading,
        tasksCount: tasks.length,
        subtasksByParentId,
        allFocusTasks,
        mitTasks,
        otherTasks,
        handleTaskComplete,
        handleToggleMit: canEditMit ? handleToggleMit : undefined,
    };
}

function OtherTasksDrawer(props: {
    otherTasks: Task[];
    isOpen: boolean;
    onToggleOpen: () => void;
    subtasksByParentId: Map<string, Task[]>;
    onComplete: (id: string) => Promise<void>;
    onToggleMit?: (task: Task) => Promise<void>;
}) {
    const { otherTasks, isOpen, onToggleOpen, subtasksByParentId, onComplete, onToggleMit } = props;
    if (otherTasks.length === 0) return null;
    return (
        <div className="pt-1 border-t border-border/50">
            <button
                type="button"
                onClick={onToggleOpen}
                aria-expanded={isOpen}
                data-testid="other-tasks-drawer-toggle"
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
                <span className="flex items-center gap-1.5">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    Other Tasks ({otherTasks.length})
                </span>
                <span className="text-[10px] font-mono">{isOpen ? 'Collapse' : 'Show backlog'}</span>
            </button>

            {isOpen && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2.5" data-testid="other-tasks-drawer-content">
                    {otherTasks.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            subtasks={subtasksByParentId.get(task.id)}
                            onComplete={onComplete}
                            compact
                            isMit={false}
                            onToggleMit={onToggleMit}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function FocusMitEmptyState({ onNavigate }: { onNavigate: (path: string) => void }) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="top-3-mits-zone">
            <div className="col-span-full flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-5">
                <div className="flex items-center gap-3 text-center sm:text-left">
                    <div className="p-2.5 rounded-xl bg-muted/60 border border-border/60 shrink-0 hidden sm:flex">
                        <CheckSquare className="h-5 w-5 text-muted-foreground/70" />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-foreground">Clear for takeoff</p>
                        <p className="text-xs text-muted-foreground">No pending tasks due today. Add one or review your habits.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => onNavigate('/habits')} className="rounded-xl h-9 text-xs px-3.5">Open Habits</Button>
                    <Button size="sm" onClick={() => onNavigate('/tasks')} className="rounded-xl h-9 text-xs px-4">Create Task</Button>
                </div>
            </div>
        </div>
    );
}

function FocusMitGrid(props: {
    mitTasks: Array<{ task: Task; isExplicitMit: boolean; mitRank: number }>;
    subtasksByParentId: Map<string, Task[]>;
    onComplete: (id: string) => Promise<void>;
    onToggleMit?: (task: Task) => Promise<void>;
    onNavigate: (path: string) => void;
}) {
    const { mitTasks, subtasksByParentId, onComplete, onToggleMit, onNavigate } = props;
    if (mitTasks.length === 0) return <FocusMitEmptyState onNavigate={onNavigate} />;

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="top-3-mits-zone">
            {mitTasks.map(({ task, isExplicitMit, mitRank }) => (
                <div key={task.id}>
                    <TaskCard
                        task={task}
                        subtasks={subtasksByParentId.get(task.id)}
                        onComplete={onComplete}
                        compact
                        isMit={isExplicitMit}
                        mitRank={isExplicitMit ? mitRank : null}
                        onToggleMit={onToggleMit}
                    />
                </div>
            ))}
        </div>
    );
}

function TodayTasksHeader({
    allFocusCount,
    onViewAll,
}: {
    allFocusCount: number;
    onViewAll: () => void;
}) {
    const taskWord = allFocusCount === 1 ? 'task' : 'tasks';
    return (
        <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 shrink-0 text-primary flex items-center justify-center">
                    <CalendarCheck className="h-4 w-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-snug">Today&apos;s Focus</h2>
                        {allFocusCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                                <Star className="h-2.5 w-2.5 fill-current" />
                                Top 3 Must-Do MITs
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono tabular-nums">
                        {allFocusCount > 0 ? `${allFocusCount} ${taskWord} queued for today` : 'All tasks clear for today'}
                    </p>
                </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onViewAll} className="group shrink-0 gap-1 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-all h-9 text-xs px-2.5 sm:px-3">
                <span>All Tasks</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
        </div>
    );
}

function TodayTasksLoadingBox() {
    return (
        <section className="surface-card overflow-hidden h-[180px] flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
        </section>
    );
}

export function TodayTasksWidget({ isHydrated = false }: TodayTasksWidgetProps) {
    const router = useRouter()
    const [isOtherTasksOpen, setIsOtherTasksOpen] = useState(false)
    const {
        mounted,
        isLoading,
        tasksCount,
        subtasksByParentId,
        allFocusTasks,
        mitTasks,
        otherTasks,
        handleTaskComplete,
        handleToggleMit,
    } = useTodayTasksState(isHydrated)

    if (!mounted) return <TodayTasksLoadingBox />;
    if (isLoading && tasksCount === 0) return <TodayTasksLoadingBox />;

    return (
        <section className="surface-card overflow-hidden tour-tasks-widget">
            <div className="p-4 sm:p-6 space-y-4">
                <TodayTasksHeader allFocusCount={allFocusTasks.length} onViewAll={() => router.push('/tasks')} />

                <FocusMitGrid
                    mitTasks={mitTasks}
                    subtasksByParentId={subtasksByParentId}
                    onComplete={handleTaskComplete}
                    onToggleMit={handleToggleMit}
                    onNavigate={(path) => router.push(path)}
                />

                <OtherTasksDrawer
                    otherTasks={otherTasks}
                    isOpen={isOtherTasksOpen}
                    onToggleOpen={() => setIsOtherTasksOpen((prev) => !prev)}
                    subtasksByParentId={subtasksByParentId}
                    onComplete={handleTaskComplete}
                    onToggleMit={handleToggleMit}
                />
            </div>
        </section>
    )
}
