'use client';

import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { X, Plus, Trash2, Star, Landmark, PiggyBank, ArrowDownRight, TrendingUp } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Goal, GoalFormData, AreaOfLife, Priority, FinancialGoalLink, FinancialGoalLinkType } from '@/lib/types';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { GOAL_TEMPLATES } from '@/lib/goal-templates';

interface GoalFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: GoalFormData) => void;
  goal?: Goal;
  existingMilestones?: string[]; // Existing milestone titles for editing
}

const AREAS: { value: AreaOfLife; label: string; emoji: string }[] = [
  { value: 'career', label: 'Career', emoji: '💼' },
  { value: 'health', label: 'Health', emoji: '💪' },
  { value: 'relationships', label: 'Relationships', emoji: '❤️' },
  { value: 'personal_growth', label: 'Personal Growth', emoji: '🌱' },
  { value: 'finance', label: 'Finance', emoji: '💰' },
  { value: 'fun', label: 'Fun & Recreation', emoji: '🎉' },
];

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'high', label: 'High', color: 'bg-destructive/20 text-destructive border-destructive/30' },
  { value: 'medium', label: 'Medium', color: 'bg-warning/20 text-warning border-warning/30' },
  { value: 'low', label: 'Low', color: 'bg-muted text-muted-foreground border-muted' },
];

