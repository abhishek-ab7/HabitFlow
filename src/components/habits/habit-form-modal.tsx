'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronDown, Link2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Habit, HabitFormData, Category, Routine } from '@/lib/types';
import { useRoutineStore } from '@/lib/stores/routine-store';
import { useHabitStore } from '@/lib/stores/habit-store';

interface HabitFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: HabitFormData) => void;
  habit?: Habit; // If provided, we're editing
}

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: 'health', label: 'Health', emoji: '💪' },
  { value: 'work', label: 'Work', emoji: '💼' },
  { value: 'learning', label: 'Learning', emoji: '📚' },
  { value: 'personal', label: 'Personal', emoji: '🌟' },
  { value: 'finance', label: 'Finance', emoji: '💰' },
  { value: 'relationships', label: 'Relationships', emoji: '❤️' },
];

const CATEGORY_COLORS: Record<Category, string> = {
  health: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/30',
  work: 'bg-indigo-500/20 text-indigo-600 border-indigo-500/30 hover:bg-indigo-500/30',
  learning: 'bg-amber-500/20 text-amber-600 border-amber-500/30 hover:bg-amber-500/30',
  personal: 'bg-pink-500/20 text-pink-600 border-pink-500/30 hover:bg-pink-500/30',
  finance: 'bg-sky-500/20 text-sky-600 border-sky-500/30 hover:bg-sky-500/30',
  relationships: 'bg-orange-500/20 text-orange-600 border-orange-500/30 hover:bg-orange-500/30',
};

const COMMON_EMOJIS = ['🧘', '💪', '📚', '💻', '✍️', '🏃', '🎯', '💤', '🥗', '🧠', '🎨', '🎵'];

export function HabitFormModal({
  open,
  onOpenChange,
  onSubmit,
  habit,
}: HabitFormModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('personal');
  const [targetDays, setTargetDays] = useState(7);
  const [icon, setIcon] = useState('');
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedRoutineIds, setSelectedRoutineIds] = useState<Set<string>>(new Set());
  const [loadingRoutines, setLoadingRoutines] = useState(false);

  const { routines, loadRoutines } = useRoutineStore();
  const { linkToRoutine, unlinkFromRoutine, getHabitRoutines } = useHabitStore();

  const isEditing = !!habit;

  // Load routines and current habit routines
  useEffect(() => {
    if (open) {
      loadRoutines();
      
      if (habit) {
        setName(habit.name);
        setCategory(habit.category);
        setTargetDays(habit.targetDaysPerWeek);
        setIcon(habit.icon || '');
        
        // Load routines this habit belongs to
        setLoadingRoutines(true);
        getHabitRoutines(habit.id).then(habitRoutines => {
          setSelectedRoutineIds(new Set(habitRoutines.map(r => r.id)));
          setLoadingRoutines(false);
        });
      } else {
        setName('');
        setCategory('personal');
        setTargetDays(7);
        setIcon('');
        setSelectedRoutineIds(new Set());
      }
      setErrors({});
    }
  }, [open, habit, loadRoutines, getHabitRoutines]);

  const handleRoutineToggle = (routineId: string) => {
    const newSet = new Set(selectedRoutineIds);
    if (newSet.has(routineId)) {
      newSet.delete(routineId);
    } else {
      newSet.add(routineId);
    }
    setSelectedRoutineIds(newSet);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!name.trim()) {
      setErrors({ name: 'Habit name is required' });
      return;
    }

    // First, submit the habit
    onSubmit({
      name: name.trim(),
      category,
      targetDaysPerWeek: targetDays,
      icon: icon || undefined,
    });

    // If editing, update routine links
    if (habit) {
      // Get current routines
      const currentRoutines = await getHabitRoutines(habit.id);
      const currentRoutineIds = new Set(currentRoutines.map(r => r.id));

      // Link new routines
      for (const routineId of selectedRoutineIds) {
        if (!currentRoutineIds.has(routineId)) {
          await linkToRoutine(habit.id, routineId);
        }
      }

      // Unlink removed routines
      for (const routineId of currentRoutineIds) {
        if (!selectedRoutineIds.has(routineId)) {
          await unlinkFromRoutine(habit.id, routineId);
        }
      }
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Habit' : 'Create New Habit'}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Update your habit details below.' 
                : 'Define a new habit to track daily.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
            {/* Icon selector */}
            <div>
              <label className="text-sm font-medium mb-2 block">Icon (optional)</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_EMOJIS.map((emoji) => (
                  <motion.button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(icon === emoji ? '' : emoji)}
                    className={cn(
                      "w-10 h-10 rounded-lg text-lg flex items-center justify-center border-2 transition-colors",
                      icon === emoji 
                        ? "border-primary bg-primary/10" 
                        : "border-transparent bg-muted hover:bg-muted/80"
                    )}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Name input */}
            <div>
              <label htmlFor="habit-name" className="text-sm font-medium mb-2 block">
                Habit Name
              </label>
              <Input
                id="habit-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({});
                }}
                placeholder="e.g., Morning Meditation"
                className={cn(errors.name && "border-destructive")}
                autoFocus
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name}</p>
              )}
            </div>

            {/* Category selector */}
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                      category === cat.value 
                        ? CATEGORY_COLORS[cat.value]
                        : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                    )}
                  >
                    <span className="mr-1">{cat.emoji}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target days */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Target Days Per Week
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setTargetDays(day)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                      targetDays === day 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {targetDays === 7 
                  ? 'Daily habit' 
                  : `${targetDays} days per week`}
              </p>
            </div>

            {/* Advanced Options */}
            <div className="pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-180")} />
                Advanced Options
              </button>

              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-3"
                >
                  <div>
                    <label className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      Link to Routines (optional)
                    </label>
                    <div className="border rounded-md p-3 space-y-2 max-h-32 overflow-y-auto bg-muted/30">
                      {routines.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No routines available. Create a routine to link habits.
                        </p>
                      ) : loadingRoutines ? (
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      ) : (
                        routines.map((routine) => (
                          <div key={routine.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`routine-${routine.id}`}
                              checked={selectedRoutineIds.has(routine.id)}
                              onCheckedChange={() => handleRoutineToggle(routine.id)}
                            />
                            <label
                              htmlFor={`routine-${routine.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                            >
                              {routine.title}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      This habit can belong to multiple routines
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {isEditing ? 'Save Changes' : 'Create Habit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
