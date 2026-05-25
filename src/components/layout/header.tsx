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
  Workflow // Routine icon
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
      await fetch('/auth/signout', { method: 'POST' });
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
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <motion.div
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground font-bold text-lg shrink-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              HF
            </motion.div>
            <span className="hidden font-semibold text-lg sm:inline-block bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent whitespace-nowrap">
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
          `}} />
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link relative flex items-center justify-start h-10 px-3 py-2 rounded-lg group"
              >
                <span
                  className={cn(
                    'flex items-center text-sm font-medium transition-colors whitespace-nowrap',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="absolute left-10 opacity-0 pointer-events-none transition-all duration-300 ease-out group-hover:opacity-100 group-hover:translate-x-1 2xl:relative 2xl:left-0 2xl:opacity-100 2xl:pointer-events-auto 2xl:ml-2">
                    {item.label}
                  </span>
                </span>
                
                {/* Premium progress underline effect on hover */}
                <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-primary to-purple-600 transform scale-x-0 origin-left transition-transform duration-300 ease-out group-hover:scale-x-100 2xl:hidden" />

                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-lg bg-muted"
                    layoutId="navbar-indicator"
                    style={{ zIndex: -1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 35,
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side actions */}
        <div className="flex-grow-0 flex-shrink-0 flex items-center justify-end gap-1.5 lg:gap-2">
          {isAuthenticated && <UserStatusHUD />}
          {/* Sync Status Badge */}
          {isAuthenticated && <SyncStatusBadge />}

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
