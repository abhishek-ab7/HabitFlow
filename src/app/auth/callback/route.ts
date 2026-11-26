import { NextResponse, type NextRequest } from 'next/server';
import { validateRedirectUrl, getValidatedNextPath } from '@/lib/security/url-validator';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function buildAuthErrorRedirect(origin: string, message: string) {
  return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(message)}`);
}

function resolveRequestOrigin(request: NextRequest, requestUrl: URL): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (!forwardedHost) return requestUrl.origin;
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  return `${forwardedProto}://${forwardedHost}`;
}

async function exchangeSessionAndRedirect(params: {
  request: NextRequest;
  requestUrl: URL;
  code: string;
  next: string;
  type: string | null;
}) {
  const { request, requestUrl, code, next, type } = params;
  const origin = resolveRequestOrigin(request, requestUrl);
  const supabase = await createServerSupabaseClient();
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('Exchange error:', exchangeError.message);
    return buildAuthErrorRedirect(requestUrl.origin, exchangeError.message);
  }

  if (!data.session) {
    console.error('No session after exchange');
    return buildAuthErrorRedirect(requestUrl.origin, 'No session after exchange');
  }

  console.log('Session exchange successful, user:', data.session.user.email);

  // Only use the explicit `?type=recovery` query param sent by Supabase.
  // Do NOT use `recovery_sent_at !== undefined` — it persists after past resets.
  const redirectPath = type === 'recovery' ? '/auth/reset-password' : next;
  const validatedRedirectUrl = validateRedirectUrl(origin, redirectPath, '/dashboard');
  return NextResponse.redirect(validatedRedirectUrl);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = getValidatedNextPath(requestUrl.searchParams, '/dashboard');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const type = requestUrl.searchParams.get('type');

  console.log('Callback received:', { code: !!code, error, next, type });

  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return buildAuthErrorRedirect(requestUrl.origin, errorDescription || error);
  }

  if (!code) {
    console.error('No code provided in callback');
    return buildAuthErrorRedirect(requestUrl.origin, 'No code provided');
  }

  try {
    return await exchangeSessionAndRedirect({ request, requestUrl, code, next, type });
  } catch (err) {
    console.error('Callback error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown callback error';
    return buildAuthErrorRedirect(requestUrl.origin, errorMessage);
  }
}
