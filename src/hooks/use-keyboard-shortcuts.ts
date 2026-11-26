'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const NAV_SHORTCUT_ROUTES: Record<string, string> = {
  d: '/dashboard',
  h: '/habits',
  g: '/goals',
  f: '/finance',
  a: '/analytics',
};

const ACTION_SHORTCUT_ROUTES: Record<string, string> = {
  n: '/habits?new=true',
  c: '/goals?new=true',
};

function isEditableElementFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return true;
  return active.getAttribute('contenteditable') === 'true';
}

export function useKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElementFocused()) return;

      const key = event.key.toLowerCase();
      const navRoute = NAV_SHORTCUT_ROUTES[key];
      if (navRoute) return router.push(navRoute);

      const actionRoute = ACTION_SHORTCUT_ROUTES[key];
      if (actionRoute) {
        event.preventDefault();
        router.push(actionRoute);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router, pathname]);
}
