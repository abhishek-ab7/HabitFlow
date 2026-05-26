(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["chunks/[root-of-the-server]__4b0ff6d4._.js",
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[project]/src/lib/security/rate-limit.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "rateLimit",
    ()=>rateLimit
]);
const rateLimitStore = new Map();
// Cleanup expired entries every minute to prevent memory leaks
if ("TURBOPACK compile-time truthy", 1) {
    setInterval(()=>{
        const now = Date.now();
        for (const [key, value] of rateLimitStore.entries()){
            if (now > value.resetTime) {
                rateLimitStore.delete(key);
            }
        }
    }, 60000);
}
function rateLimit(request, config) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const path = request.nextUrl.pathname;
    const key = `${ip}:${path}`;
    const now = Date.now();
    const record = rateLimitStore.get(key);
    // If no record exists or window has expired
    if (!record || now > record.resetTime) {
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + config.windowMs
        });
        return {
            success: true,
            remaining: config.limit - 1
        };
    }
    // Check if limit exceeded
    if (record.count >= config.limit) {
        return {
            success: false,
            remaining: 0
        };
    }
    // Increment count
    record.count++;
    return {
        success: true,
        remaining: config.limit - record.count
    };
}
}),
"[project]/src/middleware.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "middleware",
    ()=>middleware
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [middleware-edge] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createServerClient.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$api$2f$server$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/esm/api/server.js [middleware-edge] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/esm/server/web/exports/index.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$rate$2d$limit$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/security/rate-limit.ts [middleware-edge] (ecmascript)");
;
;
;
async function middleware(request) {
    const { pathname } = request.nextUrl;
    // Skip middleware for static files - this is a safety check
    if (pathname === '/manifest.json' || pathname === '/sw.js' || pathname.startsWith('/icons/') || pathname.endsWith('.ico') || pathname.endsWith('.png') || pathname.endsWith('.svg') || pathname.endsWith('.jpg') || pathname.endsWith('.jpeg') || pathname.endsWith('.webp')) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    // Public routes that don't require authentication
    const publicRoutes = [
        '/login',
        '/auth/callback',
        '/auth/auth-code-error',
        '/auth/reset-password'
    ];
    const isPublicRoute = publicRoutes.some((route)=>pathname.startsWith(route));
    if (isPublicRoute) {
        // Apply rate limiting to sensitive public routes
        if (pathname.startsWith('/auth/callback')) {
            const result = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$rate$2d$limit$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["rateLimit"])(request, {
                limit: 10,
                windowMs: 60 * 1000
            }); // 10 req/min
            if (!result.success) {
                return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"]('Too Many Requests', {
                    status: 429
                });
            }
        }
        if (pathname === '/login') {
            const result = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$rate$2d$limit$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["rateLimit"])(request, {
                limit: 20,
                windowMs: 60 * 1000
            }); // 20 req/min
            if (!result.success) {
                return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"]('Too Many Requests', {
                    status: 429
                });
            }
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    // Apply rate limiting to signout (even if it's protected, to prevent DoS)
    if (pathname === '/auth/signout') {
        const result = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$rate$2d$limit$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["rateLimit"])(request, {
            limit: 10,
            windowMs: 60 * 1000
        }); // 10 req/min
        if (!result.success) {
            return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"]('Too Many Requests', {
                status: 429
            });
        }
    }
    // Create a response object
    let response = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next({
        request: {
            headers: request.headers
        }
    });
    // Add Security Headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // Content Security Policy (CSP)
    // Allow scripts from self and trusted sources (Supabase, Vercel)
    const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.supabase.co https://*.userusercontent.com;
    font-src 'self' data:;
    connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.supabase.net wss://*.supabase.co wss://*.supabase.in wss://*.supabase.net https://generativelanguage.googleapis.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();
    response.headers.set('Content-Security-Policy', cspHeader);
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Create Supabase client with proper cookie handling
    const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["createServerClient"])(("TURBOPACK compile-time value", "https://zqzegbvtoyqxidxuuzim.supabase.co"), ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxemVnYnZ0b3lxeGlkeHV1emltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzcwODQsImV4cCI6MjA4NDU1MzA4NH0.3ML4sc6DlmtzOUfXS6zUDRY5klzITgGSriD7f6QOmC8"), {
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
    // Get session - this will also refresh if needed
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
        console.error('Middleware session error:', error.message);
    }
    // If not authenticated and trying to access protected route, redirect to login
    if (!session && !isPublicRoute) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/login';
        redirectUrl.searchParams.set('redirectedFrom', pathname);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(redirectUrl);
    }
    // If authenticated and trying to access login, redirect to dashboard
    if (session && pathname.startsWith('/login')) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/';
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(redirectUrl);
    }
    return response;
}
const config = {
    matcher: [
        /*
     * Match all request paths except:
     * - _next (static files, image optimization)
     * - favicon.ico
     * - api routes
     * Note: We also check for static files in the middleware function itself
     */ '/((?!_next|favicon\\.ico|api).*)'
    ]
};
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__4b0ff6d4._.js.map