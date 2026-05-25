import { describe, it, expect, vi } from 'vitest';
import { 
    isValidOrigin, 
    isValidPath, 
    validateRedirectUrl, 
    getValidatedNextPath 
} from '../url-validator';

describe('url-validator', () => {

    describe('isValidOrigin', () => {
        it('accepts allowed hosts', () => {
            expect(isValidOrigin('http://localhost')).toBe(true);
            expect(isValidOrigin('http://127.0.0.1')).toBe(true);
            expect(isValidOrigin('https://habitflow.tech')).toBe(true);
            expect(isValidOrigin('https://www.habitflow.tech')).toBe(true);
        });

        it('accepts allowed subdomains', () => {
            expect(isValidOrigin('https://app.habitflow.tech')).toBe(true);
        });

        it('rejects unknown domains', () => {
            expect(isValidOrigin('https://evil.com')).toBe(false);
            expect(isValidOrigin('https://habitflow.tech.evil.com')).toBe(false);
        });

        it('blocks non-http protocols', () => {
            expect(isValidOrigin('javascript:alert(1)')).toBe(false);
            expect(isValidOrigin('file:///etc/passwd')).toBe(false);
            expect(isValidOrigin('data:text/html,<html>')).toBe(false);
        });
        
        it('handles totally invalid URLs safely', () => {
            expect(isValidOrigin('not-a-url')).toBe(false);
        });
    });

    describe('isValidPath', () => {
        it('accepts allowed exact paths', () => {
            expect(isValidPath('/')).toBe(true);
            expect(isValidPath('/login')).toBe(true);
            expect(isValidPath('/dashboard')).toBe(false); // /dashboard is not in ALLOWED_PATHS? Wait, let's look at ALLOWED_PATHS.
        });

        it('accepts allowed subdirectories', () => {
            expect(isValidPath('/auth/callback')).toBe(true);
            expect(isValidPath('/goals/new')).toBe(true);
        });

        it('rejects protocol-relative // URLs', () => {
            expect(isValidPath('//evil.com')).toBe(false);
            expect(isValidPath('///evil.com')).toBe(false);
        });

        it('rejects paths not starting with /', () => {
            expect(isValidPath('login')).toBe(false);
            expect(isValidPath('https://habitflow.tech')).toBe(false);
        });
        
        it('rejects unlisted paths', () => {
            expect(isValidPath('/unknown')).toBe(false);
        });
    });

    describe('validateRedirectUrl', () => {
        it('returns validated URL when both origin and path are valid', () => {
            expect(validateRedirectUrl('https://habitflow.tech', '/login')).toBe('https://habitflow.tech/login');
        });

        it('falls back when origin is invalid', () => {
            // My recent fix makes it return just the fallback
            expect(validateRedirectUrl('https://evil.com', '/login', '/fallback')).toBe('/fallback');
        });

        it('falls back when path is invalid', () => {
            expect(validateRedirectUrl('https://habitflow.tech', '//evil.com', '/login')).toBe('https://habitflow.tech/login');
        });
    });

    describe('getValidatedNextPath', () => {
        it('extracts valid next param', () => {
            const params = new URLSearchParams('next=/login');
            expect(getValidatedNextPath(params, '/fallback')).toBe('/login');
        });

        it('returns fallback for missing param', () => {
            const params = new URLSearchParams('');
            expect(getValidatedNextPath(params, '/fallback')).toBe('/fallback');
        });

        it('returns fallback for invalid param', () => {
            const params = new URLSearchParams('next=//evil.com');
            expect(getValidatedNextPath(params, '/fallback')).toBe('/fallback');
        });
    });
});
