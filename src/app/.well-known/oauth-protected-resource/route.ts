import { NextResponse } from 'next/server';
import { MCP_BASE_URL, MCP_ENDPOINT, MCP_SCOPES, getAllowedOrigins } from '@/lib/mcp/config';

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
    resource: MCP_ENDPOINT,
    authorization_servers: [MCP_BASE_URL],
    bearer_methods_supported: ['header'],
    scopes_supported: MCP_SCOPES,
    resource_documentation: `${MCP_BASE_URL}/docs/PLAN-habitflow-mcp.md`,
  };

  return NextResponse.json(metadata, {
    status: 200,
    headers: {
      ...getCorsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });
}
