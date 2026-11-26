'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BarChart3, CheckSquare, Dumbbell, Keyboard, LayoutDashboard, ListTodo, LogOut, Menu, Moon, Settings, Sparkles, Sun, Target, User, Wallet, X, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SyncStatusBadge } from '@/components/sync/SyncStatusBadge';
import { HeaderAlertsBell } from '@/components/alerts/UnifiedAlertManager';
import type { UserSettings } from '@/lib/types';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/habits', label: 'Habits', icon: CheckSquare },
  { href: '/fitness', label: 'Fitness', icon: Dumbbell },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/finance', label: 'Finance', icon: Wallet },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const HABIT_ONLY_HREFS = new Set(['/dashboard', '/habits', '/analytics', '/settings']);

function isNavItemVisible(item: NavItem, settings?: UserSettings | null): boolean {
  if (settings?.habitOnlyMode) return HABIT_ONLY_HREFS.has(item.href);
  const hiddenBySetting: Record<string, boolean | undefined> = {
    '/tasks': settings?.showTasks === false,
    '/goals': settings?.showGoals === false,
    '/fitness': settings?.showFitness === false,
    '/finance': settings?.showFinance === false,
  };
  return !hiddenBySetting[item.href];
}

export function getVisibleNavItems(settings?: UserSettings | null): NavItem[] {
  return NAV_ITEMS.filter((item) => isNavItemVisible(item, settings));
}

export function HeaderBrandLogo({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="flex-grow-0 flex-shrink-0 flex justify-start mr-4 lg:mr-8">
      <Link href={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2.5 flex-shrink-0">
        <motion.div
          className="relative flex h-10 w-10 min-w-[2.5rem] min-h-[2.5rem] aspect-square items-center justify-center rounded-xl bg-primary/10 border border-primary/25 shadow-sm shrink-0 overflow-hidden"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'tween', duration: 0.25 }}
        >
          <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <motion.path d="M 16 4 A 12 12 0 1 1 15.99 4" stroke="url(#logo-grad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.0, ease: 'easeOut' }} />
            <motion.path d="M 12 16.5 L 15 19.5 L 21 12.5" stroke="url(#logo-grad-2)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.7, delay: 0.45, ease: 'easeOut' }} />
            <defs>
              <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="var(--primary)" /><stop offset="100%" stopColor="oklch(0.65 0.14 175)" /></linearGradient>
              <linearGradient id="logo-grad-2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="var(--primary)" /><stop offset="100%" stopColor="var(--info)" /></linearGradient>
            </defs>
          </svg>
        </motion.div>
        <span className="hidden font-semibold text-base sm:inline-block text-foreground whitespace-nowrap tracking-tight">
          Habit<span className="text-primary">Flow</span>
        </span>
      </Link>
    </div>
  );
}

export function HeaderDesktopNav({ items, pathname, onTap }: { items: NavItem[]; pathname: string; onTap: () => void }) {
  return (
    <nav className="nav-container hidden md:flex items-center justify-center flex-1 -ml-6 lg:-ml-10">
      <style dangerouslySetInnerHTML={{ __html: `.nav-link{width:2.5rem;transition:transform .25s cubic-bezier(.16,1,.3,1),background-color .2s}.nav-link:hover~.nav-link{transform:translateX(85px)}.nav-link svg{transition:color .2s ease,transform .3s cubic-bezier(.34,1.56,.64,1)}.nav-link:hover svg{transform:scale(1.1) translateY(-.5px)}` }} />
      {items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} onClick={onTap} className={cn('nav-link relative flex items-center justify-start h-10 px-3 py-2 rounded-lg group', `tour-nav-${item.label.toLowerCase()}`, isActive && 'nav-link-active')}>
            <span className={cn('flex items-center text-sm font-medium transition-colors whitespace-nowrap', isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
              <span className="relative flex items-center justify-center shrink-0"><Icon className="h-[20px] w-[20px] shrink-0 relative z-10" /></span>
              <span className="absolute left-10 opacity-0 pointer-events-none transition-all duration-200 ease-out group-hover:opacity-100 group-hover:translate-x-1">{item.label}</span>
            </span>
            <span className={cn('absolute bottom-0 left-3 right-3 h-[2px] bg-primary transform origin-left transition-transform duration-200 ease-out', isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100')} />
            {isActive && <div className="absolute inset-0 rounded-lg bg-accent/70 border-none outline-none" style={{ zIndex: -1 }} />}
          </Link>
        );
      })}
    </nav>
  );
}

export function HeaderRightActions(params: {
  isAuthenticated: boolean;
  resolvedTheme?: string;
  mobileMenuOpen: boolean;
  onSignOut: () => void;
  onSignIn: () => void;
  onToggleTheme: () => void;
  onToggleMobileMenu: () => void;
}) {
  return (
    <div className="flex-grow-0 flex-shrink-0 flex items-center justify-end gap-1.5 lg:gap-2">
      {params.isAuthenticated && <div className="hidden md:flex items-center gap-1.5 lg:gap-2"><SyncStatusBadge /></div>}
      <HeaderAlertsBell />
      {params.isAuthenticated ? (
        <Button variant="ghost" size="icon" onClick={params.onSignOut} className="h-9 w-9" title="Sign out">
          <LogOut className="h-5 w-5" /><span className="sr-only">Sign out</span>
        </Button>
      ) : (
        <Button variant="ghost" size="icon" onClick={params.onSignIn} className="h-9 w-9" title="Sign in">
          <User className="h-5 w-5" /><span className="sr-only">Sign in</span>
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('open-quick-capture'))} className="hidden md:inline-flex h-9 px-2.5 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/70 rounded-lg" title="Quick Capture (Ctrl+K)">
        <Sparkles className="h-4 w-4 text-primary" /><span className="hidden lg:inline">Capture</span>
      </Button>
      <Button variant="ghost" size="icon" onClick={() => window.dispatchEvent(new CustomEvent('toggle-shortcuts'))} className="h-9 w-9 text-muted-foreground hover:text-foreground hidden md:inline-flex tour-nav-shortcuts" title="Keyboard Shortcuts (?)">
        <Keyboard className="h-5 w-5" /><span className="sr-only">Keyboard Shortcuts</span>
      </Button>
      <Button variant="ghost" size="icon" onClick={params.onToggleTheme} className="h-9 w-9">
        <motion.div initial={false} animate={{ rotate: params.resolvedTheme === 'dark' ? 180 : 0 }} transition={{ duration: 0.3 }}>
          {params.resolvedTheme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </motion.div>
        <span className="sr-only">Toggle theme</span>
      </Button>
      <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" onClick={params.onToggleMobileMenu}>
        {params.mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        <span className="sr-only">Toggle menu</span>
      </Button>
    </div>
  );
}

export function HeaderMobileNav({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate: () => void }) {
  return (
    <motion.nav initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="md:hidden border-t bg-background dark:bg-card">
      <div className="container px-4 py-4 space-y-1">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} className={cn('flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors', isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
