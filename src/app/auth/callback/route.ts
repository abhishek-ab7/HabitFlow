import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // Handle OAuth errors from provider
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`);
  }

  if (code) {
    const cookieStore = await cookies();
    
    // Determine the redirect origin
    const forwardedHost = request.headers.get('x-forwarded-host');
    const origin = forwardedHost ? `https://${forwardedHost}` : requestUrl.origin;
    
    // Create a response that we can modify - this is the response we will return
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                // Set cookie on the response object that will be returned
                response.cookies.set(name, value, options);
              });
            } catch (err) {
              console.error('Error setting cookies:', err);
            }
          },
        },
      }
    );

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError && data.session) {
      console.log('Session exchange successful, redirecting to:', `${origin}${next}`);
      // Return the response with cookies already set
      return response;
    }

    console.error('Exchange error:', exchangeError);
    return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`);
  }

  // No code provided
  console.error('No code provided in callback');
  return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`);
}
