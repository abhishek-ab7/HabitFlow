import type { ModelTier } from './model-router';

export interface AiTelemetryEvent {
  route: string;
  modelTier: ModelTier;
  model?: string;
  latencyMs: number;
  source: 'gemini' | 'deterministic' | 'local' | 'cache';
  steps?: number;
  hitlTriggered?: boolean;
  validationFailed?: boolean;
  timestamp: string;
}

const MAX_TELEMETRY_BUFFER = 100;
const telemetryBuffer: AiTelemetryEvent[] = [];

/**
 * Lightweight, zero-dependency structured AI telemetry (pure TS, portable to Mobile).
 */
export function recordAiTelemetry(event: Omit<AiTelemetryEvent, 'timestamp'>): AiTelemetryEvent {
  const full: AiTelemetryEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  telemetryBuffer.push(full);
  if (telemetryBuffer.length > MAX_TELEMETRY_BUFFER) {
    telemetryBuffer.shift();
  }

  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
    console.info('[AI Telemetry]', JSON.stringify(full));
  }

  return full;
}

export function getRecentAiTelemetry(limit = 20): AiTelemetryEvent[] {
  return telemetryBuffer.slice(-Math.max(1, limit));
}

export function clearAiTelemetry(): void {
  telemetryBuffer.length = 0;
}
