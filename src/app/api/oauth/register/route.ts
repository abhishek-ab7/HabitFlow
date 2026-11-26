import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/mcp/supabase-admin';
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

interface RegisterClientPayload {
  client_name?: string;
  client_uri?: string | null;
  logo_uri?: string | null;
  redirect_uris: string[];
  scope?: string;
}

async function registerOAuthClientRecord(body: RegisterClientPayload) {
  const clientName = body.client_name || 'MCP Client';
  const clientId = `mcp_client_${crypto.randomBytes(16).toString('hex')}`;
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('mcp_oauth_clients').insert({
    client_id: clientId,
    client_name: clientName,
    client_uri: body.client_uri || null,
    logo_uri: body.logo_uri || null,
    redirect_uris: body.redirect_uris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: body.scope || 'habitflow:read',
    token_endpoint_auth_method: 'none',
    is_trusted: false,
  });

  if (error) throw error;

  return {
    client_id: clientId,
    client_name: clientName,
    redirect_uris: body.redirect_uris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };
}

async function handleClientRegistration(request: NextRequest, origin: string | null) {
  const body = await request.json() as RegisterClientPayload;
  if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    return applyCors(
      NextResponse.json(
        { error: 'invalid_client_metadata', error_description: 'redirect_uris is required and must be an array.' },
        { status: 400 }
      ),
      origin
    );
  }

  const registered = await registerOAuthClientRecord(body);
  return applyCors(NextResponse.json(registered, { status: 201 }), origin);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  const { success, retryAfter } = await checkMcpRateLimit(ip, 'oauth');
  if (!success) {
    return applyCors(NextResponse.json({ error: 'rate_limit_exceeded', retryAfter }, { status: 429 }), origin);
  }

  try {
    return await handleClientRegistration(request, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return applyCors(NextResponse.json({ error: 'server_error', error_description: message }, { status: 500 }), origin);
  }
}
