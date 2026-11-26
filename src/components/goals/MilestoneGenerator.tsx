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

const DIFFICULTY_COLORS = {
  easy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  hard: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
} as const;

function GeneratedMilestoneRow({
  milestone,
  index,
  selected,
  onToggle,
}: {
  milestone: GeneratedMilestone;
  index: number;
  selected: boolean;
  onToggle: (orderIndex: number) => void;
}) {
  return (
    <motion.div
      key={milestone.orderIndex}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn('border rounded-xl p-3 transition-all', selected ? 'bg-card border-invest/50' : 'bg-muted/40 border-border opacity-60')}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(milestone.orderIndex)}
          className={cn(
            'mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
            selected ? 'bg-invest border-invest' : 'border-muted-foreground/40'
          )}
        >
          {selected && <Check className="h-3 w-3 text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-medium text-sm">{milestone.orderIndex}. {milestone.title}</h4>
            <Badge variant="outline" className={DIFFICULTY_COLORS[milestone.difficulty]}>{milestone.difficulty}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{milestone.description}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {milestone.estimatedTimeWeeks} week{milestone.estimatedTimeWeeks !== 1 ? 's' : ''}
            </span>
            {milestone.suggestedDeadline && <span>Due: {new Date(milestone.suggestedDeadline).toLocaleDateString()}</span>}
          </div>
          <p className="text-xs text-invest mt-2 italic">{milestone.reasoning}</p>
        </div>
      </div>
    </motion.div>
  );
}

const PACE_OPTIONS = [
  ['relaxed', 'Relaxed Pace', 'outline'],
  ['balanced', 'Balanced (Recommended)', 'default'],
  ['aggressive', 'Fast Track', 'outline'],
] as const;

function MilestonePacePicker({
  goalTitle,
  loading,
  onSelectPace,
}: {
  goalTitle: string;
  loading: boolean;
  onSelectPace: (pref: 'aggressive' | 'balanced' | 'relaxed') => void;
}) {
  return (
    <div className="text-center py-6 space-y-4">
      <p className="text-sm text-muted-foreground">Let AI break down &quot;{goalTitle}&quot; into achievable milestones</p>
      <div className="flex gap-2 justify-center flex-wrap">
        {PACE_OPTIONS.map(([pref, label, variant]) => (
          <Button
            key={pref}
            onClick={() => onSelectPace(pref)}
            disabled={loading}
            variant={variant}
            size="sm"
            className={cn('gap-1', pref === 'balanced' && 'bg-invest hover:bg-invest/90 text-white')}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function GeneratedMilestonesList({
  milestones,
  selectedMilestones,
  confidenceScore,
  totalWeeks,
  loading,
  onToggle,
  onRegenerate,
  onAccept,
  onCancel,
}: {
  milestones: GeneratedMilestone[];
  selectedMilestones: Set<number>;
  confidenceScore: number;
  totalWeeks: number;
  loading: boolean;
  onToggle: (orderIndex: number) => void;
  onRegenerate: () => void;
  onAccept: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-4">
          <span className="text-muted-foreground">{milestones.length} milestones • {totalWeeks} weeks</span>
          <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />{confidenceScore}% confidence</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={loading} className="h-7 gap-1">
          <RefreshCw className="h-3 w-3" />
          Regenerate
        </Button>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {milestones.map((milestone, index) => (
            <GeneratedMilestoneRow
              key={milestone.orderIndex}
              milestone={milestone}
              index={index}
              selected={selectedMilestones.has(milestone.orderIndex)}
              onToggle={onToggle}
            />
          ))}
        </AnimatePresence>
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={onAccept} disabled={selectedMilestones.size === 0} className="flex-1 bg-invest hover:bg-invest/90 text-white">
          <Check className="h-4 w-4 mr-1" />
          Accept {selectedMilestones.size > 0 && `(${selectedMilestones.size})`}
        </Button>
        <Button onClick={onCancel} variant="outline">
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

function useMilestoneGenerator(
  goal: Goal,
  onMilestonesAccepted?: (milestones: GeneratedMilestone[]) => void
) {
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
          goal: { id: goal.id, title: goal.title, description: goal.description, deadline: goal.deadline, areaOfLife: goal.areaOfLife },
          userContext: { timelinePreference },
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate milestones');
      }
      const data: MilestoneGenerationOutput = await response.json();
      setMilestones(data.milestones);
      setConfidenceScore(data.confidenceScore);
      setTotalWeeks(data.totalEstimatedWeeks);
      setSelectedMilestones(new Set(data.milestones.map((m) => m.orderIndex)));
      toast.success(`Generated ${data.milestones.length} milestones!`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate milestones');
    } finally {
      setLoading(false);
    }
  };

  const toggleMilestone = (orderIndex: number) => {
    const next = new Set(selectedMilestones);
    if (next.has(orderIndex)) next.delete(orderIndex);
    else next.add(orderIndex);
    setSelectedMilestones(next);
  };

  const acceptMilestones = () => {
    if (!milestones) return;
    const accepted = milestones.filter((m) => selectedMilestones.has(m.orderIndex));
    onMilestonesAccepted?.(accepted);
    toast.success(`Added ${accepted.length} milestones to your goal!`);
  };

  return {
    loading,
    milestones,
    setMilestones,
    selectedMilestones,
    confidenceScore,
    totalWeeks,
    generateMilestones,
    toggleMilestone,
    acceptMilestones,
  };
}

export function MilestoneGenerator({ goal, onMilestonesAccepted }: MilestoneGeneratorProps) {
  const {
    loading,
    milestones,
    setMilestones,
    selectedMilestones,
    confidenceScore,
    totalWeeks,
    generateMilestones,
    toggleMilestone,
    acceptMilestones,
  } = useMilestoneGenerator(goal, onMilestonesAccepted);

  return (
    <Card className="surface-card border-invest/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-invest">
          <Target className="h-5 w-5" />
          AI Milestone Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!milestones ? (
          <MilestonePacePicker goalTitle={goal.title} loading={loading} onSelectPace={generateMilestones} />
        ) : (
          <GeneratedMilestonesList
            milestones={milestones}
            selectedMilestones={selectedMilestones}
            confidenceScore={confidenceScore}
            totalWeeks={totalWeeks}
            loading={loading}
            onToggle={toggleMilestone}
            onRegenerate={() => generateMilestones('balanced')}
            onAccept={acceptMilestones}
            onCancel={() => setMilestones(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
