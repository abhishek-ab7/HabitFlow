import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { isSupabaseConfigured } from '@/lib/supabase/mock-client';

const STATIC_EXACT_PATHS = new Set(['/manifest.json', '/sw.js', '/robots.txt', '/llms.txt', '/sitemap.xml']);
const STATIC_PREFIXES = ['/icons/', '/.well-known/'];
const STATIC_EXTENSIONS = /\.(?:ico|png|svg|jpg|jpeg|webp)$/i;
const PUBLIC_ROUTES = ['/auth/callback', '/auth/auth-code-error', '/auth/reset-password', '/auth/signout', '/.well-known'];

function isStaticAssetRequest(pathname: string): boolean {
  if (STATIC_EXACT_PATHS.has(pathname)) return true;
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return STATIC_EXTENSIONS.test(pathname);
}

async function checkAuthRateLimit(request: NextRequest, pathname: string) {
  const limit = pathname === '/login' ? 20 : 10;
  const shouldLimit =
    pathname === '/login' ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/auth/signout');
  if (!shouldLimit) return null;

  const result = await rateLimit(request, { limit, windowMs: 60 * 1000 });
  return result.success ? null : rateLimitResponse(result.retryAfter);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isStaticAssetRequest(pathname)) return NextResponse.next();

  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const isSkipPublicRoute = PUBLIC_ROUTES.some((route) => cleanPath.startsWith(route));
  const isPublicRoute = isSkipPublicRoute || cleanPath === '/';

  const rateLimited = await checkAuthRateLimit(request, pathname);
  if (rateLimited) return rateLimited;

  if (isSkipPublicRoute) return NextResponse.next();

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
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');

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
    '/((?!_next|favicon\\.ico|robots\\.txt|llms\\.txt|sitemap\\.xml|api|\\.well-known).*)',
  ],
};
