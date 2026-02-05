'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  Plus,
  Filter,
  SortAsc,
  LayoutGrid,
  List,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/motion';
import { GoalCard, GoalFormModal, EmptyGoals } from '@/components/goals';
import { useGoalStore } from '@/lib/stores';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Goal, GoalFormData, GoalStatus, AreaOfLife } from '@/lib/types';

const STATUS_OPTIONS: { value: GoalStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

const AREA_OPTIONS: { value: AreaOfLife; label: string; emoji: string }[] = [
  { value: 'career', label: 'Career', emoji: '💼' },
  { value: 'health', label: 'Health', emoji: '💪' },
  { value: 'relationships', label: 'Relationships', emoji: '❤️' },
  { value: 'personal_growth', label: 'Personal Growth', emoji: '🌱' },
  { value: 'finance', label: 'Finance', emoji: '💰' },
  { value: 'fun', label: 'Fun', emoji: '🎉' },
];

type SortOption = 'deadline' | 'priority' | 'progress' | 'created';

export default function GoalsPage() {
  const {
    goals,
    milestones,
    isLoading,
    loadGoals,
    loadAllMilestones,
    addGoal,
    editGoal,
    removeGoal,
    setFocus,
    toggleMilestoneComplete,
    addMilestone,
    removeMilestone,
    statusFilter,
    areaFilter,
    setStatusFilter,
    setAreaFilter,
    getGoalStats,
    getGoalMilestones,
    getFilteredGoals,
  } = useGoalStore();

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('deadline');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { isAuthenticated, user } = useAuth();

  // Load goals on mount AND when auth state changes
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadGoals();
      loadAllMilestones();
    }
  }, [isAuthenticated, user?.id, loadGoals, loadAllMilestones]);

  // Filter, sort and organize goals - memoized to avoid recalculation on every render
  const displayGoals = useMemo(() => {
    // Filter by search query
    const filteredGoals = getFilteredGoals().filter(goal => {
      if (!searchQuery) return true;
      return (
        goal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        goal.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    // Sort goals
    const sortedGoals = [...filteredGoals].sort((a, b) => {
      switch (sortBy) {
        case 'deadline':
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        case 'priority': {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        case 'progress': {
          const aStats = getGoalStats(a.id);
          const bStats = getGoalStats(b.id);
          return bStats.progress - aStats.progress;
        }
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

    // Put focus goals first
    const focusGoals = sortedGoals.filter(g => g.isFocus);
    const otherGoals = sortedGoals.filter(g => !g.isFocus);
    return [...focusGoals, ...otherGoals];
  }, [getFilteredGoals, searchQuery, sortBy, getGoalStats]);

  const handleCreateGoal = async (data: GoalFormData) => {
    await addGoal(data);
  };

  const handleEditGoal = async (data: GoalFormData) => {
    if (editingGoal) {
      // Update goal details
      await editGoal(editingGoal.id, {
        title: data.title,
        description: data.description,
        areaOfLife: data.areaOfLife,
        priority: data.priority,
        startDate: data.startDate,
        deadline: data.deadline,
      });

      // Handle milestones - add new ones
      const existingMilestones = getGoalMilestones(editingGoal.id);
      const existingTitles = existingMilestones.map(m => m.title);
      const newTitles = data.milestones.filter(title =>
        title.trim() && !existingTitles.includes(title.trim())
      );

      // Add new milestones
      for (const title of newTitles) {
        await addMilestone(editingGoal.id, { title: title.trim() });
      }

      // Note: We're not deleting removed milestones to preserve history
      // If needed, that could be added as a separate feature

      await loadAllMilestones(); // Reload to get updated milestones
    }
  };

  const handleOpenEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setFormModalOpen(true);
  };

  const handleCloseModal = (open: boolean) => {
    setFormModalOpen(open);
    if (!open) {
      setEditingGoal(undefined);
    }
  };

  const handleArchiveGoal = async (goalId: string) => {
    await editGoal(goalId, { archived: true });
  };

  const handleSetFocus = async (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    // If trying to set as focus and already have 2 focus goals
    if (!goal.isFocus) {
      const currentFocusCount = goals.filter(g => g.isFocus && !g.archived).length;
      if (currentFocusCount >= 2) {
        toast.error('Maximum of 2 focus goals allowed');
        return;
      }
    }

    await setFocus(goalId);
  };


  const handleToggleStatus = (status: GoalStatus) => {
    const newStatuses = statusFilter.includes(status)
      ? statusFilter.filter(s => s !== status)
      : [...statusFilter, status];
    setStatusFilter(newStatuses);
  };

  const handleToggleArea = (area: AreaOfLife) => {
    const newAreas = areaFilter.includes(area)
      ? areaFilter.filter(a => a !== area)
      : [...areaFilter, area];
    setAreaFilter(newAreas);
  };

  const clearFilters = () => {
    setStatusFilter([]);
    setAreaFilter([]);
    setSearchQuery('');
  };

  const hasActiveFilters = statusFilter.length > 0 || areaFilter.length > 0 || searchQuery;
  const activeGoalsCount = goals.filter(g => !g.archived && g.status !== 'completed').length;

  if (isLoading) {
    return (
      <div className="container px-4 py-8 md:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-muted rounded w-48" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-80 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container px-4 py-8 md:px-6 lg:px-8">
      {/* Header */}
      <FadeIn className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Target className="h-8 w-8 text-primary" />
              Goal Planner
            </h1>
            <p className="text-muted-foreground mt-1">
              {activeGoalsCount > 0
                ? `${activeGoalsCount} active goal${activeGoalsCount !== 1 ? 's' : ''}`
                : 'Set meaningful goals and track your progress'}
            </p>
          </div>

          <Button onClick={() => setFormModalOpen(true)} size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            New Goal
          </Button>
        </div>
      </FadeIn>

      {/* Filters & Controls */}
      {goals.length > 0 && (
        <FadeIn delay={0.1} className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search goals..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Status Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Status
                    {statusFilter.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                        {statusFilter.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {STATUS_OPTIONS.map(option => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={statusFilter.includes(option.value)}
                      onCheckedChange={() => handleToggleStatus(option.value)}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Area Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Area
                    {areaFilter.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                        {areaFilter.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filter by Area</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {AREA_OPTIONS.map(option => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={areaFilter.includes(option.value)}
                      onCheckedChange={() => handleToggleArea(option.value)}
                    >
                      {option.emoji} {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Sort */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <SortAsc className="h-4 w-4" />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={sortBy === 'deadline'}
                    onCheckedChange={() => setSortBy('deadline')}
                  >
                    Deadline
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortBy === 'priority'}
                    onCheckedChange={() => setSortBy('priority')}
                  >
                    Priority
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortBy === 'progress'}
                    onCheckedChange={() => setSortBy('progress')}
                  >
                    Progress
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortBy === 'created'}
                    onCheckedChange={() => setSortBy('created')}
                  >
                    Date Created
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* View Toggle */}
              <div className="flex rounded-lg border bg-muted/50 p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    viewMode === 'grid'
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    viewMode === 'list'
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Goals Grid/List */}
      {displayGoals.length === 0 ? (
        goals.length === 0 ? (
          <EmptyGoals onCreateGoal={() => setFormModalOpen(true)} />
        ) : (
          <FadeIn className="text-center py-12">
            <p className="text-muted-foreground">
              No goals match your current filters.
            </p>
            <Button variant="link" onClick={clearFilters} className="mt-2">
              Clear filters
            </Button>
          </FadeIn>
        )
      ) : (
        <StaggerContainer
          className={cn(
            "grid gap-6",
            viewMode === 'grid'
              ? "md:grid-cols-2 lg:grid-cols-3"
              : "grid-cols-1 max-w-3xl"
          )}
        >
          <AnimatePresence mode="popLayout">
            {displayGoals.map((goal, index) => (
              <StaggerItem key={goal.id} className={cn(viewMode === 'grid' && "h-full")}>
                <GoalCard
                  goal={goal}
                  milestones={getGoalMilestones(goal.id)}
                  stats={getGoalStats(goal.id)}
                  onEdit={handleOpenEditModal}
                  onDelete={removeGoal}
                  onArchive={handleArchiveGoal}
                  onSetFocus={handleSetFocus}
                  onToggleMilestone={toggleMilestoneComplete}
                  onAddMilestone={() => {
                    // Could open a separate milestone modal - for now just open edit
                    handleOpenEditModal(goal);
                  }}
                />
              </StaggerItem>
            ))}
          </AnimatePresence>
        </StaggerContainer>
      )}

      {/* Form Modal */}
      <GoalFormModal
        open={formModalOpen}
        onOpenChange={handleCloseModal}
        onSubmit={editingGoal ? handleEditGoal : handleCreateGoal}
        goal={editingGoal}
        existingMilestones={
          editingGoal
            ? getGoalMilestones(editingGoal.id).map(m => m.title)
            : []
        }
      />
    </div>
  );
}
