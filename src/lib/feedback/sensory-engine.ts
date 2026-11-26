export type SensoryEventType =
  | 'tap'
  | 'toggle'
  | 'complete'
  | 'uncheck'
  | 'success'
  | 'milestone'
  | 'warning'
  | 'error'
  | 'coin';

export interface SensoryPreferences {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

export interface SensoryDiagnostics {
  audioContextState: AudioContextState | 'unsupported';
  hasVibrateApi: boolean;
  hasNativeBridge: boolean;
  nativeBridgeName: 'median' | 'gonative' | null;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

interface NativeHapticsBridge {
  haptics?: {
    trigger?: (opts: { style: string } | string) => void;
  };
}

declare global {
  interface Window {
    median?: NativeHapticsBridge;
    gonative?: NativeHapticsBridge;
    webkitAudioContext?: typeof AudioContext;
  }
}

export const SENSORY_PREFS_STORAGE_KEY = 'habitflow:sensory_prefs';
const LEGACY_STORAGE_KEY = 'feedback_settings';
const TAP_DEBOUNCE_MS = 25;

let audioCtx: AudioContext | null = null;
let audioUnlocked = false;
let cachedPrefs: SensoryPreferences | null = null;
let lastTapAt = 0;

function safeReadStorage(): SensoryPreferences | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }
  try {
    const rawPrimary = window.localStorage.getItem(SENSORY_PREFS_STORAGE_KEY);
    if (rawPrimary) {
      const parsed = JSON.parse(rawPrimary) as Partial<SensoryPreferences>;
      return {
        soundEnabled: parsed.soundEnabled !== false,
        hapticsEnabled: parsed.hapticsEnabled !== false,
      };
    }
    const rawLegacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (rawLegacy) {
      const parsed = JSON.parse(rawLegacy) as { sound?: boolean; haptics?: boolean };
      return {
        soundEnabled: parsed.sound !== false,
        hapticsEnabled: parsed.haptics !== false,
      };
    }
  } catch {
    // Ignore storage read errors in restricted WebViews or private mode
  }
  return null;
}

function safeWriteStorage(prefs: SensoryPreferences): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(SENSORY_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    window.localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({ sound: prefs.soundEnabled, haptics: prefs.hapticsEnabled })
    );
  } catch {
    // Ignore storage quota/security errors
  }
}

export function getSensoryPreferences(): SensoryPreferences {
  if (cachedPrefs) return cachedPrefs;
  const fromStorage = safeReadStorage();
  cachedPrefs = fromStorage ?? { soundEnabled: true, hapticsEnabled: true };
  return cachedPrefs;
}

export function setSensoryPreferences(
  partial: Partial<SensoryPreferences>
): SensoryPreferences {
  const current = getSensoryPreferences();
  const next: SensoryPreferences = {
    soundEnabled:
      partial.soundEnabled !== undefined ? Boolean(partial.soundEnabled) : current.soundEnabled,
    hapticsEnabled:
      partial.hapticsEnabled !== undefined ? Boolean(partial.hapticsEnabled) : current.hapticsEnabled,
  };
  cachedPrefs = next;
  safeWriteStorage(next);
  return next;
}

export function syncSensoryPrefsFromSettings(
  settings?: { soundEnabled?: boolean; hapticsEnabled?: boolean } | null
): SensoryPreferences {
  if (!settings) return getSensoryPreferences();
  return setSensoryPreferences({
    soundEnabled: settings.soundEnabled !== false,
    hapticsEnabled: settings.hapticsEnabled !== false,
  });
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function getOrCreateAudioContext(): AudioContext | null {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new Ctor();
      audioUnlocked = false;
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function primeSilentAudioBuffer(ctx: AudioContext): void {
  if (audioUnlocked) return;
  if (typeof ctx.createBuffer !== 'function' || typeof ctx.createBufferSource !== 'function') return;
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
  audioUnlocked = true;
}

export function unlockAudio(): boolean {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      void ctx.resume().catch(() => undefined);
    }
    primeSilentAudioBuffer(ctx);
    return true;
  } catch {
    return false;
  }
}

