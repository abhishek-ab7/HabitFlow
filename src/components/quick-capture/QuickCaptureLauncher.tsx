'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const QuickCaptureModal = dynamic(
  () => import('./QuickCaptureModal').then((m) => ({ default: m.QuickCaptureModal })),
  { ssr: false }
);

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
  return (el as HTMLElement).getAttribute('contenteditable') === 'true';
}

function isQuickCaptureShortcut(e: KeyboardEvent): boolean {
  const key = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && key === 'k') return true;
  if (key !== 'q' || e.metaKey || e.ctrlKey || e.altKey) return false;
  return !isEditableElement(document.activeElement);
}

export function QuickCaptureLauncher() {
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('capture') === '1') {
      setActivated(true);
      return;
    }

    const activate = () => setActivated(true);
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isQuickCaptureShortcut(e)) return;
      e.preventDefault();
      setActivated(true);
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
