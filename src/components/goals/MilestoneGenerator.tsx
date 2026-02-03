'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, X, Calendar, Loader2, Target, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Goal } from '@/lib/types';
import type { MilestoneGenerationOutput, GeneratedMilestone } from '@/lib/ai/types';

interface MilestoneGeneratorProps {
  goal: Goal;
  onMilestonesAccepted?: (milestones: GeneratedMilestone[]) => void;
}

export function MilestoneGenerator({ goal, onMilestonesAccepted }: MilestoneGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [milestones, setMilestones] = useState<GeneratedMilestone[] | null>(null);
  const [selectedMilestones, setSelectedMilestones] = useState<Set<number>>(new Set());
  const [confidenceScore, setConfidenceScore] = useState<number>(0);
  const [totalWeeks, setTotalWeeks] = useState<number>(0);

  const generateMilestones = async (timelinePreference: 'aggressive' | 'balanced' | 'relaxed' = 'balanced') => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/generate-milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: {
            id: goal.id,
            title: goal.title,
            description: goal.description,
            deadline: goal.deadline,
            areaOfLife: goal.areaOfLife
          },
          userContext: {
            timelinePreference,
            userLevel: 5 // TODO: Get from user store
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate milestones');
      }

      const data: MilestoneGenerationOutput = await response.json();
      setMilestones(data.milestones);
      setConfidenceScore(data.confidenceScore);
      setTotalWeeks(data.totalEstimatedWeeks);
      
      // Select all by default
      setSelectedMilestones(new Set(data.milestones.map(m => m.orderIndex)));
      
      toast.success(`Generated ${data.milestones.length} milestones!`);
    } catch (error: any) {
      console.error('Milestone generation error:', error);
      toast.error(error.message || 'Failed to generate milestones');
    } finally {
      setLoading(false);
    }
  };

  const toggleMilestone = (orderIndex: number) => {
    const newSelected = new Set(selectedMilestones);
    if (newSelected.has(orderIndex)) {
      newSelected.delete(orderIndex);
    } else {
      newSelected.add(orderIndex);
    }
    setSelectedMilestones(newSelected);
  };

  const acceptMilestones = () => {
    if (!milestones) return;
    
    const acceptedMilestones = milestones.filter(m => selectedMilestones.has(m.orderIndex));
    onMilestonesAccepted?.(acceptedMilestones);
    toast.success(`Added ${acceptedMilestones.length} milestones to your goal!`);
  };

  const difficultyColors = {
    easy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    hard: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  };

  return (
    <Card className="border-purple-500/20 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
          <Target className="h-5 w-5" />
          AI Milestone Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!milestones ? (
          <div className="text-center py-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Let AI break down "{goal.title}" into achievable milestones
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button
                onClick={() => generateMilestones('relaxed')}
                disabled={loading}
                variant="outline"
                size="sm"
                className="gap-1"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Relaxed Pace
              </Button>
              <Button
                onClick={() => generateMilestones('balanced')}
                disabled={loading}
                variant="default"
                size="sm"
                className="gap-1 bg-purple-600 hover:bg-purple-700"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Balanced (Recommended)
              </Button>
              <Button
                onClick={() => generateMilestones('aggressive')}
                disabled={loading}
                variant="outline"
                size="sm"
                className="gap-1"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Fast Track
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header Stats */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <span className="text-muted-foreground">
                  {milestones.length} milestones • {totalWeeks} weeks
                </span>
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  {confidenceScore}% confidence
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => generateMilestones('balanced')}
                disabled={loading}
                className="h-7 gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Regenerate
              </Button>
            </div>

            {/* Milestones List */}
            <div className="space-y-3">
              <AnimatePresence>
                {milestones.map((milestone, index) => (
                  <motion.div
                    key={milestone.orderIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "border rounded-lg p-3 transition-all",
                      selectedMilestones.has(milestone.orderIndex)
                        ? "bg-white dark:bg-gray-900 border-purple-300 dark:border-purple-700"
                        : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleMilestone(milestone.orderIndex)}
                        className={cn(
                          "mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          selectedMilestones.has(milestone.orderIndex)
                            ? "bg-purple-600 border-purple-600"
                            : "border-gray-300 dark:border-gray-600"
                        )}
                      >
                        {selectedMilestones.has(milestone.orderIndex) && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium text-sm">
                            {milestone.orderIndex}. {milestone.title}
                          </h4>
                          <div className="flex gap-1 flex-shrink-0">
                            <Badge variant="outline" className={difficultyColors[milestone.difficulty]}>
                              {milestone.difficulty}
                            </Badge>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground mb-2">
                          {milestone.description}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {milestone.estimatedTimeWeeks} week{milestone.estimatedTimeWeeks !== 1 ? 's' : ''}
                          </span>
                          {milestone.suggestedDeadline && (
                            <span>Due: {new Date(milestone.suggestedDeadline).toLocaleDateString()}</span>
                          )}
                        </div>

                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 italic">
                          {milestone.reasoning}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={acceptMilestones}
                disabled={selectedMilestones.size === 0}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                <Check className="h-4 w-4 mr-1" />
                Accept {selectedMilestones.size > 0 && `(${selectedMilestones.size})`}
              </Button>
              <Button
                onClick={() => setMilestones(null)}
                variant="outline"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
