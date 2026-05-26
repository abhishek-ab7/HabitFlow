'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Compass, 
  Check, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Target, 
  Flame, 
  BookOpen, 
  Heart,
  Briefcase
} from 'lucide-react';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { cn } from '@/lib/utils';
import type { Category } from '@/lib/types';

interface OnboardingWizardProps {
  onComplete: () => void;
}

interface HabitTemplate {
  id: string;
  name: string;
  icon: string;
  category: Category;
  frequency: 'daily' | 'weekly';
  description: string;
  targetDaysPerWeek: number;
}

const HABIT_TEMPLATES: HabitTemplate[] = [
  { id: 'water', name: 'Drink 3L Water', icon: '💧', category: 'health', frequency: 'daily', description: 'Stay hydrated throughout the day', targetDaysPerWeek: 7 },
  { id: 'gym', name: 'Work Out / Gym', icon: '🏋️‍♂️', category: 'health', frequency: 'weekly', description: 'Maintain strength and fitness', targetDaysPerWeek: 4 },
  { id: 'dsa', name: 'LeetCode / DSA', icon: '💻', category: 'learning', frequency: 'weekly', description: 'Practice coding challenges', targetDaysPerWeek: 5 },
  { id: 'read', name: 'Read a Book', icon: '📚', category: 'learning', frequency: 'daily', description: 'Read at least 15 pages', targetDaysPerWeek: 7 },
  { id: 'steps', name: '10k Daily Steps', icon: '🏃‍♂️', category: 'health', frequency: 'daily', description: 'Keep active with walking', targetDaysPerWeek: 7 },
  { id: 'apply', name: 'Apply to Jobs', icon: '💼', category: 'work', frequency: 'daily', description: 'Apply to target job listings', targetDaysPerWeek: 5 },
];

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState<Category>('learning');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addHabit } = useHabitStore();
  const { addGoal } = useGoalStore();

  const handleToggleTemplate = (id: string) => {
    setSelectedTemplates(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      // Add selected habits
      for (const tempId of selectedTemplates) {
        const template = HABIT_TEMPLATES.find(t => t.id === tempId);
        if (template) {
          await addHabit({
            name: template.name,
            icon: template.icon,
            category: template.category,
            targetDaysPerWeek: template.targetDaysPerWeek,
          });
        }
      }

      // Add goal if specified
      if (goalTitle.trim()) {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 90); // Default 90-day goal

        await addGoal({
          title: goalTitle,
          description: 'My 90-day focus goal created during onboarding',
          areaOfLife: goalCategory === 'work' ? 'career' : 
                      goalCategory === 'learning' ? 'personal_growth' : 
                      goalCategory === 'personal' ? 'personal_growth' : 
                      goalCategory as any, // maps to health, finance, relationships
          priority: 'high',
          startDate: new Date().toISOString().split('T')[0],
          deadline: deadline.toISOString().split('T')[0],
          isFocus: true,
          milestones: [
            'Define key milestones',
            'Check progress in 30 days',
            'Check progress in 60 days',
          ]
        });
      }

      localStorage.setItem('habitflow_onboarded', 'true');
      localStorage.removeItem('habitflow_just_signed_up');
      onComplete();
    } catch (error) {
      console.error('Error during onboarding setup:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 500 : -500,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 500 : -500,
      opacity: 0
    })
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col min-h-[500px]"
      >
        {/* Header/Progress */}
        <div className="px-6 pt-6 flex justify-between items-center border-b pb-4">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary animate-spin-slow" />
            <span className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Welcome Wizard</span>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map(s => (
              <div 
                key={s} 
                className={cn(
                  "w-6 h-1 rounded-full transition-all duration-300",
                  s <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 p-6 relative overflow-hidden flex flex-col justify-between">
          <AnimatePresence mode="wait" custom={step}>
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 flex-1 flex flex-col justify-center text-center"
              >
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight">Build the best version of yourself</h2>
                  <p className="text-muted-foreground max-w-md mx-auto text-sm">
                    HabitFlow helps you track habits, design routines, and complete high-impact 90-day goals. Let's customize your workspace in under 2 minutes.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-4 flex-1 flex flex-col"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-bold">Pick your starter habits</h3>
                  <p className="text-sm text-muted-foreground">Select a few habits to start tracking today. You can always change these later.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
                  {HABIT_TEMPLATES.map(temp => {
                    const isSelected = selectedTemplates.includes(temp.id);
                    return (
                      <button
                        key={temp.id}
                        onClick={() => handleToggleTemplate(temp.id)}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border text-left transition-all hover:bg-muted/50",
                          isSelected 
                            ? "border-primary bg-primary/5 shadow-sm" 
                            : "border-border"
                        )}
                      >
                        <span className="text-2xl mt-0.5">{temp.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{temp.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{temp.description}</p>
                          <span className="inline-block mt-1 text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">
                            {temp.category} • {temp.frequency}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="bg-primary text-primary-foreground rounded-full p-0.5 mt-0.5">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-5 flex-1 flex flex-col justify-center"
              >
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-lg font-bold">Set your 90-day focus goal</h3>
                  <p className="text-sm text-muted-foreground">Focus is key. Set a milestone you want to reach in the next 3 months.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Goal Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Solve 100 LeetCode problems / Lose 5kg" 
                      value={goalTitle}
                      onChange={(e) => setGoalTitle(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['learning', 'health', 'work', 'personal', 'finance', 'relationships'] as Category[]).map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setGoalCategory(cat)}
                          className={cn(
                            "py-2 rounded-lg border text-xs capitalize font-medium transition-all",
                            goalCategory === cat 
                              ? "bg-primary text-primary-foreground border-primary" 
                              : "bg-background border-border hover:bg-muted"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-5 flex-1 flex flex-col justify-center text-center"
              >
                <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto text-success">
                  <Check className="h-8 w-8 animate-bounce" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">You are ready to flow!</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto text-sm">
                    We will set up your selected {selectedTemplates.length} habits and {goalTitle ? '1 goal' : 'prepare your dashboard'}. Get ready to make progress every single day.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer buttons */}
          <div className="mt-8 pt-4 border-t flex justify-between items-center bg-card">
            {step > 1 ? (
              <button
                onClick={handleBack}
                disabled={isSubmitting}
                className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors text-muted-foreground disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/95 transition-colors shadow-lg shadow-primary/20"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-success text-success-foreground rounded-xl font-semibold text-sm hover:bg-success/90 transition-colors shadow-lg shadow-success/20 disabled:opacity-50"
              >
                {isSubmitting ? 'Setting up...' : 'Start tracking'}
                <Sparkles className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
