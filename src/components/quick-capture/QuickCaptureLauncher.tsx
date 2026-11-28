'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { VoiceOrbButton } from './VoiceOrbButton';

const QuickCaptureModal = dynamic(
  () => import('./QuickCaptureModal').then((m) => ({ default: m.QuickCaptureModal })),
  { ssr: false }
);

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'INPUT') return true;
  if (el.tagName === 'TEXTAREA') return true;
  return (el as HTMLElement).getAttribute('contenteditable') === 'true';
}

function isQuickCaptureShortcut(e: KeyboardEvent): boolean {
  const key = e.key.toLowerCase();
  const hasCmdOrCtrl = e.metaKey || e.ctrlKey;
  if (hasCmdOrCtrl && key === 'k') return true;
  if (key !== 'q') return false;
  if (hasCmdOrCtrl || e.altKey) return false;
  return !isEditableElement(document.activeElement);
}

export function QuickCaptureLauncher() {
  const [activated, setActivated] = useState(false);
  const [voicePayload, setVoicePayload] = useState<{ text: string; seq: number } | null>(null);

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

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setActivated(true);
    setVoicePayload((prev) => ({ text: transcript, seq: (prev?.seq ?? 0) + 1 }));
    window.dispatchEvent(new Event('open-quick-capture'));
  }, []);

  return (
    <>
      <VoiceOrbButton onTranscriptReady={handleVoiceTranscript} />
      {activated && (
        <QuickCaptureModal
          defaultOpen
          initialVoiceText={voicePayload?.text}
          initialVoiceSeq={voicePayload?.seq}
        />
      )}
    </>
  );
}
