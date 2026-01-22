'use client';

import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { X, Plus, Trash2, Star } from 'lucide-react';
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
import type { Goal, GoalFormData, AreaOfLife, Priority } from '@/lib/types';

interface GoalFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: GoalFormData) => void;
  goal?: Goal; // If provided, we're editing (no milestones on edit)
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
}: GoalFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [areaOfLife, setAreaOfLife] = useState<AreaOfLife>('personal_growth');
  const [priority, setPriority] = useState<Priority>('medium');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [milestones, setMilestones] = useState<string[]>(['']);
  const [isFocus, setIsFocus] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; deadline?: string }>({});

  const isEditing = !!goal;

  // Reset form when opening or goal changes
  useEffect(() => {
    if (open) {
      if (goal) {
        setTitle(goal.title);
        setDescription(goal.description || '');
        setAreaOfLife(goal.areaOfLife);
        setPriority(goal.priority);
        setStartDate(format(new Date(goal.startDate), 'yyyy-MM-dd'));
        setDeadline(format(new Date(goal.deadline), 'yyyy-MM-dd'));
        setMilestones(['']); // Can't edit milestones here
        setIsFocus(goal.isFocus);
      } else {
        setTitle('');
        setDescription('');
        setAreaOfLife('personal_growth');
        setPriority('medium');
        setStartDate(format(new Date(), 'yyyy-MM-dd'));
        setDeadline(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
        setMilestones(['']);
        setIsFocus(false);
      }
      setErrors({});
    }
  }, [open, goal]);

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

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      areaOfLife,
      priority,
      startDate,
      deadline,
      milestones: milestones.filter(m => m.trim() !== ''),
      isFocus,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update your goal details.'
                : 'Define a meaningful goal with milestones to track your progress.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
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
                    onClick={() => setAreaOfLife(area.value)}
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

            {/* Milestones (only for new goals) */}
            {!isEditing && (
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
            )}
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
              {isEditing ? 'Save Changes' : 'Create Goal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
