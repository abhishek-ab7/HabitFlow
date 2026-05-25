'use client';

import { useCallback } from 'react';
import useSound from 'use-sound';

export function useFeedback() {
  // We assume soundEnabled and hapticsEnabled will be retrieved from local storage or context.
  // For now, we fetch from localStorage directly or default to true to stay purely client-side
  // and avoid hydrating issues if the store isn't ready.
  
  const getSettings = () => {
    if (typeof window === 'undefined') return { sound: true, haptics: true };
    try {
      const settings = localStorage.getItem('feedback_settings');
      if (settings) {
        return JSON.parse(settings);
      }
    } catch (e) {
      // ignore
    }
    return { sound: true, haptics: true };
  };

  const { sound, haptics } = getSettings();

  const [playPop] = useSound('/sounds/pop.mp3', { soundEnabled: sound });
  const [playChime] = useSound('/sounds/chime.mp3', { soundEnabled: sound });

  const triggerPop = useCallback(() => {
    if (sound) playPop();
    if (haptics && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([50]);
      } catch (e) {}
    }
  }, [playPop, sound, haptics]);

  const triggerChime = useCallback(() => {
    if (sound) playChime();
    if (haptics && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch (e) {}
    }
  }, [playChime, sound, haptics]);

  return { triggerPop, triggerChime };
}
