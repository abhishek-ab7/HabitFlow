import { NextRequest, NextResponse } from 'next/server';
import { createMcpHandler } from 'mcp-handler';
import { getAllowedOrigins, MCP_BASE_URL } from '@/lib/mcp/config';
import { authenticateMcpRequest, mcpAuthStorage } from '@/lib/mcp/auth';
import { checkMcpRateLimit } from '@/lib/mcp/rate-limit';
import { setupHabitFlowMcpServer } from '@/lib/mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const baseMcpHandler = createMcpHandler(
  async (server) => {
    await setupHabitFlowMcpServer(server);
  },
  {
    serverInfo: {
      name: 'HabitFlow Universal MCP Server',
      version: '1.0.0',
    },
  }
);

function applyCorsHeaders(response: Response, origin: string | null): Response {
  const allowedOrigins = getAllowedOrigins();
  const matchedOrigin =
    origin && allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins.includes('*')
      ? '*'
      : MCP_BASE_URL;

  response.headers.set('Access-Control-Allow-Origin', matchedOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version'
  );
  response.headers.set('Access-Control-Expose-Headers', 'Mcp-Session-Id, WWW-Authenticate');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const response = new NextResponse(null, { status: 204 });
  return applyCorsHeaders(response, origin);
}

async function handleMcpPathTokenRequest(
  request: NextRequest,
  paramsPromise: Promise<{ token: string }>
) {
  const { token } = await paramsPromise;
  const origin = request.headers.get('origin');

  // Authenticate explicit path token
  const { auth, errorResponse } = await authenticateMcpRequest(request, token);
  if (errorResponse) {
    return applyCorsHeaders(errorResponse, origin);
  }

  if (!auth) {
    return applyCorsHeaders(new NextResponse('Unauthorized', { status: 401 }), origin);
  }

  const tier = request.method === 'POST' ? 'write' : 'read';
  const { success, retryAfter } = await checkMcpRateLimit(auth.userId, tier);
  if (!success) {
    const res = NextResponse.json(
      { error: 'Rate limit exceeded. Please slow down.', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
    return applyCorsHeaders(res, origin);
  }

  const response = await mcpAuthStorage.run(auth, async () => {
    return await baseMcpHandler(request);
  });

  return applyCorsHeaders(response, origin);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  return handleMcpPathTokenRequest(request, context.params);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  return handleMcpPathTokenRequest(request, context.params);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  return handleMcpPathTokenRequest(request, context.params);
}
