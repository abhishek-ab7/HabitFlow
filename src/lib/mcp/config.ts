/**
 * HabitFlow Universal MCP Server Configuration & Timezone Utilities
 * Canonical Production Base URL: https://habit-flow-ochre-two.vercel.app
 */

export const MCP_BASE_URL = 'https://habit-flow-ochre-two.vercel.app';
export const MCP_ENDPOINT = `${MCP_BASE_URL}/api/mcp`;
export const OAUTH_PRM_URL = `${MCP_BASE_URL}/.well-known/oauth-protected-resource`;
export const OAUTH_AS_URL = `${MCP_BASE_URL}/.well-known/oauth-authorization-server`;

export const MCP_SCOPES = [
  'habitflow:read',
  'habitflow:write',
  'habitflow:finance:read',
  'habitflow:finance:write',
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<McpScope, string> = {
  'habitflow:read': 'Read habits, streaks, tasks, goals, milestones, mood logs, and user settings.',
  'habitflow:write': 'Create, edit, complete, and soft-delete/archive habits, tasks, goals, milestones, mood, and settings.',
  'habitflow:finance:read': 'Read finance accounts, balances, budgets, categories, transactions, credit cards, and friend ledgers.',
  'habitflow:finance:write': 'Create, edit, pay, split, reconcile, and soft-delete/archive transactions, statements, and financial obligations.',
};

/**
 * Default CORS allowed origins. Additional comma-separated origins can be supplied via HABITFLOW_MCP_ALLOWED_ORIGINS.
 */
export const DEFAULT_ALLOWED_ORIGINS = [
  'https://habit-flow-ochre-two.vercel.app',
  'https://gemini.google.com',
  'https://claude.ai',
  'https://chatgpt.com',
  'http://localhost:3000',
  'http://localhost:6274', // MCP Inspector default port
];

export function getAllowedOrigins(): string[] {
  const custom = process.env.HABITFLOW_MCP_ALLOWED_ORIGINS;
  if (!custom) return DEFAULT_ALLOWED_ORIGINS;
  const list = custom
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...list]));
}

/**
 * Returns formatted IST (Asia/Kolkata, UTC+05:30) YYYY-MM-DD date.
 * Guarantees consistent date evaluation on Vercel serverless runtime.
 */
export function getIstIsoDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Returns formatted IST YYYY-MM month key.
 */
export function getIstMonthKey(d: Date = new Date()): string {
  const dateStr = getIstIsoDate(d);
  return dateStr.substring(0, 7);
}

/**
 * Returns current ISO string timestamp.
 */
export function getNowIso(): string {
  return new Date().toISOString();
}

export function getMcpSecret(): string | undefined {
  return process.env.HABITFLOW_MCP_SECRET;
}

export function getMcpUserId(): string | undefined {
  return process.env.HABITFLOW_MCP_USER_ID;
}

export function getSupabaseAdminConfig(): { url: string; serviceRoleKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase credentials: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for MCP server execution.'
    );
  }

  return { url, serviceRoleKey };
}
