'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Link2, Shield, Sparkles } from 'lucide-react';
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
import type {
  Habit,
  HabitFormData,
  Category,
  HabitFrequencyType,
  AutoTrackHabitRule,
  HabitPolarity,
  HabitAnchorBlock,
} from '@/lib/types';
import { useHabitStore } from '@/lib/stores/habit-store';
import { HabitTemplates, type TemplateHabit } from './HabitTemplates';
import { HabitDifficultySelector } from './HabitDifficultySelector';

interface HabitFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: HabitFormData) => void;
  habit?: Habit; // If provided, we're editing
  defaultTab?: 'details' | 'templates';
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
  work: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/30',
  learning: 'bg-amber-500/20 text-amber-600 border-amber-500/30 hover:bg-amber-500/30',
  personal: 'bg-pink-500/20 text-pink-600 border-pink-500/30 hover:bg-pink-500/30',
  finance: 'bg-sky-500/20 text-sky-600 border-sky-500/30 hover:bg-sky-500/30',
  relationships: 'bg-orange-500/20 text-orange-600 border-orange-500/30 hover:bg-orange-500/30',
};

const WEEKDAY_PILLS: { day: number; short: string; label: string }[] = [
  { day: 1, short: 'M', label: 'Mon' },
  { day: 2, short: 'T', label: 'Tue' },
  { day: 3, short: 'W', label: 'Wed' },
  { day: 4, short: 'T', label: 'Thu' },
  { day: 5, short: 'F', label: 'Fri' },
  { day: 6, short: 'S', label: 'Sat' },
  { day: 0, short: 'S', label: 'Sun' },
];

const COMMON_EMOJIS = [
  // Health & Fitness
  '🧘', '💪', '🏃', '💤', '🥗', '💧', '🍎', '🚴', '🚶', '💊',
  // Learning & Productivity
  '📚', '💻', '✍️', '🧠', '🎯', '⚡', '📅', '📝', '🎓', '🔬',
  // Arts & Creativity
  '🎨', '🎵', '📷', '🎭', '🧶', '🎸', '🎹', '🖌️', '💃', '📽️',
  // Mindfulness & Self-care
  '🕯️', '🛁', '🌱', '☀️', '😊', '🙏', '📿', '🌳', '🌺', '🍵',
  // Finance & Work
  '💰', '💼', '📈', '📊', '🏧', '💳', '🏗️', '🚀', '👔', '🤑',
  // Social & Family
  '❤️', '👨‍👩‍👧‍👦', '🤝', '💌', '📞', '🥳', '🎁', '👶', '🐾', '🏠',
  // Misc
  '🧹', '🧼', '🧺', '🛒', '🚗', '✈️', '🌍', '🛠️', '🔧', '⭐'
];

