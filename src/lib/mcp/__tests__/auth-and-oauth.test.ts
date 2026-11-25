import { describe, it, expect, vi } from 'vitest';
import { timingSafeCheck, hashToken, hasScope, create401Response, create403Response } from '../auth';
import { verifyPkce, isPrivateOrReservedIp } from '../oauth';
import { OAUTH_PRM_URL, ACCEPTED_MCP_RESOURCES, DEFAULT_ALLOWED_ORIGINS, MCP_BASE_URL } from '../config';
import crypto from 'crypto';

describe('MCP Authentication & PKCE Security', () => {
  it('timingSafeCheck validates matching secrets safely', () => {
    const secret = 'super_secret_mcp_token_12345';
    expect(timingSafeCheck(secret, secret)).toBe(true);
    expect(timingSafeCheck('wrong_token', secret)).toBe(false);
    expect(timingSafeCheck('', secret)).toBe(false);
    expect(timingSafeCheck(secret, '')).toBe(false);
  });

  it('hashToken generates deterministic sha256 hex', () => {
    const token = 'mcp_at_test123';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hasScope correctly tests for granted permissions', () => {
    const authContext = {
      userId: 'test-user-id',
      authMode: 'oauth' as const,
      scopes: ['habitflow:read', 'habitflow:write'] as any[],
    };

    expect(hasScope(authContext, 'habitflow:read')).toBe(true);
    expect(hasScope(authContext, 'habitflow:write')).toBe(true);
    expect(hasScope(authContext, 'habitflow:finance:read')).toBe(false);
    expect(hasScope(authContext, 'habitflow:finance:write')).toBe(false);
  });

  it('create401Response outputs RFC 9728 WWW-Authenticate header', () => {
    const res = create401Response('Token required');
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe(`Bearer resource_metadata="${OAUTH_PRM_URL}"`);
  });

  it('create403Response outputs insufficient_scope challenge', () => {
    const res = create403Response('habitflow:finance:write');
    expect(res.status).toBe(403);
    expect(res.headers.get('WWW-Authenticate')).toContain('error="insufficient_scope"');
    expect(res.headers.get('WWW-Authenticate')).toContain('scope="habitflow:finance:write"');
  });

  it('verifyPkce accepts valid S256 code verifier and challenge', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

    expect(verifyPkce(verifier, challenge, 'S256')).toBe(true);
    expect(verifyPkce('wrong_verifier', challenge, 'S256')).toBe(false);
    expect(verifyPkce(verifier, challenge, 'plain')).toBe(false); // Plain is strictly rejected
  });

  it('isPrivateOrReservedIp detects loopback, private, and link-local addresses (SSRF guard)', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('localhost')).toBe(true);
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.0.5')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true); // AWS/cloud metadata IP

    // Public IPs should not be blocked
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
    expect(isPrivateOrReservedIp('76.76.21.21')).toBe(false);
  });

  it('accepts both habitflow.tech and legacy vercel.app domains in MCP resource & CORS configs', () => {
    expect(MCP_BASE_URL).toBe('https://habitflow.tech');
    expect(ACCEPTED_MCP_RESOURCES).toContain('https://habitflow.tech');
    expect(ACCEPTED_MCP_RESOURCES).toContain('https://habitflow.tech/api/mcp');
    expect(ACCEPTED_MCP_RESOURCES).toContain('https://habit-flow-ochre-two.vercel.app');
    expect(ACCEPTED_MCP_RESOURCES).toContain('https://habit-flow-ochre-two.vercel.app/api/mcp');
    expect(DEFAULT_ALLOWED_ORIGINS).toContain('https://habitflow.tech');
    expect(DEFAULT_ALLOWED_ORIGINS).toContain('https://habit-flow-ochre-two.vercel.app');
    expect(DEFAULT_ALLOWED_ORIGINS).toContain('https://gemini.google.com');
  });
});
