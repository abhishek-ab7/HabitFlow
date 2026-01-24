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
    
    // Create a response that we can modify
    const response = NextResponse.redirect(`${requestUrl.origin}${next}`);

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
                cookieStore.set(name, value, options);
                // Also set on response for immediate availability
                response.cookies.set(name, value, options);
              });
            } catch (error) {
              // Handle Server Component context
              console.error('Error setting cookies:', error);
            }
          },
        },
      }
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      // Successful authentication - use the origin from the request
      const forwardedHost = request.headers.get('x-forwarded-host');
      const origin = forwardedHost ? `https://${forwardedHost}` : requestUrl.origin;
      
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('Exchange error:', exchangeError);
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`);
}
