'use client';

import { Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/motion';

interface EmptyGoalsProps {
  onCreateGoal: () => void;
}

export function EmptyGoals({ onCreateGoal }: EmptyGoalsProps) {
  return (
    <FadeIn className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-6">
        {/* Decorative circles */}
        <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-chart-4/20 rounded-full blur-xl" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-chart-4/20 flex items-center justify-center">
          <Target className="h-10 w-10 text-primary" />
        </div>
      </div>
      
      <h3 className="text-xl font-semibold mb-2">No goals yet</h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        Goals give you direction. Set meaningful objectives and break them 
        down into milestones to track your progress.
      </p>
      
      <Button onClick={onCreateGoal} size="lg" className="gap-2">
        <Target className="h-4 w-4" />
        Create Your First Goal
      </Button>
    </FadeIn>
  );
}
