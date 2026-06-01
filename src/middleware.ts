import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files - this is a safety check
  if (
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/icons/') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.webp')
  ) {
    return NextResponse.next();
  }

  // Public routes that don't require authentication.
  // We exclude '/login' from isPublicRoute so middleware can check the session and redirect logged-in users.
  const publicRoutes = ['/auth/callback', '/auth/auth-code-error', '/auth/reset-password', '/auth/signout'];
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  
  // We skip middleware logic for static routes / authentication callback endpoints early,
  // but allow the root page '/' to proceed down so that session cookies can be validated/refreshed
  // on public homepage hits before server components render.
  const isSkipPublicRoute = publicRoutes.some(route => cleanPath.startsWith(route));
  const isPublicRoute = isSkipPublicRoute || cleanPath === '/';

  // Apply rate limiting to sensitive public routes
  if (pathname.startsWith('/auth/callback')) {
    const result = await rateLimit(request, { limit: 10, windowMs: 60 * 1000 }); // 10 req/min
    if (!result.success) {
      return rateLimitResponse(result.retryAfter);
    }
  }

  if (pathname === '/login') {
    const result = await rateLimit(request, { limit: 20, windowMs: 60 * 1000 }); // 20 req/min
    if (!result.success) {
      return rateLimitResponse(result.retryAfter);
    }
  }

  if (pathname.startsWith('/auth/signout')) {
    const result = await rateLimit(request, { limit: 10, windowMs: 60 * 1000 }); // 10 req/min
    if (!result.success) {
      return rateLimitResponse(result.retryAfter);
    }
  }

  if (isSkipPublicRoute) {
    return NextResponse.next();
  }

  // Create a response object
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client with proper cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({
              name,
              value,
              ...options,
            });
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...options,
              sameSite: 'lax',
              secure: true,
              path: '/',
            });
          });
        },
      },
    }
  );

  // Get session - this will also refresh if needed
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Middleware session error:', error.message);
  }

  // If not authenticated and trying to access protected route, redirect to login
  if (!session && !isPublicRoute && pathname !== '/login') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If authenticated and trying to access login or root page, redirect to dashboard
  if (session && (pathname === '/' || pathname.startsWith('/login'))) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  // Add Security Headers to final response
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content Security Policy (CSP)
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

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next (static files, image optimization)
     * - favicon.ico
     * - api routes
     * Note: We also check for static files in the middleware function itself
     */
    '/((?!_next|favicon\\.ico|api).*)',
  ],
};
