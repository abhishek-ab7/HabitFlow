'use client';

import { useEffect, useState } from 'react';
import type {
  AutoTrackHabitRule,
  Category,
  Habit,
  HabitAnchorBlock,
  HabitFormData,
  HabitFrequencyType,
  HabitPolarity,
} from '@/lib/types';
import { useFeedback } from '@/hooks/use-feedback';
import type { TemplateHabit } from '../HabitTemplates';
import { buildHabitFormPayload, getInitialHabitValues } from '@/lib/habits/habit-form-helpers';

export function useHabitFormController({
  open,
  habit,
  defaultTab,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  habit?: Habit;
  defaultTab?: 'details' | 'templates';
  onSubmit: (data: HabitFormData) => void;
  onOpenChange: (open: boolean) => void;
}) {
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
  const feedback = useFeedback();

  useEffect(() => {
    if (!open) return;
    setActiveTab(defaultTab || 'details');
    Promise.resolve().then(() => {
      const init = getInitialHabitValues(habit);
      setName(init.name);
      setCategory(init.category);
      setFrequencyType(init.frequencyType);
      setTargetDays(init.targetDays);
      setScheduledDays(init.scheduledDays);
      setIntervalDays(init.intervalDays);
      setAutoTrackRule(init.autoTrackRule);
      setPolarity(init.polarity);
      setAnchorBlock(init.anchorBlock);
      setIcon(init.icon);
      setIsQuantitative(init.isQuantitative);
      setTargetValue(init.targetValue);
      setUnit(init.unit);
      setDifficulty(init.difficulty);
      setStackAfterHabitId(init.stackAfterHabitId);
      setShowAdvanced(init.showAdvanced);
      setErrors({});
    });
  }, [open, habit, defaultTab]);

  const handleSelectTemplate = (template: TemplateHabit) => {
    feedback.tap();
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
    if (!name.trim()) {
      feedback.error();
      setErrors({ name: 'Habit name is required' });
      setActiveTab('details');
      return;
    }
    feedback.success();
    onSubmit(
      buildHabitFormPayload({
        name, category, frequencyType, scheduledDays, intervalDays, targetDays,
        autoTrackRule, polarity, anchorBlock, icon, isQuantitative, targetValue, unit,
        difficulty, stackAfterHabitId, existingMetadata: habit?.metadata,
      })
    );
    onOpenChange(false);
  };

  return {
    activeTab, setActiveTab, name, setName, category, setCategory,
    frequencyType, setFrequencyType, targetDays, setTargetDays,
    scheduledDays, setScheduledDays, intervalDays, setIntervalDays,
    autoTrackRule, setAutoTrackRule, polarity, setPolarity,
    anchorBlock, setAnchorBlock, icon, setIcon,
    isQuantitative, setIsQuantitative, targetValue, setTargetValue,
    unit, setUnit, difficulty, setDifficulty, errors, setErrors,
    showAdvanced, setShowAdvanced, showAllIcons, setShowAllIcons,
    stackAfterHabitId, setStackAfterHabitId,
    handleSelectTemplate, handleSubmit,
  };
}
