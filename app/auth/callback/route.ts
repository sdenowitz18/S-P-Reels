import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/home'

  const supabase = await createClient()

  // PKCE flow — used by magic links, OAuth, and sometimes invite emails
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      const hasName = !!data.user.user_metadata?.name
      if (!hasName) {
        return NextResponse.redirect(`${origin}/welcome?email=${encodeURIComponent(data.user.email ?? '')}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Token-hash flow — used by invite emails and email confirmation links
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'invite' | 'signup' | 'recovery' | 'email_change' | 'email' | 'magiclink',
    })
    if (!error && data.user) {
      const hasName = !!data.user.user_metadata?.name
      if (!hasName) {
        return NextResponse.redirect(`${origin}/welcome?email=${encodeURIComponent(data.user.email ?? '')}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/signin?error=invite_failed`)
}
