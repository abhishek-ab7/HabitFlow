import { NextResponse, type NextRequest } from 'next/server';
import { validateRedirectUrl, getValidatedNextPath } from '@/lib/security/url-validator';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = getValidatedNextPath(requestUrl.searchParams, '/');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const type = requestUrl.searchParams.get('type');

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

  try {
    // Determine the redirect origin
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const origin = forwardedHost
      ? `${forwardedProto || 'https'}://${forwardedHost}`
      : requestUrl.origin;

    // Use the central server client which correctly handles cookies via next/headers
    const supabase = await createServerSupabaseClient();
    
    // Exchange code for session - this automatically sets cookies via the client config
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

    // Check if this is a password recovery session.
    // IMPORTANT: Only use the explicit `?type=recovery` query param sent by Supabase.
    // Do NOT use `recovery_sent_at !== undefined` — that field persists on the user record
    // permanently after any past reset request and causes false-positive redirects.
    const isRecovery = type === 'recovery';
    const redirectPath = isRecovery ? '/auth/reset-password' : next;

    // Create response with proper redirect (validated to prevent open redirects)
    const validatedRedirectUrl = validateRedirectUrl(origin, redirectPath, '/');
    return NextResponse.redirect(validatedRedirectUrl);

  } catch (err) {
    console.error('Callback error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown callback error';
    return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?error=${encodeURIComponent(errorMessage)}`);
  }
}
