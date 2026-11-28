'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { AutoTrackHabitRule, Category } from '@/lib/types';
import { CATEGORIES, CATEGORY_COLORS, COMMON_EMOJIS } from '@/lib/habits/habit-form-helpers';

export function HabitIconPicker({
  icon,
  setIcon,
  showAllIcons,
  setShowAllIcons,
}: {
  icon: string;
  setIcon: (v: string) => void;
  showAllIcons: boolean;
  setShowAllIcons: (v: boolean) => void;
}) {
  return (
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
              'w-10 h-10 rounded-lg text-lg flex items-center justify-center border-2 transition-colors',
              icon === emoji ? 'border-primary bg-primary/10' : 'border-transparent bg-muted hover:bg-muted/80'
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
  );
}

export function HabitCategorySelector({
  category,
  setCategory,
}: {
  category: Category;
  setCategory: (c: Category) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium mb-2 block">Category</label>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setCategory(cat.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
              category === cat.value ? CATEGORY_COLORS[cat.value] : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
            )}
          >
            <span className="mr-1">{cat.emoji}</span>
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function HabitQuantitySection({
  isQuantitative,
  setIsQuantitative,
  targetValue,
  setTargetValue,
  unit,
  setUnit,
}: {
  isQuantitative: boolean;
  setIsQuantitative: (v: boolean) => void;
  targetValue: number;
  setTargetValue: (v: number) => void;
  unit: string;
  setUnit: (v: string) => void;
}) {
  return (
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
  );
}

export function HabitAutoTrackSelect({
  value,
  onChange,
}: {
  value: AutoTrackHabitRule;
  onChange: (rule: AutoTrackHabitRule) => void;
}) {
  return (
    <div>
      <label htmlFor="habit-auto-track-rule" className="text-sm font-medium mb-1.5 block">
        Auto-Track Rule (Fitness &amp; FlowFinance)
      </label>
      <select
        id="habit-auto-track-rule"
        value={value}
        onChange={(e) => onChange(e.target.value as AutoTrackHabitRule)}
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
  );
}
