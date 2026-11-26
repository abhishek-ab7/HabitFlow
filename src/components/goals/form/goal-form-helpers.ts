import { format, addDays } from 'date-fns';
import {
  ArrowDownRight, Dumbbell, Footprints, Landmark, PiggyBank, Ruler, Scale, TrendingUp, type LucideIcon,
} from 'lucide-react';
import type {
  AreaOfLife, FinancialGoalLink, FinancialGoalLinkType, FitnessGoalLink, FitnessGoalLinkType, Goal, Priority,
} from '@/lib/types';

export const AREAS: { value: AreaOfLife; label: string; emoji: string }[] = [
  { value: 'career', label: 'Career', emoji: '💼' },
  { value: 'health', label: 'Health', emoji: '💪' },
  { value: 'relationships', label: 'Relationships', emoji: '❤️' },
  { value: 'personal_growth', label: 'Personal Growth', emoji: '🌱' },
  { value: 'finance', label: 'Finance', emoji: '💰' },
  { value: 'fun', label: 'Fun & Recreation', emoji: '🎉' },
];

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'high', label: 'High', color: 'bg-destructive/20 text-destructive border-destructive/30' },
  { value: 'medium', label: 'Medium', color: 'bg-warning/20 text-warning border-warning/30' },
  { value: 'low', label: 'Low', color: 'bg-muted text-muted-foreground border-muted' },
];

export const FINANCIAL_LINK_OPTIONS: {
  id: FinancialGoalLinkType;
  label: string;
  icon: LucideIcon;
  desc: string;
}[] = [
  { id: 'savings_target', label: 'Savings Target', icon: PiggyBank, desc: 'Bank & Emergency Fund' },
  { id: 'debt_payoff', label: 'Debt Payoff', icon: ArrowDownRight, desc: 'Clear Loans & EMIs' },
  { id: 'sip_corpus', label: 'SIP Portfolio', icon: TrendingUp, desc: 'Mutual Funds / Wealth' },
  { id: 'net_worth', label: 'Net Worth', icon: Landmark, desc: 'Assets minus Debts' },
];

export const FITNESS_LINK_OPTIONS: {
  id: FitnessGoalLinkType;
  label: string;
  icon: LucideIcon;
  desc: string;
}[] = [
  { id: 'target_weight', label: 'Target Weight', icon: Scale, desc: 'Rolling 7d kg' },
  { id: 'target_waist', label: 'Target Waist', icon: Ruler, desc: 'Weekly inches' },
  { id: 'monthly_workouts', label: 'Monthly Workouts', icon: Dumbbell, desc: 'Gym sessions/mo' },
  { id: 'daily_steps_avg', label: 'Daily Steps Avg', icon: Footprints, desc: '14-day step pace' },
];

const FITNESS_UNIT_MAP: Partial<Record<FitnessGoalLinkType, string>> = {
  target_weight: 'kg',
  target_waist: 'in',
  monthly_workouts: 'workouts',
  daily_steps_avg: 'steps/day',
};

export interface GoalFormInitialValues {
  title: string;
  description: string;
  areaOfLife: AreaOfLife;
  priority: Priority;
  startDate: string;
  deadline: string;
  milestones: string[];
  isFocus: boolean;
  enableFinancialLink: boolean;
  financialLinkType: FinancialGoalLinkType;
  financialTargetAmount: string;
  financialStartingAmount: string;
  selectedAccountIds: string[];
  selectedDebtIds: string[];
  selectedSipIds: string[];
  enableFitnessLink: boolean;
  fitnessLinkType: FitnessGoalLinkType;
  fitnessTargetValue: string;
  fitnessStartingValue: string;
}

