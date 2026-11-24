import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { isSupabaseConfigured } from '@/lib/supabase/mock-client';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files - this is a safety check
  if (
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/.well-known/') ||
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
  const publicRoutes = ['/auth/callback', '/auth/auth-code-error', '/auth/reset-password', '/auth/signout', '/.well-known'];
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

  if (isSupabaseConfigured()) {
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
      const targetQuery = request.nextUrl.search || '';
      redirectUrl.searchParams.set('redirectedFrom', pathname + targetQuery);
      return NextResponse.redirect(redirectUrl);
    }

    // If authenticated and trying to access login or root page, redirect to dashboard or redirectedFrom
    if (session && (pathname === '/' || pathname.startsWith('/login'))) {
      const redirectedFrom = request.nextUrl.searchParams.get('redirectedFrom');
      if (redirectedFrom && redirectedFrom.startsWith('/') && !redirectedFrom.startsWith('//')) {
        return NextResponse.redirect(new URL(redirectedFrom, request.url));
      }
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/dashboard';
      redirectUrl.search = '';
      return NextResponse.redirect(redirectUrl);
    }
  } else {
    // Local demo fallback mode when Supabase env vars are not configured
    const isSignedOut = request.cookies.get('habitflow_local_signed_out')?.value === 'true';

    if (isSignedOut && !isPublicRoute && pathname !== '/login') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      const targetQuery = request.nextUrl.search || '';
      redirectUrl.searchParams.set('redirectedFrom', pathname + targetQuery);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Add Security Headers to final response (iframe-compatible for AI Studio preview)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next (static files, image optimization)
     * - favicon.ico
     * - api routes
     * - .well-known routes (MCP RFC 9728 and RFC 8414 OAuth discovery)
     * Note: We also check for static files in the middleware function itself
     */
    '/((?!_next|favicon\\.ico|api|\\.well-known).*)',
  ],
};
