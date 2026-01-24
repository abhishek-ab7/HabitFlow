import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  console.log('Callback received:', { code: !!code, error, next });

  // Handle OAuth errors from provider
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?error=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    console.error('No code provided in callback');
    return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?error=No+code+provided`);
  }

  try {
    // Determine the redirect origin
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const origin = forwardedHost 
      ? `${forwardedProto || 'https'}://${forwardedHost}` 
      : requestUrl.origin;
    
    // Create response first
    const response = NextResponse.redirect(`${origin}${next}`);
    
    // Create Supabase client with cookie handling
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
              // Set cookies on the response with proper options
              response.cookies.set({
                name,
                value,
                ...options,
                sameSite: 'lax',
                secure: true,
                httpOnly: true,
                path: '/',
              });
            });
          },
        },
      }
    );

    // Exchange code for session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Exchange error:', exchangeError.message);
      return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?error=${encodeURIComponent(exchangeError.message)}`);
    }

    if (!data.session) {
      console.error('No session after exchange');
      return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?error=No+session+after+exchange`);
    }

    console.log('Session exchange successful, user:', data.session.user.email);
    
    // Return the response with cookies set
    return response;
  } catch (err) {
    console.error('Callback error:', err);
    return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?error=Callback+error`);
  }
}
