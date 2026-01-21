'use client';

import { motion } from 'framer-motion';
import { CheckSquare, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/motion';

interface QuickActionsProps {
  onMarkTodayHabits: () => void;
  onAddHabit: () => void;
  onAddGoal: () => void;
}

export function QuickActions({ 
  onMarkTodayHabits, 
  onAddHabit,
  onAddGoal,
}: QuickActionsProps) {
  return (
    <FadeIn delay={0.4}>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 md:relative md:bottom-auto md:left-auto md:translate-x-0 md:mt-8">
        <motion.div
          className="flex items-center gap-2 p-2 rounded-2xl bg-card/80 backdrop-blur-xl border shadow-lg"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 400, damping: 25 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkTodayHabits}
            className="gap-2"
          >
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Mark Today</span>
          </Button>
          
          <div className="w-px h-6 bg-border" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddHabit}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Habit</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddGoal}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">New Goal</span>
          </Button>
        </motion.div>
      </div>
    </FadeIn>
  );
}
