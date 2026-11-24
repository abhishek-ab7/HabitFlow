import type { McpAuthContext } from './auth';
import { getSupabaseAdmin } from './supabase-admin';

export interface AuditLogEntry {
  toolName: string;
  action?: string;
  input: Record<string, unknown>;
  status: 'ok' | 'error';
  errorMessage?: string;
  durationMs: number;
}

/**
 * Sanitizes input to ensure sensitive fields (passwords, tokens, credentials) are never stored in audit logs.
 */
function sanitizeInput(input: Record<string, unknown>): string {
  const SENSITIVE_KEYS = ['token', 'secret', 'password', 'key', 'auth', 'code_verifier', 'access_token'];
  const sanitized: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof v === 'string' && v.length > 250) {
      sanitized[k] = v.substring(0, 250) + '... (truncated)';
    } else {
      sanitized[k] = v;
    }
  }

  try {
    return JSON.stringify(sanitized);
  } catch {
    return '[Unserializable Input]';
  }
}

/**
 * Persists an audit log entry to Supabase `mcp_audit_logs`.
 * Non-blocking: will not throw if logging fails, but prints warning.
 */
export async function logMcpToolInvocation(
  auth: McpAuthContext,
  entry: AuditLogEntry
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const inputSummary = sanitizeInput(entry.input);

    const { error } = await supabase.from('mcp_audit_logs').insert({
      user_id: auth.userId,
      tool_name: entry.toolName,
      action: entry.action || null,
      auth_mode: auth.authMode,
      client_id: auth.clientId || null,
      scopes: auth.scopes,
      input_summary: inputSummary,
      status: entry.status,
      error_message: entry.errorMessage || null,
      duration_ms: Math.round(entry.durationMs),
      created_at: new Date().toISOString(),
    });

    if (error) {
      // Table might not exist yet if migration hasn't been applied; warn gracefully
      console.warn('mcp_audit_logs insert error (table may be pending migration):', error.message);
    }
  } catch (err) {
    console.warn('Failed to record MCP audit log:', err);
  }
}
