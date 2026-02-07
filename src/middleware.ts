import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit } from '@/lib/security/rate-limit';

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

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/auth/callback', '/auth/auth-code-error'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  if (isPublicRoute) {
    // Apply rate limiting to sensitive public routes
    if (pathname.startsWith('/auth/callback')) {
      const result = rateLimit(request, { limit: 10, windowMs: 60 * 1000 }); // 10 req/min
      if (!result.success) {
        return new NextResponse('Too Many Requests', { status: 429 });
      }
    }

    if (pathname === '/login') {
      const result = rateLimit(request, { limit: 10, windowMs: 60 * 1000 }); // 10 req/min
      if (!result.success) {
        return new NextResponse('Too Many Requests', { status: 429 });
      }
    }

    return NextResponse.next();
  }

  // Apply rate limiting to signout (even if it's protected, to prevent DoS)
  if (pathname === '/auth/signout') {
    const result = rateLimit(request, { limit: 10, windowMs: 60 * 1000 }); // 10 req/min
    if (!result.success) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
  }

  // Create a response object
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
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
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  response.headers.set('Content-Security-Policy', cspHeader);

  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );

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
  if (!session && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If authenticated and trying to access login, redirect to dashboard
  if (session && pathname.startsWith('/login')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    return NextResponse.redirect(redirectUrl);
  }

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
