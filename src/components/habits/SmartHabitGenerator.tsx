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
import { useGamificationStore } from '@/lib/stores/gamification-store';
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

export function SmartHabitGenerator({ open, onOpenChange }: SmartHabitGeneratorProps) {
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<SmartHabitRecommendation[]>([]);
  const [addedHabits, setAddedHabits] = useState<Record<string, boolean>>({});
  const { addHabit } = useHabitStore();
  const { level } = useGamificationStore();

  const handleGenerate = async () => {
    if (!goal.trim()) {
      toast.error('Please describe your goal first.');
      return;
    }

    setLoading(true);
    setRecommendations([]);
    setAddedHabits({});

    try {
      const response = await fetch('/api/ai/recommend-habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goals: [
            {
              id: 'custom-goal',
              title: goal,
              areaOfLife: 'personal',
              description: 'Custom aspiration entered by user',
            },
          ],
          currentHabits: [],
          userLevel: level,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate recommendations');
      }

      const data = await response.json();
      setRecommendations(data.recommendations || []);
      if (data.recommendations?.length === 0) {
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto border-indigo-500/20 bg-gradient-to-br from-indigo-950/80 via-slate-900/95 to-purple-950/80 backdrop-blur-xl text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
            <Sparkles className="h-6 w-6 text-indigo-400 fill-indigo-400/20" />
            AI Smart Habit Generator
          </DialogTitle>
          <DialogDescription className="text-slate-300/90 text-sm mt-1.5">
            Turn your grand goals, aspirations, or dreams into atomic, daily actions that compound over time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
              What do you want to achieve?
            </label>
            <Textarea
              placeholder="e.g., I want to run a half-marathon, build a SaaS application, write an ebook, or improve my sleep hygiene..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="min-h-[100px] border-indigo-500/30 bg-slate-950/50 text-slate-100 placeholder:text-slate-500/70 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 rounded-xl"
              disabled={loading}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !goal.trim()}
            className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white shadow-lg shadow-indigo-500/25 border-0 hover:scale-[0.99] active:scale-95 transition-all gap-2 disabled:opacity-50 disabled:scale-100"
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
                className="space-y-4 pt-4 border-t border-slate-800"
              >
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                  Recommended Habits
                </h4>

                <div className="space-y-3">
                  {recommendations.map((rec, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group border border-white/5 bg-white/5 rounded-2xl p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:border-indigo-500/30 hover:bg-white/[0.08] transition-all"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-semibold text-lg text-slate-100 group-hover:text-white transition-colors">
                            {rec.habitName}
                          </h5>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className="bg-indigo-500/20 text-indigo-300 border-0 text-[10px]">
                              {rec.category}
                            </Badge>
                            <Badge className="bg-white/10 text-slate-300 border-0 text-[10px]">
                              {rec.targetDaysPerWeek}x/week
                            </Badge>
                            <Badge
                              className={cn(
                                'border-0 text-[10px]',
                                rec.difficulty === 'easy' && 'bg-emerald-500/20 text-emerald-400',
                                rec.difficulty === 'medium' && 'bg-amber-500/20 text-amber-400',
                                rec.difficulty === 'hard' && 'bg-rose-500/20 text-rose-400'
                              )}
                            >
                              {rec.difficulty}
                            </Badge>
                            <Badge
                              className={cn(
                                'border-0 text-[10px]',
                                rec.expectedImpact === 'high' && 'bg-purple-500/20 text-purple-400',
                                rec.expectedImpact === 'medium' && 'bg-blue-500/20 text-blue-400',
                                rec.expectedImpact === 'low' && 'bg-slate-500/20 text-slate-400'
                              )}
                            >
                              {rec.expectedImpact} impact
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {rec.reasoning}
                        </p>
                      </div>

                      <div className="flex-shrink-0 self-end md:self-start">
                        {addedHabits[rec.habitName] ? (
                          <div className="flex items-center justify-center h-10 w-28 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold gap-1.5 animate-scale-in">
                            <Check className="h-4 w-4" />
                            Added
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleAdd(rec)}
                            className="h-10 w-28 rounded-xl font-semibold bg-white/10 hover:bg-white/20 text-white border-0 hover:scale-[0.98] transition-all gap-1"
                          >
                            <Plus className="h-4 w-4" />
                            Add Habit
                          </Button>
                        )}
                      </div>
                    </motion.div>
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
