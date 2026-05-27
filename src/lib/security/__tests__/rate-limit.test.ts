import { describe, it, expect, afterEach } from 'vitest';
import { rateLimit, rateLimitResponse } from '../rate-limit';

// Helper to build a minimal mock NextRequest
const makeReq = (ip: string, path: string) =>
  ({
    headers: {
      get: (name: string) => (name === 'x-forwarded-for' ? ip : null),
    },
    nextUrl: { pathname: path },
  } as any);

describe('rateLimit (in-memory backend)', () => {
  const REAL_DATE_NOW = Date.now.bind(global.Date);

  afterEach(() => {
    global.Date.now = REAL_DATE_NOW;
  });

  it('allows first request and returns correct remaining count', async () => {
    const req = makeReq('10.0.0.1', '/test-first');
    const result = await rateLimit(req, { limit: 3, windowMs: 60_000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.retryAfter).toBe(0);
  });

  it('tracks request count correctly', async () => {
    const req = makeReq('10.0.0.2', '/test-count');
    await rateLimit(req, { limit: 3, windowMs: 60_000 }); // 1
    const result = await rateLimit(req, { limit: 3, windowMs: 60_000 }); // 2
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('blocks when limit is exceeded', async () => {
    const req = makeReq('10.0.0.3', '/test-block');
    await rateLimit(req, { limit: 2, windowMs: 60_000 }); // 1
    await rateLimit(req, { limit: 2, windowMs: 60_000 }); // 2
    const result = await rateLimit(req, { limit: 2, windowMs: 60_000 }); // 3 — blocked

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    // retryAfter should be > 0 when blocked
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('resets correctly after the time window expires', async () => {
    let currentTime = 10_000;
    global.Date.now = () => currentTime;

    const req = makeReq('10.0.0.4', '/test-reset');
    const config = { limit: 1, windowMs: 5_000 };

    expect((await rateLimit(req, config)).success).toBe(true);
    expect((await rateLimit(req, config)).success).toBe(false); // blocked

    currentTime += 6_000; // advance past window

    const result = await rateLimit(req, config);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('keys independently by IP and path', async () => {
    const req1 = makeReq('11.0.0.1', '/path-a');
    const req2 = makeReq('11.0.0.1', '/path-b'); // same IP, different path
    const req3 = makeReq('11.0.0.2', '/path-a'); // different IP, same path
    const config = { limit: 1, windowMs: 60_000 };

    await rateLimit(req1, config);
    expect((await rateLimit(req1, config)).success).toBe(false); // req1 blocked

    expect((await rateLimit(req2, config)).success).toBe(true);  // req2 unaffected
    expect((await rateLimit(req3, config)).success).toBe(true);  // req3 unaffected
  });

  it('prefers leftmost IP from x-forwarded-for', async () => {
    const req = {
      headers: { get: (name: string) => name === 'x-forwarded-for' ? '1.2.3.4, 5.6.7.8' : null },
      nextUrl: { pathname: '/xfwd' },
    } as any;

    const result = await rateLimit(req, { limit: 5, windowMs: 60_000 });
    expect(result.success).toBe(true);
  });
});

describe('rateLimitResponse', () => {
  it('returns 429 status', () => {
    const response = rateLimitResponse(60);
    expect(response.status).toBe(429);
  });

  it('returns JSON content-type', () => {
    const response = rateLimitResponse(30);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('sets Retry-After header correctly', () => {
    const response = rateLimitResponse(45);
    expect(response.headers.get('Retry-After')).toBe('45');
  });

  it('returns body with error and retryAfter fields', async () => {
    const response = rateLimitResponse(120);
    const body = await response.json();
    expect(body).toMatchObject({
      error: expect.any(String),
      retryAfter: 120,
    });
  });
});
