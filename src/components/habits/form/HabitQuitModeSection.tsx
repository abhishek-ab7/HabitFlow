'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Link2, Shield, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Habit, HabitAnchorBlock, HabitPolarity } from '@/lib/types';

const POLARITY_OPTIONS = [
  {
    id: 'build' as const,
    label: 'Build Habit',
    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
    hint: 'Standard positive daily habit with completion streaks.',
    Icon: Sparkles,
  },
  {
    id: 'quit' as const,
    label: 'Quit / Anti-Habit',
    activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm',
    hint: 'Shows clean-streak shield ("Clean so far") and 1-tap 10-Min Urge Timer.',
    Icon: Shield,
  },
] as const;

const ANCHOR_BLOCKS = [
  { id: '' as const, key: 'any', label: 'Any Time' },
  { id: 'morning' as const, key: 'morning', label: 'Morning' },
  { id: 'work' as const, key: 'work', label: 'Work' },
  { id: 'gym' as const, key: 'gym', label: 'Gym' },
  { id: 'night' as const, key: 'night', label: 'Night' },
] as const;

export function HabitPolarityAndAnchorFields({
  polarity,
  setPolarity,
  anchorBlock,
  setAnchorBlock,
}: {
  polarity: HabitPolarity;
  setPolarity: (p: HabitPolarity) => void;
  anchorBlock: HabitAnchorBlock | '';
  setAnchorBlock: (b: HabitAnchorBlock | '') => void;
}) {
  const activePolarity = POLARITY_OPTIONS.find((opt) => opt.id === polarity) ?? POLARITY_OPTIONS[0];

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Habit Polarity</label>
        <div className="grid grid-cols-2 gap-2">
          {POLARITY_OPTIONS.map(({ id, label, activeClass, Icon }) => (
            <button
              key={id}
              type="button"
              data-testid={`habit-polarity-${id}`}
              onClick={() => setPolarity(id)}
              className={cn(
                'py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5',
                polarity === id
                  ? activeClass
                  : 'bg-background text-muted-foreground border-border/70 hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">{activePolarity.hint}</p>
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Anchor Time Block (optional)</label>
        <div className="flex flex-wrap gap-1.5">
          {ANCHOR_BLOCKS.map((block) => (
            <button
              key={block.key}
              type="button"
              data-testid={`habit-anchor-${block.key}`}
              onClick={() => setAnchorBlock(block.id)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                anchorBlock === block.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border/70 hover:text-foreground'
              )}
            >
              {block.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StackSequencePreview({
  habits,
  stackAfterHabitId,
  name,
}: {
  habits: Habit[];
  stackAfterHabitId: string;
  name: string;
}) {
  if (!stackAfterHabitId) return null;
  return (
    <div className="mt-3 p-3 bg-muted/40 rounded-xl border border-border/40 flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Visual Sequence Stack</span>
      <div className="flex items-center gap-2 mt-1">
        <span className="px-2.5 py-1 bg-muted border rounded-lg text-xs font-semibold">
          {habits.find((h) => h.id === stackAfterHabitId)?.name || 'Trigger Habit'}
        </span>
        <span className="text-primary font-bold">➔</span>
        <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 text-primary rounded-lg text-xs font-bold animate-pulse">
          {name || 'New Habit'}
        </span>
      </div>
    </div>
  );
}

export function HabitAdvancedStackingSection({
  showAdvanced,
  setShowAdvanced,
  stackAfterHabitId,
  setStackAfterHabitId,
  habits,
  currentHabitId,
  name,
}: {
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  stackAfterHabitId: string;
  setStackAfterHabitId: (v: string) => void;
  habits: Habit[];
  currentHabitId?: string;
  name: string;
}) {
  const triggerCandidates = habits.filter((h) => !h.archived && (!currentHabitId || h.id !== currentHabitId));

  return (
    <div className="pt-2 border-t">
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn('w-4 h-4 transition-transform', showAdvanced && 'rotate-180')} />
        Advanced Options
      </button>

      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-amber-500" />
                  Stack after Habit (optional)
                </label>
                <select
                  value={stackAfterHabitId}
                  onChange={(e) => setStackAfterHabitId(e.target.value)}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">-- Select trigger habit --</option>
                  {triggerCandidates.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.icon || '🎯'} {h.name}
                    </option>
                  ))}
                </select>
                <StackSequencePreview habits={habits} stackAfterHabitId={stackAfterHabitId} name={name} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
