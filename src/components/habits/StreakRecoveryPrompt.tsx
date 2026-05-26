'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Flame, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Habit } from '@/lib/types';
import { useHabitStore } from '@/lib/stores/habit-store';

interface Props {
  habit: Habit;
  dateStr: string;
  onRecover: () => void;
  onDismiss: () => void;
}

export function StreakRecoveryPrompt({ habit, dateStr, onRecover, onDismiss }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-background border shadow-xl rounded-xl p-3 overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
      <button 
        onClick={onDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>

      <div className="flex gap-3">
        <div className="mt-1 h-8 w-8 shrink-0 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div>
          <h4 className="font-semibold text-sm">Streak Broken</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            You missed {habit.name} yesterday. Recover your streak?
          </p>
          
          <div className="mt-3">
            <Button size="sm" className="w-full h-7 text-xs gap-1.5" onClick={onRecover}>
              {habit.isQuantitative ? `Complete Double (${habit.targetValue! * 2} ${habit.unit})` : 'Bonus Repair Activity'}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
