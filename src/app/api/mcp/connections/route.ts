import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/mcp/supabase-admin';
import { MCP_ENDPOINT } from '@/lib/mcp/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const admin = getSupabaseAdmin();

  const [{ data: auditLogs }, { data: tokens }] = await Promise.all([
    admin
      .from('mcp_audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25),
    admin
      .from('mcp_oauth_tokens')
      .select('client_id, scopes, created_at, expires_at, revoked_at')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString()),
  ]);

  // Aggregate tokens by client_id
  const clientMap = new Map<string, { clientId: string; scopes: string[]; firstConnectedAt: string }>();
  for (const t of tokens || []) {
    if (!clientMap.has(t.client_id)) {
      clientMap.set(t.client_id, {
        clientId: t.client_id,
        scopes: t.scopes || [],
        firstConnectedAt: t.created_at,
      });
    }
  }

  return NextResponse.json({
    endpointUrl: MCP_ENDPOINT,
    userId,
    auditLogs: auditLogs || [],
    connectedApps: Array.from(clientMap.values()),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action, clientId } = body;

  if (action === 'revoke_app' && clientId) {
    const admin = getSupabaseAdmin();
    await admin
      .from('mcp_oauth_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', session.user.id)
      .eq('client_id', clientId);

    return NextResponse.json({ success: true, message: `Access for ${clientId} revoked.` });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}
