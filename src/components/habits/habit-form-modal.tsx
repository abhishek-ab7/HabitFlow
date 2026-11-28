'use client';

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
import { cn } from '@/lib/utils';
import type { Habit, HabitFormData } from '@/lib/types';
import { useHabitStore } from '@/lib/stores/habit-store';
import { HabitTemplates } from './HabitTemplates';
import { HabitDifficultySelector } from './HabitDifficultySelector';
import { useHabitFormController } from './form/useHabitFormController';
import {
  HabitAutoTrackSelect,
  HabitCategorySelector,
  HabitIconPicker,
  HabitQuantitySection,
} from './form/HabitCoreFields';
import { HabitScheduleSection } from './form/HabitScheduleSection';
import {
  HabitAdvancedStackingSection,
  HabitPolarityAndAnchorFields,
} from './form/HabitQuitModeSection';

interface HabitFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: HabitFormData) => void;
  habit?: Habit;
  defaultTab?: 'details' | 'templates';
}

function HabitFormDetailsBody({
  f,
  habits,
  currentHabitId,
  isEditing,
  onCancel,
}: {
  f: ReturnType<typeof useHabitFormController>;
  habits: Habit[];
  currentHabitId?: string;
  isEditing: boolean;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={f.handleSubmit}>
      <div className="space-y-6 py-6">
        <HabitIconPicker icon={f.icon} setIcon={f.setIcon} showAllIcons={f.showAllIcons} setShowAllIcons={f.setShowAllIcons} />

        <div>
          <label htmlFor="habit-name" className="text-sm font-medium mb-2 block">Habit Name</label>
          <Input
            id="habit-name"
            value={f.name}
            onChange={(e) => {
              f.setName(e.target.value);
              if (f.errors.name) f.setErrors({});
            }}
            placeholder="e.g., Morning Meditation"
            className={cn(f.errors.name && 'border-destructive')}
            autoFocus
          />
          {f.errors.name && <p className="text-sm text-destructive mt-1">{f.errors.name}</p>}
        </div>

        <HabitCategorySelector category={f.category} setCategory={f.setCategory} />
        <HabitPolarityAndAnchorFields polarity={f.polarity} setPolarity={f.setPolarity} anchorBlock={f.anchorBlock} setAnchorBlock={f.setAnchorBlock} />
        <HabitScheduleSection
          frequencyType={f.frequencyType}
          setFrequencyType={f.setFrequencyType}
          targetDays={f.targetDays}
          setTargetDays={f.setTargetDays}
          scheduledDays={f.scheduledDays}
          setScheduledDays={f.setScheduledDays}
          intervalDays={f.intervalDays}
          setIntervalDays={f.setIntervalDays}
        />
        <HabitDifficultySelector value={f.difficulty} onChange={f.setDifficulty} />
        <HabitQuantitySection
          isQuantitative={f.isQuantitative}
          setIsQuantitative={f.setIsQuantitative}
          targetValue={f.targetValue}
          setTargetValue={f.setTargetValue}
          unit={f.unit}
          setUnit={f.setUnit}
        />
        <HabitAutoTrackSelect value={f.autoTrackRule} onChange={f.setAutoTrackRule} />
        <HabitAdvancedStackingSection
          showAdvanced={f.showAdvanced}
          setShowAdvanced={f.setShowAdvanced}
          stackAfterHabitId={f.stackAfterHabitId}
          setStackAfterHabitId={f.setStackAfterHabitId}
          habits={habits}
          currentHabitId={currentHabitId}
          name={f.name}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{isEditing ? 'Save Changes' : 'Create Habit'}</Button>
      </DialogFooter>
    </form>
  );
}

export function HabitFormModal({
  open,
  onOpenChange,
  onSubmit,
  habit,
  defaultTab,
}: HabitFormModalProps) {
  const { habits } = useHabitStore();
  const isEditing = !!habit;
  const f = useHabitFormController({ open, habit, defaultTab, onSubmit, onOpenChange });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Habit' : 'Create New Habit'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update your habit details below.' : 'Define a new habit to track daily.'}
          </DialogDescription>
        </DialogHeader>

        {!isEditing && (
          <div className="flex border-b mb-6 relative">
            {(['details', 'templates'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => f.setActiveTab(tab)}
                className={cn(
                  'flex-1 pb-3 text-sm font-semibold transition-colors relative text-center',
                  f.activeTab === tab ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab === 'details' ? 'Details' : 'Browse Templates'}
              </button>
            ))}
          </div>
        )}

        {f.activeTab === 'templates' && !isEditing ? (
          <div className="py-4">
            <HabitTemplates onSelect={f.handleSelectTemplate} />
          </div>
        ) : (
          <HabitFormDetailsBody
            f={f}
            habits={habits}
            currentHabitId={habit?.id}
            isEditing={isEditing}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
