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

/**
 * Checks whether an IP address is private, loopback, or link-local (SSRF guard).
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  // IPv4 checks
  if (ip === '127.0.0.1' || ip === 'localhost') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith('169.254.')) return true; // Link-local
  if (ip.startsWith('0.') || ip.startsWith('100.64.')) return true;

  // IPv6 checks
  if (ip === '::1' || ip === '::') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // Unique local
  if (ip.startsWith('fe80:')) return true; // Link-local

  return false;
}

/**
 * Fetches and verifies a Client ID Metadata Document (CIMD) over HTTPS with strict SSRF guardrails.
 */
export async function resolveCimdClient(clientId: string): Promise<OAuthConfig | null> {
  try {
    const parsed = new URL(clientId);
    if (parsed.protocol !== 'https:') {
      return null;
    }

    // SSRF Check: resolve hostname DNS and reject private IPs
    const addresses = await dns.lookup(parsed.hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateOrReservedIp(addr.address)) {
        console.warn(`SSRF blocked: CIMD hostname ${parsed.hostname} resolved to private IP ${addr.address}`);
        return null;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(clientId, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (data.client_id !== clientId) return null;
    if (!Array.isArray(data.redirect_uris) || data.redirect_uris.length === 0) return null;

    return {
      clientId: data.client_id,
      clientName: data.client_name || parsed.hostname,
      redirectUris: data.redirect_uris,
    };
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

  if (error || !authCode) {
    throw new Error('Invalid authorization code.');
  }

  if (authCode.consumed_at) {
    throw new Error('Authorization code has already been consumed.');
  }

  if (new Date(authCode.expires_at).getTime() <= Date.now()) {
    throw new Error('Authorization code has expired.');
  }

  if (authCode.client_id !== params.clientId) {
    throw new Error('Client ID mismatch.');
  }

  if (authCode.redirect_uri !== params.redirectUri) {
    throw new Error('Redirect URI mismatch.');
  }

  // RFC 8707 Resource validation if provided
  if (params.resource && authCode.resource && params.resource !== authCode.resource) {
    throw new Error('Requested resource does not match authorization code resource.');
  }

  // Verify PKCE
  const pkceValid = verifyPkce(params.codeVerifier, authCode.code_challenge, authCode.code_challenge_method);
  if (!pkceValid) {
    throw new Error('Invalid PKCE code verifier.');
  }

  // Mark code consumed (single-use)
  await supabase
    .from('mcp_oauth_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('code_hash', codeHash);

  // Generate tokens
  const accessToken = `mcp_at_${crypto.randomBytes(32).toString('hex')}`;
  const refreshToken = `mcp_rt_${crypto.randomBytes(32).toString('hex')}`;

  const accessHash = hashToken(accessToken);
  const refreshHash = hashToken(refreshToken);

  const accessExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour
  const refreshExpiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString(); // 30 days

  await Promise.all([
    supabase.from('mcp_oauth_tokens').insert({
      user_id: authCode.user_id,
      client_id: authCode.client_id,
      token_hash: accessHash,
      token_type: 'access_token',
      resource: authCode.resource || MCP_ENDPOINT,
      scopes: authCode.scopes,
      expires_at: accessExpiresAt,
    }),
    supabase.from('mcp_oauth_tokens').insert({
      user_id: authCode.user_id,
      client_id: authCode.client_id,
      token_hash: refreshHash,
      token_type: 'refresh_token',
      resource: authCode.resource || MCP_ENDPOINT,
      scopes: authCode.scopes,
      expires_at: refreshExpiresAt,
    }),
  ]);

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: 3600,
    scope: (authCode.scopes || []).join(' '),
  };
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

  if (error || !tokenRecord) {
    throw new Error('Invalid or revoked refresh token.');
  }

  if (new Date(tokenRecord.expires_at).getTime() <= Date.now()) {
    throw new Error('Refresh token has expired.');
  }

  if (tokenRecord.client_id !== params.clientId) {
    throw new Error('Client ID mismatch.');
  }

  // Revoke old refresh token (rotation)
  await supabase
    .from('mcp_oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenRecord.id);

  // Issue new token pair
  const newAccessToken = `mcp_at_${crypto.randomBytes(32).toString('hex')}`;
  const newRefreshToken = `mcp_rt_${crypto.randomBytes(32).toString('hex')}`;

  const accessHash = hashToken(newAccessToken);
  const newRefreshHash = hashToken(newRefreshToken);

  const accessExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  const refreshExpiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

  await Promise.all([
    supabase.from('mcp_oauth_tokens').insert({
      user_id: tokenRecord.user_id,
      client_id: tokenRecord.client_id,
      token_hash: accessHash,
      token_type: 'access_token',
      resource: tokenRecord.resource,
      scopes: tokenRecord.scopes,
      expires_at: accessExpiresAt,
    }),
    supabase.from('mcp_oauth_tokens').insert({
      user_id: tokenRecord.user_id,
      client_id: tokenRecord.client_id,
      token_hash: newRefreshHash,
      token_type: 'refresh_token',
      resource: tokenRecord.resource,
      scopes: tokenRecord.scopes,
      expires_at: refreshExpiresAt,
    }),
  ]);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    tokenType: 'Bearer',
    expiresIn: 3600,
    scope: (tokenRecord.scopes || []).join(' '),
  };
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
