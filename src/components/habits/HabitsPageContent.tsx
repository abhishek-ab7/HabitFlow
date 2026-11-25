'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Plus, Filter, Sparkles, Archive, X, Brain, ChevronDown, LayoutTemplate } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HabitListSkeleton } from '@/components/ui/Skeletons';
import { useHabitStore } from '@/lib/stores/habit-store';
import { isAIEnabled } from '@/lib/ai-features-flag';
import { MonthSelector } from './month-selector';
import { HabitGrid } from './habit-grid';
import { HabitStackSuggestions } from './HabitStackSuggestions';
import { HabitSuggestions } from './HabitSuggestions';

const HabitFormModal = dynamic(
  () => import('./habit-form-modal').then((m) => ({ default: m.HabitFormModal })),
  { ssr: false }
);
const SmartHabitGenerator = dynamic(
  () => import('./SmartHabitGenerator').then((m) => ({ default: m.SmartHabitGenerator })),
  { ssr: false }
);
const ArchivedHabitsModal = dynamic(
  () => import('./ArchivedHabitsModal').then((m) => ({ default: m.ArchivedHabitsModal })),
  { ssr: false }
);
import { FadeIn } from '@/components/motion';
import { cn } from '@/lib/utils';
import type { Habit, HabitFormData, Category } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useFeedback } from '@/hooks/use-feedback';
import { GuidedTour, TourTriggerButton, usePageTour, PAGE_TOURS } from '@/components/tour';

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'health', label: 'Health' },
  { value: 'work', label: 'Work' },
  { value: 'learning', label: 'Learning' },
  { value: 'personal', label: 'Personal' },
  { value: 'finance', label: 'Finance' },
  { value: 'relationships', label: 'Relationships' },
];