interface ToneSpec {
  fromFreq: number;
  toFreq?: number;
  startOffsetSec?: number;
  durationSec: number;
  gainLevel: number;
  type?: OscillatorType;
}

function scheduleTone(ctx: AudioContext, baseTime: number, spec: ToneSpec): void {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = baseTime + (spec.startOffsetSec ?? 0);
    const end = start + spec.durationSec;
    const attackEnd = start + Math.min(0.005, spec.durationSec * 0.25);

    osc.type = spec.type ?? 'triangle';
    osc.frequency.setValueAtTime(spec.fromFreq, start);
    if (spec.toFreq && spec.toFreq !== spec.fromFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, spec.toFreq), end);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(spec.gainLevel, attackEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.005);
  } catch {
    // Never throw in restricted browsers or partial mocks
  }
}

const SOUND_SEQUENCES: Record<Exclude<SensoryEventType, 'toggle'>, ToneSpec[]> = {
  tap: [{ fromFreq: 880, toFreq: 520, durationSec: 0.028, gainLevel: 0.14, type: 'triangle' }],
  complete: [
    { fromFreq: 523.25, startOffsetSec: 0, durationSec: 0.075, gainLevel: 0.2, type: 'triangle' },
    { fromFreq: 783.99, startOffsetSec: 0.06, durationSec: 0.08, gainLevel: 0.24, type: 'sine' },
  ],
  uncheck: [{ fromFreq: 580, toFreq: 390, durationSec: 0.065, gainLevel: 0.15, type: 'sine' }],
  success: [
    { fromFreq: 523.25, startOffsetSec: 0, durationSec: 0.085, gainLevel: 0.19, type: 'triangle' },
    { fromFreq: 659.25, startOffsetSec: 0.065, durationSec: 0.095, gainLevel: 0.2, type: 'triangle' },
    { fromFreq: 783.99, startOffsetSec: 0.13, durationSec: 0.11, gainLevel: 0.23, type: 'sine' },
  ],
  milestone: [
    { fromFreq: 523.25, startOffsetSec: 0, durationSec: 0.09, gainLevel: 0.2, type: 'triangle' },
    { fromFreq: 659.25, startOffsetSec: 0.08, durationSec: 0.09, gainLevel: 0.21, type: 'triangle' },
    { fromFreq: 783.99, startOffsetSec: 0.16, durationSec: 0.1, gainLevel: 0.22, type: 'sine' },
    { fromFreq: 1046.5, startOffsetSec: 0.24, durationSec: 0.13, gainLevel: 0.26, type: 'sine' },
  ],
  warning: [
    { fromFreq: 330, startOffsetSec: 0, durationSec: 0.055, gainLevel: 0.18, type: 'triangle' },
    { fromFreq: 260, startOffsetSec: 0.075, durationSec: 0.065, gainLevel: 0.18, type: 'triangle' },
  ],
  error: [
    { fromFreq: 240, startOffsetSec: 0, durationSec: 0.075, gainLevel: 0.22, type: 'triangle' },
    { fromFreq: 180, startOffsetSec: 0.095, durationSec: 0.085, gainLevel: 0.24, type: 'triangle' },
  ],
  coin: [
    { fromFreq: 1318.51, startOffsetSec: 0, durationSec: 0.075, gainLevel: 0.19, type: 'triangle' },
    { fromFreq: 1975.53, startOffsetSec: 0.055, durationSec: 0.11, gainLevel: 0.22, type: 'sine' },
  ],
};

function resolveToneSpecs(type: SensoryEventType, isOn?: boolean): ToneSpec[] {
  if (type !== 'toggle') return SOUND_SEQUENCES[type];
  return isOn === false
    ? [{ fromFreq: 760, toFreq: 480, durationSec: 0.045, gainLevel: 0.16, type: 'sine' }]
    : [{ fromFreq: 620, toFreq: 940, durationSec: 0.045, gainLevel: 0.18, type: 'triangle' }];
}

