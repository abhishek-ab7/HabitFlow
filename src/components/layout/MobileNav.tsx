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
  User,
  ChevronRight,
  X,
  Dumbbell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useFeedback } from '@/hooks/use-feedback';

interface MoreMenuItem {
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const MORE_MENU_ITEMS: MoreMenuItem[] = [
  {
    href: '/habits',
    label: 'Habits & Routines',
    description: 'Daily streaks, anti-habits & anchor blocks',
    icon: CheckSquare,
    color: 'text-emerald-500 bg-emerald-500/10',
  },
  {
    href: '/tasks',
    label: 'Tasks',
    description: 'Priorities, Eisenhower matrix & daily checklist',
    icon: ListTodo,
    color: 'text-info bg-info/10',
  },
  {
    href: '/goals',
    label: 'Goals',
    description: 'SMART goals, financial targets & roadmaps',
    icon: Target,
    color: 'text-warning bg-warning/10',
  },
  {
    href: '/analytics',
    label: 'Analytics',
    description: 'Spending correlations, pace charts & heatmaps',
    icon: BarChart3,
    color: 'text-primary bg-primary/10',
  },
  {
    href: '/settings',
    label: 'Settings & Profile',
    description: 'Appearance, notifications, backup & account',
    icon: User,
    color: 'text-muted-foreground bg-muted',
  },
];

function isSwipeIgnoredTarget(target: HTMLElement): boolean {
  return Boolean(
    target.closest('input, textarea, select, button, a') ||
    target.closest('[role="dialog"]') ||
    target.closest('[role="slider"]') ||
    target.closest('.no-swipe') ||
    target.closest('[data-no-swipe="true"]') ||
    target.closest('.overflow-x-auto') ||
    target.closest('.overflow-y-auto') ||
    target.closest('[class*="overflow-x-"]') ||
    target.closest('[class*="overflow-y-"]')
  );
}

function isHorizontalSwipe(deltaX: number, deltaY: number, duration: number) {
  return duration < 500 && Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 2;
}

function resolveSwipeNavigation(ctx: {
  deltaX: number;
  deltaY: number;
  duration: number;
  pathname: string;
  swipeRoutes: string[];
}): { targetUrl: string; direction: 'swipe-left' | 'swipe-right' } | null {
  if (!isHorizontalSwipe(ctx.deltaX, ctx.deltaY, ctx.duration)) return null;
  const currentIndex = ctx.swipeRoutes.indexOf(ctx.pathname);
  if (currentIndex === -1) return null;

  const isLeft = ctx.deltaX < 0;
  const nextIndex = isLeft ? currentIndex + 1 : currentIndex - 1;
  if (nextIndex < 0 || nextIndex >= ctx.swipeRoutes.length) return null;

  return { targetUrl: ctx.swipeRoutes[nextIndex], direction: isLeft ? 'swipe-left' : 'swipe-right' };
}

function NavActivePill({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return (
    <motion.div
      layoutId="mobile-nav-pill"
      className="absolute inset-1 bg-primary/10 rounded-xl -z-10"
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    />
  );
}

function MobileNavLink({
  href,
  label,
  icon: Icon,
  isActive,
  className,
  onTap,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  isActive: boolean;
  className?: string;
  onTap: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onTap}
      className={cn(
        'relative flex flex-col items-center justify-center w-full h-full space-y-1 text-muted-foreground hover:text-foreground transition-colors',
        className,
        isActive && 'text-primary'
      )}
    >
      <NavActivePill isActive={isActive} />
      <Icon className={cn('w-5 h-5', isActive && 'text-primary')} strokeWidth={isActive ? 2.5 : 2} />
      <span className="text-[10px] font-semibold tracking-tight">{label}</span>
    </Link>
  );
}

function navigateWithTransition(
  router: ReturnType<typeof useRouter>,
  targetUrl: string,
  direction: 'swipe-left' | 'swipe-right'
) {
  if (typeof document === 'undefined') {
    router.push(targetUrl);
    return;
  }
  document.documentElement.classList.add(direction);
  if ('startViewTransition' in document) {
    const transition = (document as unknown as { startViewTransition: (cb: () => void) => { finished: Promise<void> } }).startViewTransition(() => {
      router.push(targetUrl);
    });
    transition.finished.finally(() => document.documentElement.classList.remove(direction));
    return;
  }
  router.push(targetUrl);
}

function MobileMoreDrawer({
  open,
  onOpenChange,
  items,
  pathname,
  onTap,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: typeof MORE_MENU_ITEMS;
  pathname: string;
  onTap: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-md w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col border-border bg-background"
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
          <DialogHeader className="text-left space-y-0.5">
            <DialogTitle className="text-base font-bold text-foreground">More Workspaces</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Access your productivity and personal growth toolkit
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-2 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  onTap();
                  onOpenChange(false);
                }}
                className={cn(
                  'w-full p-3 rounded-xl border transition-colors flex items-center gap-3.5 text-left group',
                  isActive
                    ? 'border-primary/40 bg-accent/60'
                    : 'border-border/50 bg-muted/45 hover:bg-muted/75 active:scale-[0.98]'
                )}
              >
                <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105', item.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">{item.label}</span>
                    {isActive && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary">Active</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function isHiddenMobileNavRoute(pathname: string) {
  return pathname === '/' || pathname === '/login' || pathname.startsWith('/auth');
}

function useMobileSwipeNavigation({
  mounted,
  pathname,
  router,
  swipeRoutes,
  showFinance,
  showFitness,
}: {
  mounted: boolean;
  pathname: string;
  router: ReturnType<typeof useRouter>;
  swipeRoutes: string[];
  showFinance: boolean;
  showFitness: boolean;
}) {
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1 || isSwipeIgnoredTarget(e.target as HTMLElement)) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 0) return;
      const result = resolveSwipeNavigation({
        deltaX: e.changedTouches[0].clientX - touchStartX,
        deltaY: e.changedTouches[0].clientY - touchStartY,
        duration: Date.now() - touchStartTime,
        pathname,
        swipeRoutes,
      });
      if (result) navigateWithTransition(router, result.targetUrl, result.direction);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [mounted, pathname, router, showFinance, showFitness]);
}

