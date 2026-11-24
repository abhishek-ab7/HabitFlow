import { NextResponse } from 'next/server';
import { MCP_BASE_URL, MCP_SCOPES, getAllowedOrigins } from '@/lib/mcp/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getCorsHeaders(origin: string | null) {
  const allowed = getAllowedOrigins();
  const matched = origin && allowed.includes(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': matched,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'public, max-age=3600',
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) });
}

export async function GET(request: Request) {
  const origin = request.headers.get('origin');
  const metadata = {
    issuer: MCP_BASE_URL,
    authorization_endpoint: `${MCP_BASE_URL}/oauth/authorize`,
    token_endpoint: `${MCP_BASE_URL}/api/oauth/token`,
    registration_endpoint: `${MCP_BASE_URL}/api/oauth/register`,
    revocation_endpoint: `${MCP_BASE_URL}/api/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: MCP_SCOPES,
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
  };

  return NextResponse.json(metadata, {
    status: 200,
    headers: {
      ...getCorsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });
}
