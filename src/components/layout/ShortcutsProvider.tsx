'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

const ShortcutsModal = dynamic(() => import('@/components/ui/ShortcutsModal'), {
  ssr: false,
});

function isEditableActiveElement(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return true;
  return active.getAttribute('contenteditable') === 'true';
}

export function ShortcutsProvider() {
  useKeyboardShortcuts();
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableActiveElement()) return;
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
