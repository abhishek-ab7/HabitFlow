import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple in-memory rate limiter for middleware
 * Note: In a serverless environment (Vercel), this memory is not shared across instances.
 * For production, you should use Redis (Upstash) or a database.
 * This is a basic implementation to deter simple attacks.
 */

interface RateLimitConfig {
    limit: number;
    windowMs: number;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Cleanup expired entries every minute to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
        if (now > value.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 60000);

export function rateLimit(request: NextRequest, config: RateLimitConfig) {
    const ip = (request as any).ip || request.headers.get('x-forwarded-for') || 'unknown';
    const path = request.nextUrl.pathname;
    const key = `${ip}:${path}`;
    const now = Date.now();

    const record = rateLimitStore.get(key);

    // If no record exists or window has expired
    if (!record || now > record.resetTime) {
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + config.windowMs,
        });
        return { success: true, remaining: config.limit - 1 };
    }

    // Check if limit exceeded
    if (record.count >= config.limit) {
        return { success: false, remaining: 0 };
    }

    // Increment count
    record.count++;
    return { success: true, remaining: config.limit - record.count };
}
