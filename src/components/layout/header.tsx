'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useFeedback } from '@/hooks/use-feedback';
import {
  getVisibleNavItems,
  HeaderBrandLogo,
  HeaderDesktopNav,
  HeaderMobileNav,
  HeaderRightActions,
} from './HeaderParts';

const HIDDEN_HEADER_PATHS = new Set(['/', '/login']);

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const feedback = useFeedback();
  const settings = useGamificationStore((s) => s.settings);

  if (HIDDEN_HEADER_PATHS.has(pathname) || pathname.startsWith('/auth')) return null;

  const visibleNavItems = getVisibleNavItems(settings);

  const handleSignOut = async () => {
    try {
      await fetch('/auth/signout', { method: 'POST', redirect: 'manual' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      router.push('/login');
    }
  };

  const toggleTheme = () => {
    const nextDark = resolvedTheme !== 'dark';
    feedback.toggle(nextDark);
    setTheme(nextDark ? 'dark' : 'light');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/98 dark:bg-card/98 md:surface-chrome">
      <div className="w-full flex h-14 md:h-16 items-center px-4 md:px-6">
        <HeaderBrandLogo isAuthenticated={isAuthenticated} />
        <HeaderDesktopNav items={visibleNavItems} pathname={pathname} onTap={() => feedback.tap()} />
        <div className="flex-grow md:hidden" />
        <HeaderRightActions
          isAuthenticated={isAuthenticated}
          resolvedTheme={resolvedTheme}
          mobileMenuOpen={mobileMenuOpen}
          onSignOut={handleSignOut}
          onSignIn={() => router.push('/login')}
          onToggleTheme={toggleTheme}
          onToggleMobileMenu={() => setMobileMenuOpen((p) => !p)}
        />
      </div>

      {mobileMenuOpen && (
        <HeaderMobileNav
          items={visibleNavItems}
          pathname={pathname}
          onNavigate={() => {
            feedback.tap();
            setMobileMenuOpen(false);
          }}
        />
      )}
    </header>
  );
}
