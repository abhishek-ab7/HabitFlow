import { NextRequest } from 'next/server';

/**
 * Dual-mode Rate Limiter
 *
 * - No UPSTASH_REDIS_REST_URL set → in-memory Map (local dev, CI, tests)
 * - UPSTASH_REDIS_REST_URL set     → Upstash Redis sliding window (production)
 *
 * The abstraction is transparent to callers. All environments get the same
 * RateLimitResult shape. Only the persistence backend differs.
 *
 * Production cost note:
 *   Upstash free tier = 10,000 commands/day.
 *   Each rate-limit check = 1 Redis command.
 *   ~500 daily active users hitting /login = ~500 commands (well within free tier).
 *   For high traffic (>5,000 DAU), upgrade to Upstash Pro ($0.2/100K commands).
 */

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfter: number; // seconds until the rate-limit window resets (0 if not limited)
}

// ---------------------------------------------------------------------------
// In-memory backend (local dev / tests / no-Upstash environments)
// ---------------------------------------------------------------------------

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Cleanup expired entries every 60s to prevent memory leaks
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 60_000);
}

function rateLimitInMemory(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs });
    return { success: true, remaining: config.limit - 1, retryAfter: 0 };
  }

  if (record.count >= config.limit) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { success: false, remaining: 0, retryAfter };
  }

  record.count++;
  return { success: true, remaining: config.limit - record.count, retryAfter: 0 };
}

// ---------------------------------------------------------------------------
// Upstash Redis backend (production)
// ---------------------------------------------------------------------------

async function rateLimitUpstash(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  // Dynamic import so Upstash is only loaded when the env vars are present.
  // This prevents import errors in environments that don't have Upstash configured.
  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import('@upstash/ratelimit'),
    import('@upstash/redis'),
  ]);

  // Instantiate per-request (Upstash handles connection pooling internally).
  // Sliding window algorithm gives the smoothest rate limiting behavior —
  // avoids the "burst at window boundary" issue with fixed windows.
  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(config.limit, `${Math.round(config.windowMs / 1000)} s`),
    analytics: false, // Disable Upstash analytics to minimize command usage
    prefix: 'habitflow:rl',
  });

  const { success, remaining, reset } = await ratelimit.limit(key);
  const retryAfter = success ? 0 : Math.ceil((reset - Date.now()) / 1000);

  return { success, remaining, retryAfter };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Rate limit a request by IP + path.
 *
 * @example
 * const result = await rateLimit(request, { limit: 10, windowMs: 60_000 });
 * if (!result.success) {
 *   return rateLimitResponse(result.retryAfter);
 * }
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  // Prefer the leftmost IP in x-forwarded-for (the real client IP behind proxies)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    (request as unknown as { ip?: string }).ip ||
    'unknown';

  const path = request.nextUrl.pathname;
  const key = `rl:${ip}:${path}`;

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await rateLimitUpstash(key, config);
    } catch (err) {
      // Upstash unavailable — degrade gracefully to in-memory
      console.error('Upstash rate limit error, falling back to in-memory:', err);
      return rateLimitInMemory(key, config);
    }
  }

  return rateLimitInMemory(key, config);
}

/**
 * Build a standardised 429 Too Many Requests response.
 * Returns JSON with a human-readable message and machine-readable retryAfter.
 */
export function rateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please wait before trying again.',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    },
  );
}
