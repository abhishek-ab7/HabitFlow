'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
import { 
  CheckCircle2, 
  Circle, 
  Calendar, 
  Heart, 
  Sparkles, 
  ShieldCheck, 
  Flame,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useFeedback } from '@/hooks/use-feedback';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Goal, Milestone, GoalStats } from '@/lib/types';
import { calculateHabitStats } from '@/lib/calculations';

interface GoalRoadmapViewProps {
  goal: Goal;
  milestones: Milestone[];
  stats: GoalStats;
  onToggleMilestone?: (milestoneId: string) => void;
}

const AREA_LINKED_CATEGORIES: Record<string, string[]> = {
  career: ['work', 'learning'],
  health: ['health'],
  relationships: ['relationships'],
  personal_growth: ['learning', 'personal'],
  finance: ['finance'],
  fun: ['personal'],
};

function computeGoalHealthScore(
  areaOfLife: string,
  habits: ReturnType<typeof useHabitStore.getState>['habits'],
  completions: ReturnType<typeof useHabitStore.getState>['completions'],
  stats: GoalStats
) {
  const linkedCats = AREA_LINKED_CATEGORIES[areaOfLife] || [];
  const activeHabits = habits.filter((h) => !h.archived);
  const linkedHabits = activeHabits.filter((h) => linkedCats.includes(h.category));
  const pool = linkedHabits.length > 0 ? linkedHabits : activeHabits;

  let consistency = 80;
  if (pool.length > 0) {
    const sum = pool.reduce((acc, h) => acc + calculateHabitStats(h, completions).completionRate, 0);
    consistency = sum / pool.length;
  }

  const totalDays = stats.totalDays || 1;
  const proximityScore = stats.isOnTrack
    ? 100
    : Math.max(0, Math.min(100, (stats.daysRemaining / totalDays) * 100));
  const finalScore = Math.round(consistency * 0.4 + stats.progress * 0.4 + proximityScore * 0.2);

  return {
    finalScore,
    consistency: Math.round(consistency),
    milestoneProgress: Math.round(stats.progress),
    proximityScore: Math.round(proximityScore),
    linkedHabitsCount: linkedHabits.length,
  };
}

function getHealthStrokeClass(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 50) return 'text-amber-500';
  return 'text-rose-500';
}

function getHealthLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Struggling';
  return 'Critical';
}

function MilestoneTimelineRow({
  milestone,
  idx,
  onToggle,
}: {
  milestone: Milestone;
  idx: number;
  onToggle: (milestone: Milestone) => void;
}) {
  const isCompleted = milestone.completed;
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => onToggle(milestone)}
        className="absolute -left-[31px] top-0.5 bg-card flex items-center justify-center p-0.5 rounded-full z-10 hover:scale-110 active:scale-95 transition-transform duration-200 cursor-pointer"
        title={isCompleted ? 'Mark as Incomplete' : 'Mark as Complete'}
      >
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500 bg-card rounded-full" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors bg-card rounded-full" />
        )}
      </button>

      <div
        onClick={() => onToggle(milestone)}
        className={cn(
          'p-3 rounded-lg border transition-all duration-200 cursor-pointer select-none',
          isCompleted
            ? 'bg-muted/10 border-emerald-500/20 text-muted-foreground hover:bg-muted/20'
            : 'bg-muted/30 border-border/40 hover:border-primary/40 hover:bg-muted/45 text-foreground'
        )}
      >
        <div className="flex justify-between items-start gap-2">
          <div>
            <h6 className={cn('text-sm font-bold', isCompleted && 'line-through text-muted-foreground/70')}>
              {milestone.title}
            </h6>
            {milestone.deadline && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                <Calendar className="h-3 w-3" />
                Target Date: {format(new Date(milestone.deadline), 'MMM d, yyyy')}
              </span>
            )}
          </div>
          <Badge
            variant={isCompleted ? 'secondary' : 'outline'}
            className={cn(
              'text-[10px] px-1.5 py-0',
              isCompleted ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'text-muted-foreground'
            )}
          >
            {isCompleted ? 'Completed' : `Milestone ${idx + 1}`}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function HealthScoreRing({ score }: { score: number }) {
  const healthColorClass = getHealthStrokeClass(score);
  const circumference = 2 * Math.PI * 20;
  return (
    <div className="flex items-center gap-3 bg-muted/30 px-4 py-2 rounded-lg border border-border/40">
      <div className="relative flex items-center justify-center w-12 h-12">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="24" cy="24" r="20" className="stroke-muted" strokeWidth="4" fill="transparent" />
          <motion.circle
            cx="24"
            cy="24"
            r="20"
            className={cn('stroke-current', healthColorClass)}
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <span className="absolute text-sm font-bold">{score}</span>
      </div>
      <div>
        <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Health Status</div>
        <div className="text-sm font-bold flex items-center gap-1">
          <span className={healthColorClass}>{getHealthLabel(score)}</span>
        </div>
      </div>
    </div>
  );
}

