import { NextRequest, NextResponse } from 'next/server';
import { exchangeAuthorizationCode, refreshAccessToken } from '@/lib/mcp/oauth';
import { getAllowedOrigins, MCP_BASE_URL } from '@/lib/mcp/config';
import { checkMcpRateLimit } from '@/lib/mcp/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function applyCors(res: Response, origin: string | null) {
  const allowed = getAllowedOrigins();
  const matched = origin && allowed.includes(origin) ? origin : MCP_BASE_URL;
  res.headers.set('Access-Control-Allow-Origin', matched);
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

export async function OPTIONS(request: NextRequest) {
  return applyCors(new NextResponse(null, { status: 204 }), request.headers.get('origin'));
}

function corsJson(payload: unknown, status: number, origin: string | null) {
  return applyCors(NextResponse.json(payload, { status }), origin);
}

async function parseTokenRequestBody(request: NextRequest): Promise<Record<string, string> | null> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(await request.text());
    return Object.fromEntries(params.entries());
  }
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function formatTokenResponse(
  tokens: { accessToken: string; tokenType: string; expiresIn: number; refreshToken: string; scope: string },
  origin: string | null
) {
  return corsJson(
    {
      access_token: tokens.accessToken,
      token_type: tokens.tokenType,
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
    },
    200,
    origin
  );
}

async function handleAuthorizationCodeGrant(body: Record<string, string>, clientId: string, origin: string | null) {
  const { code, code_verifier: codeVerifier, redirect_uri: redirectUri, resource } = body;
  const hasRequired = Boolean(code && codeVerifier && redirectUri);
  if (!hasRequired) {
    return corsJson(
      { error: 'invalid_request', error_description: 'code, code_verifier (PKCE S256), and redirect_uri are required.' },
      400,
      origin
    );
  }
  const tokens = await exchangeAuthorizationCode({ code, codeVerifier, clientId, redirectUri, resource });
  return formatTokenResponse(tokens, origin);
}

async function handleRefreshTokenGrant(body: Record<string, string>, clientId: string, origin: string | null) {
  const { refresh_token: refreshToken, resource } = body;
  if (!refreshToken) {
    return corsJson({ error: 'invalid_request', error_description: 'refresh_token is required.' }, 400, origin);
  }
  const tokens = await refreshAccessToken({ refreshToken, clientId, resource });
  return formatTokenResponse(tokens, origin);
}

async function dispatchTokenGrant(grantType: string, body: Record<string, string>, clientId: string, origin: string | null) {
  if (grantType === 'authorization_code') return handleAuthorizationCodeGrant(body, clientId, origin);
  if (grantType === 'refresh_token') return handleRefreshTokenGrant(body, clientId, origin);
  return corsJson({ error: 'unsupported_grant_type', error_description: `Unsupported grant_type: ${grantType}` }, 400, origin);
}

async function validateTokenRequest(request: NextRequest, origin: string | null) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { success, retryAfter } = await checkMcpRateLimit(ip, 'oauth');
  if (!success) return { error: corsJson({ error: 'rate_limit_exceeded', retryAfter }, 429, origin) };

  const body = await parseTokenRequestBody(request);
  if (!body) {
    return { error: corsJson({ error: 'invalid_request', error_description: 'Malformed JSON payload.' }, 400, origin) };
  }

  const { grant_type: grantType, client_id: clientId } = body;
  if (!grantType || !clientId) {
    return { error: corsJson({ error: 'invalid_request', error_description: 'grant_type and client_id are required.' }, 400, origin) };
  }

  return { body, grantType, clientId };
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const validated = await validateTokenRequest(request, origin);
  if (validated.error) return validated.error;

  try {
    return await dispatchTokenGrant(validated.grantType, validated.body, validated.clientId, origin);
  } catch (err: any) {
    return corsJson({ error: 'invalid_grant', error_description: err.message }, 400, origin);
  }
}