export function HabitFormModal({
  open,
  onOpenChange,
  onSubmit,
  habit,
  defaultTab,
}: HabitFormModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'templates'>('details');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('personal');
  const [frequencyType, setFrequencyType] = useState<HabitFrequencyType>('daily');
  const [targetDays, setTargetDays] = useState(7);
  const [scheduledDays, setScheduledDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [intervalDays, setIntervalDays] = useState<number>(2);
  const [autoTrackRule, setAutoTrackRule] = useState<AutoTrackHabitRule>('none');
  const [polarity, setPolarity] = useState<HabitPolarity>('build');
  const [anchorBlock, setAnchorBlock] = useState<HabitAnchorBlock | ''>('');
  const [icon, setIcon] = useState('');
  const [isQuantitative, setIsQuantitative] = useState(false);
  const [targetValue, setTargetValue] = useState(0);
  const [unit, setUnit] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAllIcons, setShowAllIcons] = useState(false);
  const [stackAfterHabitId, setStackAfterHabitId] = useState<string>('');

  const { habits } = useHabitStore();

  const isEditing = !!habit;

  // Load current habit stack trigger
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab || 'details');

      Promise.resolve().then(() => {
        if (habit) {
          setName(habit.name);
          setCategory(habit.category);
          const inferredFreq: HabitFrequencyType =
            habit.frequencyType || (habit.targetDaysPerWeek < 7 ? 'weekly_flexible' : 'daily');
          setFrequencyType(inferredFreq);
          setTargetDays(habit.targetDaysPerWeek);
          setScheduledDays(habit.scheduledDays || [1, 2, 3, 4, 5]);
          setIntervalDays(habit.intervalDays || 2);
          const normalizedRule: AutoTrackHabitRule =
            habit.autoTrackRule === 'protein_target'
              ? 'protein_target_met'
              : habit.autoTrackRule === 'no_junk_food'
                ? 'zero_junk_today'
                : habit.autoTrackRule || 'none';
          setAutoTrackRule(normalizedRule);
          setPolarity(habit.polarity || 'build');
          setAnchorBlock(habit.anchorBlock || '');
          setIcon(habit.icon || '');
          setIsQuantitative(habit.isQuantitative || false);
          setTargetValue(habit.targetValue || 0);
          setUnit(habit.unit || '');
          setDifficulty(habit.difficulty || 'medium');
          setStackAfterHabitId(habit.metadata?.stackTriggerHabitId || '');
          setShowAdvanced(
            Boolean(
              (habit.autoTrackRule && habit.autoTrackRule !== 'none') ||
                habit.metadata?.stackTriggerHabitId
            )
          );
        } else {
          setName('');
          setCategory('personal');
          setFrequencyType('daily');
          setTargetDays(7);
          setScheduledDays([1, 2, 3, 4, 5]);
          setIntervalDays(2);
          setAutoTrackRule('none');
          setPolarity('build');
          setAnchorBlock('');
          setIcon('');
          setIsQuantitative(false);
          setTargetValue(0);
          setUnit('');
          setDifficulty('medium');
          setStackAfterHabitId('');
          setShowAdvanced(false);
        }
        setErrors({});
      });
    }
  }, [open, habit, defaultTab]);

  const handleSelectTemplate = (template: TemplateHabit) => {
    setName(template.name);
    setCategory(template.category);
    setTargetDays(template.targetDaysPerWeek);
    setFrequencyType(template.targetDaysPerWeek < 7 ? 'weekly_flexible' : 'daily');
    setIcon(template.icon);
    setIsQuantitative(template.isQuantitative);
    setTargetValue(template.targetValue);
    setUnit(template.unit);
    setActiveTab('details');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!name.trim()) {
      setErrors({ name: 'Habit name is required' });
      setActiveTab('details');
      return;
    }

    const effectiveTargetDays =
      frequencyType === 'daily'
        ? 7
        : frequencyType === 'specific_days'
        ? Math.max(1, scheduledDays.length)
        : frequencyType === 'interval'
        ? Math.max(1, Math.round(7 / Math.max(2, intervalDays)))
        : targetDays;

    onSubmit({
      name: name.trim(),
      category,
      frequencyType,
      targetDaysPerWeek: effectiveTargetDays,
      scheduledDays: frequencyType === 'specific_days' ? scheduledDays : undefined,
      intervalDays: frequencyType === 'interval' ? intervalDays : undefined,
      autoTrackRule,
      polarity,
      anchorBlock: anchorBlock || undefined,
      icon: icon || undefined,
      isQuantitative,
      targetValue: isQuantitative ? targetValue : undefined,
      unit: isQuantitative ? unit.trim() : undefined,
      difficulty,
      metadata: {
        ...(habit?.metadata || {}),
        stackTriggerHabitId: stackAfterHabitId || undefined,
      }
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Habit' : 'Create New Habit'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your habit details below.'
              : 'Define a new habit to track daily.'}
          </DialogDescription>
        </DialogHeader>

        {!isEditing && (
          <div className="flex border-b mb-6 relative">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={cn(
                "flex-1 pb-3 text-sm font-semibold transition-colors relative text-center",
                activeTab === 'details' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={cn(
                "flex-1 pb-3 text-sm font-semibold transition-colors relative text-center",
                activeTab === 'templates' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Browse Templates
            </button>
          </div>
        )}

        {activeTab === 'templates' && !isEditing ? (
          <div className="py-4">
            <HabitTemplates onSelect={handleSelectTemplate} />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-6">
              {/* Icon selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Icon (optional)</label>
                  <button
                    type="button"
                    onClick={() => setShowAllIcons(!showAllIcons)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showAllIcons ? 'Show Less' : 'Show All'}
                  </button>
                </div>
                <motion.div
                  layout
                  className="flex flex-wrap gap-2 overflow-hidden"
                  animate={{ height: 'auto' }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  {(showAllIcons ? COMMON_EMOJIS : COMMON_EMOJIS.slice(0, 12)).map((emoji) => (
                    <motion.button
                      key={emoji}
                      layout
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
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </motion.div>
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

              {/* Polarity (Build vs Quit Anti-Habit) & Anchor Time Block */}
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Habit Polarity
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      data-testid="habit-polarity-build"
                      onClick={() => setPolarity('build')}
                      className={cn(
                        'py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5',
                        polarity === 'build'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-background text-muted-foreground border-border/70 hover:text-foreground'
                      )}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Build Habit
                    </button>
                    <button
                      type="button"
                      data-testid="habit-polarity-quit"
                      onClick={() => setPolarity('quit')}
                      className={cn(
                        'py-2 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5',
                        polarity === 'quit'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-background text-muted-foreground border-border/70 hover:text-foreground'
                      )}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Quit / Anti-Habit
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {polarity === 'quit'
                      ? 'Shows clean-streak shield ("Clean so far") and 1-tap 10-Min Urge Timer.'
                      : 'Standard positive daily habit with completion streaks.'}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Anchor Time Block (optional)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: '', label: 'Any Time' },
                        { id: 'morning', label: 'Morning' },
                        { id: 'work', label: 'Work' },
                        { id: 'gym', label: 'Gym' },
                        { id: 'night', label: 'Night' },
                      ] as const
                    ).map((block) => (
                      <button
                        key={block.id || 'any'}
                        type="button"
                        data-testid={`habit-anchor-${block.id || 'any'}`}
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

              {/* Schedule Mode & Target Days (Habit Engine V2) */}
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3.5">
                <label className="text-sm font-medium block">
                  Schedule & Rest Days
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'daily', label: 'Daily (7×)' },
                    { id: 'weekly_flexible', label: 'X Days / Wk' },
                    { id: 'specific_days', label: 'Specific Days' },
                    { id: 'interval', label: 'Every N Days' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        const nextMode = mode.id as HabitFrequencyType;
                        setFrequencyType(nextMode);
                        if (nextMode === 'daily') setTargetDays(7);
                        if (nextMode === 'weekly_flexible' && targetDays === 7) setTargetDays(5);
                      }}
                      className={cn(
                        'py-2 px-2 rounded-lg text-xs font-semibold transition-all border',
                        frequencyType === mode.id
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-background text-muted-foreground border-border/60 hover:text-foreground'
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* Keep 1..7 selector accessible for both daily & weekly_flexible */}
                {(frequencyType === 'daily' || frequencyType === 'weekly_flexible') && (
                  <div>
                    <div className="flex gap-1 mt-2">
                      {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setTargetDays(day);
                            setFrequencyType(day === 7 ? 'daily' : 'weekly_flexible');
                          }}
                          className={cn(
                            'flex-1 py-2 rounded-lg text-sm font-mono font-semibold transition-colors',
                            targetDays === day
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {targetDays === 7
                        ? 'Daily habit (7 days/week). Missing a day requires a Streak Shield.'
                        : `${targetDays} days/week • Includes ${7 - targetDays} flexible Rest Day${7 - targetDays > 1 ? 's' : ''}/week. Mark any day as Rest without breaking your streak.`}
                    </p>
                  </div>
                )}

                {frequencyType === 'specific_days' && (
                  <div className="pt-1">
                    <div className="flex gap-1.5">
                      {WEEKDAY_PILLS.map((w) => {
                        const active = scheduledDays.includes(w.day);
                        return (
                          <button
                            key={w.day}
                            type="button"
                            onClick={() => {
                              setScheduledDays((prev) =>
                                prev.includes(w.day)
                                  ? prev.length > 1
                                    ? prev.filter((d) => d !== w.day)
                                    : prev
                                  : [...prev, w.day]
                              );
                            }}
                            className={cn(
                              'flex-1 py-2 rounded-lg text-xs font-bold transition-colors border',
                              active
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-muted/60 text-muted-foreground border-transparent hover:bg-muted'
                            )}
                            title={w.label}
                          >
                            {w.short}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Scheduled {scheduledDays.length} day{scheduledDays.length > 1 ? 's' : ''}/week. Unscheduled days automatically count as Auto-Rest.
                    </p>
                  </div>
                )}

                {frequencyType === 'interval' && (
                  <div className="pt-1 flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">Repeat every</span>
                    <div className="flex items-center gap-1.5">
                      {[2, 3, 4, 5, 7].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setIntervalDays(n)}
                          className={cn(
                            'px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors',
                            intervalDays === n
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted text-muted-foreground border-transparent'
                          )}
                        >
                          {n}d
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Difficulty selector */}
              <HabitDifficultySelector value={difficulty} onChange={setDifficulty} />

              {/* Track Quantity */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-semibold block">Track Quantity</label>
                    <span className="text-xs text-muted-foreground">For countable habits like water, steps, reading pages.</span>
                  </div>
                  <Checkbox
                    id="is-quantitative"
                    checked={isQuantitative}
                    onCheckedChange={(checked) => setIsQuantitative(!!checked)}
                    className="h-5 w-5"
                  />
                </div>

                <AnimatePresence>
                  {isQuantitative && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <label htmlFor="target-value" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                            Target Value
                          </label>
                          <Input
                            id="target-value"
                            type="number"
                            min={1}
                            value={targetValue}
                            onChange={(e) => setTargetValue(Math.max(1, parseInt(e.target.value) || 0))}
                            className="bg-muted/50 border-border"
                          />
                        </div>
                        <div>
                          <label htmlFor="unit" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                            Unit
                          </label>
                          <Input
                            id="unit"
                            type="text"
                            placeholder="e.g. glasses, steps, mins"
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            className="bg-muted/50 border-border"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Cross-Domain Auto-Tracking (Fitness & FlowFinance) */}
              <div>
                <label
                  htmlFor="habit-auto-track-rule"
                  className="text-sm font-medium mb-1.5 block"
                >
                  Auto-Track Rule (Fitness &amp; FlowFinance)
                </label>
                <select
                  id="habit-auto-track-rule"
                  value={autoTrackRule}
                  onChange={(e) => setAutoTrackRule(e.target.value as AutoTrackHabitRule)}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="none">Manual check-in only</option>
                  <optgroup label="Body & Fitness">
                    <option value="workout_logged">Auto-tick when a workout is logged</option>
                    <option value="steps_target">Auto-tick when daily steps goal is hit</option>
                    <option value="sleep_target">Auto-tick when sleep target is met</option>
                    <option value="protein_target_met">Auto-tick when protein target is met</option>
                    <option value="supplements_taken_today">Auto-tick when active supplements are taken</option>
                    <option value="zero_junk_today">Auto-reverse if any Junk Food meal or expense is logged</option>
                  </optgroup>
                  <optgroup label="FlowFinance">
                    <option value="log_expense_today">Auto-tick when I log an expense today</option>
                    <option value="under_daily_safe_spend">Auto-tick when under Daily Safe-to-Spend</option>
                    <option value="no_spend_day">Auto-tick on No-Spend Days</option>
                    <option value="sip_completed_month">Auto-tick when monthly SIP is invested</option>
                  </optgroup>
                </select>
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
                        {/* Habit Stacking */}
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
                            {habits
                              .filter((h) => !h.archived && (!habit || h.id !== habit.id))
                              .map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.icon || '🎯'} {h.name}
                                </option>
                              ))}
                          </select>
                          {stackAfterHabitId && (
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
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
