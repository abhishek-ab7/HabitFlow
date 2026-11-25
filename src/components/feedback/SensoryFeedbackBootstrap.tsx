'use client';

import { useEffect } from 'react';
import { unlockAudio } from '@/lib/feedback/sensory-engine';

export function SensoryFeedbackBootstrap() {
  useEffect(() => {
    const handleGestureUnlock = () => {
      unlockAudio();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        unlockAudio();
      }
    };

    window.addEventListener('pointerdown', handleGestureUnlock, { passive: true, capture: true });
    window.addEventListener('touchstart', handleGestureUnlock, { passive: true, capture: true });
    window.addEventListener('keydown', handleGestureUnlock, { passive: true, capture: true });
    document.addEventListener('visibilitychange', handleVisibility, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleGestureUnlock, { capture: true });
      window.removeEventListener('touchstart', handleGestureUnlock, { capture: true });
      window.removeEventListener('keydown', handleGestureUnlock, { capture: true });
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return null;
}