function HealthMetricBarCard({
  icon,
  label,
  pct,
  barClass,
  footnote,
}: {
  icon: React.ReactNode;
  label: string;
  pct: number;
  barClass: string;
  footnote: string;
}) {
  return (
    <div className="bg-muted/20 p-3.5 rounded-lg border border-border/30">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span className="text-xs font-bold">{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', barClass)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">{footnote}</p>
    </div>
  );
}

export function GoalRoadmapView({ goal, milestones, stats, onToggleMilestone }: GoalRoadmapViewProps) {
  const { habits, completions } = useHabitStore();
  const feedback = useFeedback();

  const healthScoreDetails = useMemo(
    () => computeGoalHealthScore(goal.areaOfLife, habits, completions, stats),
    [goal.areaOfLife, habits, completions, stats]
  );

  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => a.order - b.order),
    [milestones]
  );

  const handleToggle = (milestone: Milestone) => {
    if (milestone.completed) feedback.uncheck();
    else if (stats.milestonesCompleted + 1 >= stats.milestonesTotal && stats.milestonesTotal > 0) feedback.milestone();
    else feedback.complete();
    onToggleMilestone?.(milestone.id);
  };

  return (
    <div className="space-y-6 p-6 bg-card rounded-xl border border-border/60 shadow-lg relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-radial-gradient from-emerald-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-4">
        <div>
          <h4 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Roadmap &amp; Health Analysis
          </h4>
          <p className="text-xs text-muted-foreground">
            Dynamic health scorecard calculated from habits consistency, milestones, and timeline.
          </p>
        </div>

        <HealthScoreRing score={healthScoreDetails.finalScore} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HealthMetricBarCard
          icon={<Flame className="h-3.5 w-3.5 text-orange-500" />}
          label="Habit Consistency (40%)"
          pct={healthScoreDetails.consistency}
          barClass="bg-orange-500"
          footnote={`${healthScoreDetails.linkedHabitsCount} linked habits in area of life.`}
        />
        <HealthMetricBarCard
          icon={<Sparkles className="h-3.5 w-3.5 text-emerald-500" />}
          label="Milestone Progress (40%)"
          pct={healthScoreDetails.milestoneProgress}
          barClass="bg-emerald-500"
          footnote={`${stats.milestonesCompleted} of ${stats.milestonesTotal} milestones completed.`}
        />
        <HealthMetricBarCard
          icon={<Calendar className="h-3.5 w-3.5 text-blue-500" />}
          label="Timeline Proximity (20%)"
          pct={healthScoreDetails.proximityScore}
          barClass="bg-blue-500"
          footnote={`${stats.daysRemaining} days remaining out of ${stats.totalDays}.`}
        />
      </div>

      <div className="mt-6 space-y-4">
        <h5 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2">Milestone Timeline</h5>
        {sortedMilestones.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border/40 rounded-lg">
            No milestones added to this goal. Add milestones to view your roadmap timeline.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 border-l border-border/60 ml-3">
            <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20" />
            {sortedMilestones.map((milestone, idx) => (
              <MilestoneTimelineRow key={milestone.id} milestone={milestone} idx={idx} onToggle={handleToggle} />
            ))}
            <div className="relative group pt-2">
              <span className="absolute -left-[31px] top-3.5 bg-card flex items-center justify-center p-0.5 rounded-full z-10">
                <CheckCircle2 className="h-5 w-5 text-primary bg-card rounded-full" />
              </span>
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex justify-between items-center">
                  <div>
                    <h6 className="text-sm font-bold text-primary flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" />
                      Goal Complete: {goal.title}
                    </h6>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3" />
                      Deadline: {format(new Date(goal.deadline), 'MMMM d, yyyy')}
                    </span>
                  </div>
                  <Badge variant="default" className="text-[10px] bg-primary/20 text-primary border-primary/30 hover:bg-primary/20">Target</Badge>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
