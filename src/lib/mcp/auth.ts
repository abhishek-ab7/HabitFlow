import crypto from 'crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  ACCEPTED_MCP_RESOURCES,
  OAUTH_PRM_URL,
  MCP_SCOPES,
  type McpScope,
  getMcpSecret,
  getMcpUserId,
} from './config';
import { getSupabaseAdmin } from './supabase-admin';

export interface McpAuthContext {
  userId: string;
  authMode: 'secret' | 'oauth';
  clientId?: string;
  scopes: McpScope[];
}

export const mcpAuthStorage = new AsyncLocalStorage<McpAuthContext>();

export function getMcpAuthContext(): McpAuthContext {
  const ctx = mcpAuthStorage.getStore();
  if (!ctx) {
    throw new Error('Unauthenticated MCP tool execution: No active McpAuthContext found.');
  }
  return ctx;
}

/**
 * Timing-safe string comparison using SHA-256 digests.
 */
export function timingSafeCheck(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  try {
    const a = crypto.createHash('sha256').update(provided).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Hashes an OAuth token with SHA-256 for secure storage & lookup.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Extracts Bearer token from the standard Authorization header or optional fallback path/query.
 */
export function extractBearerToken(request: NextRequest, explicitToken?: string): string | null {
  if (explicitToken) return explicitToken.trim();

  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1].trim();
    }
  }

  // Fallback query parameter for restricted environments that cannot send headers
  const queryToken = request.nextUrl.searchParams.get('token');
  if (queryToken) return queryToken.trim();

  return null;
}

/**
 * Validates the request authentication against Tier 1 (Vercel env var secret) or Tier 2 (OAuth 2.1 access token).
 */
export async function authenticateMcpRequest(
  request: NextRequest,
  explicitToken?: string
): Promise<{ auth: McpAuthContext | null; errorResponse: NextResponse | null }> {
  const token = extractBearerToken(request, explicitToken);

  if (!token) {
    return {
      auth: null,
      errorResponse: create401Response('Missing Bearer authentication token.'),
    };
  }

  // 1. Tier 1: Personal Fast-Track Auth via HABITFLOW_MCP_SECRET
  const configuredSecret = getMcpSecret();
  const configuredUserId = getMcpUserId();

  if (configuredSecret && configuredUserId && timingSafeCheck(token, configuredSecret)) {
    return {
      auth: {
        userId: configuredUserId,
        authMode: 'secret',
        clientId: 'personal-mcp-owner',
        scopes: [...MCP_SCOPES], // Owner has all scopes
      },
      errorResponse: null,
    };
  }

  // 2. Tier 2: OAuth 2.1 Access Token Verification
  try {
    const supabase = getSupabaseAdmin();
    const tokenHash = hashToken(token);
    const nowIso = new Date().toISOString();

    const { data: oauthToken, error } = await supabase
      .from('mcp_oauth_tokens')
      .select('user_id, client_id, scopes, resource, expires_at, revoked_at')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .gt('expires_at', nowIso)
      .single();

    if (!error && oauthToken) {
      // Validate RFC 8707 Resource Indicator / Audience Binding
      if (oauthToken.resource && !ACCEPTED_MCP_RESOURCES.includes(oauthToken.resource)) {
        return {
          auth: null,
          errorResponse: create401Response('Token resource indicator mismatch.'),
        };
      }

      const tokenScopes = Array.isArray(oauthToken.scopes)
        ? (oauthToken.scopes as McpScope[])
        : [];

      return {
        auth: {
          userId: oauthToken.user_id,
          authMode: 'oauth',
          clientId: oauthToken.client_id,
          scopes: tokenScopes,
        },
        errorResponse: null,
      };
    }
  } catch (err) {
    console.warn('OAuth token lookup encountered an error:', err);
  }

  return {
    auth: null,
    errorResponse: create401Response('Invalid or expired authentication token.'),
  };
}

/**
 * Checks if the authenticated context possesses the required scope.
 */
export function hasScope(auth: McpAuthContext, requiredScope: McpScope): boolean {
  return auth.scopes.includes(requiredScope);
}

/**
 * Creates RFC 9728 compliant HTTP 401 Unauthorized response with WWW-Authenticate pointing to PRM.
 */
export function create401Response(detail: string = 'Authentication required'): NextResponse {
  return NextResponse.json(
    {
      error: 'unauthorized',
      message: detail,
      resource_metadata: OAUTH_PRM_URL,
    },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer resource_metadata="${OAUTH_PRM_URL}"`,
      },
    }
  );
}

/**
 * Creates RFC 6750 compliant HTTP 403 Forbidden response when scope is insufficient.
 */
export function create403Response(requiredScope: McpScope): NextResponse {
  return NextResponse.json(
    {
      error: 'insufficient_scope',
      message: `Action requires the '${requiredScope}' scope.`,
      scope: requiredScope,
    },
    {
      status: 403,
      headers: {
        'WWW-Authenticate': `Bearer error="insufficient_scope", scope="${requiredScope}"`,
      },
    }
  );
}
