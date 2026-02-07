import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { validateRedirectUrl } from '@/lib/security/url-validator'

export async function POST(request: NextRequest) {
    const requestUrl = new URL(request.url)
    // Determine origin for redirect
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const origin = forwardedHost
        ? `${forwardedProto || 'https'}://${forwardedHost}`
        : requestUrl.origin;

    // Validate redirect URL to prevent open redirects
    const validatedRedirectUrl = validateRedirectUrl(origin, '/login', '/login');
    const response = NextResponse.redirect(validatedRedirectUrl, {
        status: 302,
    })

    // Create Supabase client to handle cookie clearing
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
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
                    })
                },
            },
        }
    )

    // Sign out from Supabase (this triggers the setAll above to clear cookies)
    await supabase.auth.signOut()

    return response
}
