import { NextResponse } from 'next/server'
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/teacher'

  if (code) {
    console.log('[Auth Callback] Received code from Google OAuth, attempting to exchange for session...');
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      console.log('[Auth Callback] Successfully exchanged code for session! Redirecting to:', `${origin}${next}`);

      if (data?.session?.provider_token) {
        const cookieStore = await cookies();
        cookieStore.set('provider_token', data.session.provider_token, {
          path: '/',
          httpOnly: false, // Accessible to frontend to check connection status
          secure: process.env.NODE_ENV === 'production',
          maxAge: 3500 // 1 hour minus a small buffer
        });
      }

      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error('[Auth Callback] Error exchanging code for session:', error.message, error);
    }
  } else {
    // If there's an error param in the URL directly from the OAuth provider (e.g. user denied access, or missing redirect URL)
    const errDesc = searchParams.get('error_description');
    if (errDesc) {
      console.error('[Auth Callback] OAuth Provider returned an error:', errDesc);
    } else {
      console.error('[Auth Callback] No code provided in the callback URL.');
    }
  }

  // return the user to an error page with instructions (appending the message if available to the URL)
  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`)
}