export function GoalFormModal({
  open,
  onOpenChange,
  onSubmit,
  goal,
  existingMilestones = [],
}: GoalFormModalProps) {
  const { accounts, debtRecords, emiTrackers, sipPlans, getNetWorthSummary } = useFinanceStore();
  const netWorthSummary = getNetWorthSummary();

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

  // Financial Link state
  const [enableFinancialLink, setEnableFinancialLink] = useState(false);
  const [financialLinkType, setFinancialLinkType] = useState<FinancialGoalLinkType>('savings_target');
  const [financialTargetAmount, setFinancialTargetAmount] = useState('');
  const [financialStartingAmount, setFinancialStartingAmount] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const [selectedSipIds, setSelectedSipIds] = useState<string[]>([]);

  const isEditing = !!goal;

  // Reset form when opening or goal changes
  useEffect(() => {
    if (open) {
      setActiveTab('details');
      Promise.resolve().then(() => {
        if (goal) {
          setTitle(goal.title);
          setDescription(goal.description || '');
          setAreaOfLife(goal.areaOfLife);
          setPriority(goal.priority);
          setStartDate(format(new Date(goal.startDate), 'yyyy-MM-dd'));
          setDeadline(format(new Date(goal.deadline), 'yyyy-MM-dd'));
          setMilestones(existingMilestones.length > 0 ? existingMilestones : ['']);
          setIsFocus(goal.isFocus);
          if (goal.financialLink) {
            setEnableFinancialLink(true);
            setFinancialLinkType(goal.financialLink.type);
            setFinancialTargetAmount(String(goal.financialLink.targetAmount || ''));
            setFinancialStartingAmount(goal.financialLink.startingAmount !== undefined ? String(goal.financialLink.startingAmount) : '');
            setSelectedAccountIds(goal.financialLink.linkedAccountIds || []);
            setSelectedDebtIds(goal.financialLink.linkedDebtIds || []);
            setSelectedSipIds(goal.financialLink.linkedSipIds || []);
          } else {
            setEnableFinancialLink(goal.areaOfLife === 'finance');
            setFinancialLinkType('savings_target');
            setFinancialTargetAmount('');
            setFinancialStartingAmount('');
            setSelectedAccountIds([]);
            setSelectedDebtIds([]);
            setSelectedSipIds([]);
          }
        } else {
          setTitle('');
          setDescription('');
          setAreaOfLife('personal_growth');
          setPriority('medium');
          setStartDate(format(new Date(), 'yyyy-MM-dd'));
          setDeadline(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
          setMilestones(['']);
          setIsFocus(false);
          setEnableFinancialLink(false);
          setFinancialLinkType('savings_target');
          setFinancialTargetAmount('');
          setFinancialStartingAmount('');
          setSelectedAccountIds([]);
          setSelectedDebtIds([]);
          setSelectedSipIds([]);
        }
        setErrors({});
      });
    }
  }, [open, goal]);

  const handleSelectTemplate = (template: typeof GOAL_TEMPLATES[number]) => {
    setTitle(template.title);
    setDescription(template.description);
    setAreaOfLife(template.areaOfLife);
    setPriority(template.priority);
    const today = new Date();
    setStartDate(format(today, 'yyyy-MM-dd'));
    setDeadline(format(addDays(today, template.durationDays), 'yyyy-MM-dd'));
    setMilestones(template.milestones.length > 0 ? template.milestones : ['']);
    setIsFocus(false);
    setActiveTab('details');
  };

  const handleAddMilestone = () => {
    setMilestones([...milestones, '']);
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleMilestoneChange = (index: number, value: string) => {
    const updated = [...milestones];
    updated[index] = value;
    setMilestones(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: typeof errors = {};
    if (!title.trim()) {
      newErrors.title = 'Goal title is required';
    }
    if (!deadline || new Date(deadline) < new Date(startDate)) {
      newErrors.deadline = 'Deadline must be after start date';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    let financialLink: FinancialGoalLink | undefined = undefined;
    if (enableFinancialLink && Number(financialTargetAmount) > 0) {
      financialLink = {
        type: financialLinkType,
        targetAmount: Math.max(0, Number(financialTargetAmount) || 0),
        startingAmount: financialStartingAmount ? Number(financialStartingAmount) : undefined,
        linkedAccountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
        linkedDebtIds: selectedDebtIds.length > 0 ? selectedDebtIds : undefined,
        linkedSipIds: selectedSipIds.length > 0 ? selectedSipIds : undefined,
      };
    }

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      areaOfLife,
      priority,
      startDate,
      deadline,
      milestones: milestones.filter(m => m.trim() !== ''),
      isFocus,
      financialLink,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(activeTab === 'templates' && !isEditing ? "sm:max-w-2xl" : "sm:max-w-lg", "max-h-[90vh] overflow-y-auto transition-all duration-200")}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update your goal details.'
                : 'Define a meaningful goal with milestones to track your progress.'}
            </DialogDescription>
          </DialogHeader>

          {!isEditing && (
            <div className="flex border-b border-border/40 mb-4 mt-4">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={cn(
                  "flex-1 py-2 text-sm font-semibold border-b-2 transition-all outline-none",
                  activeTab === 'details'
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className={cn(
                  "flex-1 py-2 text-sm font-semibold border-b-2 transition-all outline-none",
                  activeTab === 'templates'
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Browse Starter Packs
              </button>
            </div>
          )}

          {activeTab === 'templates' && !isEditing ? (
            <div className="py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {GOAL_TEMPLATES.map((tmpl, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectTemplate(tmpl)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectTemplate(tmpl);
                      }
                    }}
                    className="p-4 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/70 hover:border-border/80 transition-all cursor-pointer flex flex-col justify-between text-left group outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-semibold capitalize px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {tmpl.areaOfLife.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {tmpl.durationDays} days
                        </span>
                      </div>
                      <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">
                        {tmpl.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {tmpl.description}
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-border/20 flex flex-wrap gap-1">
                      {tmpl.milestones.slice(0, 2).map((m, mIdx) => (
                        <span key={mIdx} className="text-[10px] bg-background border rounded px-1.5 py-0.5 text-muted-foreground truncate max-w-[120px]">
                          {m}
                        </span>
                      ))}
                      {tmpl.milestones.length > 2 && (
                        <span className="text-[10px] text-muted-foreground px-1 py-0.5 font-medium">
                          +{tmpl.milestones.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Title */}
              <div>
                <label htmlFor="goal-title" className="text-sm font-medium mb-2 block">
                  Goal Title *
                </label>
                <Input
                  id="goal-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) setErrors({ ...errors, title: undefined });
                  }}
                  placeholder="e.g., Launch my side project"
                  className={cn(errors.title && "border-destructive")}
                  autoFocus
                />
                {errors.title && (
                  <p className="text-sm text-destructive mt-1">{errors.title}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="goal-description" className="text-sm font-medium mb-2 block">
                  Description (optional)
                </label>
                <Textarea
                  id="goal-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does achieving this goal mean to you?"
                  rows={2}
                />
              </div>

              {/* Area of Life */}
              <div>
                <label className="text-sm font-medium mb-2 block">Area of Life</label>
                <div className="flex flex-wrap gap-2">
                  {AREAS.map((area) => (
                    <button
                      key={area.value}
                      type="button"
                      onClick={() => {
                        setAreaOfLife(area.value);
                        if (area.value === 'finance' && !enableFinancialLink) {
                          setEnableFinancialLink(true);
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                        areaOfLife === area.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                      )}
                    >
                      <span className="mr-1">{area.emoji}</span>
                      {area.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <div className="flex gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all",
                        priority === p.value ? p.color : "bg-muted/50 text-muted-foreground border-transparent"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start-date" className="text-sm font-medium mb-2 block">
                    Start Date
                  </label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="deadline" className="text-sm font-medium mb-2 block">
                    Deadline *
                  </label>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => {
                      setDeadline(e.target.value);
                      if (errors.deadline) setErrors({ ...errors, deadline: undefined });
                    }}
                    className={cn(errors.deadline && "border-destructive")}
                  />
                  {errors.deadline && (
                    <p className="text-sm text-destructive mt-1">{errors.deadline}</p>
                  )}
                </div>
              </div>

              {/* Focus Goal Option */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-focus"
                  checked={isFocus}
                  onCheckedChange={(checked) => setIsFocus(checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="is-focus"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1.5"
                  >
                    <Star className="h-4 w-4 text-primary" />
                    Set as Focus Goal
                  </label>
                  <p className="text-xs text-muted-foreground">
                    This goal will be pinned to your dashboard.
                  </p>
                </div>
              </div>

              {/* Financial Link Section */}
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
                      <Landmark className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <label htmlFor="enable-fin-link" className="text-sm font-semibold text-foreground cursor-pointer">
                          Live Financial Balance Link
                        </label>
                        <Badge variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10 text-[10px] px-1.5 py-0 font-medium">
                          Life OS Link
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Automatically sync monetary progress with live bank balances, debt payoff, or SIPs
                      </p>
                    </div>
                  </div>
                  <Checkbox
                    id="enable-fin-link"
                    checked={enableFinancialLink}
                    onCheckedChange={(c) => setEnableFinancialLink(!!c)}
                  />
                </div>

                {enableFinancialLink && (
                  <div className="space-y-4 pt-2 border-t border-sky-500/20">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                        Financial Metric Type
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: 'savings_target' as const, label: 'Savings Target', icon: PiggyBank, desc: 'Bank & Emergency Fund' },
                          { id: 'debt_payoff' as const, label: 'Debt Payoff', icon: ArrowDownRight, desc: 'Clear Loans & EMIs' },
                          { id: 'sip_corpus' as const, label: 'SIP Portfolio', icon: TrendingUp, desc: 'Mutual Funds / Wealth' },
                          { id: 'net_worth' as const, label: 'Net Worth', icon: Landmark, desc: 'Assets minus Debts' },
                        ].map((m) => {
                          const Icon = m.icon;
                          const isSel = financialLinkType === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setFinancialLinkType(m.id)}
                              className={cn(
                                "p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all text-xs",
                                isSel
                                  ? "border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500"
                                  : "border-border/60 bg-background/50 hover:bg-muted text-muted-foreground"
                              )}
                            >
                              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                <Icon className="h-3.5 w-3.5 text-sky-500" />
                                <span>{m.label}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{m.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          Target Amount (₹) *
                        </label>
                        <Input
                          type="number"
                          placeholder="e.g. 100000"
                          value={financialTargetAmount}
                          onChange={(e) => setFinancialTargetAmount(e.target.value)}
                          className="font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          Starting / Baseline Amount (₹)
                        </label>
                        <Input
                          type="number"
                          placeholder="e.g. 10000 (optional)"
                          value={financialStartingAmount}
                          onChange={(e) => setFinancialStartingAmount(e.target.value)}
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>

                    {/* Contextual account / item selector */}
                    {financialLinkType === 'savings_target' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground block">
                          Link Specific Accounts (optional)
                        </label>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                          {accounts.filter(a => a.type !== 'credit_card').map(acc => {
                            const isChecked = selectedAccountIds.includes(acc.id);
                            return (
                              <button
                                key={acc.id}
                                type="button"
                                onClick={() => {
                                  setSelectedAccountIds(prev =>
                                    isChecked ? prev.filter(id => id !== acc.id) : [...prev, acc.id]
                                  );
                                }}
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-xs border font-medium transition-all flex items-center gap-1.5",
                                  isChecked
                                    ? "bg-sky-500 text-white border-sky-600"
                                    : "bg-background border-border/60 text-muted-foreground hover:bg-muted"
                                )}
                              >
                                <span>{acc.name}</span>
                                <span className="font-mono text-[10px] opacity-80">{formatINR(acc.balance)}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {selectedAccountIds.length === 0 ? "Tracking all non-credit accounts combined." : `Tracking ${selectedAccountIds.length} selected account(s).`}
                        </p>
                      </div>
                    )}

                    {financialLinkType === 'debt_payoff' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground block">
                          Link Specific Debts / EMIs (optional)
                        </label>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                          {[...debtRecords.map(d => ({ id: d.id, name: d.title || d.personName, amount: d.remainingAmount })),
                            ...emiTrackers.map(e => ({ id: e.id, name: e.loanName, amount: Math.max(0, (e.tenureMonths - e.paidMonths) * e.emiAmount) }))].map(d => {
                            const isChecked = selectedDebtIds.includes(d.id);
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                  setSelectedDebtIds(prev =>
                                    isChecked ? prev.filter(id => id !== d.id) : [...prev, d.id]
                                  );
                                }}
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-xs border font-medium transition-all flex items-center gap-1.5",
                                  isChecked
                                    ? "bg-rose-500 text-white border-rose-600"
                                    : "bg-background border-border/60 text-muted-foreground hover:bg-muted"
                                )}
                              >
                                <span>{d.name}</span>
                                <span className="font-mono text-[10px] opacity-80">{formatINR(d.amount)}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {selectedDebtIds.length === 0 ? "Tracking all active debts & EMIs combined." : `Tracking ${selectedDebtIds.length} selected debt item(s).`}
                        </p>
                      </div>
                    )}

                    {financialLinkType === 'sip_corpus' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground block">
                          Link Specific SIP Portfolios (optional)
                        </label>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                          {sipPlans.map(sip => {
                            const isChecked = selectedSipIds.includes(sip.id);
                            return (
                              <button
                                key={sip.id}
                                type="button"
                                onClick={() => {
                                  setSelectedSipIds(prev =>
                                    isChecked ? prev.filter(id => id !== sip.id) : [...prev, sip.id]
                                  );
                                }}
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-xs border font-medium transition-all flex items-center gap-1.5",
                                  isChecked
                                    ? "bg-invest text-white border-invest"
                                    : "bg-background border-border/60 text-muted-foreground hover:bg-muted"
                                )}
                              >
                                <span>{sip.name}</span>
                                <span className="font-mono text-[10px] opacity-80">{formatINR(sip.currentValue || sip.totalInvested)}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {selectedSipIds.length === 0 ? "Tracking all active SIP investment portfolios." : `Tracking ${selectedSipIds.length} selected SIP(s).`}
                        </p>
                      </div>
                    )}

                    {financialLinkType === 'net_worth' && (
                      <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs flex items-center justify-between">
                        <span className="text-muted-foreground">Current Live Net Worth:</span>
                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                          {formatINR(netWorthSummary.netWorth)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Milestones */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Milestones (optional)
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  Break down your goal into smaller, achievable steps.
                </p>
                <div className="space-y-2">
                  {milestones.map((milestone, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={milestone}
                        onChange={(e) => handleMilestoneChange(index, e.target.value)}
                        placeholder={`Milestone ${index + 1}`}
                      />
                      {milestones.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMilestone(index)}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddMilestone}
                    className="w-full gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add Milestone
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            {(activeTab === 'details' || isEditing) && (
              <Button type="submit">
                {isEditing ? 'Save Changes' : 'Create Goal'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
