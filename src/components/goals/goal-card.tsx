'use client';

import { useState } from 'react';
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
import { ProgressRing, CountUp, ScaleOnHover, SuccessRipple } from '@/components/motion';
import { cn } from '@/lib/utils';
import { getDeadlineStatus } from '@/lib/calculations';
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
  career: { bg: 'bg-indigo-500/20', text: 'text-indigo-600', icon: '💼' },
  health: { bg: 'bg-emerald-500/20', text: 'text-emerald-600', icon: '💪' },
  relationships: { bg: 'bg-pink-500/20', text: 'text-pink-600', icon: '❤️' },
  personal_growth: { bg: 'bg-purple-500/20', text: 'text-purple-600', icon: '🌱' },
  finance: { bg: 'bg-sky-500/20', text: 'text-sky-600', icon: '💰' },
  fun: { bg: 'bg-amber-500/20', text: 'text-amber-600', icon: '🎉' },
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
  const [rippleMilestone, setRippleMilestone] = useState<string | null>(null);

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
      <Card className={cn(
        "relative overflow-hidden transition-shadow h-full flex flex-col",
        goal.isFocus && "ring-2 ring-primary/50"
      )}>
        {/* Focus indicator */}
        {goal.isFocus && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-chart-4" />
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
                  <Button variant="ghost" size="icon" className="h-8 w-8">
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
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
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
              {/* Today marker */}
              {stats.daysRemaining > 0 && stats.daysElapsed > 0 && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-foreground rounded-full"
                  style={{ left: `${elapsedPercentage}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                />
              )}
            </div>
          </div>

          {/* Next milestone preview */}
          {nextMilestone && !expanded && (
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <Checkbox
                checked={false}
                onCheckedChange={() => handleMilestoneToggle(nextMilestone.id)}
              />
              <span className="text-sm flex-1 truncate">{nextMilestone.title}</span>
              <span className="text-xs text-muted-foreground">Next</span>
            </div>
          )}

          {/* Expand/collapse milestones */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
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
                        className="data-[state=checked]:bg-success data-[state=checked]:border-success"
                      />
                      <label
                        htmlFor={milestone.id}
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* On track indicator */}
          <div className="flex items-center justify-center pt-2 border-t">
            <Badge variant={stats.isOnTrack ? 'default' : 'destructive'}>
              {stats.isOnTrack ? '✓ On Track' : '⚠ Behind Schedule'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </ScaleOnHover>
  );
}
