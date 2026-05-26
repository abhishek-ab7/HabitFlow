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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Goal, Milestone, GoalStats } from '@/lib/types';
import { calculateHabitStats } from '@/lib/calculations';

interface GoalRoadmapViewProps {
  goal: Goal;
  milestones: Milestone[];
  stats: GoalStats;
}

export function GoalRoadmapView({ goal, milestones, stats }: GoalRoadmapViewProps) {
  const { habits, completions } = useHabitStore();

  // 1. Dynamic Health Score Calculation
  const healthScoreDetails = useMemo(() => {
    // Consistency: linked habits rate (40% weight)
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
    
    let consistency = 80; // Baseline
    if (linkedHabits.length > 0) {
      const completionRates = linkedHabits.map(h => {
        const stats = calculateHabitStats(h, completions);
        return stats.completionRate;
      });
      consistency = completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length;
    } else if (habits.length > 0) {
      // Fallback to overall habits average if no linked habits
      const completionRates = habits.filter(h => !h.archived).map(h => {
        const stats = calculateHabitStats(h, completions);
        return stats.completionRate;
      });
      consistency = completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length;
    }

    // Milestones Progress: (40% weight)
    const milestoneProgress = stats.progress;

    // Deadline Proximity: remaining time (20% weight)
    const totalDays = stats.totalDays || 1;
    const daysRemaining = stats.daysRemaining;
    let proximityScore = 100;
    if (!stats.isOnTrack) {
      proximityScore = Math.max(0, Math.min(100, (daysRemaining / totalDays) * 100));
    }

    const finalScore = Math.round(consistency * 0.4 + milestoneProgress * 0.4 + proximityScore * 0.2);

    return {
      finalScore,
      consistency: Math.round(consistency),
      milestoneProgress: Math.round(milestoneProgress),
      proximityScore: Math.round(proximityScore),
      linkedHabitsCount: linkedHabits.length
    };
  }, [goal.areaOfLife, habits, completions, stats]);

  // Determine health color based on score
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-teal-500 text-emerald-500';
    if (score >= 50) return 'from-amber-500 to-orange-500 text-amber-500';
    return 'from-rose-500 to-red-500 text-rose-500';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Struggling';
    return 'Critical';
  };

  // Sort milestones by order index
  const sortedMilestones = [...milestones].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6 p-6 bg-card rounded-xl border border-border/60 shadow-lg relative overflow-hidden">
      {/* Visual background details to add WOW factor */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-radial-gradient from-emerald-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Header with Health Score */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-4">
        <div>
          <h4 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Roadmap & Health Analysis
          </h4>
          <p className="text-xs text-muted-foreground">
            Dynamic health scorecard calculated from habits consistency, milestones, and timeline.
          </p>
        </div>

        {/* Health Indicator Circle */}
        <div className="flex items-center gap-3 bg-muted/30 px-4 py-2 rounded-lg border border-border/40">
          <div className="relative flex items-center justify-center w-12 h-12">
            {/* Background Circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                className="stroke-muted"
                strokeWidth="4"
                fill="transparent"
              />
              <motion.circle
                cx="24"
                cy="24"
                r="20"
                className={cn("stroke-current", getHealthColor(healthScoreDetails.finalScore).split(' ')[2])}
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 20}
                initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - healthScoreDetails.finalScore / 100) }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </svg>
            <span className="absolute text-sm font-bold">{healthScoreDetails.finalScore}</span>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Health Status</div>
            <div className="text-sm font-bold flex items-center gap-1">
              <span className={cn(getHealthColor(healthScoreDetails.finalScore).split(' ')[2])}>
                {getHealthLabel(healthScoreDetails.finalScore)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Health Score Component Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Habit Consistency */}
        <div className="bg-muted/20 p-3.5 rounded-lg border border-border/30">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              Habit Consistency (40%)
            </span>
            <span className="text-xs font-bold">{healthScoreDetails.consistency}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-orange-500 rounded-full transition-all duration-500" 
              style={{ width: `${healthScoreDetails.consistency}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {healthScoreDetails.linkedHabitsCount} linked habits in area of life.
          </p>
        </div>

        {/* Milestone Progress */}
        <div className="bg-muted/20 p-3.5 rounded-lg border border-border/30">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              Milestone Progress (40%)
            </span>
            <span className="text-xs font-bold">{healthScoreDetails.milestoneProgress}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
              style={{ width: `${healthScoreDetails.milestoneProgress}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {stats.milestonesCompleted} of {stats.milestonesTotal} milestones completed.
          </p>
        </div>

        {/* Proximity Score */}
        <div className="bg-muted/20 p-3.5 rounded-lg border border-border/30">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              Timeline Proximity (20%)
            </span>
            <span className="text-xs font-bold">{healthScoreDetails.proximityScore}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-500" 
              style={{ width: `${healthScoreDetails.proximityScore}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {stats.daysRemaining} days remaining out of {stats.totalDays}.
          </p>
        </div>
      </div>

      {/* Visual Roadmap (Timeline) */}
      <div className="mt-6 space-y-4">
        <h5 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2">Milestone Timeline</h5>
        
        {sortedMilestones.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border/40 rounded-lg">
            No milestones added to this goal. Add milestones to view your roadmap timeline.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 border-l border-border/60 ml-3">
            {/* Start node */}
            <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20" />
            
            {sortedMilestones.map((milestone, idx) => {
              const isCompleted = milestone.completed;
              return (
                <div key={milestone.id} className="relative group">
                  {/* Timeline icon indicator */}
                  <span className="absolute -left-[31px] top-0.5 bg-card flex items-center justify-center p-0.5 rounded-full z-10">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 bg-card rounded-full" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors bg-card rounded-full" />
                    )}
                  </span>
                  
                  {/* Milestone Details Card */}
                  <div className={cn(
                    "p-3 rounded-lg border transition-all duration-200",
                    isCompleted 
                      ? "bg-muted/10 border-emerald-500/20 text-muted-foreground" 
                      : "bg-muted/30 border-border/40 hover:border-primary/40 text-foreground"
                  )}>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h6 className={cn(
                          "text-sm font-bold",
                          isCompleted && "line-through text-muted-foreground/70"
                        )}>
                          {milestone.title}
                        </h6>
                        {milestone.deadline && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            Target Date: {format(new Date(milestone.deadline), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                      
                      <Badge variant={isCompleted ? "secondary" : "outline"} className={cn(
                        "text-[10px] px-1.5 py-0",
                        isCompleted ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "text-muted-foreground"
                      )}>
                        {isCompleted ? "Completed" : `Milestone ${idx + 1}`}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* End Target Node */}
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
                  <Badge variant="default" className="text-[10px] bg-primary/20 text-primary border-primary/30 hover:bg-primary/20">
                    Target
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
