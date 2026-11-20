"use client"

import { useEffect, useState } from "react"
import { useShallow } from 'zustand/react/shallow'
import { TaskCard } from "@/components/tasks/TaskCard"
import { motion, AnimatePresence } from "framer-motion"
import { CalendarCheck, ArrowRight, Loader2, Wallet, HeartHandshake, Landmark, Users, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useTaskStore } from "@/lib/stores/task-store"
import { useFinanceStore, formatINR } from "@/lib/stores/finance-store"
import type { FinancialObligationItem } from "@/lib/types"
import { toast } from "sonner"

interface TodayTasksWidgetProps {
    isHydrated?: boolean;
}

export function TodayTasksWidget({ isHydrated = false }: TodayTasksWidgetProps) {
    const { loadTasks, tasks, toggleTaskComplete, isLoading } = useTaskStore(
        useShallow((s) => ({
            loadTasks: s.loadTasks,
            tasks: s.tasks,
            toggleTaskComplete: s.toggleTaskComplete,
            isLoading: s.isLoading,
        }))
    )

    const {
        categories,
        loadFinanceData,
        getUpcomingFinancialObligations,
        payMonthlyEmi,
        settleCommitmentBalance,
        recordDebtInstallment,
    } = useFinanceStore(
        useShallow((s) => ({
            categories: s.categories,
            loadFinanceData: s.loadFinanceData,
            getUpcomingFinancialObligations: s.getUpcomingFinancialObligations,
            payMonthlyEmi: s.payMonthlyEmi,
            settleCommitmentBalance: s.settleCommitmentBalance,
            recordDebtInstallment: s.recordDebtInstallment,
        }))
    )

    const router = useRouter()
    const [mounted, setMounted] = useState(isHydrated)

    useEffect(() => {
        if (tasks.length === 0) {
            loadTasks()
        }
        if (categories.length === 0) {
            loadFinanceData()
        }
        if (mounted) return;
        setMounted(true)
    }, [loadTasks, tasks.length, categories.length, loadFinanceData, mounted])

    // Hydration safety: Don't render date-dependent logic until mounted
    if (!mounted) {
        return (
            <section className="surface-card overflow-hidden h-[200px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
            </section>
        )
    }

    const today = new Date().toISOString().split('T')[0]

    const allFocusTasks = tasks.filter(t => {
        if (t.status === 'done' || t.status === 'archived' || t.parentTaskId) return false;
        return !t.due_date || t.due_date <= (today + "T23:59:59");
    }).sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return a.title.localeCompare(b.title);
    });

    const financialObligations = getUpcomingFinancialObligations(5);

    const totalFocusCount = allFocusTasks.length + financialObligations.length;
    const todayTasks = allFocusTasks.slice(0, 6);

    const handleTaskComplete = async (id: string) => {
        await toggleTaskComplete(id)
    }

    const handleQuickSettleObligation = async (item: FinancialObligationItem) => {
        if (item.type === 'emi') {
            await payMonthlyEmi(item.sourceId);
            toast.success(`Paid ${item.title} (${formatINR(item.amount)})`);
        } else if (item.type === 'commitment') {
            await settleCommitmentBalance(item.sourceId);
            toast.success(`Settled ${item.title} (${formatINR(item.amount)})`);
        } else if (item.type === 'debt') {
            await recordDebtInstallment({
                debtId: item.sourceId,
                amount: item.amount,
                paymentMethod: 'upi',
                note: 'Quick installment payment from Dashboard',
            });
            toast.success(`Logged ${formatINR(item.amount)} partial installment`);
        }
    }

    if (isLoading && tasks.length === 0) return (
        <div className="h-full min-h-[200px] flex items-center justify-center surface-card">
            <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
        </div>
    )

    return (
        <section className="surface-card overflow-hidden tour-tasks-widget">
            <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
                <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="p-2 sm:p-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0 text-primary mt-0.5 sm:mt-0">
                            <CalendarCheck className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                            <h2 className="text-base sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-snug">
                                Today&apos;s Focus &amp; Financial Dues
                            </h2>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                {totalFocusCount > 0
                                    ? `${allFocusTasks.length} ${allFocusTasks.length === 1 ? 'task' : 'tasks'} & ${financialObligations.length} obligation(s) due soon`
                                    : "All caught up!"}
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/tasks')}
                        className="group shrink-0 gap-1 sm:gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-all h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-4"
                    >
                        <span>View All</span>
                        <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                </div>

                {/* Upcoming Financial Obligations (EMIs, Monthly Commitments, Friend Debt Installments due within 5 days) */}
                {financialObligations.length > 0 && (
                    <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                                Due Commitments &amp; EMIs (Next 5 Days)
                            </span>
                            <button
                                type="button"
                                onClick={() => router.push('/finance')}
                                className="text-[11px] sm:text-xs text-primary hover:underline font-medium"
                            >
                                Manage in FlowFinance →
                            </button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {financialObligations.map((ob) => {
                                const Icon =
                                    ob.type === 'commitment'
                                        ? HeartHandshake
                                        : ob.type === 'emi'
                                        ? Landmark
                                        : Users;
                                return (
                                    <div
                                        key={ob.id}
                                        className="surface-subtle p-3.5 flex flex-col justify-between gap-2.5"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase text-primary">
                                                    <Icon className="w-3.5 h-3.5" />
                                                    {ob.type === 'commitment'
                                                        ? 'Commitment'
                                                        : ob.type === 'emi'
                                                        ? 'Loan EMI'
                                                        : 'Friend Debt'}
                                                </span>
                                                <span
                                                    className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                                        ob.isOverdue
                                                            ? 'bg-rose-500/15 text-rose-500'
                                                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                                    }`}
                                                >
                                                    {ob.isOverdue
                                                        ? `Due (${Math.abs(ob.daysUntilDue)}d ago)`
                                                        : ob.daysUntilDue === 0
                                                        ? 'Due Today'
                                                        : `In ${ob.daysUntilDue}d`}
                                                </span>
                                            </div>
                                            <p className="text-sm font-bold text-foreground line-clamp-1">
                                                {ob.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground line-clamp-1">
                                                {ob.subtitle}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between pt-1 border-t border-border/50">
                                            <span className="text-sm font-bold font-mono tabular-nums text-foreground">
                                                {formatINR(ob.amount)}
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleQuickSettleObligation(ob)}
                                                className="h-7 px-2.5 text-xs gap-1"
                                            >
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                {ob.type === 'commitment'
                                                    ? 'Settle'
                                                    : ob.type === 'emi'
                                                    ? 'Mark Paid'
                                                    : 'Pay Partial'}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                        {todayTasks.length === 0 && financialObligations.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="col-span-full flex flex-col items-center justify-center py-12 text-center space-y-4"
                            >
                                <div className="p-4 rounded-full bg-muted/50 border border-border/50">
                                    <CalendarCheck className="h-8 w-8 text-muted-foreground/40" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-lg font-medium text-muted-foreground">Clear for takeoff!</p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push('/tasks')}
                                    className="rounded-xl border-primary/20 hover:border-primary/40 hover:bg-primary/5 h-10 text-sm px-6"
                                >
                                    Create Task
                                </Button>
                            </motion.div>
                        ) : (
                            todayTasks.map((task, index) => (
                                <motion.div
                                    key={task.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        transition: { delay: index * 0.05 }
                                    }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                >
                                    <TaskCard task={task} onComplete={handleTaskComplete} compact />
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </section>
    )
}
