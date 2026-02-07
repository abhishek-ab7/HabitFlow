/**
 * URL Validation Utility
 * 
 * Prevents open redirect vulnerabilities by validating URLs against an allowlist
 * of trusted domains and paths.
 */

const ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    // Add your production domain here when deploying
    // 'habitflow.app',
    // 'www.habitflow.app',
];

const ALLOWED_PATHS = [
    '/',
    '/login',
    '/auth/callback',
    '/auth/reset-password',
    '/auth/auth-code-error',
    '/analytics',
    '/goals',
    '/habits',
    '/routines',
    '/settings',
    '/tasks',
];

/**
 * Validates if a given origin (protocol + host) is trusted
 */
export function isValidOrigin(origin: string): boolean {
    try {
        const url = new URL(origin);

        // Check protocol
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return false;
        }

        // Extract hostname (without port)
        const hostname = url.hostname;

        // Check against allowlist
        return ALLOWED_HOSTS.some(allowed => {
            // Exact match or subdomain match
            return hostname === allowed || hostname.endsWith(`.${allowed}`);
        });
    } catch {
        return false;
    }
}

/**
 * Validates if a given path is allowed for redirects
 */
export function isValidPath(path: string): boolean {
    // Must start with /
    if (!path.startsWith('/')) {
        return false;
    }

    // Prevent protocol-relative URLs (//evil.com)
    if (path.startsWith('//')) {
        return false;
    }

    // Check against allowlist (exact match or starts with allowed path)
    return ALLOWED_PATHS.some(allowed => {
        return path === allowed || path.startsWith(`${allowed}/`);
    });
}

/**
 * Validates and sanitizes a redirect URL
 * Returns the validated URL or a safe fallback
 */
export function validateRedirectUrl(
    origin: string,
    path: string,
    fallback: string = '/'
): string {
    // Validate origin
    if (!isValidOrigin(origin)) {
        console.warn(`Invalid origin detected: ${origin}, using fallback`);
        // Use the request's own origin as fallback
        return fallback;
    }

    // Validate path
    if (!isValidPath(path)) {
        console.warn(`Invalid path detected: ${path}, using fallback`);
        return `${origin}${fallback}`;
    }

    return `${origin}${path}`;
}

/**
 * Extracts and validates the 'next' parameter from URL search params
 */
export function getValidatedNextPath(
    searchParams: URLSearchParams,
    fallback: string = '/'
): string {
    const next = searchParams.get('next');

    if (!next) {
        return fallback;
    }

    // Validate the path
    if (!isValidPath(next)) {
        console.warn(`Invalid 'next' parameter: ${next}, using fallback`);
        return fallback;
    }

    return next;
}
