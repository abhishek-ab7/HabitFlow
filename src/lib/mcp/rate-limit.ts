import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

export type McpRateLimitTier = 'read' | 'write' | 'oauth';

const TIER_CONFIG: Record<McpRateLimitTier, { limit: number; windowMs: number }> = {
  read: { limit: 120, windowMs: 60_000 },
  write: { limit: 40, windowMs: 60_000 },
  oauth: { limit: 20, windowMs: 60_000 },
};

// In-memory fallback map
const inMemoryStore = new Map<string, { count: number; resetTime: number }>();

function rateLimitInMemory(key: string, tier: McpRateLimitTier) {
  const config = TIER_CONFIG[tier];
  const now = Date.now();
  const record = inMemoryStore.get(key);

  if (!record || now > record.resetTime) {
    inMemoryStore.set(key, { count: 1, resetTime: now + config.windowMs });
    return { success: true, retryAfter: 0 };
  }

  if (record.count >= config.limit) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { success: false, retryAfter };
  }

  record.count += 1;
  return { success: true, retryAfter: 0 };
}

let upstashLimiters: Record<McpRateLimitTier, Ratelimit> | null = null;

function getUpstashLimiters() {
  if (upstashLimiters) return upstashLimiters;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const redis = new Redis({ url, token });
    upstashLimiters = {
      read: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(TIER_CONFIG.read.limit, '60 s'),
        prefix: 'habitflow:mcp:read',
      }),
      write: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(TIER_CONFIG.write.limit, '60 s'),
        prefix: 'habitflow:mcp:write',
      }),
      oauth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(TIER_CONFIG.oauth.limit, '60 s'),
        prefix: 'habitflow:mcp:oauth',
      }),
    };
    return upstashLimiters;
  } catch (err) {
    console.warn('Failed to initialize Upstash Redis for MCP rate limiting:', err);
    return null;
  }
}

/**
 * Checks rate limit for an MCP caller.
 * @param key Identifier (e.g. userId for authenticated tools, client IP for OAuth endpoints)
 * @param tier 'read' | 'write' | 'oauth'
 */
export async function checkMcpRateLimit(
  key: string,
  tier: McpRateLimitTier
): Promise<{ success: boolean; retryAfter: number }> {
  const limiters = getUpstashLimiters();

  if (limiters) {
    try {
      const res = await limiters[tier].limit(key);
      const retryAfter = res.reset ? Math.ceil((res.reset - Date.now()) / 1000) : 0;
      return { success: res.success, retryAfter: Math.max(0, retryAfter) };
    } catch (err) {
      console.warn('Upstash MCP rate limit error, falling back to in-memory:', err);
    }
  }

  return rateLimitInMemory(key, tier);
}
