'use client';

import { Star } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { AreaOfLife, Goal, GoalFormData, Priority } from '@/lib/types';
import { AREAS, PRIORITIES } from './form/goal-form-helpers';
import { useGoalFormController } from './form/useGoalFormController';
import { GoalTemplatesTab } from './form/GoalTemplatesTab';
import { GoalFinancialLinkSection } from './form/GoalFinancialLinkSection';
import { GoalFitnessLinkSection } from './form/GoalFitnessLinkSection';
import { GoalMilestonesEditor } from './form/GoalMilestonesEditor';

interface GoalFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: GoalFormData) => void;
  goal?: Goal;
  existingMilestones?: string[];
}

function GoalFormTabs({ activeTab, setActiveTab }: { activeTab: 'details' | 'templates'; setActiveTab: React.Dispatch<React.SetStateAction<'details' | 'templates'>> }) {
  return (
    <div className="flex border-b border-border/40 mb-4 mt-4">
      {(['details', 'templates'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => setActiveTab(tab)}
          className={cn(
            'flex-1 py-2 text-sm font-semibold border-b-2 transition-all outline-none',
            activeTab === tab ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {tab === 'details' ? 'Details' : 'Browse Starter Packs'}
        </button>
      ))}
    </div>
  );
}

function GoalCoreFields(params: {
  title: string;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  description: string;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  areaOfLife: AreaOfLife;
  onSelectArea: (area: AreaOfLife) => void;
  priority: Priority;
  setPriority: React.Dispatch<React.SetStateAction<Priority>>;
  startDate: string;
  setStartDate: React.Dispatch<React.SetStateAction<string>>;
  deadline: string;
  setDeadline: React.Dispatch<React.SetStateAction<string>>;
  isFocus: boolean;
  setIsFocus: React.Dispatch<React.SetStateAction<boolean>>;
  errors: { title?: string; deadline?: string };
  setErrors: React.Dispatch<React.SetStateAction<{ title?: string; deadline?: string }>>;
}) {
  return (
    <>
      <div>
        <label htmlFor="goal-title" className="text-sm font-medium mb-2 block">Goal Title *</label>
        <Input
          id="goal-title"
          value={params.title}
          onChange={(e) => {
            params.setTitle(e.target.value);
            if (params.errors.title) params.setErrors({ ...params.errors, title: undefined });
          }}
          placeholder="e.g., Launch my side project"
          className={cn(params.errors.title && 'border-destructive')}
          autoFocus
        />
        {params.errors.title && <p className="text-sm text-destructive mt-1">{params.errors.title}</p>}
      </div>

      <div>
        <label htmlFor="goal-description" className="text-sm font-medium mb-2 block">Description (optional)</label>
        <Textarea id="goal-description" value={params.description} onChange={(e) => params.setDescription(e.target.value)} placeholder="What does achieving this goal mean to you?" rows={2} />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Area of Life</label>
        <div className="flex flex-wrap gap-2">
          {AREAS.map((area) => (
            <button
              key={area.value}
              type="button"
              onClick={() => params.onSelectArea(area.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                params.areaOfLife === area.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
              )}
            >
              <span className="mr-1">{area.emoji}</span>{area.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Priority</label>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => params.setPriority(p.value)}
              className={cn('flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all', params.priority === p.value ? p.color : 'bg-muted/50 text-muted-foreground border-transparent')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="start-date" className="text-sm font-medium mb-2 block">Start Date</label>
          <Input id="start-date" type="date" value={params.startDate} onChange={(e) => params.setStartDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="deadline" className="text-sm font-medium mb-2 block">Deadline *</label>
          <Input
            id="deadline"
            type="date"
            value={params.deadline}
            onChange={(e) => {
              params.setDeadline(e.target.value);
              if (params.errors.deadline) params.setErrors({ ...params.errors, deadline: undefined });
            }}
            className={cn(params.errors.deadline && 'border-destructive')}
          />
          {params.errors.deadline && <p className="text-sm text-destructive mt-1">{params.errors.deadline}</p>}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox id="is-focus" checked={params.isFocus} onCheckedChange={(checked) => params.setIsFocus(Boolean(checked))} />
        <div className="grid gap-1.5 leading-none">
          <label htmlFor="is-focus" className="text-sm font-medium leading-none cursor-pointer flex items-center gap-1.5">
            <Star className="h-4 w-4 text-primary" /> Set as Focus Goal
          </label>
          <p className="text-xs text-muted-foreground">This goal will be pinned to your dashboard.</p>
        </div>
      </div>
    </>
  );
}

function GoalFormDetailsBody({ vm }: { vm: ReturnType<typeof useGoalFormController> }) {
  return (
    <div className="space-y-6 py-4">
      <GoalCoreFields
        title={vm.title}
        setTitle={vm.setTitle}
        description={vm.description}
        setDescription={vm.setDescription}
        areaOfLife={vm.areaOfLife}
        onSelectArea={(area) => {
          vm.setAreaOfLife(area);
          if (area === 'finance' && !vm.enableFinancialLink) vm.setEnableFinancialLink(true);
        }}
        priority={vm.priority}
        setPriority={vm.setPriority}
        startDate={vm.startDate}
        setStartDate={vm.setStartDate}
        deadline={vm.deadline}
        setDeadline={vm.setDeadline}
        isFocus={vm.isFocus}
        setIsFocus={vm.setIsFocus}
        errors={vm.errors}
        setErrors={vm.setErrors}
      />

      <GoalFinancialLinkSection
        enabled={vm.enableFinancialLink}
        setEnabled={vm.setEnableFinancialLink}
        financialLinkType={vm.financialLinkType}
        setFinancialLinkType={vm.setFinancialLinkType}
        financialTargetAmount={vm.financialTargetAmount}
        setFinancialTargetAmount={vm.setFinancialTargetAmount}
        financialStartingAmount={vm.financialStartingAmount}
        setFinancialStartingAmount={vm.setFinancialStartingAmount}
        selectedAccountIds={vm.selectedAccountIds}
        setSelectedAccountIds={vm.setSelectedAccountIds}
        selectedDebtIds={vm.selectedDebtIds}
        setSelectedDebtIds={vm.setSelectedDebtIds}
        selectedSipIds={vm.selectedSipIds}
        setSelectedSipIds={vm.setSelectedSipIds}
        accounts={vm.accounts}
        debtRecords={vm.debtRecords}
        emiTrackers={vm.emiTrackers}
        sipPlans={vm.sipPlans}
        netWorth={vm.netWorth}
      />

      {vm.isFitnessEnabled && (
        <GoalFitnessLinkSection
          enabled={vm.enableFitnessLink}
          setEnabled={vm.setEnableFitnessLink}
          fitnessLinkType={vm.fitnessLinkType}
          setFitnessLinkType={vm.setFitnessLinkType}
          fitnessTargetValue={vm.fitnessTargetValue}
          setFitnessTargetValue={vm.setFitnessTargetValue}
          fitnessStartingValue={vm.fitnessStartingValue}
          setFitnessStartingValue={vm.setFitnessStartingValue}
          fitnessProfile={vm.fitnessProfile}
          fitnessDailyLogs={vm.fitnessDailyLogs}
        />
      )}

      <GoalMilestonesEditor
        milestones={vm.milestones}
        onAdd={() => vm.setMilestones((prev) => [...prev, ''])}
        onRemove={(idx) => vm.setMilestones((prev) => prev.filter((_, i) => i !== idx))}
        onChange={(idx, val) => vm.setMilestones((prev) => prev.map((m, i) => (i === idx ? val : m)))}
      />
    </div>
  );
}

function GoalFormDialogBody({ vm }: { vm: ReturnType<typeof useGoalFormController> }) {
  if (vm.activeTab === 'templates' && !vm.isEditing) {
    return <GoalTemplatesTab onSelectTemplate={vm.handleSelectTemplate} />;
  }
  return <GoalFormDetailsBody vm={vm} />;
}

export function GoalFormModal({ open, onOpenChange, onSubmit, goal, existingMilestones = [] }: GoalFormModalProps) {
  const vm = useGoalFormController({ open, onOpenChange, onSubmit, goal, existingMilestones });
  const isWide = vm.activeTab === 'templates' && !vm.isEditing;
  const showSubmit = vm.activeTab === 'details' || vm.isEditing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(isWide ? 'sm:max-w-2xl' : 'sm:max-w-lg', 'max-h-[90vh] overflow-y-auto transition-all duration-200')}>
        <form onSubmit={vm.handleSubmit}>
          <DialogHeader>
            <DialogTitle>{vm.isEditing ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
            <DialogDescription>
              {vm.isEditing ? 'Update your goal details.' : 'Define a meaningful goal with milestones to track your progress.'}
            </DialogDescription>
          </DialogHeader>

          {!vm.isEditing && <GoalFormTabs activeTab={vm.activeTab} setActiveTab={vm.setActiveTab} />}
          <GoalFormDialogBody vm={vm} />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            {showSubmit && <Button type="submit">{vm.isEditing ? 'Save Changes' : 'Create Goal'}</Button>}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
