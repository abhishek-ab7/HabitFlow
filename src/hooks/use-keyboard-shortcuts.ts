'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function useKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts if the user is typing in an input/textarea
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      // Navigation Shortcuts
      if (key === 'd') {
        router.push('/dashboard');
      } else if (key === 'h') {
        router.push('/habits');
      } else if (key === 'g') {
        router.push('/goals');
      } else if (key === 'a') {
        router.push('/analytics');
      } 
      // Action Shortcuts
      else if (key === 'n') {
        event.preventDefault();
        router.push('/habits?new=true');
      } else if (key === 'c') {
        event.preventDefault();
        router.push('/goals?new=true');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router, pathname]);
}
