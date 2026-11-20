import { GoogleGenAI } from '@google/genai';

export const FINANCE_GEMINI_MODEL = 'gemini-4-hydrogen';

const ENV_KEY_CANDIDATES = [
  'GEMINI_API_KEY',
  'GEMINI_KEY_DASHBOARD_1',
  'GEMINI_KEY_DASHBOARD_2',
  'GEMINI_KEY_DASHBOARD_3',
  'GEMINI_KEY_TASKS_1',
  'GEMINI_KEY_HABITS_1',
] as const;

export function resolveGeminiApiKey(): string | null {
  for (const name of ENV_KEY_CANDIDATES) {
    const val = process.env[name]?.trim();
    if (val && !val.startsWith('your_')) {
      return val;
    }
  }
  return null;
}

export function createFinanceGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}