export function playSound(type: SensoryEventType, options?: { isOn?: boolean }): void {
  if (!getSensoryPreferences().soundEnabled) return;
  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      void ctx.resume().catch(() => undefined);
    }
    const now = ctx.currentTime;
    resolveToneSpecs(type, options?.isOn).forEach((spec) => scheduleTone(ctx, now, spec));
  } catch {
    // Non-blocking
  }
}

const NATIVE_STYLE_MAP: Record<SensoryEventType, string> = {
  tap: 'impactLight',
  uncheck: 'impactLight',
  toggle: 'impactMedium',
  complete: 'notificationSuccess',
  success: 'notificationSuccess',
  coin: 'notificationSuccess',
  milestone: 'impactHeavy',
  warning: 'notificationWarning',
  error: 'notificationError',
};

const VIBRATION_PATTERNS: Record<SensoryEventType, number | number[]> = {
  tap: 12,
  toggle: 16,
  uncheck: 14,
  complete: [18, 35, 24],
  success: [20, 40, 32],
  coin: [20, 40, 32],
  milestone: [20, 45, 25, 45, 45],
  warning: [30, 50, 30],
  error: [45, 55, 45],
};

function getNativeBridge(): {
  name: 'median' | 'gonative';
  trigger: NonNullable<NonNullable<NativeHapticsBridge['haptics']>['trigger']>;
} | null {
  if (typeof window === 'undefined') return null;
  if (typeof window.median?.haptics?.trigger === 'function') {
    return { name: 'median', trigger: window.median.haptics.trigger };
  }
  if (typeof window.gonative?.haptics?.trigger === 'function') {
    return { name: 'gonative', trigger: window.gonative.haptics.trigger };
  }
  return null;
}

export function triggerHaptic(type: SensoryEventType): void {
  const prefs = getSensoryPreferences();
  if (!prefs.hapticsEnabled) return;

  try {
    const bridge = getNativeBridge();
    if (bridge) {
      bridge.trigger({ style: NATIVE_STYLE_MAP[type] });
      return;
    }

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(VIBRATION_PATTERNS[type]);
    }
  } catch {
    // Never throw in restricted browsers or test runners
  }
}

export function triggerSensoryFeedback(
  type: SensoryEventType,
  options?: { isOn?: boolean; skipDebounce?: boolean }
): void {
  if (type === 'tap' && !options?.skipDebounce) {
    const now = Date.now();
    if (now - lastTapAt < TAP_DEBOUNCE_MS) {
      return;
    }
    lastTapAt = now;
  }

  triggerHaptic(type);
  playSound(type, options);
}

export function getSensoryDiagnostics(): SensoryDiagnostics {
  const prefs = getSensoryPreferences();
  const bridge = getNativeBridge();
  const hasVibrateApi =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  let audioContextState: SensoryDiagnostics['audioContextState'] = 'unsupported';
  if (audioCtx) {
    audioContextState = audioCtx.state;
  } else if (getAudioContextConstructor()) {
    audioContextState = 'suspended';
  }

  return {
    audioContextState,
    hasVibrateApi,
    hasNativeBridge: Boolean(bridge),
    nativeBridgeName: bridge?.name ?? null,
    soundEnabled: prefs.soundEnabled,
    hapticsEnabled: prefs.hapticsEnabled,
  };
}

export function resetSensoryEngineForTests(): void {
  audioCtx = null;
  audioUnlocked = false;
  cachedPrefs = null;
  lastTapAt = 0;
}

export const sensoryEngine = {
  unlockAudio,
  playSound,
  triggerHaptic,
  trigger: triggerSensoryFeedback,
  getPreferences: getSensoryPreferences,
  setPreferences: setSensoryPreferences,
  syncFromSettings: syncSensoryPrefsFromSettings,
  getDiagnostics: getSensoryDiagnostics,
};
