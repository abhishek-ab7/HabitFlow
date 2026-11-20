'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { ProgressRing, CountUp, ScaleOnHover, SuccessRipple } from '@/components/motion';
import { cn } from '@/lib/utils';
import { getDeadlineStatus, calculateHabitStats } from '@/lib/calculations';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { GoalRoadmapView } from './GoalRoadmapView';
import { SMARTGoalAnalysis } from './SMARTGoalAnalysis';
import type { Goal, Milestone, GoalStats, GoalStatus, Priority, AreaOfLife } from '@/lib/types';

interface GoalCardProps {
  goal: Goal;
  milestones: Milestone[];
  stats: GoalStats;
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
  onArchive: (goalId: string) => void;
  onSetFocus: (goalId: string) => void;
  onToggleMilestone: (milestoneId: string) => void;
  onAddMilestone: (goalId: string) => void;
}

const STATUS_STYLES: Record<GoalStatus, { bg: string; text: string; label: string }> = {
  not_started: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Not Started' },
  in_progress: { bg: 'bg-warning/20', text: 'text-warning', label: 'In Progress' },
  completed: { bg: 'bg-success/20', text: 'text-success', label: 'Completed' },
  on_hold: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'On Hold' },
};

const PRIORITY_STYLES: Record<Priority, { color: string; label: string }> = {
  high: { color: 'text-destructive', label: 'High' },
  medium: { color: 'text-warning', label: 'Medium' },
  low: { color: 'text-muted-foreground', label: 'Low' },
};

