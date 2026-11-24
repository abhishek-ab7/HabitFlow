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

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  const { success, retryAfter } = await checkMcpRateLimit(ip, 'oauth');
  if (!success) {
    return applyCors(
      NextResponse.json({ error: 'rate_limit_exceeded', retryAfter }, { status: 429 }),
      origin
    );
  }

  let body: Record<string, string> = {};
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    params.forEach((val, key) => {
      body[key] = val;
    });
  } else {
    try {
      body = await request.json();
    } catch {
      return applyCors(
        NextResponse.json({ error: 'invalid_request', error_description: 'Malformed JSON payload.' }, { status: 400 }),
        origin
      );
    }
  }

  const grantType = body.grant_type;
  const clientId = body.client_id;

  if (!grantType || !clientId) {
    return applyCors(
      NextResponse.json(
        { error: 'invalid_request', error_description: 'grant_type and client_id are required.' },
        { status: 400 }
      ),
      origin
    );
  }

  try {
    if (grantType === 'authorization_code') {
      const code = body.code;
      const codeVerifier = body.code_verifier;
      const redirectUri = body.redirect_uri;
      const resource = body.resource;

      if (!code || !codeVerifier || !redirectUri) {
        return applyCors(
          NextResponse.json(
            {
              error: 'invalid_request',
              error_description: 'code, code_verifier (PKCE S256), and redirect_uri are required.',
            },
            { status: 400 }
          ),
          origin
        );
      }

      const tokens = await exchangeAuthorizationCode({
        code,
        codeVerifier,
        clientId,
        redirectUri,
        resource,
      });

      return applyCors(
        NextResponse.json({
          access_token: tokens.accessToken,
          token_type: tokens.tokenType,
          expires_in: tokens.expiresIn,
          refresh_token: tokens.refreshToken,
          scope: tokens.scope,
        }),
        origin
      );
    }

    if (grantType === 'refresh_token') {
      const refreshToken = body.refresh_token;
      const resource = body.resource;

      if (!refreshToken) {
        return applyCors(
          NextResponse.json(
            { error: 'invalid_request', error_description: 'refresh_token is required.' },
            { status: 400 }
          ),
          origin
        );
      }

      const tokens = await refreshAccessToken({
        refreshToken,
        clientId,
        resource,
      });

      return applyCors(
        NextResponse.json({
          access_token: tokens.accessToken,
          token_type: tokens.tokenType,
          expires_in: tokens.expiresIn,
          refresh_token: tokens.refreshToken,
          scope: tokens.scope,
        }),
        origin
      );
    }

    return applyCors(
      NextResponse.json(
        { error: 'unsupported_grant_type', error_description: `Unsupported grant_type: ${grantType}` },
        { status: 400 }
      ),
      origin
    );
  } catch (err: any) {
    return applyCors(
      NextResponse.json(
        { error: 'invalid_grant', error_description: err.message },
        { status: 400 }
      ),
      origin
    );
  }
}
