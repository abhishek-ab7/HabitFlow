'use client';

import { useCallback } from 'react';

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

  const playPopSynth = () => {
    if (typeof window === 'undefined') return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      console.error(e);
    }
  };

  const playChimeSynth = () => {
    if (typeof window === 'undefined') return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playNote = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration - 0.02);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      const now = ctx.currentTime;
      playNote(523.25, now, 0.15); // C5
      playNote(659.25, now + 0.08, 0.15); // E5
      playNote(783.99, now + 0.16, 0.3); // G5
    } catch (e) {
      console.error(e);
    }
  };

  const triggerPop = useCallback(() => {
    if (sound) playPopSynth();
    if (haptics && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([40]);
      } catch (e) {}
    }
  }, [sound, haptics]);

  const triggerChime = useCallback(() => {
    if (sound) playChimeSynth();
    if (haptics && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([80, 40, 80]);
      } catch (e) {}
    }
  }, [sound, haptics]);

  return { triggerPop, triggerChime };
}
