// In-Memory Cache with TTL (can be upgraded to Redis/Vercel KV later)

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class InMemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    const expired: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl * 1000) {
        expired.push(key);
      }
    });

    expired.forEach(key => this.cache.delete(key));
    
    if (expired.length > 0) {
      console.log(`[Cache] Cleaned up ${expired.length} expired entries`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(`ai:${key}`);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl * 1000) {
      // Expired
      this.cache.delete(`ai:${key}`);
      return null;
    }

    return entry.data as T;
  }

  async set<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds
    };
    this.cache.set(`ai:${key}`, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(`ai:${key}`);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`[Cache] Invalidated ${keysToDelete.length} keys matching pattern: ${pattern}`);
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// Singleton instance
const cache = new InMemoryCache();

export async function getCachedResponse<T>(key: string): Promise<T | null> {
  try {
    return await cache.get<T>(key);
  } catch (error) {
    console.error('[Cache] Read error:', error);
    return null; // Fail gracefully
  }
}

export async function setCachedResponse<T>(
  key: string,
  data: T,
  ttlSeconds: number
): Promise<void> {
  try {
    await cache.set(key, data, ttlSeconds);
  } catch (error) {
    console.error('[Cache] Write error:', error);
    // Don't throw - caching failure shouldn't break the feature
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  try {
    await cache.invalidatePattern(pattern);
  } catch (error) {
    console.error('[Cache] Invalidation error:', error);
  }
}

export async function deleteCacheKey(key: string): Promise<void> {
  try {
    await cache.delete(key);
  } catch (error) {
    console.error('[Cache] Delete error:', error);
  }
}

export function getCacheStats() {
  return cache.getStats();
}