function MobileBottomBar({
  pathname,
  showFitness,
  showFinance,
  isMoreActive,
  onTap,
  onOpenCapture,
  onOpenMore,
}: {
  pathname: string;
  showFitness: boolean;
  showFinance: boolean;
  isMoreActive: boolean;
  onTap: () => void;
  onOpenCapture: () => void;
  onOpenMore: () => void;
}) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/98 dark:bg-card/98 border-t border-border/80 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)]">
      <nav className="flex items-center justify-around h-16 px-1 relative">
        <MobileNavLink
          href="/dashboard"
          label="Home"
          icon={LayoutDashboard}
          isActive={pathname === '/dashboard'}
          className="tour-mobile-nav-dashboard"
          onTap={onTap}
        />

        {showFitness ? (
          <MobileNavLink href="/fitness" label="Fitness" icon={Dumbbell} isActive={pathname.startsWith('/fitness')} onTap={onTap} />
        ) : (
          <MobileNavLink href="/habits" label="Habits" icon={CheckSquare} isActive={pathname === '/habits'} className="tour-mobile-nav-habits" onTap={onTap} />
        )}

        <div className="relative flex items-center justify-center w-full h-full">
          <button
            type="button"
            onClick={onOpenCapture}
            aria-label="10-Second Universal Capture"
            className="absolute -top-3.5 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center border-4 border-background active:scale-90 hover:scale-105 transition-all"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
          <span className="text-[9px] font-semibold tracking-tight text-muted-foreground pt-7">Capture</span>
        </div>

        {showFinance ? (
          <MobileNavLink href="/finance" label="Finance" icon={Wallet} isActive={pathname === '/finance'} className="tour-mobile-nav-finance" onTap={onTap} />
        ) : (
          <MobileNavLink href="/analytics" label="Analytics" icon={BarChart3} isActive={pathname === '/analytics'} onTap={onTap} />
        )}

        <button
          type="button"
          onClick={onOpenMore}
          aria-label="Open More options"
          className={cn(
            'relative flex flex-col items-center justify-center w-full h-full space-y-1 text-muted-foreground hover:text-foreground transition-colors tour-mobile-nav-more',
            isMoreActive && 'text-primary'
          )}
        >
          <NavActivePill isActive={isMoreActive} />
          <LayoutGrid className={cn('w-5 h-5', isMoreActive && 'text-primary')} strokeWidth={isMoreActive ? 2.5 : 2} />
          <span className="text-[10px] font-semibold tracking-tight">More</span>
        </button>
      </nav>
    </div>
  );
}

function getNavVisibility(settings: ReturnType<typeof useGamificationStore.getState>['settings']) {
  const habitOnly = Boolean(settings?.habitOnlyMode);
  return {
    showFitness: !habitOnly && settings?.showFitness !== false,
    showFinance: !habitOnly && settings?.showFinance !== false,
    showTasks: !habitOnly && settings?.showTasks !== false,
    showGoals: !habitOnly && settings?.showGoals !== false,
  };
}

function getVisibleMoreItems(vis: ReturnType<typeof getNavVisibility>) {
  const visibilityRules: Record<string, boolean> = {
    '/habits': vis.showFitness,
    '/tasks': vis.showTasks,
    '/goals': vis.showGoals,
    '/analytics': vis.showFinance,
  };
  return MORE_MENU_ITEMS.filter((item) => visibilityRules[item.href] ?? true);
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);
  const feedback = useFeedback();

  const settings = useGamificationStore((s) => s.settings);
  const vis = getNavVisibility(settings);
  const { showFitness, showFinance } = vis;
  const swipeRoutes = ['/dashboard', showFitness ? '/fitness' : '/habits', showFinance ? '/finance' : '/analytics'];
  const visibleMoreItems = getVisibleMoreItems(vis);

  useEffect(() => {
    setMounted(true);
  }, []);

  useMobileSwipeNavigation({ mounted, pathname, router, swipeRoutes, showFinance, showFitness });

  if (isHiddenMobileNavRoute(pathname) || !mounted) return null;

  const isMoreActive = visibleMoreItems.some((item) => pathname.startsWith(item.href));

  return (
    <>
      <MobileBottomBar
        pathname={pathname}
        showFitness={showFitness}
        showFinance={showFinance}
        isMoreActive={isMoreActive}
        onTap={() => feedback.tap()}
        onOpenCapture={() => {
          feedback.toggle(true);
          window.dispatchEvent(new Event('open-quick-capture'));
        }}
        onOpenMore={() => {
          feedback.toggle(true);
          setIsMoreDrawerOpen(true);
        }}
      />

      <MobileMoreDrawer
        open={isMoreDrawerOpen}
        onOpenChange={setIsMoreDrawerOpen}
        items={visibleMoreItems}
        pathname={pathname}
        onTap={() => feedback.tap()}
      />
    </>
  );
}
