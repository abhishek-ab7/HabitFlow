'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const QuickCaptureModal = dynamic(
  () => import('./QuickCaptureModal').then((m) => ({ default: m.QuickCaptureModal })),
  { ssr: false }
);

export function QuickCaptureLauncher() {
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('capture') === '1') {
      setActivated(true);
      return;
    }

    const activate = () => setActivated(true);
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActivated(true);
        return;
      }
      const tag = document.activeElement?.tagName;
      if (
        e.key.toLowerCase() === 'q' &&
        tag !== 'INPUT' &&
        tag !== 'TEXTAREA' &&
        (document.activeElement as HTMLElement | null)?.getAttribute('contenteditable') !== 'true' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setActivated(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('open-quick-capture', activate);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('open-quick-capture', activate);
    };
  }, []);

  if (!activated) return null;
  return <QuickCaptureModal defaultOpen />;
}
