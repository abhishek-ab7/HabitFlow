import crypto from 'crypto';
import dns from 'dns/promises';
import { getSupabaseAdmin } from './supabase-admin';
import { hashToken } from './auth';
import { MCP_BASE_URL, MCP_ENDPOINT, MCP_SCOPES, type McpScope } from './config';

export interface OAuthConfig {
  clientId: string;
  clientName: string;
  redirectUris: string[];
}

/**
 * Validates PKCE S256 code challenge against the provided code verifier.
 * SHA-256 base64url-encoded.
 */
export function verifyPkce(codeVerifier: string, codeChallenge: string, method: string = 'S256'): boolean {
  if (method !== 'S256') {
    return false; // HabitFlow MCP strictly requires S256; rejects plain
  }
  try {
    const computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return computed === codeChallenge;
  } catch {
    return false;
  }
}

const PRIVATE_EXACT_IPS = new Set(['127.0.0.1', 'localhost', '::1', '::']);
const PRIVATE_PREFIXES = ['10.', '192.168.', '169.254.', '0.', '100.64.', 'fc', 'fd', 'fe80:'];

/**
 * Checks whether an IP address is private, loopback, or link-local (SSRF guard).
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (PRIVATE_EXACT_IPS.has(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  return PRIVATE_PREFIXES.some((prefix) => ip.startsWith(prefix));
}

async function hasPrivateDnsResolution(hostname: string): Promise<boolean> {
  const addresses = await dns.lookup(hostname, { all: true });
  const privateAddr = addresses.find((addr) => isPrivateOrReservedIp(addr.address));
  if (privateAddr) {
    console.warn(`SSRF blocked: CIMD hostname ${hostname} resolved to private IP ${privateAddr.address}`);
    return true;
  }
  return false;
}

async function fetchCimdJson(clientId: string): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(clientId, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    return res.ok ? await res.json() : null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseCimdMetadata(opts: { data: any; clientId: string; fallbackName: string }): OAuthConfig | null {
  const { data, clientId, fallbackName } = opts;
  if (!data || data.client_id !== clientId) return null;
  if (!Array.isArray(data.redirect_uris) || data.redirect_uris.length === 0) return null;
  return {
    clientId: data.client_id,
    clientName: data.client_name || fallbackName,
    redirectUris: data.redirect_uris,
  };
}

/**
 * Fetches and verifies a Client ID Metadata Document (CIMD) over HTTPS with strict SSRF guardrails.
 */
export async function resolveCimdClient(clientId: string): Promise<OAuthConfig | null> {
  try {
    const parsed = new URL(clientId);
    if (parsed.protocol !== 'https:') return null;
    if (await hasPrivateDnsResolution(parsed.hostname)) return null;

    const data = await fetchCimdJson(clientId);
    return parseCimdMetadata({ data, clientId, fallbackName: parsed.hostname });
  } catch (err) {
    console.warn(`Failed to resolve CIMD client ${clientId}:`, err);
    return null;
  }
}

/**
 * Validates a client_id (CIMD or DCR / static registration) and verifies redirect_uri.
 */
export async function validateOAuthClient(
  clientId: string,
  redirectUri: string
): Promise<{ valid: boolean; clientName: string; error?: string }> {
  // 1. CIMD check (URL client_id)
  if (clientId.startsWith('https://')) {
    const cimd = await resolveCimdClient(clientId);
    if (!cimd) {
      return { valid: false, clientName: clientId, error: 'Invalid or unreachable Client ID Metadata Document.' };
    }
    if (!cimd.redirectUris.includes(redirectUri)) {
      return { valid: false, clientName: cimd.clientName, error: 'Redirect URI does not match CIMD registration.' };
    }
    return { valid: true, clientName: cimd.clientName };
  }

  // 2. Dynamic Client Registration / Static registration check in DB
  const supabase = getSupabaseAdmin();
  const { data: client, error } = await supabase
    .from('mcp_oauth_clients')
    .select('*')
    .eq('client_id', clientId)
    .single();

  if (error || !client) {
    return { valid: false, clientName: clientId, error: 'Unknown client_id.' };
  }

  const registeredUris = Array.isArray(client.redirect_uris) ? client.redirect_uris : [];
  if (!registeredUris.includes(redirectUri)) {
    return { valid: false, clientName: client.client_name, error: 'Redirect URI is not registered for this client.' };
  }

  return { valid: true, clientName: client.client_name };
}

/**
 * Issues a short-lived authorization code (expires in 5 minutes).
 */