const AREA_STYLES: Record<AreaOfLife, { bg: string; text: string; icon: string }> = {
  career: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', icon: '💼' },
  health: { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', icon: '💪' },
  relationships: { bg: 'bg-rose-500/15', text: 'text-rose-600 dark:text-rose-400', icon: '❤️' },
  personal_growth: { bg: 'bg-teal-500/15', text: 'text-teal-600 dark:text-teal-400', icon: '🌱' },
  finance: { bg: 'bg-sky-500/15', text: 'text-sky-600 dark:text-sky-400', icon: '💰' },
  fun: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', icon: '🎉' },
};

export function GoalCard({
  goal,
  milestones,
  stats,
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

  const { habits, completions } = useHabitStore();
  const { accounts, debtRecords, emiTrackers, sipPlans, getNetWorthSummary, getMonthlySummary } = useFinanceStore();

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

    // Projected completion estimation
    let projectionText: string | null = null;
    if (progressPct >= 100) {
      projectionText = 'Target Achieved!';
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
          projectionText = `Projected: ~${monthsNeeded} months (at ₹${Math.round(monthlyPace).toLocaleString('en-IN')}/mo)`;
        } else {
          const years = (monthsNeeded / 12).toFixed(1);
          projectionText = `Projected: ~${years} years (at ₹${Math.round(monthlyPace).toLocaleString('en-IN')}/mo)`;
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
    const linkedHabits = habits.filter(h => !h.archived && linkedCats.includes(h.category));
    
    let consistency = 80;
    if (linkedHabits.length > 0) {
      const completionRates = linkedHabits.map(h => {
        const stats = calculateHabitStats(h, completions);
        return stats.completionRate;
      });
      consistency = completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length;
    } else if (habits.length > 0) {
      const completionRates = habits.filter(h => !h.archived).map(h => {
        const stats = calculateHabitStats(h, completions);
        return stats.completionRate;
      });
      consistency = completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length;
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

  const deadlineInfo = getDeadlineStatus(goal.deadline);
  const statusStyle = STATUS_STYLES[goal.status];
  const priorityStyle = PRIORITY_STYLES[goal.priority];
  const areaStyle = AREA_STYLES[goal.areaOfLife];

  const completedMilestones = milestones.filter(m => m.completed);
  const pendingMilestones = milestones.filter(m => !m.completed);
  const nextMilestone = pendingMilestones[0];

  // Timeline progress
  const totalDays = stats.totalDays || 1;
  const elapsedPercentage = Math.min(100, (stats.daysElapsed / totalDays) * 100);

  const getDeadlineColorClass = (color: typeof deadlineInfo.color) => {
    switch (color) {
      case 'destructive': return 'text-destructive';
      case 'warning': return 'text-warning';
      case 'success': return 'text-success';
      default: return 'text-muted-foreground';
    }
  };

  const handleMilestoneToggle = (milestoneId: string) => {
    setRippleMilestone(milestoneId);
    onToggleMilestone(milestoneId);
    setTimeout(() => setRippleMilestone(null), 500);
  };

  return (
    <ScaleOnHover scale={1.01} lift className="h-full">
      <Card 
        className={cn(
          "relative overflow-hidden transition-shadow h-full flex flex-col hover:shadow-md",
          goal.isFocus && "ring-2 ring-primary/50"
        )}
      >
        {/* Focus indicator */}
        {goal.isFocus && (
          <div className="absolute top-0 left-0 right-0 h-1 progress-gradient" />
        )}

        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Area badge */}
              <Badge
                variant="secondary"
                className={cn("mb-2", areaStyle.bg, areaStyle.text)}
              >
                {areaStyle.icon} {goal.areaOfLife.replace('_', ' ')}
              </Badge>

              <Badge
                variant="outline"
                className={cn("ml-2 mb-2 font-bold", 
                  healthScore >= 80 ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5" :
                  healthScore >= 50 ? "border-amber-500/30 text-amber-500 bg-amber-500/5" :
                  "border-rose-500/30 text-rose-500 bg-rose-500/5"
                )}
              >
                Health: {healthScore}/100
              </Badge>

              {/* Title */}
              <h3 className="text-lg font-semibold truncate">{goal.title}</h3>

              {/* Description */}
              {goal.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {goal.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Status badge */}
              <Badge
                variant="secondary"
                className={cn(statusStyle.bg, statusStyle.text)}
              >
                {statusStyle.label}
              </Badge>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 flex-1">
          {/* Live Financial Link Section */}
          {financialProgress && (
            <div className="rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
                  <financialProgress.Icon className="h-3.5 w-3.5 text-sky-500" />
                  <span>{financialProgress.label}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-base font-bold tabular-nums text-foreground">
                    {formatINR(financialProgress.currentAmount)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    / {formatINR(financialProgress.targetAmount)}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold tabular-nums text-sky-600 dark:text-sky-400">
                  {financialProgress.progressPct}%
                </span>
              </div>

              {/* Monetary Progress Bar */}
              <div className="h-2 w-full bg-muted/80 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${financialProgress.progressPct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>

              {financialProgress.projectionText && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                  <span className="truncate">{financialProgress.projectionText}</span>
                  {financialProgress.remaining > 0 && (
                    <span className="font-mono tabular-nums text-[10px] shrink-0 font-medium">
                      {formatINR(financialProgress.remaining)} to go
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Progress section */}
          <div className="flex items-center gap-4">
            <ProgressRing progress={stats.progress} size={80} strokeWidth={6}>
              <span className="text-lg font-bold">
                <CountUp value={stats.progress} />%
              </span>
            </ProgressRing>

            <div className="flex-1 space-y-2">
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {stats.milestonesCompleted}/{stats.milestonesTotal} milestones
                  </span>
                </div>
                <Progress value={stats.progress} className="h-2" />
              </div>

              {/* Deadline */}
              <div className={cn(
                "flex items-center gap-1.5 text-sm",
                getDeadlineColorClass(deadlineInfo.color)
              )}>
                <Calendar className="h-4 w-4" />
                <span>{deadlineInfo.label}</span>
              </div>

              {/* Priority */}
              <div className={cn("flex items-center gap-1.5 text-sm", priorityStyle.color)}>
                <Flag className="h-4 w-4" />
                <span>{priorityStyle.label} Priority</span>
              </div>
            </div>
          </div>

          {/* Timeline bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{format(new Date(goal.startDate), 'MMM d')}</span>
              <span>{format(new Date(goal.deadline), 'MMM d, yyyy')}</span>
            </div>
            <div className="relative pt-1 pb-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                {/* Elapsed time */}
                <div
                  className="absolute inset-y-0 left-0 bg-muted-foreground/30"
                  style={{ width: `${elapsedPercentage}%` }}
                />
                {/* Progress */}
                <motion.div
                  className="absolute inset-y-0 left-0 bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              {/* Today marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3.5 bg-red-500 rounded-full border border-white dark:border-slate-950 shadow-md pointer-events-none z-10"
                style={{ left: `${elapsedPercentage}%`, transform: 'translate(-50%, -50%)' }}
                title="Today"
              />
            </div>
          </div>

          {/* Next milestone preview */}
          {nextMilestone && !expanded && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                handleMilestoneToggle(nextMilestone.id);
              }}
              className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors"
            >
              <Checkbox
                checked={false}
                onCheckedChange={() => handleMilestoneToggle(nextMilestone.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-sm flex-1 truncate">{nextMilestone.title}</span>
              <span className="text-xs text-muted-foreground select-none">Next</span>
            </div>
          )}

          {/* Expand/collapse milestones */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="w-full gap-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide Milestones
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show All Milestones ({milestones.length})
              </>
            )}
          </Button>

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
                <div className="space-y-2 pt-2 border-t">
                  {milestones.map((milestone, index) => (
                    <motion.div
                      key={milestone.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
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
                          "flex-1 text-sm cursor-pointer",
                          milestone.completed && "line-through text-muted-foreground"
                        )}
                      >
                        {milestone.title}
                      </label>
                      {milestone.completed && milestone.completedAt && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(milestone.completedAt), 'MMM d')}
                        </span>
                      )}
                      <SuccessRipple
                        trigger={rippleMilestone === milestone.id && milestone.completed}
                      />
                    </motion.div>
                  ))}

                  {/* Add milestone button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddMilestone(goal.id);
                    }}
                    className="w-full gap-1 mt-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Milestone
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Detailed Roadmap & SMART Coach trigger */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation();
              setDetailsModalOpen(true);
            }}
            className="w-full gap-2 mt-3 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Roadmap & SMART Coach
          </Button>

          {/* On track indicator */}
          <div className="flex items-center justify-center pt-2 border-t mt-3">
            <Badge variant={stats.isOnTrack ? 'default' : 'destructive'}>
              {stats.isOnTrack ? '✓ On Track' : '⚠ Behind Schedule'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Roadmap & SMART Coach Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-full sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto bg-background border-border shadow-2xl p-6 rounded-2xl">
          <DialogHeader className="pb-4 border-b border-border/40">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Goal Roadmap & SMART Coach: {goal.title}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div>
              <GoalRoadmapView goal={goal} milestones={milestones} stats={stats} onToggleMilestone={onToggleMilestone} />
            </div>
            <div>
              <SMARTGoalAnalysis goal={goal} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ScaleOnHover>
  );
}
