'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { Habit, HabitFormData, Category } from '@/lib/types';

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

  const isEditing = !!habit;

  // Reset form when opening or habit changes
  useEffect(() => {
    if (open) {
      if (habit) {
        setName(habit.name);
        setCategory(habit.category);
        setTargetDays(habit.targetDaysPerWeek);
        setIcon(habit.icon || '');
      } else {
        setName('');
        setCategory('personal');
        setTargetDays(7);
        setIcon('');
      }
      setErrors({});
    }
  }, [open, habit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!name.trim()) {
      setErrors({ name: 'Habit name is required' });
      return;
    }

    onSubmit({
      name: name.trim(),
      category,
      targetDaysPerWeek: targetDays,
      icon: icon || undefined,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
