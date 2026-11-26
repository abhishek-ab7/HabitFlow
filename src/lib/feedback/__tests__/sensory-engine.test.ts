import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  SENSORY_PREFS_STORAGE_KEY,
  getSensoryDiagnostics,
  getSensoryPreferences,
  playSound,
  resetSensoryEngineForTests,
  setSensoryPreferences,
  syncSensoryPrefsFromSettings,
  triggerHaptic,
  triggerSensoryFeedback,
  unlockAudio,
} from '../sensory-engine';
import { useFeedback } from '@/hooks/use-feedback';

interface MockAudioContextInstance {
  state: AudioContextState;
  currentTime: number;
  destination: object;
  resume: ReturnType<typeof vi.fn>;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  createBuffer: ReturnType<typeof vi.fn>;
  createBufferSource: ReturnType<typeof vi.fn>;
}

function createMockAudioContextFactory(initialState: AudioContextState = 'suspended') {
  const instances: MockAudioContextInstance[] = [];

  const createOscillatorMock = () => ({
    type: 'sine' as OscillatorType,
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });

  const createGainMock = () => ({
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  });

  const MockAudioContext = vi.fn(function MockCtx(this: MockAudioContextInstance) {
    this.state = initialState;
    this.currentTime = 1.5;
    this.destination = {};
    this.resume = vi.fn(async () => {
      this.state = 'running';
    });
    this.createOscillator = vi.fn(createOscillatorMock);
    this.createGain = vi.fn(createGainMock);
    this.createBuffer = vi.fn(() => ({}));
    this.createBufferSource = vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
    }));
    instances.push(this);
  });

  return { MockAudioContext, instances };
}

