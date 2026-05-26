'use client';

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Plus, Filter, Sparkles, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useHabitStore } from '@/lib/stores/habit-store';
import { isAIEnabled } from '@/lib/ai-features-flag';
import { MonthSelector, HabitGrid, HabitFormModal, HabitStackSuggestions, SmartHabitGenerator, ArchivedHabitsModal } from '@/components/habits';
import { HabitSuggestions } from '@/components/habits/HabitSuggestions';
import { FadeIn } from '@/components/motion';
import { cn } from '@/lib/utils';
import type { Habit, HabitFormData, Category } from '@/lib/types';

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'health', label: 'Health' },
  { value: 'work', label: 'Work' },
  { value: 'learning', label: 'Learning' },
  { value: 'personal', label: 'Personal' },
  { value: 'finance', label: 'Finance' },
  { value: 'relationships', label: 'Relationships' },
];

function HabitsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const {
    habits,
    completions,
    isLoading,
    selectedMonth,
    categoryFilter,
    loadHabits,
    loadCompletions,
    addHabit,
    editHabit,
    removeHabit,
    toggle,
    setSelectedMonth,
    setCategoryFilter,
    getCurrentStreaks,
  } = useHabitStore();

  const [showModal, setShowModal] = useState(false);
  const [showSmartGenerator, setShowSmartGenerator] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>();
  const [modalTab, setModalTab] = useState<'details' | 'templates'>('details');
  const [showArchivedModal, setShowArchivedModal] = useState(false);

  // Check for ?new=true query param
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      Promise.resolve().then(() => {
        setShowModal(true);
      });
      // Clean up the URL
      router.replace('/habits');
    }
  }, [searchParams, router]);

  // Load data - OPTIMIZED: Single useEffect with parallel loading
  useEffect(() => {
    const init = async () => {
      // Calculate date range for completions
      const start = format(startOfMonth(subMonths(selectedMonth, 1)), 'yyyy-MM-dd');
      const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      
      // ⚡ OPTIMIZATION: Load habits and completions in parallel
      await Promise.all([
        loadHabits(),
        loadCompletions(start, end)
      ]);
    };
    
    init();
  }, [loadHabits, loadCompletions, selectedMonth]);

  // Event handlers - OPTIMIZED: Wrapped in useCallback to prevent re-renders
  const handleMonthChange = useCallback((date: Date) => {
    setSelectedMonth(date);
  }, []);

  const handleToggle = useCallback(async (habitId: string, date: string) => {
    await toggle(habitId, date);
  }, [toggle]);

  const handleCreateHabit = useCallback(async (data: HabitFormData) => {
    await addHabit(data);
    setEditingHabit(undefined);
  }, [addHabit]);

  const handleEditHabit = useCallback(async (data: HabitFormData) => {
    if (editingHabit) {
      await editHabit(editingHabit.id, data);
      setEditingHabit(undefined);
    }
  }, [editingHabit, editHabit]);

  const handleOpenEdit = useCallback((habit: Habit) => {
    setEditingHabit(habit);
    setShowModal(true);
  }, []);

  const handleArchive = useCallback(async (habitId: string) => {
    await editHabit(habitId, { archived: true });
  }, [editHabit]);

  const handleDelete = useCallback(async (habitId: string) => {
    if (confirm('Are you sure you want to delete this habit? All data will be lost.')) {
      await removeHabit(habitId);
    }
  }, [removeHabit]);

  const handleCategoryFilter = useCallback((category: Category) => {
    if (categoryFilter.includes(category)) {
      setCategoryFilter(categoryFilter.filter(c => c !== category));
    } else {
      setCategoryFilter([...categoryFilter, category]);
    }
  }, [categoryFilter]);

  // Get filtered habits - OPTIMIZED: Memoized
  const filteredHabits = useMemo(() => 
    categoryFilter.length > 0 
      ? habits.filter(h => categoryFilter.includes(h.category))
      : habits,
    [habits, categoryFilter]
  );

  // Get streaks - OPTIMIZED: Memoized
  const streaks = useMemo(() => getCurrentStreaks(), [habits, completions]);

  if (isLoading && habits.length === 0) {
    return (
      <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-72" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-7xl mx-auto">
      <FadeIn>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Habit Tracker</h1>
            <p className="text-muted-foreground mt-1">
              Track your daily habits and build consistency
            </p>
          </div>
          <div className="flex gap-2">
            {isAIEnabled() && (
              <Button
                onClick={() => setShowSmartGenerator(true)}
                variant="outline"
                className="gap-2 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
              >
                <Sparkles className="h-4 w-4 fill-current" />
                AI Generator
              </Button>
            )}
            <Button
              onClick={() => {
                setModalTab('templates');
                setShowModal(true);
              }}
              variant="outline"
              className="gap-2 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
            >
              <Sparkles className="h-4 w-4" />
              Browse Templates
            </Button>
            <Button
              onClick={() => setShowArchivedModal(true)}
              variant="outline"
              className="gap-2 border-border/80 hover:bg-muted/30"
            >
              <Archive className="h-4 w-4 text-muted-foreground" />
              Archived
            </Button>
            <Button 
              onClick={() => {
                setModalTab('details');
                setShowModal(true);
              }} 
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Habit
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <MonthSelector 
            selectedMonth={selectedMonth} 
            onMonthChange={handleMonthChange} 
          />
          
          {/* Category filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {CATEGORIES.map((cat) => (
              <Badge
                key={cat.value}
                variant={categoryFilter.includes(cat.value) ? 'default' : 'outline'}
                className={cn(
                  "cursor-pointer transition-all",
                  categoryFilter.includes(cat.value) && "bg-primary"
                )}
                onClick={() => handleCategoryFilter(cat.value)}
              >
                {cat.label}
              </Badge>
            ))}
            {categoryFilter.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setCategoryFilter([])}
                className="h-6 px-2 text-xs"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Habit Grid - Takes 3 columns */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                <HabitGrid
                  habits={filteredHabits}
                  completions={completions}
                  selectedMonth={selectedMonth}
                  onToggle={handleToggle}
                  onEdit={handleOpenEdit}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                  streaks={streaks}
                />
              </CardContent>
            </Card>
          </div>

          {/* AI Suggestions Sidebar - Takes 1 column */}
          {isAIEnabled() && (
            <div className="lg:col-span-1 space-y-6">
              <HabitSuggestions />
              <HabitStackSuggestions />
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-success/20 flex items-center justify-center">
              <div className="w-2 h-2 bg-success rounded-sm" />
            </div>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted/40" />
            <span>Missed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-primary/10 border-2 border-dashed border-primary/30" />
            <span>Today</span>
          </div>
        </div>
      </FadeIn>

      {/* Form Modal */}
      <HabitFormModal
        open={showModal}
        onOpenChange={(open) => {
          setShowModal(open);
          if (!open) setEditingHabit(undefined);
        }}
        onSubmit={editingHabit ? handleEditHabit : handleCreateHabit}
        habit={editingHabit}
        defaultTab={modalTab}
      />

      {isAIEnabled() && (
        <SmartHabitGenerator
          open={showSmartGenerator}
          onOpenChange={setShowSmartGenerator}
        />
      )}

      <ArchivedHabitsModal
        open={showArchivedModal}
        onOpenChange={setShowArchivedModal}
      />
    </div>
  );
}

export default function HabitsPage() {
  return (
    <Suspense fallback={
      <div className="container px-4 py-8 md:px-6 lg:px-8 max-w-7xl mx-auto">
        <Skeleton className="h-9 w-48 mb-8" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <HabitsPageContent />
    </Suspense>
  );
}
