import crypto from 'node:crypto';

export type ExternalMcpProviderKind = 'google_calendar' | 'gmail' | 'strava_health' | 'custom';

export interface ExternalMcpSourceRecord {
  id: string;
  label: string;
  providerKind: ExternalMcpProviderKind;
  endpointUrl: string;
  encryptedToken?: string | null;
  tokenHint?: string | null;
  enabled: boolean;
  lastSyncedAt?: string | null;
}

export interface ExternalMcpContextSummary {
  sourcesChecked: number;
  snippets: Array<{
    providerKind: ExternalMcpProviderKind;
    label: string;
    summary: string;
  }>;
}

const READ_ONLY_TOOL_PREFIXES = [
  'get_',
  'list_',
  'search_',
  'read_',
  'fetch_',
  'gmail_fetch_',
  'gmail_list_',
  'googlecalendar_list_',
  'googlecalendar_find_',
  'strava_get_',
  'strava_list_',
];
const MUTATING_TOOL_SEGMENTS = ['send', 'create', 'delete', 'update', 'remove', 'insert', 'patch', 'draft', 'reply', 'modify'];
const OUTBOUND_TIMEOUT_MS = 3000;

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[?::1\]?$/,
  /^\[?fc/i,
  /^\[?fd/i,
  /^\[?fe80:/i,
];

/**
 * Strict SSRF guardrail: allows only public HTTPS MCP endpoints.
 */
export function validateOutboundMcpUrl(rawUrl: string): { ok: true; url: string } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only HTTPS MCP endpoints are allowed' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'Embedded URL credentials are not allowed' };
  }
  const host = parsed.hostname.toLowerCase();
  if (!host || BLOCKED_HOST_PATTERNS.some((re) => re.test(host))) {
    return { ok: false, error: 'Private, loopback, or internal hosts are blocked' };
  }
  return { ok: true, url: parsed.toString() };
}

export function isReadOnlyMcpTool(toolName: string): boolean {
  const lower = toolName.trim().toLowerCase();
  if (!READ_ONLY_TOOL_PREFIXES.some((prefix) => lower.startsWith(prefix))) return false;
  return !MUTATING_TOOL_SEGMENTS.some((seg) => lower.includes(seg));
}

export function maskMcpToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 4) return '••••';
  return `••••${trimmed.slice(-4)}`;
}

function resolveEncryptionKey(): Buffer {
  const raw = process.env.MCP_TOKEN_ENCRYPTION_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || 'habitflow-dev-mcp-key';
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptMcpToken(plainToken: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', resolveEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainToken, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptMcpToken(payload: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      resolveEncryptionKey(),
      Buffer.from(ivB64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}

async function parseMcpHttpResponse(res: Response): Promise<{ result?: unknown; error?: { message?: string } }> {
  const contentType = res.headers.get('content-type')?.toLowerCase() || '';
  if (!contentType.includes('text/event-stream')) {
    return (await res.json()) as { result?: unknown; error?: { message?: string } };
  }

  const rawText = await res.text();
  const dataLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim())
    .filter((l) => l && l !== '[DONE]');

  for (let i = dataLines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(dataLines[i]) as { result?: unknown; error?: { message?: string } };
    } catch {
      // Continue scanning earlier SSE frames
    }
  }
  throw new Error('Empty or invalid SSE response from MCP server');
}

async function callMcpJsonRpc(params: {
  url: string;
  token?: string | null;
  method: string;
  rpcParams?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (params.token) {
    const host = new URL(params.url).hostname.toLowerCase();
    if (host.endsWith('composio.dev')) {
      headers['x-consumer-api-key'] = params.token;
    } else {
      headers.Authorization = `Bearer ${params.token}`;
    }
  }

  const res = await fetch(params.url, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(params.timeoutMs ?? OUTBOUND_TIMEOUT_MS),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: params.method,
      params: params.rpcParams ?? {},
    }),
  });

  if (!res.ok) {
    throw new Error(`MCP endpoint returned HTTP ${res.status}`);
  }
  const json = await parseMcpHttpResponse(res);
  if (json.error) {
    throw new Error(json.error.message || 'MCP JSON-RPC error');
  }
  return json.result;
}

export async function testExternalMcpConnection(params: {
  endpointUrl: string;
  bearerToken?: string;
}): Promise<{ ok: boolean; readOnlyTools: string[]; error?: string }> {
  const urlCheck = validateOutboundMcpUrl(params.endpointUrl);
  if (!urlCheck.ok) return { ok: false, readOnlyTools: [], error: urlCheck.error };

  try {
    const result = (await callMcpJsonRpc({
      url: urlCheck.url,
      token: params.bearerToken,
      method: 'tools/list',
    })) as { tools?: Array<{ name?: string }> };

    const tools = Array.isArray(result?.tools)
      ? result.tools
          .map((t) => String(t?.name || ''))
          .filter((name) => Boolean(name) && isReadOnlyMcpTool(name))
      : [];

    return { ok: true, readOnlyTools: tools.slice(0, 20) };
  } catch (err) {
    return {
      ok: false,
      readOnlyTools: [],
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

/**
 * Fetches read-only context snippets from enabled external MCP sources within a strict 3s timeout.
 * Never throws — degrades cleanly so Coach Swarm latency is never stalled.
 */
export async function fetchExternalMcpContext(
  sources: ExternalMcpSourceRecord[],
  timeoutMs = OUTBOUND_TIMEOUT_MS
): Promise<ExternalMcpContextSummary> {
  const active = sources.filter((s) => s.enabled).slice(0, 4);
  if (active.length === 0) return { sourcesChecked: 0, snippets: [] };

  const settled = await Promise.allSettled(
    active.map(async (src) => {
      const check = validateOutboundMcpUrl(src.endpointUrl);
      if (!check.ok) return null;
      const token = src.encryptedToken ? decryptMcpToken(src.encryptedToken) : null;
      const listRes = (await callMcpJsonRpc({
        url: check.url,
        token,
        method: 'tools/list',
        timeoutMs,
      })) as { tools?: Array<{ name?: string }> };

      const readOnlyTool = (listRes?.tools || [])
        .map((t) => String(t?.name || ''))
        .find((name) => isReadOnlyMcpTool(name));

      if (!readOnlyTool) return null;

      const callRes = (await callMcpJsonRpc({
        url: check.url,
        token,
        method: 'tools/call',
        rpcParams: { name: readOnlyTool, arguments: {} },
        timeoutMs,
      })) as { content?: Array<{ text?: string }> };

      const rawText = (callRes?.content || [])
        .map((c) => c?.text || '')
        .join(' ')
        .replace(/<\/?untrusted_input>/gi, '')
        .trim()
        .slice(0, 280);

      if (!rawText) return null;
      return { providerKind: src.providerKind, label: src.label, summary: rawText };
    })
  );

  const snippets = settled
    .filter((r): r is PromiseFulfilledResult<{ providerKind: ExternalMcpProviderKind; label: string; summary: string } | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((v): v is { providerKind: ExternalMcpProviderKind; label: string; summary: string } => v !== null);

  return { sourcesChecked: active.length, snippets };
}
