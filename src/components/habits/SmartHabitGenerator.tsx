'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useHabitStore } from '@/lib/stores/habit-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Category } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

interface SmartHabitGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SmartHabitRecommendation {
  habitName: string;
  category: string;
  reasoning: string;
  targetDaysPerWeek: number;
  difficulty: 'easy' | 'medium' | 'hard';
  expectedImpact: 'low' | 'medium' | 'high';
}

const DIFFICULTY_BADGE_CLASSES: Record<SmartHabitRecommendation['difficulty'], string> = {
  easy: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  hard: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
};

const IMPACT_BADGE_CLASSES: Record<SmartHabitRecommendation['expectedImpact'], string> = {
  high: 'bg-invest/15 text-invest',
  medium: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  low: 'bg-muted text-muted-foreground',
};

async function fetchHabitRecommendations(goal: string): Promise<SmartHabitRecommendation[]> {
  const response = await fetch('/api/ai/recommend-habits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goals: [{ id: 'custom-goal', title: goal, areaOfLife: 'personal', description: 'Custom aspiration entered by user' }],
      currentHabits: [],
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate recommendations');
  }
  const data = await response.json();
  return data.recommendations || [];
}

function RecommendationRow({
  rec,
  index,
  isAdded,
  onAdd,
}: {
  rec: SmartHabitRecommendation;
  index: number;
  isAdded: boolean;
  onAdd: (rec: SmartHabitRecommendation) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group surface-subtle rounded-2xl p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:border-invest/40 transition-all"
    >
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h5 className="font-semibold text-lg text-foreground transition-colors">{rec.habitName}</h5>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className="bg-primary/15 text-primary border-0 text-[10px]">{rec.category}</Badge>
            <Badge className="bg-muted text-muted-foreground border-0 text-[10px] font-mono tabular-nums">
              {rec.targetDaysPerWeek}x/week
            </Badge>
            <Badge className={cn('border-0 text-[10px]', DIFFICULTY_BADGE_CLASSES[rec.difficulty])}>
              {rec.difficulty}
            </Badge>
            <Badge className={cn('border-0 text-[10px]', IMPACT_BADGE_CLASSES[rec.expectedImpact])}>
              {rec.expectedImpact} impact
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{rec.reasoning}</p>
      </div>

      <div className="flex-shrink-0 self-end md:self-start">
        {isAdded ? (
          <div className="flex items-center justify-center h-10 w-28 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm font-semibold gap-1.5 animate-scale-in">
            <Check className="h-4 w-4" />
            Added
          </div>
        ) : (
          <Button
            onClick={() => onAdd(rec)}
            className="h-10 w-28 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground border-0 hover:scale-[0.98] transition-all gap-1"
          >
            <Plus className="h-4 w-4" />
            Add Habit
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export function SmartHabitGenerator({ open, onOpenChange }: SmartHabitGeneratorProps) {
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<SmartHabitRecommendation[]>([]);
  const [addedHabits, setAddedHabits] = useState<Record<string, boolean>>({});
  const { addHabit } = useHabitStore();

  const handleGenerate = async () => {
    if (!goal.trim()) {
      toast.error('Please describe your goal first.');
      return;
    }

    setLoading(true);
    setRecommendations([]);
    setAddedHabits({});

    try {
      const recs = await fetchHabitRecommendations(goal);
      setRecommendations(recs);
      if (recs.length === 0) {
        toast.info('AI was unable to formulate specific habits. Try rephrasing your goal.');
      }
    } catch (err: any) {
      console.error('Failed to generate custom habits:', err);
      toast.error(err.message || 'AI Coach is busy. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (rec: SmartHabitRecommendation) => {
    try {
      await addHabit({
        name: rec.habitName,
        category: rec.category.toLowerCase() as Category,
        targetDaysPerWeek: rec.targetDaysPerWeek,
      });

      setAddedHabits((prev) => ({ ...prev, [rec.habitName]: true }));
      toast.success(`Habit "${rec.habitName}" added successfully!`);
    } catch (err) {
      toast.error('Failed to add habit');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border text-foreground rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Sparkles className="h-6 w-6 text-invest fill-invest/20" />
            AI Smart Habit Generator
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm mt-1.5">
            Turn your grand goals, aspirations, or dreams into atomic, daily actions that compound over time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-invest">
              What do you want to achieve?
            </label>
            <Textarea
              placeholder="e.g., I want to run a half-marathon, build a SaaS application, write an ebook, or improve my sleep hygiene..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="min-h-[100px] border-border bg-muted/40 text-foreground placeholder:text-muted-foreground focus:border-invest focus:ring-1 focus:ring-invest/40 rounded-xl"
              disabled={loading}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !goal.trim()}
            className="w-full h-12 rounded-xl font-semibold bg-invest hover:bg-invest/90 text-white shadow-sm border-0 hover:scale-[0.99] active:scale-95 transition-all gap-2 disabled:opacity-50 disabled:scale-100"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Architecting Your Routine...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 fill-current" />
                Deconstruct into Atomic Habits
              </>
            )}
          </Button>

          <AnimatePresence>
            {recommendations.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-4 pt-4 border-t border-border"
              >
                <h4 className="text-xs font-semibold uppercase tracking-wider text-invest">
                  Recommended Habits
                </h4>

                <div className="space-y-3">
                  {recommendations.map((rec, index) => (
                    <RecommendationRow
                      key={index}
                      rec={rec}
                      index={index}
                      isAdded={Boolean(addedHabits[rec.habitName])}
                      onAdd={handleAdd}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
