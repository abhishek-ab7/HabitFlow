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
"[project]/src/app/auth/signout/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createServerClient.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$url$2d$validator$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/security/url-validator.ts [app-route] (ecmascript)");
;
;
;
async function POST(request) {
    const requestUrl = new URL(request.url);
    // Determine origin for redirect
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const origin = forwardedHost ? `${forwardedProto || 'https'}://${forwardedHost}` : requestUrl.origin;
    // Validate redirect URL to prevent open redirects
    const validatedRedirectUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$url$2d$validator$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateRedirectUrl"])(origin, '/login', '/login');
    const response = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].redirect(validatedRedirectUrl, {
        status: 302
    });
    // Create Supabase client to handle cookie clearing
    const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createServerClient"])(("TURBOPACK compile-time value", "https://zqzegbvtoyqxidxuuzim.supabase.co"), ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxemVnYnZ0b3lxeGlkeHV1emltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzcwODQsImV4cCI6MjA4NDU1MzA4NH0.3ML4sc6DlmtzOUfXS6zUDRY5klzITgGSriD7f6QOmC8"), {
        cookies: {
            getAll () {
                return request.cookies.getAll();
            },
            setAll (cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options })=>{
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                        sameSite: 'lax',
                        secure: true,
                        path: '/'
                    });
                });
            }
        }
    });
    // Sign out from Supabase (this triggers the setAll above to clear cookies)
    await supabase.auth.signOut();
    return response;
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__effc5fbe._.js.map