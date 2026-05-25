import { describe, it, expect, vi } from 'vitest';
import { rateLimit } from '../rate-limit';

describe('rateLimit', () => {
    // Mock Date.now to control time
    const REAL_DATE_NOW = Date.now.bind(global.Date);

    afterEach(() => {
        global.Date.now = REAL_DATE_NOW;
    });

    it('allows first request', () => {
        const req = {
            ip: '127.0.0.1',
            headers: { get: () => null },
            nextUrl: { pathname: '/login' }
        } as any;
        const config = { limit: 3, windowMs: 60000 };
        
        const result = rateLimit(req, config);
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(2);
    });

    it('tracks request count correctly', () => {
        const req = {
            ip: '10.0.0.1',
            headers: { get: () => null },
            nextUrl: { pathname: '/login' }
        } as any;
        const config = { limit: 3, windowMs: 60000 };
        
        rateLimit(req, config); // 1
        const result = rateLimit(req, config); // 2
        
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(1);
    });

    it('blocks when limit exceeded', () => {
        const req = {
            ip: '192.168.1.1',
            headers: { get: () => null },
            nextUrl: { pathname: '/login' }
        } as any;
        const config = { limit: 2, windowMs: 60000 };
        
        rateLimit(req, config); // 1
        rateLimit(req, config); // 2
        const result = rateLimit(req, config); // 3 (blocked)
        
        expect(result.success).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('resets after window expires', () => {
        let currentTime = 10000;
        global.Date.now = () => currentTime;

        const req = {
            ip: '192.168.1.5',
            headers: { get: () => null },
            nextUrl: { pathname: '/login' }
        } as any;
        const config = { limit: 1, windowMs: 5000 };
        
        // Use up the limit
        expect(rateLimit(req, config).success).toBe(true);
        expect(rateLimit(req, config).success).toBe(false); // blocked
        
        // Fast forward past window end
        currentTime += 6000;
        
        // Should be allowed again
        const result = rateLimit(req, config);
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(0);
    });

    it('keys by IP and path', () => {
        const req1 = { ip: '1.1.1.1', headers: { get: () => null }, nextUrl: { pathname: '/path1' } } as any;
        const req2 = { ip: '1.1.1.1', headers: { get: () => null }, nextUrl: { pathname: '/path2' } } as any;
        const req3 = { ip: '2.2.2.2', headers: { get: () => null }, nextUrl: { pathname: '/path1' } } as any;
        
        const config = { limit: 1, windowMs: 60000 };
        
        // req1 uses its limit
        rateLimit(req1, config);
        expect(rateLimit(req1, config).success).toBe(false);
        
        // req2 (different path) should still pass
        expect(rateLimit(req2, config).success).toBe(true);
        
        // req3 (different IP) should still pass
        expect(rateLimit(req3, config).success).toBe(true);
    });
});
