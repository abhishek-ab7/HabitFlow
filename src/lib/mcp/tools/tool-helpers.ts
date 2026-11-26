import { getMcpAuthContext, hasScope, type McpAuthContext } from '../auth';
import { logMcpToolInvocation } from '../audit';

export type McpScope =
  | 'habitflow:read'
  | 'habitflow:write'
  | 'habitflow:finance:read'
  | 'habitflow:finance:write';

export function mcpJson(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  };
}

export function mcpError(message: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: message }],
  };
}

export function authorizeMcpTool(scope: McpScope):
  | { ok: true; auth: McpAuthContext }
  | { ok: false; response: ReturnType<typeof mcpError> } {
  const auth = getMcpAuthContext();
  if (!hasScope(auth, scope)) {
    return {
      ok: false,
      response: mcpError(`Forbidden: Missing ${scope} scope.`),
    };
  }
  return { ok: true, auth };
}

export function pickDefinedColumns(
  source: Record<string, unknown>,
  columnMap: ReadonlyArray<readonly [argKey: string, dbCol: string]>
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const [argKey, dbCol] of columnMap) {
    if (source[argKey] !== undefined) {
      updates[dbCol] = source[argKey];
    }
  }
  return updates;
}

export async function logAndReturnMcpSuccess(params: {
  auth: McpAuthContext;
  toolName: string;
  action: string;
  input: Record<string, unknown>;
  startMs: number;
  payload: unknown;
}) {
  await logMcpToolInvocation(params.auth, {
    toolName: params.toolName,
    action: params.action,
    input: params.input,
    status: 'ok',
    durationMs: Date.now() - params.startMs,
  });
  return mcpJson(params.payload);
}

export async function logAndReturnMcpError(params: {
  auth: McpAuthContext;
  toolName: string;
  action: string;
  input: Record<string, unknown>;
  startMs: number;
  error: unknown;
  prefix: string;
}) {
  const msg = params.error instanceof Error ? params.error.message : String(params.error);
  await logMcpToolInvocation(params.auth, {
    toolName: params.toolName,
    action: params.action,
    input: params.input,
    status: 'error',
    errorMessage: msg,
    durationMs: Date.now() - params.startMs,
  });
  return mcpError(`${params.prefix}: ${msg}`);
}
