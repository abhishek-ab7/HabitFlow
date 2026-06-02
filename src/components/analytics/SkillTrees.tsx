'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Heart, 
  BookOpen, 
  ShieldAlert, 
  Users, 
  DollarSign, 
  Sparkles,
  Award,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { calculateHabitStats } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface SkillAttribute {
  name: string;
  level: number;
  xp: number;
  xpNeeded: number;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  description: string;
  habitsCount: number;
}

export function SkillTrees() {
  const { habits, completions } = useHabitStore();
  const { goals } = useGoalStore();

  const skillStats = useMemo(() => {
    // 1. Filter active habits
    const activeHabits = habits.filter(h => !h.archived);

    // Helper: count completions per category
    const completionsByCategory: Record<string, number> = {
      health: 0,
      work: 0,
      learning: 0,
      personal: 0,
      finance: 0,
      relationships: 0
    };

    const habitsMap = new Map(habits.map(h => [h.id, h]));
    completions.forEach(c => {
      if (c.completed && c.status !== 'frozen') {
        const habit = habitsMap.get(c.habitId);
        if (habit && completionsByCategory[habit.category] !== undefined) {
          completionsByCategory[habit.category]++;
        }
      }
    });

    // Helper: count habits per category
    const habitsByCategory = (cat: string) => activeHabits.filter(h => h.category === cat).length;

    // Helper: calculate RPG levels based on completions
    // Level = floor(sqrt(completions / 2)) + 1
    // Progress to next level = completions % (needed for next level)
    const getLevelDetails = (completionsCount: number) => {
      const level = Math.floor(Math.sqrt(completionsCount / 2)) + 1;
      const currentLevelMin = 2 * Math.pow(level - 1, 2);
      const nextLevelMin = 2 * Math.pow(level, 2);
      const levelRange = nextLevelMin - currentLevelMin;
      const progress = completionsCount - currentLevelMin;

      return {
        level,
        xp: progress,
        xpNeeded: levelRange
      };
    };

    // Calculate overall discipline (based on goals and average completion rate)
    const overallCompletionRate = completions.length > 0
      ? (completions.filter(c => c.completed).length / completions.length) * 100
      : 70;
    const completedGoalsCount = goals.filter(g => g.status === 'completed').length;
    const disciplineCompletions = Math.round(overallCompletionRate * 0.8 + completedGoalsCount * 10);
    const disciplineDetails = getLevelDetails(disciplineCompletions);

    const vitalityDetails = getLevelDetails(completionsByCategory.health);
    const intelligenceDetails = getLevelDetails(completionsByCategory.learning * 1.5 + completionsByCategory.work * 0.8);
    const charismaDetails = getLevelDetails(completionsByCategory.relationships * 2);
    const wealthDetails = getLevelDetails(completionsByCategory.finance * 2.5);
    const creativityDetails = getLevelDetails(completionsByCategory.personal * 1.5);

    const attributes: SkillAttribute[] = [
      {
        name: 'Vitality',
        ...vitalityDetails,
        icon: <Heart className="h-4 w-4" />,
        color: 'text-emerald-500',
        gradient: 'from-emerald-500 to-teal-500',
        description: 'Physical health, fitness, and sleep consistency.',
        habitsCount: habitsByCategory('health')
      },
      {
        name: 'Intelligence',
        ...intelligenceDetails,
        icon: <BookOpen className="h-4 w-4" />,
        color: 'text-amber-500',
        gradient: 'from-amber-500 to-orange-500',
        description: 'Learning, skills development, and productive output.',
        habitsCount: habitsByCategory('learning') + habitsByCategory('work')
      },
      {
        name: 'Discipline',
        ...disciplineDetails,
        icon: <Zap className="h-4 w-4" />,
        color: 'text-rose-500',
        gradient: 'from-rose-500 to-red-500',
        description: 'Overall consistency, task resolution, and goal completions.',
        habitsCount: activeHabits.length
      },
      {
        name: 'Charisma',
        ...charismaDetails,
        icon: <Users className="h-4 w-4" />,
        color: 'text-pink-500',
        gradient: 'from-pink-500 to-rose-400',
        description: 'Relationships, family connections, and social habits.',
        habitsCount: habitsByCategory('relationships')
      },
      {
        name: 'Wealth',
        ...wealthDetails,
        icon: <DollarSign className="h-4 w-4" />,
        color: 'text-sky-500',
        gradient: 'from-sky-500 to-cyan-500',
        description: 'Financial management, saving, and investing.',
        habitsCount: habitsByCategory('finance')
      },
      {
        name: 'Creativity',
        ...creativityDetails,
        icon: <Sparkles className="h-4 w-4" />,
        color: 'text-yellow-500',
        gradient: 'from-yellow-400 to-amber-500',
        description: 'Mindfulness, personal growth, hobbies, and recreation.',
        habitsCount: habitsByCategory('personal')
      }
    ];

    // Calculate total character level
    const totalLevel = attributes.reduce((sum, attr) => sum + attr.level, 0);

    return {
      attributes,
      totalLevel
    };
  }, [habits, completions, goals]);

  return (
    <Card className="border border-border/60 bg-card rounded-2xl shadow-xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-80 h-80 bg-radial-gradient from-primary/5 to-transparent blur-3xl pointer-events-none" />

      <CardHeader className="pb-4 border-b border-border/40 flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Award className="h-5 w-5 text-primary animate-bounce" />
            RPG Skill Tree & Attributes
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Level up your real-life attributes dynamically by completing habits and goals.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Level</div>
          <div className="text-3xl font-black text-primary">{skillStats.totalLevel}</div>
        </div>
      </CardHeader>

      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {skillStats.attributes.map((attr) => {
          const progressPercent = Math.min(100, Math.round((attr.xp / attr.xpNeeded) * 100)) || 0;

          return (
            <motion.div
              key={attr.name}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="p-4 rounded-xl border border-border/50 bg-muted/20 flex flex-col justify-between h-[160px] relative group"
            >
              {/* Active attribute gradient highlight on hover */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              <div>
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded-lg border border-border bg-background shadow-sm", attr.color)}>
                      {attr.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{attr.name}</h4>
                      <span className="text-[10px] text-muted-foreground">{attr.habitsCount} active habits</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Rank</span>
                    <h5 className={cn("text-lg font-black leading-none", attr.color)}>Lvl {attr.level}</h5>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] text-muted-foreground mt-2.5 line-clamp-2 leading-relaxed">
                  {attr.description}
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-1 mt-3">
                <div className="flex justify-between text-[9px] font-bold text-muted-foreground/75 font-mono">
                  <span>Progress to Next Rank</span>
                  <span>{attr.xp}/{attr.xpNeeded} XP</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/20">
                  <motion.div
                    className={cn("h-full rounded-full bg-gradient-to-r", attr.gradient)}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