export async function issueAuthorizationCode(params: {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  scopes: string[];
}): Promise<string> {
  const code = crypto.randomBytes(32).toString('hex');
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('mcp_oauth_codes').insert({
    code_hash: codeHash,
    user_id: params.userId,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    code_challenge_method: params.codeChallengeMethod || 'S256',
    resource: params.resource,
    scopes: params.scopes,
    expires_at: expiresAt,
  });

  if (error) throw error;
  return code;
}

function assertAuthCodeTiming(authCode: any) {
  if (authCode.consumed_at) throw new Error('Authorization code has already been consumed.');
  if (new Date(authCode.expires_at).getTime() <= Date.now()) throw new Error('Authorization code has expired.');
}

function assertResourceMatches(opts: { expected: string | null | undefined; actual: string | undefined }) {
  if (!opts.actual || !opts.expected) return;
  if (opts.actual !== opts.expected) {
    throw new Error('Requested resource does not match authorization code resource.');
  }
}

function assertAuthCodeMatchesParams(
  authCode: any,
  params: { clientId: string; redirectUri: string; resource?: string }
) {
  if (authCode.client_id !== params.clientId) throw new Error('Client ID mismatch.');
  if (authCode.redirect_uri !== params.redirectUri) throw new Error('Redirect URI mismatch.');
  assertResourceMatches({ expected: authCode.resource, actual: params.resource });
}

function assertAuthCodeValid(authCode: any, params: {
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  resource?: string;
}) {
  assertAuthCodeTiming(authCode);
  assertAuthCodeMatchesParams(authCode, params);
  if (!verifyPkce(params.codeVerifier, authCode.code_challenge, authCode.code_challenge_method)) {
    throw new Error('Invalid PKCE code verifier.');
  }
}

async function issueTokenPair(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  clientId: string;
  resource: string;
  scopes: string[];
}) {
  const accessToken = `mcp_at_${crypto.randomBytes(32).toString('hex')}`;
  const refreshToken = `mcp_rt_${crypto.randomBytes(32).toString('hex')}`;
  const accessExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  const refreshExpiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

  await Promise.all([
    params.supabase.from('mcp_oauth_tokens').insert({
      user_id: params.userId,
      client_id: params.clientId,
      token_hash: hashToken(accessToken),
      token_type: 'access_token',
      resource: params.resource,
      scopes: params.scopes,
      expires_at: accessExpiresAt,
    }),
    params.supabase.from('mcp_oauth_tokens').insert({
      user_id: params.userId,
      client_id: params.clientId,
      token_hash: hashToken(refreshToken),
      token_type: 'refresh_token',
      resource: params.resource,
      scopes: params.scopes,
      expires_at: refreshExpiresAt,
    }),
  ]);

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer' as const,
    expiresIn: 3600,
    scope: (params.scopes || []).join(' '),
  };
}

/**
 * Exchanges an authorization code for access and refresh tokens.
 */
export async function exchangeAuthorizationCode(params: {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  resource?: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string;
}> {
  const codeHash = hashToken(params.code);
  const supabase = getSupabaseAdmin();

  const { data: authCode, error } = await supabase
    .from('mcp_oauth_codes')
    .select('*')
    .eq('code_hash', codeHash)
    .single();

  if (error || !authCode) throw new Error('Invalid authorization code.');
  assertAuthCodeValid(authCode, params);

  await supabase
    .from('mcp_oauth_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('code_hash', codeHash);

  return issueTokenPair({
    supabase,
    userId: authCode.user_id,
    clientId: authCode.client_id,
    resource: authCode.resource || MCP_ENDPOINT,
    scopes: authCode.scopes,
  });
}

/**
 * Refreshes an expired access token using a valid refresh token.
 */
export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  resource?: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string;
}> {
  const refreshHash = hashToken(params.refreshToken);
  const supabase = getSupabaseAdmin();

  const { data: tokenRecord, error } = await supabase
    .from('mcp_oauth_tokens')
    .select('*')
    .eq('token_hash', refreshHash)
    .eq('token_type', 'refresh_token')
    .is('revoked_at', null)
    .single();

  if (error || !tokenRecord) throw new Error('Invalid or revoked refresh token.');
  if (new Date(tokenRecord.expires_at).getTime() <= Date.now()) throw new Error('Refresh token has expired.');
  if (tokenRecord.client_id !== params.clientId) throw new Error('Client ID mismatch.');

  await supabase
    .from('mcp_oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenRecord.id);

  return issueTokenPair({
    supabase,
    userId: tokenRecord.user_id,
    clientId: tokenRecord.client_id,
    resource: tokenRecord.resource,
    scopes: tokenRecord.scopes,
  });
}

/**
 * Revokes a token (access or refresh).
 */
export async function revokeToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const supabase = getSupabaseAdmin();
  await supabase
    .from('mcp_oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', tokenHash);
}
