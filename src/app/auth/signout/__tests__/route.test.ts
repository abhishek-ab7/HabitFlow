import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import * as urlValidator from '@/lib/security/url-validator';

// Mock validateRedirectUrl
vi.mock('@/lib/security/url-validator', () => ({
  validateRedirectUrl: vi.fn((origin, path, fallback) => origin + path),
}));

// Mock @supabase/ssr
const mockSignOut = vi.fn().mockResolvedValue({ error: null });
const mockCookiesSet = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signOut: mockSignOut,
    },
  })),
}));

describe('Auth Signout Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (url: string, headers = {}) => {
    return new NextRequest(new URL(url), { method: 'POST', headers });
  };

  it('signs out and redirects to login', async () => {
    const req = createRequest('http://localhost:3000/auth/signout');
    const res = await POST(req);

    expect(mockSignOut).toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('uses x-forwarded headers for origin', async () => {
    const req = createRequest('http://localhost:3000/auth/signout', {
      'x-forwarded-host': 'habitflow.app',
      'x-forwarded-proto': 'https'
    });
    
    await POST(req);

    expect(urlValidator.validateRedirectUrl).toHaveBeenCalledWith(
      'https://habitflow.app',
      '/login',
      '/login'
    );
  });
});
