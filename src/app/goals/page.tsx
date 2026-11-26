'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import {
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
import { Skeleton } from '@/components/ui/skeleton'; // Force HMR refresh
import { PageHeader } from '@/components/ui/page-header';
import { GoalListSkeleton } from '@/components/ui/Skeletons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FadeIn } from '@/components/motion';
import { GoalCard } from '@/components/goals/goal-card';
import { EmptyGoals } from '@/components/goals/empty-goals';
import { useGoalStore } from '@/lib/stores/goal-store';

const GoalFormModal = dynamic(
  () => import('@/components/goals/goal-form-modal').then((m) => ({ default: m.GoalFormModal })),
  { ssr: false }
);
import { useFitnessStore } from '@/lib/stores/fitness';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Goal, GoalFormData, GoalStatus, AreaOfLife } from '@/lib/types';
import { GuidedTour, TourTriggerButton, usePageTour, PAGE_TOURS } from '@/components/tour';

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

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'deadline', label: 'Deadline' },
  { value: 'priority', label: 'Priority' },
  { value: 'progress', label: 'Progress' },
  { value: 'created', label: 'Date Created' },
];

const PRIORITY_ORDER: Record<Goal['priority'], number> = { high: 0, medium: 1, low: 2 };

function sortAndPrioritizeGoals(
  filteredGoals: Goal[],
  sortBy: SortOption,
  getGoalStats: (id: string) => { progress: number }
): Goal[] {
  const sorted = [...filteredGoals].sort((a, b) => {
    if (sortBy === 'deadline') return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    if (sortBy === 'priority') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (sortBy === 'progress') return getGoalStats(b.id).progress - getGoalStats(a.id).progress;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return [...sorted.filter((g) => g.isFocus), ...sorted.filter((g) => !g.isFocus)];
}

function GoalsPageSkeleton() {
  return (
    <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Skeleton className="h-10 w-48 rounded" />
            <Skeleton className="h-5 w-32 mt-2 rounded" />
          </div>
          <Skeleton className="h-10 w-32 rounded" />
        </div>
        <GoalListSkeleton />
      </div>
    </div>
  );
}

function GoalsFilterDropdown<T extends string>(props: {
  label: string;
  menuLabel: string;
  selected: T[];
  options: { value: T; label: string }[];
  onToggle: (value: T) => void;
}) {
  const { label, menuLabel, selected, options, onToggle } = props;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">{selected.length}</Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.includes(option.value)}
            onCheckedChange={() => onToggle(option.value)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const AREA_FILTER_OPTIONS = AREA_OPTIONS.map((o) => ({ value: o.value, label: `${o.emoji} ${o.label}` }));

function GoalsFilterToolbar(props: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: GoalStatus[];
  onToggleStatus: (status: GoalStatus) => void;
  areaFilter: AreaOfLife[];
  onToggleArea: (area: AreaOfLife) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  const {
    searchQuery,
    onSearchChange,
    statusFilter,
    onToggleStatus,
    areaFilter,
    onToggleArea,
    sortBy,
    onSortChange,
    viewMode,
    onViewModeChange,
    hasActiveFilters,
    onClearFilters,
  } = props;

  return (
    <FadeIn delay={0.1} className="mb-6 tour-goals-header">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search goals..." value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} className="pl-10" />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <GoalsFilterDropdown label="Status" menuLabel="Filter by Status" selected={statusFilter} options={STATUS_OPTIONS} onToggle={onToggleStatus} />
          <GoalsFilterDropdown label="Area" menuLabel="Filter by Area" selected={areaFilter} options={AREA_FILTER_OPTIONS} onToggle={onToggleArea} />

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
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuCheckboxItem key={option.value} checked={sortBy === option.value} onCheckedChange={() => onSortChange(option.value)}>
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex rounded-lg border bg-muted/50 p-0.5">
            {(['grid', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === mode ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {mode === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>Clear</Button>
          )}
        </div>
      </div>
    </FadeIn>
  );
}

function GoalsGridOrEmpty(props: {
  totalGoals: number;
  displayGoals: Goal[];
  viewMode: 'grid' | 'list';
  milestonesByGoalId: Map<string, ReturnType<typeof useGoalStore.getState>['milestones']>;
  goalStatsById: Map<string, ReturnType<ReturnType<typeof useGoalStore.getState>['getGoalStats']>>;
  getGoalStats: (id: string) => ReturnType<ReturnType<typeof useGoalStore.getState>['getGoalStats']>;
  onCreateGoal: () => void;
  onClearFilters: () => void;
  onEdit: (g: Goal) => void;
  onDelete: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onSetFocus: (id: string) => Promise<void>;
  onToggleMilestone: (id: string) => Promise<void>;
  onAddMilestone: (id: string) => void;
}) {
  const { totalGoals, displayGoals, viewMode, milestonesByGoalId, goalStatsById, getGoalStats, onCreateGoal, onClearFilters } = props;
  if (totalGoals === 0) return <EmptyGoals onCreateGoal={onCreateGoal} />;
  if (displayGoals.length === 0) {
    return (
      <FadeIn className="text-center py-12">
        <p className="text-muted-foreground">No goals match your current filters.</p>
        <Button variant="link" onClick={onClearFilters} className="mt-2">Clear filters</Button>
      </FadeIn>
    );
  }
  return (
    <div className={cn('grid grid-cols-1 tour-goals-grid', viewMode === 'grid' ? 'gap-5 md:grid-cols-2 lg:grid-cols-3' : 'gap-3 max-w-5xl')}>
      {displayGoals.map((goal) => (
        <div key={goal.id} className={cn('min-w-0 cv-auto', viewMode === 'grid' && 'h-full')}>
          <GoalCard
            goal={goal}
            milestones={milestonesByGoalId.get(goal.id) || []}
            stats={goalStatsById.get(goal.id) || getGoalStats(goal.id)}
            viewMode={viewMode}
            onEdit={props.onEdit}
            onDelete={props.onDelete}
            onArchive={props.onArchive}
            onSetFocus={props.onSetFocus}
            onToggleMilestone={props.onToggleMilestone}
            onAddMilestone={props.onAddMilestone}
          />
        </div>
      ))}
    </div>
  );
}

function useGoalsViewModel(params: {
  goals: Goal[];
  milestones: ReturnType<typeof useGoalStore.getState>['milestones'];
  statusFilter: GoalStatus[];
  areaFilter: AreaOfLife[];
  searchQuery: string;
  sortBy: SortOption;
  getFilteredGoals: () => Goal[];
  getGoalStats: (id: string) => ReturnType<ReturnType<typeof useGoalStore.getState>['getGoalStats']>;
}) {
  const { goals, milestones, statusFilter, areaFilter, searchQuery, sortBy, getFilteredGoals, getGoalStats } = params;

  const displayGoals = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filteredGoals = getFilteredGoals().filter((goal) => {
      if (!q) return true;
      return goal.title.toLowerCase().includes(q) || Boolean(goal.description?.toLowerCase().includes(q));
    });
    return sortAndPrioritizeGoals(filteredGoals, sortBy, getGoalStats);
  }, [getFilteredGoals, goals, milestones, statusFilter, areaFilter, searchQuery, sortBy, getGoalStats]);

  const milestonesByGoalId = useMemo(() => {
    const map = new Map<string, typeof milestones>();
    for (const m of milestones) {
      const arr = map.get(m.goalId) || [];
      arr.push(m);
      map.set(m.goalId, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.order - b.order);
    return map;
  }, [milestones]);

  const goalStatsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getGoalStats>>();
    for (const g of displayGoals) map.set(g.id, getGoalStats(g.id));
    return map;
  }, [displayGoals, getGoalStats, milestones]);

  return { displayGoals, milestonesByGoalId, goalStatsById };
}

function useGoalsStoreBindings() {
  return useGoalStore(
    useShallow((s) => ({
      goals: s.goals,
      milestones: s.milestones,
      isLoading: s.isLoading,
      loadGoals: s.loadGoals,
      loadAllMilestones: s.loadAllMilestones,
      addGoal: s.addGoal,
      editGoal: s.editGoal,
      removeGoal: s.removeGoal,
      setFocus: s.setFocus,
      toggleMilestoneComplete: s.toggleMilestoneComplete,
      addMilestone: s.addMilestone,
      statusFilter: s.statusFilter,
      areaFilter: s.areaFilter,
      setStatusFilter: s.setStatusFilter,
      setAreaFilter: s.setAreaFilter,
      getGoalStats: s.getGoalStats,
      getGoalMilestones: s.getGoalMilestones,
      getFilteredGoals: s.getFilteredGoals,
    }))
  );
}

async function submitEditedGoal(params: {
  editingGoal: Goal;
  data: GoalFormData;
  editGoal: (id: string, patch: Partial<Goal>) => Promise<void>;
  getGoalMilestones: (id: string) => { title: string }[];
  addMilestone: (goalId: string, input: { title: string }) => Promise<unknown>;
  loadAllMilestones: () => Promise<void>;
}) {
  const { editingGoal, data, editGoal, getGoalMilestones, addMilestone, loadAllMilestones } = params;
  await editGoal(editingGoal.id, {
    title: data.title,
    description: data.description,
    areaOfLife: data.areaOfLife,
    priority: data.priority,
    startDate: data.startDate,
    deadline: data.deadline,
    isFocus: data.isFocus,
    financialLink: data.financialLink,
    fitnessLink: data.fitnessLink,
  });

  const existingTitles = getGoalMilestones(editingGoal.id).map((m) => m.title);
  const newTitles = data.milestones.filter((title) => title.trim() && !existingTitles.includes(title.trim()));
  for (const title of newTitles) await addMilestone(editingGoal.id, { title: title.trim() });
  await loadAllMilestones();
}

function GoalsHeaderBanner(props: {
  activeGoalsCount: number;
  onStartTour: () => void;
  onNewGoal: () => void;
}) {
  const { activeGoalsCount, onStartTour, onNewGoal } = props;
  const description =
    activeGoalsCount > 0
      ? `${activeGoalsCount} active goal${activeGoalsCount !== 1 ? 's' : ''}`
      : 'Set meaningful goals and track your progress';
  return (
    <FadeIn className="mb-6">
      <PageHeader
        title="Goal Planner"
        description={description}
        actions={
          <div className="flex items-center gap-2">
            <TourTriggerButton onClick={onStartTour} pageTitle="Goals" />
            <Button onClick={onNewGoal} size="sm" className="h-9 gap-1.5 rounded-xl tour-add-goal-btn">
              <Plus className="h-4 w-4" />
              New Goal
            </Button>
          </div>
        }
      />
    </FadeIn>
  );
}

function useGoalsFilterControls(params: {
  statusFilter: GoalStatus[];
  areaFilter: AreaOfLife[];
  setStatusFilter: (s: GoalStatus[]) => void;
  setAreaFilter: (a: AreaOfLife[]) => void;
}) {
  const { statusFilter, areaFilter, setStatusFilter, setAreaFilter } = params;
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('deadline');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const toggleStatus = (status: GoalStatus) => {
    setStatusFilter(statusFilter.includes(status) ? statusFilter.filter((s) => s !== status) : [...statusFilter, status]);
  };
  const toggleArea = (area: AreaOfLife) => {
    setAreaFilter(areaFilter.includes(area) ? areaFilter.filter((a) => a !== area) : [...areaFilter, area]);
  };
  const clearFilters = () => {
    setStatusFilter([]);
    setAreaFilter([]);
    setSearchQuery('');
  };
  const hasActiveFilters = Boolean(statusFilter.length > 0 || areaFilter.length > 0 || searchQuery);

  return { searchQuery, setSearchQuery, sortBy, setSortBy, viewMode, setViewMode, toggleStatus, toggleArea, clearFilters, hasActiveFilters };
}

function GoalsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();

  const { isOpen: isTourOpen, startTour, closeTour, completeTour } = usePageTour('goals');
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (searchParams.get('new') !== 'true') return;
    setFormModalOpen(true);
    router.replace('/goals');
  }, [searchParams, router]);

  const store = useGoalsStoreBindings();
  const filters = useGoalsFilterControls({
    statusFilter: store.statusFilter,
    areaFilter: store.areaFilter,
    setStatusFilter: store.setStatusFilter,
    setAreaFilter: store.setAreaFilter,
  });

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    store.loadGoals();
    store.loadAllMilestones();
    const fitState = useFitnessStore.getState();
    if (!fitState.hasLoaded) void fitState.loadFitnessData(user.id);
  }, [isAuthenticated, user?.id, store.loadGoals, store.loadAllMilestones]);

  const { displayGoals, milestonesByGoalId, goalStatsById } = useGoalsViewModel({
    goals: store.goals,
    milestones: store.milestones,
    statusFilter: store.statusFilter,
    areaFilter: store.areaFilter,
    searchQuery: filters.searchQuery,
    sortBy: filters.sortBy,
    getFilteredGoals: store.getFilteredGoals,
    getGoalStats: store.getGoalStats,
  });

  const handleOpenEditModal = useCallback((goal: Goal) => {
    setEditingGoal(goal);
    setFormModalOpen(true);
  }, []);

  const handleCloseModal = useCallback((open: boolean) => {
    setFormModalOpen(open);
    if (!open) setEditingGoal(undefined);
  }, []);

  const handleArchiveGoal = useCallback(async (goalId: string) => {
    await store.editGoal(goalId, { archived: true });
  }, [store.editGoal]);

  const handleAddMilestonePrompt = useCallback((goalId: string) => {
    const found = store.goals.find((g) => g.id === goalId);
    if (found) handleOpenEditModal(found);
  }, [store.goals, handleOpenEditModal]);

  const handleEditGoal = async (data: GoalFormData) => {
    if (!editingGoal) return;
    await submitEditedGoal({
      editingGoal,
      data,
      editGoal: store.editGoal,
      getGoalMilestones: store.getGoalMilestones,
      addMilestone: store.addMilestone,
      loadAllMilestones: store.loadAllMilestones,
    });
  };

  const handleSetFocus = useCallback(async (goalId: string) => {
    const goal = store.goals.find((g) => g.id === goalId);
    if (!goal) return;
    if (!goal.isFocus && store.goals.filter((g) => g.isFocus && !g.archived).length >= 2) {
      toast.error('Maximum of 2 focus goals allowed');
      return;
    }
    await store.setFocus(goalId);
  }, [store.goals, store.setFocus]);

  const activeGoalsCount = store.goals.filter((g) => !g.archived && g.status !== 'completed').length;
  if (store.isLoading) return <GoalsPageSkeleton />;

  return (
    <div className="w-full overflow-x-hidden px-4 py-6 sm:py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto pb-24 md:pb-12">
      <GoalsHeaderBanner activeGoalsCount={activeGoalsCount} onStartTour={startTour} onNewGoal={() => setFormModalOpen(true)} />

      {store.goals.length > 0 && (
        <GoalsFilterToolbar
          searchQuery={filters.searchQuery}
          onSearchChange={filters.setSearchQuery}
          statusFilter={store.statusFilter}
          onToggleStatus={filters.toggleStatus}
          areaFilter={store.areaFilter}
          onToggleArea={filters.toggleArea}
          sortBy={filters.sortBy}
          onSortChange={filters.setSortBy}
          viewMode={filters.viewMode}
          onViewModeChange={filters.setViewMode}
          hasActiveFilters={filters.hasActiveFilters}
          onClearFilters={filters.clearFilters}
        />
      )}

      <GoalsGridOrEmpty
        totalGoals={store.goals.length}
        displayGoals={displayGoals}
        viewMode={filters.viewMode}
        milestonesByGoalId={milestonesByGoalId}
        goalStatsById={goalStatsById}
        getGoalStats={store.getGoalStats}
        onCreateGoal={() => setFormModalOpen(true)}
        onClearFilters={filters.clearFilters}
        onEdit={handleOpenEditModal}
        onDelete={store.removeGoal}
        onArchive={handleArchiveGoal}
        onSetFocus={handleSetFocus}
        onToggleMilestone={store.toggleMilestoneComplete}
        onAddMilestone={handleAddMilestonePrompt}
      />

      {formModalOpen && (
        <GoalFormModal
          open={formModalOpen}
          onOpenChange={handleCloseModal}
          onSubmit={editingGoal ? handleEditGoal : store.addGoal}
          goal={editingGoal}
          existingMilestones={editingGoal ? store.getGoalMilestones(editingGoal.id).map((m) => m.title) : []}
        />
      )}

      <GuidedTour {...PAGE_TOURS.goals} isOpen={isTourOpen} onClose={closeTour} onComplete={completeTour} />
    </div>
  );
}

export default function GoalsPage() {
  return (
    <Suspense fallback={<GoalsPageSkeleton />}>
      <GoalsPageContent />
    </Suspense>
  );
}