function getDefaultGoalFormValues(): GoalFormInitialValues {
  return {
    title: '', description: '', areaOfLife: 'personal_growth', priority: 'medium',
    startDate: format(new Date(), 'yyyy-MM-dd'), deadline: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    milestones: [''], isFocus: false,
    enableFinancialLink: false, financialLinkType: 'savings_target', financialTargetAmount: '', financialStartingAmount: '',
    selectedAccountIds: [], selectedDebtIds: [], selectedSipIds: [],
    enableFitnessLink: false, fitnessLinkType: 'target_weight', fitnessTargetValue: '', fitnessStartingValue: '',
  };
}

function getEditingFinancialIds(fin: Goal['financialLink']) {
  return {
    selectedAccountIds: fin?.linkedAccountIds ?? [],
    selectedDebtIds: fin?.linkedDebtIds ?? [],
    selectedSipIds: fin?.linkedSipIds ?? [],
  };
}

function getEditingFinancialFields(goal: Goal) {
  const fin = goal.financialLink;
  if (!fin) {
    return {
      enableFinancialLink: goal.areaOfLife === 'finance',
      financialLinkType: 'savings_target' as FinancialGoalLinkType,
      financialTargetAmount: '',
      financialStartingAmount: '',
      ...getEditingFinancialIds(undefined),
    };
  }
  return {
    enableFinancialLink: true,
    financialLinkType: fin.type,
    financialTargetAmount: fin.targetAmount ? String(fin.targetAmount) : '',
    financialStartingAmount: fin.startingAmount !== undefined ? String(fin.startingAmount) : '',
    ...getEditingFinancialIds(fin),
  };
}

function getEditingFitnessFields(goal: Goal) {
  const fit = goal.fitnessLink;
  return {
    enableFitnessLink: Boolean(fit),
    fitnessLinkType: fit?.type ?? 'target_weight',
    fitnessTargetValue: fit?.targetValue ? String(fit.targetValue) : '',
    fitnessStartingValue: fit?.startingValue !== undefined ? String(fit.startingValue) : '',
  };
}

export function getInitialGoalFormValues(goal: Goal | undefined, existingMilestones: string[]): GoalFormInitialValues {
  if (!goal) return getDefaultGoalFormValues();
  return {
    title: goal.title,
    description: goal.description || '',
    areaOfLife: goal.areaOfLife,
    priority: goal.priority,
    startDate: format(new Date(goal.startDate), 'yyyy-MM-dd'),
    deadline: format(new Date(goal.deadline), 'yyyy-MM-dd'),
    milestones: existingMilestones.length > 0 ? existingMilestones : [''],
    isFocus: goal.isFocus,
    ...getEditingFinancialFields(goal),
    ...getEditingFitnessFields(goal),
  };
}

export function buildFinancialLinkFromForm(params: {
  enabled: boolean;
  type: FinancialGoalLinkType;
  targetAmount: string;
  startingAmount: string;
  selectedAccountIds: string[];
  selectedDebtIds: string[];
  selectedSipIds: string[];
}): FinancialGoalLink | undefined {
  if (!params.enabled || Number(params.targetAmount) <= 0) return undefined;
  return {
    type: params.type,
    targetAmount: Math.max(0, Number(params.targetAmount) || 0),
    startingAmount: params.startingAmount ? Number(params.startingAmount) : undefined,
    linkedAccountIds: params.selectedAccountIds.length > 0 ? params.selectedAccountIds : undefined,
    linkedDebtIds: params.selectedDebtIds.length > 0 ? params.selectedDebtIds : undefined,
    linkedSipIds: params.selectedSipIds.length > 0 ? params.selectedSipIds : undefined,
  };
}

export function buildFitnessLinkFromForm(params: {
  enabled: boolean;
  type: FitnessGoalLinkType;
  targetValue: string;
  startingValue: string;
}): FitnessGoalLink | undefined {
  if (!params.enabled || Number(params.targetValue) <= 0) return undefined;
  return {
    type: params.type,
    targetValue: Math.max(0, Number(params.targetValue) || 0),
    startingValue: params.startingValue ? Number(params.startingValue) : undefined,
    unit: FITNESS_UNIT_MAP[params.type],
  };
}
