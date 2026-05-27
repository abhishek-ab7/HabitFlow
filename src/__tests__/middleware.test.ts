import { describe, it, expect, vi, beforeEach } from 'vitest';
import { middleware } from '../middleware';
import { NextRequest, NextResponse } from 'next/server';
import * as rateLimit from '@/lib/security/rate-limit';

const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/security/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 19, retryAfter: 0 }),
  rateLimitResponse: vi.fn((retryAfter: number) =>
    new Response(
      JSON.stringify({ error: 'Too many requests', retryAfter }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) } }
    )
  ),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
    },
  })),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  
  // Create a mock that can be used as a constructor
  const MockNextResponse = vi.fn((body, init) => {
    return new actual.NextResponse(body, init);
  }) as any;

  // Add static methods
  MockNextResponse.next = vi.fn((init) => ({
    status: 200,
    headers: new Headers(init?.request?.headers || {}),
    text: async () => '',
  }));

  MockNextResponse.redirect = vi.fn((url) => ({
    status: 307,
    headers: new Headers({ location: url.toString() }),
  }));

  return {
    ...actual,
    NextResponse: MockNextResponse,
  };
});

describe('Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (url: string) => {
    return new NextRequest(new URL(url), {
      headers: new Headers({
        'host': 'localhost:3000',
      })
    });
  };

  it('skips public routes', async () => {
    const req = createRequest('http://localhost:3000/auth/auth-code-error');
    const res = await middleware(req);
    
    expect(res.status).toBe(200); // NextResponse.next()
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('skips static files', async () => {
    const req = createRequest('http://localhost:3000/icons/icon.png');
    const res = await middleware(req);
    
    expect(res.status).toBe(200);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users to login', async () => {
    const req = createRequest('http://localhost:3000/dashboard');
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });

    const res = await middleware(req);

    expect(res.status).toBe(307); // NextResponse.redirect
    expect(res.headers.get('location')).toContain('/login');
    expect(res.headers.get('location')).toContain('redirectedFrom=%2Fdashboard');
  });

  it('allows authenticated users to access protected routes', async () => {
    const req = createRequest('http://localhost:3000/dashboard');
    mockGetSession.mockResolvedValueOnce({ 
      data: { session: { user: { id: 'u1' } } }, 
      error: null 
    });

    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Security-Policy')).toBeDefined();
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('allows unauthenticated users to access login page', async () => {
    const req = createRequest('http://localhost:3000/login');
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });

    const res = await middleware(req);

    expect(res.status).toBe(200);
  });

  it('redirects authenticated users away from login to dashboard', async () => {
    const req = createRequest('http://localhost:3000/login');
    mockGetSession.mockResolvedValueOnce({ 
      data: { session: { user: { id: 'u1' } } }, 
      error: null 
    });

    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard');
  });

  it('applies rate limiting to /auth/callback', async () => {
    const req = createRequest('http://localhost:3000/auth/callback');
    vi.mocked(rateLimit.rateLimit).mockResolvedValueOnce({ success: false, remaining: 0, retryAfter: 60 });

    const res = await middleware(req);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ error: expect.any(String), retryAfter: 60 });
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('allows /auth/signout without authentication (publicRoute)', async () => {
    const req = createRequest('http://localhost:3000/auth/signout');
    const res = await middleware(req);

    // signout is now public — middleware should return next() without session check
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
