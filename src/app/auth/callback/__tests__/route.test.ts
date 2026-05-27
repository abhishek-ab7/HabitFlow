import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest, NextResponse } from 'next/server';
import * as urlValidator from '@/lib/security/url-validator';
import * as supabaseServer from '@/lib/supabase/server';

// Mock dependencies
vi.mock('@/lib/security/url-validator', () => ({
  validateRedirectUrl: vi.fn((origin, path, fallback) => origin + path),
  getValidatedNextPath: vi.fn((params, fallback) => params.get('next') || fallback),
}));

const mockSupabase = vi.hoisted(() => ({
  auth: {
    exchangeCodeForSession: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue(mockSupabase),
}));

describe('Auth Callback Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (url: string, headers = {}) => {
    return new NextRequest(new URL(url), { headers });
  };

  it('redirects to error page when no code is provided', async () => {
    const req = createRequest('http://localhost:3000/auth/callback');
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/auth-code-error?error=No+code+provided');
  });

  it('redirects to error page when provider returns error', async () => {
    const req = createRequest('http://localhost:3000/auth/callback?error=access_denied&error_description=User+aborted');
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/auth-code-error?error=User%20aborted');
  });

  it('exchanges code for session and redirects to dashboard', async () => {
    const req = createRequest('http://localhost:3000/auth/callback?code=valid_code');
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { user: { email: 'test@example.com' } } },
      error: null
    });

    const res = await GET(req);

    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('valid_code');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard');
  });

  it('redirects to reset-password when type is recovery', async () => {
    const req = createRequest('http://localhost:3000/auth/callback?code=valid_code&type=recovery');
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { user: { email: 'test@example.com' } } },
      error: null
    });

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/auth/reset-password');
  });

  it('handles exchange errors gracefully', async () => {
    const req = createRequest('http://localhost:3000/auth/callback?code=invalid_code');
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid code' }
    });

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/auth-code-error?error=Invalid%20code');
  });

  it('uses x-forwarded headers for origin if present', async () => {
    const req = createRequest('http://localhost:3000/auth/callback?code=valid_code', {
      'x-forwarded-host': 'habitflow.app',
      'x-forwarded-proto': 'https'
    });
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { user: { email: 'test@example.com' } } },
      error: null
    });

    await GET(req);

    expect(urlValidator.validateRedirectUrl).toHaveBeenCalledWith(
      'https://habitflow.app',
      '/dashboard',
      '/dashboard'
    );
  });
});