describe('sensory-engine', () => {
  const originalAudioContext = window.AudioContext;
  const originalWebkitAudioContext = window.webkitAudioContext;
  const originalVibrate = navigator.vibrate;

  function configureSensoryGlobals(opts: {
    audioContext: typeof AudioContext | undefined;
    webkitAudioContext: typeof AudioContext | undefined;
    vibrate: typeof navigator.vibrate;
  }) {
    delete window.median;
    delete window.gonative;
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: opts.audioContext,
    });
    Object.defineProperty(window, 'webkitAudioContext', {
      configurable: true,
      writable: true,
      value: opts.webkitAudioContext,
    });
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      writable: true,
      value: opts.vibrate,
    });
  }

  beforeEach(() => {
    resetSensoryEngineForTests();
    window.localStorage.clear();
    configureSensoryGlobals({
      audioContext: undefined,
      webkitAudioContext: undefined,
      vibrate: vi.fn(() => true),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetSensoryEngineForTests();
    configureSensoryGlobals({
      audioContext: originalAudioContext,
      webkitAudioContext: originalWebkitAudioContext,
      vibrate: originalVibrate,
    });
  });

  describe('preferences & storage sync', () => {
    it('defaults both sound and haptics to true and persists syncSensoryPrefsFromSettings', () => {
      expect(getSensoryPreferences()).toEqual({ soundEnabled: true, hapticsEnabled: true });

      const synced = syncSensoryPrefsFromSettings({ soundEnabled: false, hapticsEnabled: true });
      expect(synced).toEqual({ soundEnabled: false, hapticsEnabled: true });

      const stored = JSON.parse(window.localStorage.getItem(SENSORY_PREFS_STORAGE_KEY) || '{}');
      expect(stored).toEqual({ soundEnabled: false, hapticsEnabled: true });

      const legacy = JSON.parse(window.localStorage.getItem('feedback_settings') || '{}');
      expect(legacy).toEqual({ sound: false, haptics: true });
    });

    it('falls back to legacy feedback_settings key when primary key is absent', () => {
      window.localStorage.setItem('feedback_settings', JSON.stringify({ sound: false, haptics: true }));
      resetSensoryEngineForTests();
      expect(getSensoryPreferences()).toEqual({ soundEnabled: false, hapticsEnabled: true });
    });

    it('gates sound and haptics independently', () => {
      const { MockAudioContext, instances } = createMockAudioContextFactory('running');
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
      const vibrateSpy = navigator.vibrate as ReturnType<typeof vi.fn>;

      setSensoryPreferences({ soundEnabled: false, hapticsEnabled: true });
      triggerSensoryFeedback('complete');
      expect(vibrateSpy).toHaveBeenCalledTimes(1);
      expect(instances).toHaveLength(0);

      vibrateSpy.mockClear();
      setSensoryPreferences({ soundEnabled: true, hapticsEnabled: false });
      triggerSensoryFeedback('complete');
      expect(vibrateSpy).not.toHaveBeenCalled();
      expect(instances).toHaveLength(1);
      expect(instances[0].createOscillator).toHaveBeenCalledTimes(2);
    });
  });

  describe('haptics bridge priority & vibrate fallback', () => {
    it('prefers window.median.haptics.trigger over navigator.vibrate', () => {
      const medianTrigger = vi.fn();
      window.median = { haptics: { trigger: medianTrigger } };
      const vibrateSpy = navigator.vibrate as ReturnType<typeof vi.fn>;

      triggerHaptic('tap');
      triggerHaptic('toggle');
      triggerHaptic('complete');
      triggerHaptic('milestone');
      triggerHaptic('warning');
      triggerHaptic('error');
      triggerHaptic('coin');

      expect(medianTrigger).toHaveBeenNthCalledWith(1, { style: 'impactLight' });
      expect(medianTrigger).toHaveBeenNthCalledWith(2, { style: 'impactMedium' });
      expect(medianTrigger).toHaveBeenNthCalledWith(3, { style: 'notificationSuccess' });
      expect(medianTrigger).toHaveBeenNthCalledWith(4, { style: 'impactHeavy' });
      expect(medianTrigger).toHaveBeenNthCalledWith(5, { style: 'notificationWarning' });
      expect(medianTrigger).toHaveBeenNthCalledWith(6, { style: 'notificationError' });
      expect(medianTrigger).toHaveBeenNthCalledWith(7, { style: 'notificationSuccess' });
      expect(vibrateSpy).not.toHaveBeenCalled();
    });

    it('supports window.gonative.haptics.trigger fallback', () => {
      const gonativeTrigger = vi.fn();
      window.gonative = { haptics: { trigger: gonativeTrigger } };
      const vibrateSpy = navigator.vibrate as ReturnType<typeof vi.fn>;

      triggerHaptic('success');

      expect(gonativeTrigger).toHaveBeenCalledWith({ style: 'notificationSuccess' });
      expect(vibrateSpy).not.toHaveBeenCalled();
    });

    it('falls back to tuned navigator.vibrate patterns when no native bridge exists', () => {
      const vibrateSpy = navigator.vibrate as ReturnType<typeof vi.fn>;

      triggerHaptic('tap');
      triggerHaptic('complete');
      triggerHaptic('milestone');
      triggerHaptic('error');

      expect(vibrateSpy).toHaveBeenNthCalledWith(1, 12);
      expect(vibrateSpy).toHaveBeenNthCalledWith(2, [18, 35, 24]);
      expect(vibrateSpy).toHaveBeenNthCalledWith(3, [20, 45, 25, 45, 45]);
      expect(vibrateSpy).toHaveBeenNthCalledWith(4, [45, 55, 45]);
    });

    it('never throws when navigator.vibrate is missing or throws', () => {
      Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        writable: true,
        value: vi.fn(() => {
          throw new Error('Blocked');
        }),
      });
      expect(() => triggerHaptic('complete')).not.toThrow();

      Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        writable: true,
        value: undefined,
      });
      expect(() => triggerHaptic('complete')).not.toThrow();
    });
  });

  describe('Web Audio singleton, unlock, and resume', () => {
    it('reuses a single AudioContext across calls and calls resume synchronously when suspended', () => {
      const { MockAudioContext, instances } = createMockAudioContextFactory('suspended');
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext;

      expect(unlockAudio()).toBe(true);
      expect(instances).toHaveLength(1);
      expect(instances[0].resume).toHaveBeenCalledTimes(1);
      expect(instances[0].createBuffer).toHaveBeenCalledWith(1, 1, 22050);

      instances[0].state = 'suspended';
      playSound('coin');
      playSound('tap');

      expect(instances).toHaveLength(1);
      expect(instances[0].resume).toHaveBeenCalledTimes(2);
      expect(instances[0].createOscillator).toHaveBeenCalledTimes(3);
    });

    it('handles missing or throwing AudioContext safely without throwing', () => {
      expect(unlockAudio()).toBe(false);
      expect(() => playSound('success')).not.toThrow();
      expect(getSensoryDiagnostics().audioContextState).toBe('unsupported');

      window.AudioContext = vi.fn(() => {
        throw new Error('AudioContext disabled');
      }) as unknown as typeof AudioContext;
      expect(unlockAudio()).toBe(false);
      expect(() => playSound('milestone')).not.toThrow();
    });
  });

  describe('tap debounce & diagnostics', () => {
    it('debounces rapid tap feedback within 25ms unless skipDebounce is set', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
      const vibrateSpy = navigator.vibrate as ReturnType<typeof vi.fn>;

      triggerSensoryFeedback('tap');
      triggerSensoryFeedback('tap');
      expect(vibrateSpy).toHaveBeenCalledTimes(1);

      triggerSensoryFeedback('tap', { skipDebounce: true });
      expect(vibrateSpy).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(30);
      triggerSensoryFeedback('tap');
      expect(vibrateSpy).toHaveBeenCalledTimes(3);

      // Non-tap events are never suppressed by tap debounce
      triggerSensoryFeedback('complete');
      triggerSensoryFeedback('complete');
      expect(vibrateSpy).toHaveBeenCalledTimes(5);
    });

    it('reports live diagnostics accurately', () => {
      const { MockAudioContext } = createMockAudioContextFactory('suspended');
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
      window.median = { haptics: { trigger: vi.fn() } };
      setSensoryPreferences({ soundEnabled: true, hapticsEnabled: false });

      const beforeUnlock = getSensoryDiagnostics();
      expect(beforeUnlock).toEqual({
        audioContextState: 'suspended',
        hasVibrateApi: true,
        hasNativeBridge: true,
        nativeBridgeName: 'median',
        soundEnabled: true,
        hapticsEnabled: false,
      });

      unlockAudio();
      const afterUnlock = getSensoryDiagnostics();
      expect(afterUnlock.hasNativeBridge).toBe(true);
    });
  });

  describe('useFeedback hook', () => {
    it('exposes primary methods and backwards-compatible aliases wired to the sensory engine', () => {
      const { MockAudioContext, instances } = createMockAudioContextFactory('running');
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
      const vibrateSpy = navigator.vibrate as ReturnType<typeof vi.fn>;

      const { result } = renderHook(() => useFeedback());

      result.current.triggerTap();
      result.current.triggerPop();
      result.current.toggle(true);
      result.current.triggerChime();
      result.current.triggerSuccess();
      result.current.coin();

      expect(vibrateSpy).toHaveBeenNthCalledWith(1, 12);
      expect(vibrateSpy).toHaveBeenNthCalledWith(2, 14);
      expect(vibrateSpy).toHaveBeenNthCalledWith(3, 16);
      expect(vibrateSpy).toHaveBeenNthCalledWith(4, [18, 35, 24]);
      expect(vibrateSpy).toHaveBeenNthCalledWith(5, [20, 40, 32]);
      expect(vibrateSpy).toHaveBeenNthCalledWith(6, [20, 40, 32]);
      expect(instances).toHaveLength(1);
    });
  });
});
