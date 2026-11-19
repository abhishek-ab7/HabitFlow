'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CheckSquare,
  Wallet,
  Plus,
  LayoutGrid,
  ListTodo,
  Target,
  BarChart3,
  Trophy,
  User,
  MessageSquareText,
  Sparkles,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AddTransactionModal } from '@/components/finance/AddTransactionModal';
import { SmsImportModal } from '@/components/finance/SmsImportModal';
import { HabitFormModal } from '@/components/habits/habit-form-modal';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';
import { FocusModeOverlay } from '@/components/dashboard/FocusModeOverlay';
import { useHabitStore } from '@/lib/stores/habit-store';
import { toast } from 'sonner';

interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  badge?: string;
  onClick: () => void;
}

interface MoreMenuItem {
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const MORE_MENU_ITEMS: MoreMenuItem[] = [
  {
    href: '/tasks',
    label: 'Tasks',
    description: 'Priorities, Eisenhower matrix & daily checklist',
    icon: ListTodo,
    color: 'text-indigo-500 bg-indigo-500/10',
  },
  {
    href: '/goals',
    label: 'Goals',
    description: 'SMART goals, financial targets & roadmaps',
    icon: Target,
    color: 'text-amber-500 bg-amber-500/10',
  },
  {
    href: '/analytics',
    label: 'Analytics',
    description: 'Spending correlations, pace charts & skill trees',
    icon: BarChart3,
    color: 'text-emerald-500 bg-emerald-500/10',
  },
  {
    href: '/leaderboard',
    label: 'Leaderboard',
    description: 'Global XP rankings, streaks & level rewards',
    icon: Trophy,
    color: 'text-purple-500 bg-purple-500/10',
  },
  {
    href: '/settings',
    label: 'Settings & Profile',
    description: 'Appearance, notifications, backup & account',
    icon: User,
    color: 'text-sky-500 bg-sky-500/10',
  },
];

const PRIMARY_SWIPE_ROUTES = ['/dashboard', '/habits', '/finance'];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Modal open states
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isSmsImportOpen, setIsSmsImportOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isNewHabitOpen, setIsNewHabitOpen] = useState(false);
  const [isFocusOverlayOpen, setIsFocusOverlayOpen] = useState(false);

  const { addHabit } = useHabitStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Global horizontal touch swipe detection for mobile views
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) return;
      const target = e.target as HTMLElement;

      const isInteractive =
        target.closest('input, textarea, select, button, a') ||
        target.closest('[role="dialog"]') ||
        target.closest('[role="slider"]') ||
        target.closest('.no-swipe') ||
        target.closest('[data-no-swipe="true"]') ||
        target.closest('.overflow-x-auto') ||
        target.closest('.overflow-y-auto') ||
        target.closest('[class*="overflow-x-"]') ||
        target.closest('[class*="overflow-y-"]');

      if (isInteractive) return;

      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 0) return;

      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      const duration = Date.now() - touchStartTime;

      if (
        duration < 500 &&
        Math.abs(deltaX) > 80 &&
        Math.abs(deltaX) > Math.abs(deltaY) * 2
      ) {
        const currentIndex = PRIMARY_SWIPE_ROUTES.indexOf(pathname);
        if (currentIndex === -1) return;

        let targetUrl = '';
        const swipeDirection: 'swipe-left' | 'swipe-right' =
          deltaX < 0 ? 'swipe-left' : 'swipe-right';

        if (deltaX < 0 && currentIndex < PRIMARY_SWIPE_ROUTES.length - 1) {
          targetUrl = PRIMARY_SWIPE_ROUTES[currentIndex + 1];
        } else if (deltaX > 0 && currentIndex > 0) {
          targetUrl = PRIMARY_SWIPE_ROUTES[currentIndex - 1];
        }

        if (targetUrl) {
          if (typeof document !== 'undefined') {
            document.documentElement.classList.add(swipeDirection);
          }

          if (
            typeof document !== 'undefined' &&
            'startViewTransition' in document
          ) {
            const transition = (document as any).startViewTransition(() => {
              router.push(targetUrl);
            });
            transition.finished.finally(() => {
              if (typeof document !== 'undefined') {
                document.documentElement.classList.remove(swipeDirection);
              }
            });
          } else {
            router.push(targetUrl);
          }
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [mounted, pathname, router]);

  if (pathname === '/' || pathname === '/login' || pathname.startsWith('/auth')) {
    return null;
  }

  if (!mounted) return null;

  const isMoreActive = MORE_MENU_ITEMS.some((item) => pathname.startsWith(item.href));

  const quickActions: QuickActionItem[] = [
    {
      id: 'expense',
      title: 'Log Expense / Income',
      description: 'Record spending, split with friends, or pay credit card',
      icon: Wallet,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      badge: 'Quick Add',
      onClick: () => {
        setIsQuickAddOpen(false);
        setIsAddExpenseOpen(true);
      },
    },
    {
      id: 'sms',
      title: 'Fetch from SMS & Alerts',
      description: 'Auto-extract transactions from bank & UPI alerts',
      icon: MessageSquareText,
      color: 'text-primary bg-primary/10 border-primary/20',
      badge: 'Smart Scan',
      onClick: () => {
        setIsQuickAddOpen(false);
        setIsSmsImportOpen(true);
      },
    },
    {
      id: 'task',
      title: 'New Task',
      description: 'Capture an actionable to-do with deadline & AI subtasks',
      icon: ListTodo,
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
      onClick: () => {
        setIsQuickAddOpen(false);
        setIsCreateTaskOpen(true);
      },
    },
    {
      id: 'habit',
      title: 'New Habit',
      description: 'Create a daily, flexible weekly, or interval habit',
      icon: CheckSquare,
      color: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
      onClick: () => {
        setIsQuickAddOpen(false);
        setIsNewHabitOpen(true);
      },
    },
    {
      id: 'focus',
      title: 'Start Focus Mode',
      description: 'Enter zen focus flow for today’s highest priority habits',
      icon: Sparkles,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      badge: 'Zen Flow',
      onClick: () => {
        setIsQuickAddOpen(false);
        setIsFocusOverlayOpen(true);
      },
    },
  ];

  return (
    <>
      {/* 5-Slot Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/85 backdrop-blur-2xl border-t border-border/50 pb-safe shadow-lg">
        <nav className="flex items-center justify-around h-16 px-1 relative">
          {/* Slot 1: Home */}
          <Link
            href="/dashboard"
            className={cn(
              'relative flex flex-col items-center justify-center w-full h-full space-y-1 text-muted-foreground hover:text-foreground transition-colors tour-mobile-nav-dashboard',
              pathname === '/dashboard' && 'text-primary'
            )}
          >
            {pathname === '/dashboard' && (
              <motion.div
                layoutId="mobile-nav-pill"
                className="absolute inset-1 bg-primary/10 rounded-xl -z-10"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <LayoutDashboard
              className={cn('w-5 h-5', pathname === '/dashboard' && 'text-primary')}
              strokeWidth={pathname === '/dashboard' ? 2.5 : 2}
            />
            <span className="text-[10px] font-semibold tracking-tight">Home</span>
          </Link>

          {/* Slot 2: Habits */}
          <Link
            href="/habits"
            className={cn(
              'relative flex flex-col items-center justify-center w-full h-full space-y-1 text-muted-foreground hover:text-foreground transition-colors tour-mobile-nav-habits',
              pathname === '/habits' && 'text-primary'
            )}
          >
            {pathname === '/habits' && (
              <motion.div
                layoutId="mobile-nav-pill"
                className="absolute inset-1 bg-primary/10 rounded-xl -z-10"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <CheckSquare
              className={cn('w-5 h-5', pathname === '/habits' && 'text-primary')}
              strokeWidth={pathname === '/habits' ? 2.5 : 2}
            />
            <span className="text-[10px] font-semibold tracking-tight">Habits</span>
          </Link>

          {/* Slot 3: Center Elevated [ + ] Action Button */}
          <div className="relative flex items-center justify-center w-full h-full">
            <button
              type="button"
              onClick={() => setIsQuickAddOpen(true)}
              aria-label="Universal Quick Add"
              className="absolute -top-3.5 w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-emerald-500 text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center border-4 border-background active:scale-90 hover:scale-105 transition-all"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
            <span className="text-[9px] font-semibold tracking-tight text-muted-foreground pt-7">
              Add
            </span>
          </div>

          {/* Slot 4: Finance */}
          <Link
            href="/finance"
            className={cn(
              'relative flex flex-col items-center justify-center w-full h-full space-y-1 text-muted-foreground hover:text-foreground transition-colors tour-mobile-nav-finance',
              pathname === '/finance' && 'text-primary'
            )}
          >
            {pathname === '/finance' && (
              <motion.div
                layoutId="mobile-nav-pill"
                className="absolute inset-1 bg-primary/10 rounded-xl -z-10"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <Wallet
              className={cn('w-5 h-5', pathname === '/finance' && 'text-primary')}
              strokeWidth={pathname === '/finance' ? 2.5 : 2}
            />
            <span className="text-[10px] font-semibold tracking-tight">Finance</span>
          </Link>

          {/* Slot 5: More (Drawer) */}
          <button
            type="button"
            onClick={() => setIsMoreDrawerOpen(true)}
            aria-label="Open More options"
            className={cn(
              'relative flex flex-col items-center justify-center w-full h-full space-y-1 text-muted-foreground hover:text-foreground transition-colors tour-mobile-nav-more',
              isMoreActive && 'text-primary'
            )}
          >
            {isMoreActive && (
              <motion.div
                layoutId="mobile-nav-pill"
                className="absolute inset-1 bg-primary/10 rounded-xl -z-10"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <LayoutGrid
              className={cn('w-5 h-5', isMoreActive && 'text-primary')}
              strokeWidth={isMoreActive ? 2.5 : 2}
            />
            <span className="text-[10px] font-semibold tracking-tight">More</span>
          </button>
        </nav>
      </div>

      {/* Sheet 1: Universal Quick-Add Bottom Sheet */}
      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent
          showCloseButton={false}
          className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-md w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col border-border bg-background"
        >
          {/* Mobile Drag Handle */}
          <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
            <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
            <DialogHeader className="text-left space-y-0.5">
              <DialogTitle className="text-base font-bold text-foreground">
                Quick Actions
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Capture habits, track cashflow, or initiate deep focus
              </DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onClick={() => setIsQuickAddOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-2 overflow-y-auto">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={action.onClick}
                  className="w-full p-3 rounded-2xl border border-border/60 bg-card/60 hover:bg-muted/50 active:scale-[0.98] transition-all flex items-center gap-3.5 text-left group"
                >
                  <div
                    className={cn(
                      'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105',
                      action.color
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {action.title}
                      </span>
                      {action.badge && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
                          {action.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {action.description}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sheet 2: More Drawer (Tasks, Goals, Analytics, Leaderboard, Settings) */}
      <Dialog open={isMoreDrawerOpen} onOpenChange={setIsMoreDrawerOpen}>
        <DialogContent
          showCloseButton={false}
          className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-md w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col border-border bg-background"
        >
          {/* Mobile Drag Handle */}
          <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
            <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
            <DialogHeader className="text-left space-y-0.5">
              <DialogTitle className="text-base font-bold text-foreground">
                More Workspaces
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Access your productivity and personal growth toolkit
              </DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onClick={() => setIsMoreDrawerOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-2 overflow-y-auto">
            {MORE_MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    setIsMoreDrawerOpen(false);
                    router.push(item.href);
                  }}
                  className={cn(
                    'w-full p-3 rounded-2xl border transition-all flex items-center gap-3.5 text-left group',
                    isActive
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border/60 bg-card/60 hover:bg-muted/50 active:scale-[0.98]'
                  )}
                >
                  <div
                    className={cn(
                      'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105',
                      item.color
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">
                        {item.label}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sub-Modals Triggered from Quick Actions */}
      <AddTransactionModal
        open={isAddExpenseOpen}
        onOpenChange={setIsAddExpenseOpen}
        onOpenSmsImport={() => {
          setIsAddExpenseOpen(false);
          setIsSmsImportOpen(true);
        }}
      />

      <SmsImportModal
        open={isSmsImportOpen}
        onOpenChange={setIsSmsImportOpen}
      />

      <CreateTaskModal
        open={isCreateTaskOpen}
        onOpenChange={setIsCreateTaskOpen}
        hideTrigger
      />

      <HabitFormModal
        open={isNewHabitOpen}
        onOpenChange={setIsNewHabitOpen}
        onSubmit={async (data) => {
          await addHabit(data);
          toast.success('Habit created!');
          setIsNewHabitOpen(false);
        }}
      />

      <FocusModeOverlay
        isOpen={isFocusOverlayOpen}
        onClose={() => setIsFocusOverlayOpen(false)}
      />
    </>
  );
}
