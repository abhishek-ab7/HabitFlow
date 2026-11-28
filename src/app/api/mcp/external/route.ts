import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  encryptMcpToken,
  maskMcpToken,
  testExternalMcpConnection,
  validateOutboundMcpUrl,
  type ExternalMcpProviderKind,
} from '@/lib/mcp/outbound-client';

const VALID_PROVIDERS = new Set<ExternalMcpProviderKind>([
  'google_calendar',
  'gmail',
  'strava_health',
  'custom',
]);

interface ExternalMcpRow {
  id: string;
  label: string;
  provider_kind: ExternalMcpProviderKind;
  endpoint_url: string;
  token_hint?: string | null;
  enabled: boolean;
  last_synced_at?: string | null;
}

async function getAuthedClient() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  // shortcut: untyped table helper until `npm run gen:types` is re-run after applying migration
  const db = supabase as unknown as { from: (table: string) => any };
  return { db, userId: user.id };
}

export async function GET() {
  const auth = await getAuthedClient();
  if ('error' in auth) return auth.error;

  const { data, error } = await auth.db
    .from('user_external_mcp_sources')
    .select('id, label, provider_kind, endpoint_url, token_hint, enabled, last_synced_at')
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false });

  if (error) {
    // Graceful empty list if migration not yet applied in local dev
    return NextResponse.json({ sources: [] });
  }

  const rows = (Array.isArray(data) ? data : []) as ExternalMcpRow[];
  return NextResponse.json({
    sources: rows.map((row) => ({
      id: row.id,
      label: row.label,
      providerKind: row.provider_kind,
      endpointUrl: row.endpoint_url,
      tokenHint: row.token_hint || '',
      enabled: row.enabled,
      lastSyncedAt: row.last_synced_at ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthedClient();
  if ('error' in auth) return auth.error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const endpointUrl = typeof body.endpointUrl === 'string' ? body.endpointUrl.trim() : '';
  const bearerToken = typeof body.bearerToken === 'string' ? body.bearerToken.trim() : '';
  const urlCheck = validateOutboundMcpUrl(endpointUrl);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: urlCheck.error }, { status: 400 });
  }

  if (body.action === 'test') {
    const testResult = await testExternalMcpConnection({ endpointUrl: urlCheck.url, bearerToken });
    return NextResponse.json(testResult, { status: testResult.ok ? 200 : 422 });
  }

  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 60) : 'External MCP';
  const rawProvider = String(body.providerKind || 'custom') as ExternalMcpProviderKind;
  const providerKind: ExternalMcpProviderKind = VALID_PROVIDERS.has(rawProvider) ? rawProvider : 'custom';

  const { data, error } = await auth.db
    .from('user_external_mcp_sources')
    .insert({
      user_id: auth.userId,
      label,
      provider_kind: providerKind,
      endpoint_url: urlCheck.url,
      encrypted_token: bearerToken ? encryptMcpToken(bearerToken) : null,
      token_hint: bearerToken ? maskMcpToken(bearerToken) : null,
      enabled: true,
    })
    .select('id, label, provider_kind, endpoint_url, token_hint, enabled')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to save external MCP source' }, { status: 500 });
  }

  const saved = data as ExternalMcpRow;
  return NextResponse.json({
    source: {
      id: saved.id,
      label: saved.label,
      providerKind: saved.provider_kind,
      endpointUrl: saved.endpoint_url,
      tokenHint: saved.token_hint || '',
      enabled: saved.enabled,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthedClient();
  if ('error' in auth) return auth.error;

  const id = req.nextUrl.searchParams.get('id')?.trim();
  if (!id) return NextResponse.json({ error: 'Source id is required' }, { status: 400 });

  const { error } = await auth.db
    .from('user_external_mcp_sources')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.userId);

  if (error) return NextResponse.json({ error: 'Failed to remove source' }, { status: 500 });
  return NextResponse.json({ removed: true });
}