export default function HabitsPageContent() {
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
  } = useHabitStore(
    useShallow((s) => ({
      habits: s.habits,
      completions: s.completions,
      isLoading: s.isLoading,
      selectedMonth: s.selectedMonth,
      categoryFilter: s.categoryFilter,
      loadHabits: s.loadHabits,
      loadCompletions: s.loadCompletions,
      addHabit: s.addHabit,
      editHabit: s.editHabit,
      removeHabit: s.removeHabit,
      toggle: s.toggle,
      setSelectedMonth: s.setSelectedMonth,
      setCategoryFilter: s.setCategoryFilter,
      getCurrentStreaks: s.getCurrentStreaks,
    }))
  );

  const [showModal, setShowModal] = useState(false);
  const [showSmartGenerator, setShowSmartGenerator] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>();
  const [modalTab, setModalTab] = useState<'details' | 'templates'>('details');
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [habitIdToDelete, setHabitIdToDelete] = useState<string | null>(null);
  const feedback = useFeedback();

  const {
    isOpen: isTourOpen,
    startTour,
    closeTour,
    completeTour,
  } = usePageTour('habits');

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
    feedback.tap();
    setSelectedMonth(date);
  }, [feedback, setSelectedMonth]);

  const handleToggle = useCallback(async (habitId: string, date: string) => {
    await toggle(habitId, date);
  }, [toggle]);

  const handleCreateHabit = useCallback(async (data: HabitFormData) => {
    feedback.success();
    await addHabit(data);
    setEditingHabit(undefined);
  }, [feedback, addHabit]);

  const handleEditHabit = useCallback(async (data: HabitFormData) => {
    if (editingHabit) {
      feedback.success();
      await editHabit(editingHabit.id, data);
      setEditingHabit(undefined);
    }
  }, [feedback, editingHabit, editHabit]);

  const handleOpenEdit = useCallback((habit: Habit) => {
    setEditingHabit(habit);
    setShowModal(true);
  }, []);

  const handleArchive = useCallback(async (habitId: string) => {
    feedback.warning();
    await editHabit(habitId, { archived: true });
  }, [feedback, editHabit]);

  const handleDelete = useCallback((habitId: string) => {
    setHabitIdToDelete(habitId);
    setDeleteConfirmOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (habitIdToDelete) {
      feedback.warning();
      await removeHabit(habitIdToDelete);
      setHabitIdToDelete(null);
    }
  }, [feedback, habitIdToDelete, removeHabit]);

  const handleCategoryFilter = useCallback((category: Category) => {
    feedback.tap();
    if (categoryFilter.includes(category)) {
      setCategoryFilter(categoryFilter.filter(c => c !== category));
    } else {
      setCategoryFilter([...categoryFilter, category]);
    }
  }, [feedback, categoryFilter, setCategoryFilter]);

  // Get filtered habits - OPTIMIZED: Memoized
  const filteredHabits = useMemo(() => 
    categoryFilter.length > 0 
      ? habits.filter(h => categoryFilter.includes(h.category))
      : habits,
    [habits, categoryFilter]
  );

  // Get streaks - OPTIMIZED: Memoized
  const streaks = useMemo(() => getCurrentStreaks(), [habits, completions, getCurrentStreaks]);

  if (isLoading && habits.length === 0) {
    return (
      <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-72" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <HabitListSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-hidden px-4 py-6 sm:py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto pb-24 md:pb-12">
      <FadeIn>
        {/* Standardized Header (max 3 controls) */}
        <PageHeader
          title="Habit Tracker"
          description="Track your daily habits and build consistency"
          className="mb-6"
          actions={
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 rounded-xl border-border/80 text-xs sm:text-sm"
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>{isAIEnabled() ? 'AI & Templates' : 'Templates'}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl">
                  {isAIEnabled() && (
                    <DropdownMenuItem
                      onClick={() => setShowSmartGenerator(true)}
                      className="gap-2 cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 text-invest" />
                      <span>AI Generator</span>
                    </DropdownMenuItem>
                  )}
                  {isAIEnabled() && (
                    <DropdownMenuItem
                      onClick={() => setShowAIAssist(true)}
                      className="gap-2 cursor-pointer"
                    >
                      <Brain className="h-4 w-4 text-primary" />
                      <span>AI Assist &amp; Stacks</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      setModalTab('templates');
                      setShowModal(true);
                    }}
                    className="gap-2 cursor-pointer"
                  >
                    <LayoutTemplate className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span>Browse Templates</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={() => setShowArchivedModal(true)}
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-xl border-border/80 hover:bg-muted/40 text-xs sm:text-sm"
              >
                <Archive className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">Archived</span>
              </Button>

              <TourTriggerButton onClick={startTour} pageTitle="Habits" />

              <Button
                size="sm"
                onClick={() => {
                  setModalTab('details');
                  setShowModal(true);
                }}
                className="h-9 gap-1.5 rounded-xl text-xs sm:text-sm tour-add-habit-btn"
              >
                <Plus className="h-4 w-4" />
                <span>New Habit</span>
              </Button>
            </>
          }
        />

        {/* Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-6 tour-habits-header">
          <MonthSelector 
            selectedMonth={selectedMonth} 
            onMonthChange={handleMonthChange} 
          />
          
          {/* Category filters: horizontal scroll on mobile so nothing clips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 lg:flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0 mr-0.5" />
            {CATEGORIES.map((cat) => (
              <Badge
                key={cat.value}
                variant={categoryFilter.includes(cat.value) ? 'default' : 'outline'}
                className={cn(
                  "cursor-pointer transition-all shrink-0 h-7 px-2.5 text-xs",
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
                className="h-7 px-2 text-xs shrink-0"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="w-full">
          {/* Habit Grid - Full width */}
          <Card className="border-none shadow-none md:border md:shadow-sm tour-habits-grid">
            <CardContent className="p-2 sm:p-4 md:p-6">
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

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-success/20 flex items-center justify-center">
              <div className="w-2 h-2 bg-success rounded-sm" />
            </div>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted/75 border border-border/70 dark:bg-muted/50" />
            <span>Missed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-primary/10 border-2 border-dashed border-primary/30" />
            <span>Today</span>
          </div>
        </div>
      </FadeIn>

      {/* Form Modal */}
      {showModal && (
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
      )}

      {isAIEnabled() && showSmartGenerator && (
        <SmartHabitGenerator
          open={showSmartGenerator}
          onOpenChange={setShowSmartGenerator}
        />
      )}

      {showArchivedModal && (
        <ArchivedHabitsModal
          open={showArchivedModal}
          onOpenChange={setShowArchivedModal}
        />
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Habit"
        description="Are you sure you want to delete this habit? All data will be lost."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />

      {/* AI Assist Drawer */}
      {isAIEnabled() && (
        <AnimatePresence>
          {showAIAssist && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAIAssist(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              />
              {/* Drawer panel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-md sm:max-w-lg bg-background border-l border-border/80 shadow-2xl z-50 flex flex-col h-full"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/80">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-invest" />
                    <h2 className="text-lg font-semibold tracking-tight">AI Assistant</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAIAssist(false)}
                    className="h-8 w-8 rounded-full hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <HabitSuggestions />
                  <HabitStackSuggestions />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}

      {/* Guided Tour */}
      <GuidedTour
        {...PAGE_TOURS.habits}
        isOpen={isTourOpen}
        onClose={closeTour}
        onComplete={completeTour}
      />
    </div>
  );
}
