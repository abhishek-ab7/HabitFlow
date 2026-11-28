import { NextRequest, NextResponse } from 'next/server';
import { getCachedResponse, setCachedResponse } from '@/lib/ai/cache';
import { runCoachSwarmGraph } from '@/lib/ai/graphs/coach-swarm-graph';
import type { CoachSwarmOutput } from '@/lib/ai/graphs/coach-swarm-types';
import type { CoachBriefingInput } from '@/lib/ai/types';
import { getIstIsoDate } from '@/lib/mcp/config';
import { fetchExternalMcpContext, type ExternalMcpProviderKind } from '@/lib/mcp/outbound-client';
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const COACH_CACHE_TTL_SECONDS = 6 * 60 * 60;

function isRateLimitMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return message.includes('429') || lower.includes('quota') || lower.includes('rate limit');
}

function buildCoachErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const isRateLimit = isRateLimitMessage(message);
  console.error('[AI Coach Route Error]:', error);
  return NextResponse.json(
    {
      error: isRateLimit ? 'Daily AI quota exceeded. Try again later.' : 'AI Coach error',
      details: message,
      isRateLimit,
    },
    { status: isRateLimit ? 429 : 500 }
  );
}

async function parseCoachRequestBody(req: NextRequest): Promise<CoachBriefingInput | null> {
  try {
    return (await req.json()) || ({} as CoachBriefingInput);
  } catch {
    return null;
  }
}

function getCoachCacheKey(params: { userId: string; todayIst: string; mode?: string }): string {
  return `coach:${params.userId}:${params.todayIst}:${params.mode || 'briefing'}`;
}

function buildNormalizedCoachInput(params: {
  userId: string;
  todayIst: string;
  body: CoachBriefingInput;
}): CoachBriefingInput {
  const { userId, todayIst, body } = params;
  return {
    userData: {
      userName: body.userData?.userName,
      level: body.userData?.level,
      xp: body.userData?.xp,
      userId,
    },
    context: { ...(body.context || {}), todayIso: todayIst },
    forceRefresh: body.forceRefresh,
  };
}

interface ExternalMcpDbRow {
  id: string;
  label: string;
  provider_kind: ExternalMcpProviderKind;
  endpoint_url: string;
  encrypted_token?: string | null;
  enabled: boolean;
}

async function loadExternalMcpSnippets(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string
): Promise<string[]> {
  try {
    const client = supabase as unknown as { from?: (table: string) => any };
    if (typeof client?.from !== 'function') return [];
    const { data, error } = await client
      .from('user_external_mcp_sources')
      .select('id, label, provider_kind, endpoint_url, encrypted_token, enabled')
      .eq('user_id', userId)
      .eq('enabled', true)
      .limit(4);
    const rows = (Array.isArray(data) ? data : []) as ExternalMcpDbRow[];
    if (error || rows.length === 0) return [];
    const summary = await fetchExternalMcpContext(
      rows.map((r) => ({
        id: String(r.id),
        label: String(r.label),
        providerKind: r.provider_kind,
        endpointUrl: String(r.endpoint_url),
        encryptedToken: r.encrypted_token ?? null,
        enabled: Boolean(r.enabled),
      }))
    );
    return summary.snippets.map((s) => `[${s.label}] ${s.summary}`);
  } catch {
    return [];
  }
}

async function handleCoachBriefing(params: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
  body: CoachBriefingInput;
}) {
  const { supabase, userId, body } = params;
  const todayIst = getIstIsoDate();
  const cacheKey = getCoachCacheKey({ userId, todayIst, mode: body.context?.mode });

  if (!body.forceRefresh) {
    const cached = await getCachedResponse<CoachSwarmOutput>(cacheKey);
    if (cached) return NextResponse.json(cached);
  }

  const normalizedInput = buildNormalizedCoachInput({ userId, todayIst, body });
  const externalSnippets = await loadExternalMcpSnippets(supabase, userId);
  if (externalSnippets.length > 0) {
    const existingInsights = normalizedInput.context?.crossDomainInsights;
    normalizedInput.context = {
      ...(normalizedInput.context || {}),
      crossDomainInsights: {
        ...(existingInsights || {}),
        alerts: [
          ...(existingInsights?.alerts || []),
          ...externalSnippets.slice(0, 2).map((s) => ({ title: s, description: 'External read-only MCP context' })),
        ],
      },
    };
  }
  const output = await runCoachSwarmGraph(normalizedInput, todayIst);
  await setCachedResponse(cacheKey, output, COACH_CACHE_TTL_SECONDS);
  return NextResponse.json(output);
}

async function authorizeCoachRequest(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
    return { error: NextResponse.json({ error: 'AI features are currently disabled' }, { status: 503 }) };
  }

  const limitResult = await rateLimit(req, { limit: 20, windowMs: 60 * 1000 });
  if (!limitResult.success) return { error: rateLimitResponse(limitResult.retryAfter) };

  const body = await parseCoachRequestBody(req);
  if (!body) return { error: NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) };

  return { supabase, userId: user.id, body };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeCoachRequest(req);
    if (auth.error) return auth.error;
    return await handleCoachBriefing({ supabase: auth.supabase, userId: auth.userId, body: auth.body });
  } catch (error: unknown) {
    return buildCoachErrorResponse(error);
  }
}
