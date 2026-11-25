'use client';

import { useCallback, useMemo } from 'react';
import {
  getSensoryDiagnostics,
  playSound,
  sensoryEngine,
  triggerHaptic,
  triggerSensoryFeedback,
  type SensoryEventType,
} from '@/lib/feedback/sensory-engine';

export function useFeedback() {
  const tap = useCallback(() => {
    triggerSensoryFeedback('tap');
  }, []);

  const toggle = useCallback((isOn = true) => {
    triggerSensoryFeedback('toggle', { isOn });
  }, []);

  const complete = useCallback(() => {
    triggerSensoryFeedback('complete');
  }, []);

  const uncheck = useCallback(() => {
    triggerSensoryFeedback('uncheck');
  }, []);

  const success = useCallback(() => {
    triggerSensoryFeedback('success');
  }, []);

  const milestone = useCallback(() => {
    triggerSensoryFeedback('milestone');
  }, []);

  const warning = useCallback(() => {
    triggerSensoryFeedback('warning');
  }, []);

  const error = useCallback(() => {
    triggerSensoryFeedback('error');
  }, []);

  const coin = useCallback(() => {
    triggerSensoryFeedback('coin');
  }, []);

  const haptic = useCallback((type: SensoryEventType = 'tap') => {
    triggerHaptic(type);
  }, []);

  const play = useCallback((type: SensoryEventType, options?: { isOn?: boolean }) => {
    playSound(type, options);
  }, []);

  return useMemo(
    () => ({
      tap,
      toggle,
      complete,
      uncheck,
      success,
      milestone,
      warning,
      error,
      coin,
      haptic,
      playSound: play,
      unlockAudio: sensoryEngine.unlockAudio,
      getDiagnostics: getSensoryDiagnostics,
      // Backwards-compatible aliases
      triggerTap: tap,
      triggerPop: uncheck,
      triggerChime: complete,
      triggerSuccess: success,
    }),
    [tap, toggle, complete, uncheck, success, milestone, warning, error, coin, haptic, play]
  );
}
