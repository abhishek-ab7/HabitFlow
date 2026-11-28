import { GoogleGenAI } from '@google/genai';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const ENV_KEY_CANDIDATES = [
  'GEMINI_KEY_TASKS_1',
  'GEMINI_KEY_TASKS_3',
  'GEMINI_KEY_TASKS_2',
  'GEMINI_KEY_DASHBOARD_1',
  'GEMINI_KEY_DASHBOARD_2',
  'GEMINI_KEY_DASHBOARD_3',
  'GEMINI_KEY_HABITS_1',
  'GEMINI_KEY_HABITS_2',
  'GEMINI_API_KEY',
] as const;

function isUsableGeminiKey(val: string | undefined, seen: Set<string>): val is string {
  return Boolean(val && !val.startsWith('your_') && !seen.has(val));
}

export function resolveGeminiApiKeys(): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];

  for (const name of ENV_KEY_CANDIDATES) {
    const val = process.env[name]?.trim();
    if (!isUsableGeminiKey(val, seen)) continue;
    seen.add(val);
    keys.push(val);
  }

  return keys;
}

export function resolveGeminiApiKey(): string | null {
  return resolveGeminiApiKeys()[0] ?? null;
}

export function createGeminiServerClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

export async function runWithGeminiFailover<T>(
  operation: (ai: GoogleGenAI) => Promise<T>
): Promise<T> {
  const keys = resolveGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('No configured Gemini API keys found');
  }

  let lastError: unknown;
  for (const apiKey of keys) {
    try {
      const ai = createGeminiServerClient(apiKey);
      return await operation(ai);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}
