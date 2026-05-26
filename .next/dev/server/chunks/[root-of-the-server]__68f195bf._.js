module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/src/lib/security/url-validator.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getValidatedNextPath",
    ()=>getValidatedNextPath,
    "isValidOrigin",
    ()=>isValidOrigin,
    "isValidPath",
    ()=>isValidPath,
    "validateRedirectUrl",
    ()=>validateRedirectUrl
]);
/**
 * URL Validation Utility
 * 
 * Prevents open redirect vulnerabilities by validating URLs against an allowlist
 * of trusted domains and paths.
 */ const ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    'habitflow.tech',
    'www.habitflow.tech',
    'habit-flow-ochre-two.vercel.app'
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
    '/tasks'
];
function isValidOrigin(origin) {
    try {
        const url = new URL(origin);
        // Check protocol
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return false;
        }
        // Extract hostname (without port)
        const hostname = url.hostname;
        // Check against allowlist
        return ALLOWED_HOSTS.some((allowed)=>{
            // Exact match or subdomain match
            return hostname === allowed || hostname.endsWith(`.${allowed}`);
        });
    } catch  {
        return false;
    }
}
function isValidPath(path) {
    // Must start with /
    if (!path.startsWith('/')) {
        return false;
    }
    // Prevent protocol-relative URLs (//evil.com)
    if (path.startsWith('//')) {
        return false;
    }
    // Check against allowlist (exact match or starts with allowed path)
    return ALLOWED_PATHS.some((allowed)=>{
        return path === allowed || path.startsWith(`${allowed}/`);
    });
}
function validateRedirectUrl(origin, path, fallback = '/') {
    // Validate origin
    if (!isValidOrigin(origin)) {
        console.warn(`Invalid origin detected: ${origin}, using fallback`);
        // Do not use the invalid origin! Just return the fallback path which will be relative
        return fallback;
    }
    // Validate path
    if (!isValidPath(path)) {
        console.warn(`Invalid path detected: ${path}, using fallback`);
        return `${origin}${fallback}`;
    }
    return `${origin}${path}`;
}
function getValidatedNextPath(searchParams, fallback = '/') {
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
}),
"[project]/src/lib/supabase/server.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createServerSupabaseClient",
    ()=>createServerSupabaseClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createServerClient.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
;
;
async function createServerSupabaseClient() {
    const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createServerClient"])(("TURBOPACK compile-time value", "https://zqzegbvtoyqxidxuuzim.supabase.co"), ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxemVnYnZ0b3lxeGlkeHV1emltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzcwODQsImV4cCI6MjA4NDU1MzA4NH0.3ML4sc6DlmtzOUfXS6zUDRY5klzITgGSriD7f6QOmC8"), {
        cookies: {
            getAll () {
                return cookieStore.getAll();
            },
            setAll (cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options })=>cookieStore.set(name, value, options));
                } catch  {
                // The `setAll` method was called from a Server Component.
                // This can be ignored if you have middleware refreshing
                // user sessions.
                }
            }
        }
    });
}
}),
"[project]/src/app/auth/callback/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$url$2d$validator$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/security/url-validator.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase/server.ts [app-route] (ecmascript)");
;
;
;
const dynamic = 'force-dynamic';
async function GET(request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$url$2d$validator$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getValidatedNextPath"])(requestUrl.searchParams, '/dashboard');
    const error = requestUrl.searchParams.get('error');
    const errorDescription = requestUrl.searchParams.get('error_description');
    const type = requestUrl.searchParams.get('type');
    console.log('Callback received:', {
        code: !!code,
        error,
        next,
        type
    });
    // Handle OAuth errors from provider
    if (error) {
        console.error('OAuth error:', error, errorDescription);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].redirect(`${requestUrl.origin}/auth/auth-code-error?error=${encodeURIComponent(errorDescription || error)}`);
    }
    if (!code) {
        console.error('No code provided in callback');
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].redirect(`${requestUrl.origin}/auth/auth-code-error?error=No+code+provided`);
    }
    try {
        // Determine the redirect origin
        const forwardedHost = request.headers.get('x-forwarded-host');
        const forwardedProto = request.headers.get('x-forwarded-proto');
        const origin = forwardedHost ? `${forwardedProto || 'https'}://${forwardedHost}` : requestUrl.origin;
        // Use the central server client which correctly handles cookies via next/headers
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createServerSupabaseClient"])();
        // Exchange code for session - this automatically sets cookies via the client config
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
            console.error('Exchange error:', exchangeError.message);
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].redirect(`${requestUrl.origin}/auth/auth-code-error?error=${encodeURIComponent(exchangeError.message)}`);
        }
        if (!data.session) {
            console.error('No session after exchange');
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].redirect(`${requestUrl.origin}/auth/auth-code-error?error=No+session+after+exchange`);
        }
        console.log('Session exchange successful, user:', data.session.user.email);
        // Check if this is a password recovery session
        const isRecovery = type === 'recovery' || data.session.user.recovery_sent_at !== undefined;
        const redirectPath = isRecovery ? '/auth/reset-password' : next;
        // Create response with proper redirect (validated to prevent open redirects)
        const validatedRedirectUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$url$2d$validator$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateRedirectUrl"])(origin, redirectPath, '/dashboard');
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].redirect(validatedRedirectUrl);
    } catch (err) {
        console.error('Callback error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown callback error';
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].redirect(`${requestUrl.origin}/auth/auth-code-error?error=${encodeURIComponent(errorMessage)}`);
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__68f195bf._.js.map