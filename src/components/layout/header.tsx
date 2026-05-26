'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  CheckSquare,
  ListTodo,
  Target,
  BarChart3,
  Sun,
  Moon,
  Menu,
  X,
  Settings,
  User,
  LogOut,
  Cloud,
  CloudOff,
  Loader2,
  Workflow, // Routine icon
  Trophy,
  Keyboard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';
import { useSync } from '@/providers/sync-provider';
import { SyncStatusBadge } from '@/components/sync/SyncStatusBadge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { UserStatusHUD } from '@/components/gamification/UserStatusHUD';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/routines', label: 'Routines', icon: Workflow },
  { href: '/habits', label: 'Habits', icon: CheckSquare },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { isAuthenticated, user, signOut } = useAuth();
  const { syncStatus, isSyncing } = useSync();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      // Call server-side route to clear cookies reliably
      await fetch('/auth/signout', { method: 'POST', redirect: 'manual' });
      // Force a hard navigation to ensure clean state
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      // Fallback
      router.push('/login');
    }
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="w-full flex h-16 items-center px-4 md:px-6">
        {/* Logo */}
        <div className="flex-grow-0 flex-shrink-0 flex justify-start mr-4 lg:mr-8">
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <motion.div
              className="relative flex h-11 w-11 min-w-[2.75rem] min-h-[2.75rem] aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-purple-600/10 border border-purple-500/30 dark:border-purple-400/40 shadow-sm shadow-purple-500/10 shrink-0 overflow-hidden"
              whileHover={{ scale: 1.05, rotate: [0, -5, 5, 0] }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'tween', duration: 0.5 }}
            >
              <svg
                viewBox="0 0 32 32"
                className="h-7 w-7"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Flowing circular arc representing habits loop */}
                <motion.path
                  d="M 16 4 A 12 12 0 1 1 15.99 4"
                  stroke="url(#logo-grad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
                {/* Completed checkmark flying out representing progression */}
                <motion.path
                  d="M 12 16.5 L 15 19.5 L 21 12.5"
                  stroke="url(#logo-grad-2)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
                />
                <defs>
                  <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--primary)" />
                    <stop offset="100%" stopColor="#9333ea" />
                  </linearGradient>
                  <linearGradient id="logo-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#9333ea" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                  <linearGradient 
                    id="nav-icon-grad-active" 
                    x1="0" 
                    y1="0" 
                    x2="20" 
                    y2="20" 
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="var(--primary)" />
                    <stop offset="100%" stopColor="#d946ef" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
            <span className="hidden font-semibold text-lg sm:inline-block bg-gradient-to-r from-primary via-purple-600 to-pink-500 bg-clip-text text-transparent whitespace-nowrap tracking-tight">
              Habit Flow
            </span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="nav-container hidden md:flex items-center justify-center flex-1 -ml-6 lg:-ml-10">
          <style dangerouslySetInnerHTML={{ __html: `
            @media (max-width: 1535px) {
              .nav-link {
                width: 2.5rem;
                transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s;
              }
              .nav-container:hover .nav-link {
                transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s;
              }
              .nav-link:hover ~ .nav-link {
                transform: translateX(85px);
              }
            }
            .nav-link svg {
              transition: stroke 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .nav-link.nav-link-active svg {
              stroke: url(#nav-icon-grad-active);
            }
            .nav-link:hover svg {
              stroke: url(#nav-icon-grad-active);
              transform: scale(1.15) rotate(4deg) translateY(-0.5px);
            }
          `}} />
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "nav-link relative flex items-center justify-start h-10 px-3 py-2 rounded-lg group",
                  isActive && "nav-link-active"
                )}
              >
                <span
                  className={cn(
                    'flex items-center text-sm font-medium transition-colors whitespace-nowrap',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="relative flex items-center justify-center shrink-0">
                    {/* Premium backlit glow overlay */}
                    <span 
                      className={cn(
                        "absolute -inset-2.5 rounded-full bg-gradient-to-br from-primary/10 via-purple-500/5 to-pink-500/10 dark:from-primary/20 dark:via-purple-500/10 dark:to-pink-500/20 blur-sm opacity-0 transition-all duration-500 scale-75 group-hover:opacity-100 group-hover:scale-100",
                        isActive && "opacity-100 scale-100"
                      )}
                    />
                    <Icon className="h-[20px] w-[20px] shrink-0 relative z-10" />
                  </span>
                  <span className="absolute left-10 opacity-0 pointer-events-none transition-all duration-300 ease-out group-hover:opacity-100 group-hover:translate-x-1 2xl:relative 2xl:left-0 2xl:opacity-100 2xl:pointer-events-auto 2xl:ml-2">
                    {item.label}
                  </span>
                </span>
                
                {/* Premium progress underline effect on hover */}
                <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-primary to-purple-600 transform scale-x-0 origin-left transition-transform duration-300 ease-out group-hover:scale-x-100 2xl:hidden" />

                {isActive && (
                  <div
                    className="absolute inset-0 rounded-lg bg-muted border-none outline-none"
                    style={{ zIndex: -1 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Spacer to push actions to the right on mobile */}
        <div className="flex-grow md:hidden" />

        {/* Right side actions */}
        <div className="flex-grow-0 flex-shrink-0 flex items-center justify-end gap-1.5 lg:gap-2">
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
              <UserStatusHUD />
              <SyncStatusBadge />
            </div>
          )}

          {/* User Menu */}
          {isAuthenticated ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="h-9 w-9"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Sign out</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/login')}
              className="h-9 w-9"
              title="Sign in"
            >
              <User className="h-5 w-5" />
              <span className="sr-only">Sign in</span>
            </Button>
          )}

          {/* Keyboard shortcuts */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-shortcuts'))}
            className="h-9 w-9 text-muted-foreground hover:text-foreground hidden md:inline-flex"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="h-5 w-5" />
            <span className="sr-only">Keyboard Shortcuts</span>
          </Button>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9"
          >
            <motion.div
              initial={false}
              animate={{ rotate: resolvedTheme === 'dark' ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {resolvedTheme === 'dark' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </motion.div>
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl"
        >
          <div className="container px-4 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </motion.nav>
      )}
    </header>
  );
}
