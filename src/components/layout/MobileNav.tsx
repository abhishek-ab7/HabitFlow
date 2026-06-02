'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, CheckSquare, ListTodo, Target, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const mobileNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/habits', label: 'Habits', icon: CheckSquare },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/settings', label: 'Profile', icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

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
      // Avoid gesture triggers on multi-touch events
      if (e.touches.length > 1) return;

      const target = e.target as HTMLElement;

      // Ignore swipes starting inside interactive inputs, dialogs, scroll containers, or drag handlers
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

      // Ensure it's a quick swipe (under 500ms), long enough (> 80px),
      // and primarily horizontal (deltaX is at least double deltaY)
      if (duration < 500 && Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
        // Detect current tab index
        const currentIndex = mobileNavItems.findIndex(item => item.href === pathname);
        if (currentIndex === -1) return;

        let targetUrl = '';
        let swipeDirection: 'swipe-left' | 'swipe-right' = 'swipe-left';

        if (deltaX < 0) {
          // Swipe Left -> finger moves left -> shows tab to the right
          if (currentIndex < mobileNavItems.length - 1) {
            targetUrl = mobileNavItems[currentIndex + 1].href;
            swipeDirection = 'swipe-left';
          }
        } else {
          // Swipe Right -> finger moves right -> shows tab to the left
          if (currentIndex > 0) {
            targetUrl = mobileNavItems[currentIndex - 1].href;
            swipeDirection = 'swipe-right';
          }
        }

        if (targetUrl) {
          if (typeof document !== 'undefined') {
            document.documentElement.classList.add(swipeDirection);
          }

          if (typeof document !== 'undefined' && 'startViewTransition' in document) {
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

  // Hide the global mobile navigation on public landing page, login page, and auth callback pages
  if (pathname === '/' || pathname === '/login' || pathname.startsWith('/auth')) {
    return null;
  }

  if (!mounted) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/40 pb-safe">
      <nav className="flex items-center justify-around h-16 px-2">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center w-full h-full space-y-1 text-muted-foreground hover:text-foreground transition-colors",
                `tour-mobile-nav-${item.label.toLowerCase() === 'profile' ? 'settings' : item.label.toLowerCase()}`,
                isActive && "text-primary"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-pill"
                  className="absolute inset-0 bg-primary/10 rounded-lg -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className={cn("w-5 h-5", isActive && "text-primary")} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
