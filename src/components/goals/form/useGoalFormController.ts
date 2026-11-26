'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, addDays } from 'date-fns';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { GOAL_TEMPLATES } from '@/lib/goal-templates';
import type { AreaOfLife, FinancialGoalLinkType, FitnessGoalLinkType, Goal, GoalFormData, Priority } from '@/lib/types';
import {
  buildFinancialLinkFromForm,
  buildFitnessLinkFromForm,
  getInitialGoalFormValues,
} from './goal-form-helpers';

export function useGoalFormController(params: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: GoalFormData) => void;
  goal?: Goal;
  existingMilestones: string[];
}) {
  const { open, onOpenChange, onSubmit, goal, existingMilestones } = params;
  const accounts = useFinanceStore((s) => s.accounts);
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const emiTrackers = useFinanceStore((s) => s.emiTrackers);
  const sipPlans = useFinanceStore((s) => s.sipPlans);
  const getNetWorthSummary = useFinanceStore((s) => s.getNetWorthSummary);
  const netWorthSummary = useMemo(
    () => (open ? getNetWorthSummary() : { netWorth: 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, getNetWorthSummary, accounts, debtRecords, emiTrackers, sipPlans]
  );

  const isFitnessEnabled = isFitnessModuleEnabled(useGamificationStore((s) => s.settings));
  const fitnessProfile = useFitnessStore((s) => s.profile);
  const fitnessDailyLogs = useFitnessStore((s) => s.dailyLogs);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [areaOfLife, setAreaOfLife] = useState<AreaOfLife>('personal_growth');
  const [priority, setPriority] = useState<Priority>('medium');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [milestones, setMilestones] = useState<string[]>(['']);
  const [isFocus, setIsFocus] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; deadline?: string }>({});
  const [activeTab, setActiveTab] = useState<'details' | 'templates'>('details');

  const [enableFinancialLink, setEnableFinancialLink] = useState(false);
  const [financialLinkType, setFinancialLinkType] = useState<FinancialGoalLinkType>('savings_target');
  const [financialTargetAmount, setFinancialTargetAmount] = useState('');
  const [financialStartingAmount, setFinancialStartingAmount] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const [selectedSipIds, setSelectedSipIds] = useState<string[]>([]);

  const [enableFitnessLink, setEnableFitnessLink] = useState(false);
  const [fitnessLinkType, setFitnessLinkType] = useState<FitnessGoalLinkType>('target_weight');
  const [fitnessTargetValue, setFitnessTargetValue] = useState('');
  const [fitnessStartingValue, setFitnessStartingValue] = useState('');

  useEffect(() => {
    if (!open) return;
    setActiveTab('details');
    Promise.resolve().then(() => {
      const init = getInitialGoalFormValues(goal, existingMilestones);
      setTitle(init.title);
      setDescription(init.description);
      setAreaOfLife(init.areaOfLife);
      setPriority(init.priority);
      setStartDate(init.startDate);
      setDeadline(init.deadline);
      setMilestones(init.milestones);
      setIsFocus(init.isFocus);
      setEnableFinancialLink(init.enableFinancialLink);
      setFinancialLinkType(init.financialLinkType);
      setFinancialTargetAmount(init.financialTargetAmount);
      setFinancialStartingAmount(init.financialStartingAmount);
      setSelectedAccountIds(init.selectedAccountIds);
      setSelectedDebtIds(init.selectedDebtIds);
      setSelectedSipIds(init.selectedSipIds);
      setEnableFitnessLink(init.enableFitnessLink);
      setFitnessLinkType(init.fitnessLinkType);
      setFitnessTargetValue(init.fitnessTargetValue);
      setFitnessStartingValue(init.fitnessStartingValue);
      setErrors({});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal]);

  const handleSelectTemplate = (template: (typeof GOAL_TEMPLATES)[number]) => {
    const today = new Date();
    setTitle(template.title);
    setDescription(template.description);
    setAreaOfLife(template.areaOfLife);
    setPriority(template.priority);
    setStartDate(format(today, 'yyyy-MM-dd'));
    setDeadline(format(addDays(today, template.durationDays), 'yyyy-MM-dd'));
    setMilestones(template.milestones.length > 0 ? template.milestones : ['']);
    setIsFocus(false);
    setActiveTab('details');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { title?: string; deadline?: string } = {};
    if (!title.trim()) newErrors.title = 'Goal title is required';
    if (!deadline || new Date(deadline) < new Date(startDate)) newErrors.deadline = 'Deadline must be after start date';
    if (Object.keys(newErrors).length > 0) return void setErrors(newErrors);

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      areaOfLife,
      priority,
      startDate,
      deadline,
      milestones: milestones.filter((m) => m.trim() !== ''),
      isFocus,
      financialLink: buildFinancialLinkFromForm({
        enabled: enableFinancialLink, type: financialLinkType, targetAmount: financialTargetAmount,
        startingAmount: financialStartingAmount, selectedAccountIds, selectedDebtIds, selectedSipIds,
      }),
      fitnessLink: buildFitnessLinkFromForm({
        enabled: enableFitnessLink, type: fitnessLinkType, targetValue: fitnessTargetValue, startingValue: fitnessStartingValue,
      }),
    });
    onOpenChange(false);
  };

  return {
    isEditing: Boolean(goal),
    accounts, debtRecords, emiTrackers, sipPlans, netWorth: netWorthSummary.netWorth,
    isFitnessEnabled, fitnessProfile, fitnessDailyLogs,
    title, setTitle, description, setDescription, areaOfLife, setAreaOfLife, priority, setPriority,
    startDate, setStartDate, deadline, setDeadline, milestones, setMilestones, isFocus, setIsFocus,
    errors, setErrors, activeTab, setActiveTab,
    enableFinancialLink, setEnableFinancialLink, financialLinkType, setFinancialLinkType,
    financialTargetAmount, setFinancialTargetAmount, financialStartingAmount, setFinancialStartingAmount,
    selectedAccountIds, setSelectedAccountIds, selectedDebtIds, setSelectedDebtIds, selectedSipIds, setSelectedSipIds,
    enableFitnessLink, setEnableFitnessLink, fitnessLinkType, setFitnessLinkType,
    fitnessTargetValue, setFitnessTargetValue, fitnessStartingValue, setFitnessStartingValue,
    handleSelectTemplate, handleSubmit,
  };
}
