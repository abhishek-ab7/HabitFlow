import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { validateRedirectUrl, getValidatedNextPath } from '@/lib/security/url-validator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = getValidatedNextPath(requestUrl.searchParams, '/');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const type = requestUrl.searchParams.get('type'); // 'recovery' for password reset

  console.log('Callback received:', { code: !!code, error, next, type });

  // Handle OAuth errors from provider
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?error=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    console.error('No code provided in callback');
    return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?error=No+code+provided`);
  }

  // Debug: Log all cookies to verify presence of code verifier
  const allCookies = request.cookies.getAll();
  console.log('Cookies in callback:', allCookies.map(c => c.name));
  const verifierCookies = allCookies.filter(c => c.name.endsWith('-code-verifier'));
  if (verifierCookies.length === 0) {
    console.error('No code verifier cookie found!');
  } else {
    console.log('Found verifier cookies:', verifierCookies.map(c => c.name));
  }

  try {
    // Determine the redirect origin
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const origin = forwardedHost
      ? `${forwardedProto || 'https'}://${forwardedHost}`
      : requestUrl.origin;

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
            // We'll set cookies on the response later
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

    // Check if this is a password recovery session
    // Supabase sets user.aud to 'authenticated' for recovery sessions
    // We can detect recovery by checking if the user just verified their email for password reset
    const isRecovery = data.session.user.recovery_sent_at !== undefined;

    // Determine redirect path: recovery sessions go to reset page, others use 'next' param
    const redirectPath = isRecovery ? '/auth/reset-password' : next;

    console.log('Redirect decision:', { isRecovery, redirectPath, recovery_sent_at: data.session.user.recovery_sent_at });

    // Create response with proper redirect (validated to prevent open redirects)
    const validatedRedirectUrl = validateRedirectUrl(origin, redirectPath, '/');
    const response = NextResponse.redirect(validatedRedirectUrl);

    // Now set the session cookies on the response
    const cookiesToSet: Array<{ name: string; value: string; options: any }> = [];

    const supabaseWithCookies = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookies) {
            cookies.forEach(({ name, value, options }) => {
              cookiesToSet.push({ name, value, options });
            });
          },
        },
      }
    );

    // Trigger cookie setting by getting session again
    await supabaseWithCookies.auth.getSession();

    // Apply all cookies to response
    cookiesToSet.forEach(({ name, value, options }) => {
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

    // Return the response with cookies set
    return response;
  } catch (err) {
    console.error('Callback error:', err);
    return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?error=Callback+error`);
  }
}
