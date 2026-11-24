import { NextRequest, NextResponse } from 'next/server';
import { revokeToken } from '@/lib/mcp/oauth';
import { getAllowedOrigins, MCP_BASE_URL } from '@/lib/mcp/config';

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
  let token = '';

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    token = params.get('token') || '';
  } else {
    try {
      const body = await request.json();
      token = body.token || '';
    } catch {
      // Ignored
    }
  }

  if (token) {
    try {
      await revokeToken(token);
    } catch (err) {
      console.warn('Revoke token error:', err);
    }
  }

  // RFC 7009 Section 2.2: The authorization server responds with HTTP status code 200
  // if the token has been revoked successfully or if the client submitted an invalid token.
  return applyCors(NextResponse.json({ revoked: true }, { status: 200 }), origin);
}
