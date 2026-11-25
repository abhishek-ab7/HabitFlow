'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

const ShortcutsModal = dynamic(() => import('@/components/ui/ShortcutsModal'), {
  ssr: false,
});

export function ShortcutsProvider() {
  useKeyboardShortcuts();
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }
      if (event.key === '?' && event.shiftKey) {
        setHasOpened(true);
      }
    };
    const onToggle = () => setHasOpened(true);

    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('toggle-shortcuts', onToggle);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('toggle-shortcuts', onToggle);
    };
  }, []);

  if (!hasOpened) return null;
  return <ShortcutsModal defaultOpen />;
}
