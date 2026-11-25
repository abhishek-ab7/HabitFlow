'use client';

import { useState, useMemo, memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  Calendar,
  Flag,
  Star,
  MoreHorizontal,
  Pencil,
  Trash2,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles,
  Landmark,
  PiggyBank,
  ArrowDownRight,
  TrendingUp,
  Dumbbell,
  Scale,
  Ruler,
  Footprints,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScaleOnHover, SuccessRipple } from '@/components/motion';
import { cn } from '@/lib/utils';
import { getDeadlineStatus, calculateHabitStats } from '@/lib/calculations';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { calculateFitnessGoalProgress } from '@/lib/fitness/shared-analytics';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import dynamic from 'next/dynamic';
import type { Goal, Milestone, GoalStats, Priority, AreaOfLife } from '@/lib/types';

const GoalRoadmapView = dynamic(
  () => import('./GoalRoadmapView').then((m) => ({ default: m.GoalRoadmapView })),
  { ssr: false }
);
const SMARTGoalAnalysis = dynamic(
  () => import('./SMARTGoalAnalysis').then((m) => ({ default: m.SMARTGoalAnalysis })),
  { ssr: false }
);

interface GoalCardProps {
  goal: Goal;
  milestones: Milestone[];
  stats: GoalStats;
  viewMode?: 'grid' | 'list';
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
  onArchive: (goalId: string) => void;
  onSetFocus: (goalId: string) => void;
  onToggleMilestone: (milestoneId: string) => void;
  onAddMilestone: (goalId: string) => void;
}

const PRIORITY_STYLES: Record<Priority, { color: string; label: string }> = {
  high: { color: 'text-rose-600 dark:text-rose-400', label: 'High' },
  medium: { color: 'text-amber-600 dark:text-amber-400', label: 'Medium' },
  low: { color: 'text-muted-foreground', label: 'Low' },
};

const AREA_STYLES: Record<AreaOfLife, { text: string; label: string }> = {
  career: { text: 'text-blue-600 dark:text-blue-400', label: 'Career' },
  health: { text: 'text-emerald-600 dark:text-emerald-400', label: 'Health' },
  relationships: { text: 'text-rose-600 dark:text-rose-400', label: 'Relationships' },
  personal_growth: { text: 'text-teal-600 dark:text-teal-400', label: 'Personal Growth' },
  finance: { text: 'text-sky-600 dark:text-sky-400', label: 'Finance' },
  fun: { text: 'text-amber-600 dark:text-amber-400', label: 'Fun & Leisure' },
};

const EMPTY_HABITS: never[] = [];
const EMPTY_COMPLETIONS: never[] = [];
const EMPTY_ACCOUNTS: never[] = [];
const EMPTY_DEBTS: never[] = [];
const EMPTY_EMIS: never[] = [];
const EMPTY_SIPS: never[] = [];
const EMPTY_DAILY_LOGS: never[] = [];
const EMPTY_WORKOUTS: never[] = [];

function GoalDetailsHealthBadge({ goal, stats }: { goal: Goal; stats: GoalStats }) {
  const { habits, completions } = useHabitStore(
    useShallow((s) => ({ habits: s.habits, completions: s.completions }))
  );

  const healthScore = useMemo(() => {
    const getLinkedCategories = (area: string): string[] => {
      switch (area) {
        case 'career': return ['work', 'learning'];
        case 'health': return ['health'];
        case 'relationships': return ['relationships'];
        case 'personal_growth': return ['learning', 'personal'];
        case 'finance': return ['finance'];
        case 'fun': return ['personal'];
        default: return [];
      }
    };

    const linkedCats = getLinkedCategories(goal.areaOfLife);
    const activeHabits = habits.filter((h) => !h.archived);
    const linkedHabits = activeHabits.filter((h) => linkedCats.includes(h.category));
    const targetHabits = linkedHabits.length > 0 ? linkedHabits : activeHabits;

    let consistency = 80;
    if (targetHabits.length > 0) {
      const compsByHabit = new Map<string, typeof completions>();
      for (const c of completions) {
        const arr = compsByHabit.get(c.habitId);
        if (arr) arr.push(c);
        else compsByHabit.set(c.habitId, [c]);
      }
      const sumRates = targetHabits.reduce(
        (sum, h) => sum + calculateHabitStats(h, compsByHabit.get(h.id) || []).completionRate,
        0
      );
      consistency = sumRates / targetHabits.length;
    }

    const milestoneProgress = stats.progress;
    const totalDays = stats.totalDays || 1;
    const daysRemaining = stats.daysRemaining;
    let proximityScore = 100;
    if (!stats.isOnTrack) {
      proximityScore = Math.max(0, Math.min(100, (daysRemaining / totalDays) * 100));
    }

    return Math.round(consistency * 0.4 + milestoneProgress * 0.4 + proximityScore * 0.2);
  }, [goal.areaOfLife, habits, completions, stats]);

  return (
    <span
      className={cn(
        'font-semibold',
        healthScore >= 80
          ? 'text-emerald-600 dark:text-emerald-400'
          : healthScore >= 50
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-rose-600 dark:text-rose-400'
      )}
    >
      Health {healthScore}/100
    </span>
  );
}

export const GoalCard = memo(function GoalCard({
  goal,
  milestones,
  stats,
  viewMode = 'grid',
  onEdit,
  onDelete,
  onArchive,
  onSetFocus,
  onToggleMilestone,
  onAddMilestone,
}: GoalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [rippleMilestone, setRippleMilestone] = useState<string | null>(null);

  const hasFinanceLink = Boolean(goal.financialLink && goal.financialLink.targetAmount);
  const hasFitnessLink = Boolean(goal.fitnessLink && goal.fitnessLink.targetValue);

  const { accounts, debtRecords, emiTrackers, sipPlans, getNetWorthSummary, getMonthlySummary } = useFinanceStore(
    useShallow((s) =>
      hasFinanceLink
        ? {
            accounts: s.accounts,
            debtRecords: s.debtRecords,
            emiTrackers: s.emiTrackers,
            sipPlans: s.sipPlans,
            getNetWorthSummary: s.getNetWorthSummary,
            getMonthlySummary: s.getMonthlySummary,
          }
        : {
            accounts: EMPTY_ACCOUNTS,
            debtRecords: EMPTY_DEBTS,
            emiTrackers: EMPTY_EMIS,
            sipPlans: EMPTY_SIPS,
            getNetWorthSummary: s.getNetWorthSummary,
            getMonthlySummary: s.getMonthlySummary,
          }
    )
  );
  const fitnessProfile = useFitnessStore((s) => (hasFitnessLink ? s.profile : null));
  const fitnessDailyLogs = useFitnessStore((s) => (hasFitnessLink ? s.dailyLogs : EMPTY_DAILY_LOGS));
  const fitnessWorkoutSessions = useFitnessStore((s) =>
    hasFitnessLink ? s.workoutSessions : EMPTY_WORKOUTS
  );

  const fitnessProgress = useMemo(() => {
    if (!goal.fitnessLink || !goal.fitnessLink.targetValue) return null;
    const summary = calculateFitnessGoalProgress(goal.fitnessLink, {
      profile: fitnessProfile,
      dailyLogs: fitnessDailyLogs,
      workoutSessions: fitnessWorkoutSessions,
      referenceDate: getLocalIsoDate(),
    });
    const Icon =
      goal.fitnessLink.type === 'target_weight'
        ? Scale
        : goal.fitnessLink.type === 'target_waist'
          ? Ruler
          : goal.fitnessLink.type === 'daily_steps_avg'
            ? Footprints
            : Dumbbell;
    return { ...summary, Icon };
  }, [goal.fitnessLink, fitnessProfile, fitnessDailyLogs, fitnessWorkoutSessions]);

  const financialProgress = useMemo(() => {
    if (!goal.financialLink || !goal.financialLink.targetAmount) return null;

    const { type, targetAmount, startingAmount = 0, linkedAccountIds, linkedDebtIds, linkedSipIds } = goal.financialLink;

    let currentAmount = 0;
    let label = 'Live Financial Balance';
    let icon = Landmark;

    if (type === 'savings_target') {
      label = 'Savings Target';
      icon = PiggyBank;
      const relevantAccounts = linkedAccountIds && linkedAccountIds.length > 0
        ? accounts.filter(a => linkedAccountIds.includes(a.id))
        : accounts.filter(a => a.type !== 'credit_card');
      currentAmount = relevantAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    } else if (type === 'debt_payoff') {
      label = 'Debt Payoff';
      icon = ArrowDownRight;
      const allDebts = [
        ...debtRecords.map(d => ({ id: d.id, amount: d.remainingAmount, initial: d.principalAmount || d.remainingAmount })),
        ...emiTrackers.map(e => ({
          id: e.id,
          amount: Math.max(0, (e.tenureMonths - e.paidMonths) * e.emiAmount),
          initial: e.principalAmount,
        }))
      ];
      const relevantDebts = linkedDebtIds && linkedDebtIds.length > 0
        ? allDebts.filter(d => linkedDebtIds.includes(d.id))
        : allDebts;

      const currentRemaining = relevantDebts.reduce((sum, d) => sum + d.amount, 0);
      const initialTotal = startingAmount || targetAmount;
      currentAmount = Math.max(0, initialTotal - currentRemaining);
    } else if (type === 'net_worth') {
      label = 'Net Worth Milestone';
      icon = Landmark;
      const nw = getNetWorthSummary();
      currentAmount = nw.netWorth;
    } else if (type === 'sip_corpus') {
      label = 'SIP Corpus';
      icon = TrendingUp;
      const relevantSips = linkedSipIds && linkedSipIds.length > 0
        ? sipPlans.filter(s => linkedSipIds.includes(s.id))
        : sipPlans;
      currentAmount = relevantSips.reduce((sum, s) => sum + (s.currentValue || s.totalInvested || 0), 0);
    }

    const remaining = Math.max(0, targetAmount - currentAmount);
    const progressPct = targetAmount > 0
      ? Math.min(100, Math.max(0, Math.round(((currentAmount - (type === 'net_worth' ? startingAmount : 0)) / (targetAmount - (type === 'net_worth' ? startingAmount : 0) || 1)) * 100)))
      : 0;

    let projectionText: string | null = null;
    if (progressPct >= 100) {
      projectionText = 'Target Achieved';
    } else {
      const summary = getMonthlySummary(format(new Date(), 'yyyy-MM'));
      const netCashFlow = summary.totalIncome - summary.totalSpent;
      const monthlyNetSavings = netCashFlow > 0 ? netCashFlow : summary.safeToSpendMonthly;

      let monthlyPace = monthlyNetSavings;
      if (type === 'sip_corpus') {
        const totalMonthlySip = sipPlans.filter(s => s.isActive).reduce((sum, s) => sum + s.monthlyAmount, 0);
        monthlyPace = totalMonthlySip > 0 ? totalMonthlySip : monthlyNetSavings;
      } else if (type === 'debt_payoff') {
        const monthlyDebtPmt = emiTrackers.reduce((sum, e) => sum + e.emiAmount, 0) + (debtRecords.length > 0 ? 5000 : 0);
        monthlyPace = monthlyDebtPmt > 0 ? monthlyDebtPmt : monthlyNetSavings;
      }

      if (monthlyPace > 0 && remaining > 0) {
        const monthsNeeded = Math.ceil(remaining / monthlyPace);
        if (monthsNeeded <= 1) {
          projectionText = 'Projected: Reached this month';
        } else if (monthsNeeded <= 12) {
          projectionText = `Projected: ~${monthsNeeded} mo (₹${Math.round(monthlyPace).toLocaleString('en-IN')}/mo)`;
        } else {
          const years = (monthsNeeded / 12).toFixed(1);
          projectionText = `Projected: ~${years} yrs (₹${Math.round(monthlyPace).toLocaleString('en-IN')}/mo)`;
        }
      }
    }

    return {
      type,
      label,
      Icon: icon,
      currentAmount,
      targetAmount,
      remaining,
      progressPct,
      projectionText,
    };
  }, [goal.financialLink, accounts, debtRecords, emiTrackers, sipPlans, getNetWorthSummary, getMonthlySummary]);

  const deadlineInfo = useMemo(() => getDeadlineStatus(goal.deadline), [goal.deadline]);
  const priorityStyle = PRIORITY_STYLES[goal.priority];
  const areaStyle = AREA_STYLES[goal.areaOfLife];

  const pendingMilestones = useMemo(() => milestones.filter(m => !m.completed), [milestones]);
  const nextMilestone = pendingMilestones[0];

  // Single truthful status indicator (never contradicts Not Started with On Track)
  const unifiedStatus = useMemo(() => {
    if (goal.status === 'completed') {
      return { label: 'Completed', className: 'text-emerald-600 dark:text-emerald-400' };
    }
    if (goal.status === 'on_hold') {
      return { label: 'On Hold', className: 'text-muted-foreground' };
    }
    if (goal.status === 'not_started') {
      return { label: 'Not Started', className: 'text-muted-foreground' };
    }
    return stats.isOnTrack
      ? { label: 'In Progress · On Track', className: 'text-emerald-600 dark:text-emerald-400' }
      : { label: 'In Progress · Behind', className: 'text-amber-600 dark:text-amber-400' };
  }, [goal.status, stats.isOnTrack]);

  // Timeline percentage (shown cleanly inside Roadmap modal)
  const totalDays = stats.totalDays || 1;
  const elapsedPercentage = Math.min(100, Math.max(0, (stats.daysElapsed / totalDays) * 100));

  const getDeadlineColorClass = (color: typeof deadlineInfo.color) => {
    switch (color) {
      case 'destructive': return 'text-destructive';
      case 'warning': return 'text-amber-600 dark:text-amber-400';
      case 'success': return 'text-emerald-600 dark:text-emerald-400';
      default: return 'text-muted-foreground';
    }
  };

  const handleMilestoneToggle = (milestoneId: string) => {
    setRippleMilestone(milestoneId);
    onToggleMilestone(milestoneId);
    setTimeout(() => setRippleMilestone(null), 500);
  };

  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Goal actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        <DropdownMenuItem onClick={() => onSetFocus(goal.id)}>
          <Star className="h-4 w-4 mr-2" />
          {goal.isFocus ? 'Remove Focus' : 'Set as Focus'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(goal)}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAddMilestone(goal.id)}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Add Milestone
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onArchive(goal.id)}>
          <Archive className="h-4 w-4 mr-2" />
          Archive
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(goal.id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const roadmapModal = detailsModalOpen ? (
    <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
      <DialogContent className="max-w-full sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto bg-background border-border shadow-2xl p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-4 border-b border-border/60 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">{goal.title}</span>
            </DialogTitle>
            <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
              <GoalDetailsHealthBadge goal={goal} stats={stats} />
              <span className="text-muted-foreground">·</span>
              <span className={unifiedStatus.className}>{unifiedStatus.label}</span>
            </div>
          </div>

          {/* Detailed Timeline Bar (housed cleanly in modal instead of crowding card face) */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-xs text-muted-foreground font-mono tabular-nums">
              <span>{format(new Date(goal.startDate), 'd MMM yyyy')}</span>
              <span>{deadlineInfo.label} · {format(new Date(goal.deadline), 'd MMM yyyy')}</span>
            </div>
            <div className="relative py-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                <div
                  className="absolute inset-y-0 left-0 bg-muted-foreground/30"
                  style={{ width: `${elapsedPercentage}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-primary transition-all"
                  style={{ width: `${stats.progress}%` }}
                />
              </div>
              <div
                className="absolute top-1/2 w-1.5 h-3.5 bg-rose-500 rounded-full border border-background shadow-sm pointer-events-none"
                style={{ left: `${elapsedPercentage}%`, transform: 'translate(-50%, -50%)' }}
                title="Today"
              />
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          <div>
            <GoalRoadmapView goal={goal} milestones={milestones} stats={stats} onToggleMilestone={onToggleMilestone} />
          </div>
          <div>
            <SMARTGoalAnalysis goal={goal} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  // Compact Horizontal List View Row
  if (viewMode === 'list') {
    return (
      <>
        <Card className="rounded-2xl border border-border/80 bg-card shadow-none transition-colors hover:border-border">
          <div className="p-4 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Left: Title + inline unboxed metadata */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 min-w-0">
                  {goal.isFocus && (
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" aria-label="Focus Goal" />
                  )}
                  <h3 className="text-base font-semibold text-foreground truncate">
                    {goal.title}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className={cn('font-medium', areaStyle.text)}>{areaStyle.label}</span>
                  <span aria-hidden="true">·</span>
                  <span className={cn('font-medium', unifiedStatus.className)}>{unifiedStatus.label}</span>
                  <span aria-hidden="true">·</span>
                  <span className={cn('inline-flex items-center gap-1', getDeadlineColorClass(deadlineInfo.color))}>
                    <Calendar className="h-3 w-3" />
                    {deadlineInfo.label}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className={cn('inline-flex items-center gap-1', priorityStyle.color)}>
                    <Flag className="h-3 w-3" />
                    {priorityStyle.label}
                  </span>
                </div>
              </div>

              {/* Right: Unified Progress + Quick Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <div className="w-36 sm:w-44 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-muted-foreground">
                      {stats.milestonesCompleted}/{stats.milestonesTotal} milestones
                    </span>
                    <span className="font-semibold text-foreground">{stats.progress}%</span>
                  </div>
                  <Progress value={stats.progress} className="h-1.5" />
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDetailsModalOpen(true)}
                    className="h-8 px-2.5 text-xs rounded-lg gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="hidden md:inline">Roadmap</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setExpanded(!expanded)}
                    className="h-8 w-8 text-muted-foreground"
                    aria-label={expanded ? 'Hide milestones' : 'Show milestones'}
                  >
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  {actionsMenu}
                </div>
              </div>
            </div>

            {/* Financial sync compact bar if linked */}
            {financialProgress && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-500/5 border border-sky-500/20 px-3 py-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-sky-700 dark:text-sky-300">
                  <financialProgress.Icon className="h-3.5 w-3.5 text-sky-500" />
                  {financialProgress.label}
                </span>
                <span className="font-mono tabular-nums text-foreground font-semibold">
                  {formatINR(financialProgress.currentAmount)} / {formatINR(financialProgress.targetAmount)}{' '}
                  <span className="text-sky-600 dark:text-sky-400">({financialProgress.progressPct}%)</span>
                </span>
              </div>
            )}

            {/* Fitness telemetry sync compact bar if linked */}
            {fitnessProgress && (
              <div
                data-testid="goal-fitness-progress-bar"
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 text-xs"
              >
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
                  <fitnessProgress.Icon className="h-3.5 w-3.5 text-emerald-500" />
                  {fitnessProgress.label}
                </span>
                <span className="font-mono tabular-nums text-foreground font-semibold">
                  {fitnessProgress.currentValue} / {fitnessProgress.targetValue} {fitnessProgress.unit}{' '}
                  <span className="text-emerald-600 dark:text-emerald-400">({fitnessProgress.progressPct}%)</span>
                </span>
              </div>
            )}

            {/* Collapsible milestones in list mode */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 border-t border-border/60 space-y-1.5">
                    {milestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="relative flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/50"
                      >
                        <Checkbox
                          id={`list-${milestone.id}`}
                          checked={milestone.completed}
                          onCheckedChange={() => handleMilestoneToggle(milestone.id)}
                          className="data-[state=checked]:bg-success data-[state=checked]:border-success"
                        />
                        <label
                          htmlFor={`list-${milestone.id}`}
                          className={cn(
                            'flex-1 text-sm cursor-pointer',
                            milestone.completed && 'line-through text-muted-foreground'
                          )}
                        >
                          {milestone.title}
                        </label>
                        {milestone.completed && milestone.completedAt && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {format(new Date(milestone.completedAt), 'd MMM')}
                          </span>
                        )}
                        <SuccessRipple trigger={rippleMilestone === milestone.id && milestone.completed} />
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAddMilestone(goal.id)}
                      className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Milestone
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
        {roadmapModal}
      </>
    );
  }

  // Clean Grid View Card
  return (
    <ScaleOnHover scale={1.01} lift className="h-full min-w-0 w-full">
      <Card className="relative w-full min-w-0 overflow-hidden transition-all h-full flex flex-col rounded-2xl border border-border/80 bg-card shadow-none hover:border-border hover:shadow-sm">
        <CardHeader className="pb-3 space-y-2">
          {/* Top quiet metadata strip + menu */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs min-w-0 truncate">
              <span className={cn('font-semibold', areaStyle.text)}>
                {areaStyle.label}
              </span>
              <span className="text-muted-foreground" aria-hidden="true">·</span>
              <span className={cn('font-medium truncate', unifiedStatus.className)}>
                {unifiedStatus.label}
              </span>
            </div>
            {actionsMenu}
          </div>

          {/* Title + optional subtle Focus star */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 min-w-0">
              {goal.isFocus && (
                <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" aria-label="Focus Goal" />
              )}
              <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
                {goal.title}
              </h3>
            </div>
            {goal.description && (
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {goal.description}
              </p>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 flex-1 flex flex-col justify-between pt-0">
          <div className="space-y-4">
            {/* Live Financial Link Section */}
            {financialProgress && (
              <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-sky-700 dark:text-sky-300">
                    <financialProgress.Icon className="h-3.5 w-3.5 text-sky-500" />
                    {financialProgress.label}
                  </span>
                  <span className="font-mono text-xs font-bold tabular-nums text-sky-600 dark:text-sky-400">
                    {financialProgress.progressPct}%
                  </span>
                </div>

                <div className="flex items-baseline gap-1 font-mono tabular-nums">
                  <span className="text-base font-bold text-foreground">
                    {formatINR(financialProgress.currentAmount)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {formatINR(financialProgress.targetAmount)}
                  </span>
                </div>

                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-sky-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${financialProgress.progressPct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>

                {financialProgress.projectionText && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {financialProgress.projectionText}
                  </p>
                )}
              </div>
            )}

            {/* Live Fitness Link Section */}
            {fitnessProgress && (
              <div
                data-testid="goal-fitness-progress-card"
                className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                    <fitnessProgress.Icon className="h-3.5 w-3.5 text-emerald-500" />
                    {fitnessProgress.label}
                  </span>
                  <span className="font-mono text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {fitnessProgress.progressPct}%
                  </span>
                </div>

                <div className="flex items-baseline gap-1 font-mono tabular-nums">
                  <span className="text-base font-bold text-foreground">
                    {fitnessProgress.currentValue}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {fitnessProgress.targetValue} {fitnessProgress.unit}
                  </span>
                </div>

                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-emerald-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${fitnessProgress.progressPct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>

                <p className="text-[11px] text-muted-foreground truncate">
                  {fitnessProgress.remainingLabel}
                </p>
              </div>
            )}

            {/* Single Unified Progress Bar + Quiet Metadata */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between text-xs font-mono tabular-nums">
                <span className="text-muted-foreground">
                  {stats.milestonesCompleted}/{stats.milestonesTotal} milestones
                </span>
                <span className="text-sm font-bold text-foreground">
                  {stats.progress}%
                </span>
              </div>
              <Progress value={stats.progress} className="h-2" />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <span className={cn('inline-flex items-center gap-1.5 font-medium', getDeadlineColorClass(deadlineInfo.color))}>
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{deadlineInfo.label}</span>
                  <span className="text-muted-foreground font-normal">
                    ({format(new Date(goal.deadline), 'd MMM')})
                  </span>
                </span>
                <span className={cn('inline-flex items-center gap-1 font-medium', priorityStyle.color)}>
                  <Flag className="h-3 w-3" />
                  {priorityStyle.label}
                </span>
              </div>
            </div>

            {/* Next milestone preview */}
            {nextMilestone && !expanded && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleMilestoneToggle(nextMilestone.id);
                }}
                className="flex items-center gap-2.5 min-w-0 px-3 py-2.5 bg-muted/40 border border-border/50 rounded-xl cursor-pointer hover:bg-muted/70 transition-colors"
              >
                <Checkbox
                  checked={false}
                  onCheckedChange={() => handleMilestoneToggle(nextMilestone.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0"
                />
                <span className="text-xs sm:text-sm min-w-0 flex-1 truncate text-foreground">{nextMilestone.title}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">Next</span>
              </div>
            )}

            {/* Expanded milestones list */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5 pt-2 border-t border-border/60">
                    {milestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="relative flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50"
                      >
                        <Checkbox
                          id={milestone.id}
                          checked={milestone.completed}
                          onCheckedChange={() => handleMilestoneToggle(milestone.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="data-[state=checked]:bg-success data-[state=checked]:border-success"
                        />
                        <label
                          htmlFor={milestone.id}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            'flex-1 text-xs sm:text-sm cursor-pointer',
                            milestone.completed && 'line-through text-muted-foreground'
                          )}
                        >
                          {milestone.title}
                        </label>
                        {milestone.completed && milestone.completedAt && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {format(new Date(milestone.completedAt), 'd MMM')}
                          </span>
                        )}
                        <SuccessRipple
                          trigger={rippleMilestone === milestone.id && milestone.completed}
                        />
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddMilestone(goal.id);
                      }}
                      className="w-full gap-1 mt-2 h-8 text-xs rounded-lg"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Milestone
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Clean Footer Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="flex-1 h-9 text-xs gap-1 rounded-xl text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Milestones ({milestones.length})
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setDetailsModalOpen(true);
              }}
              className="flex-1 h-9 text-xs gap-1.5 rounded-xl border-border/80 hover:bg-muted/50 font-medium"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Roadmap
            </Button>
          </div>
        </CardContent>
      </Card>

      {roadmapModal}
    </ScaleOnHover>
  );
});
