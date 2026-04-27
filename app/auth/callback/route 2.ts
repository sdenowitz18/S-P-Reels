import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/home'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Check if this is a new user with no name set yet
      const hasName = !!data.user.user_metadata?.name
      if (!hasName) {
        // New invited user — send to welcome page to set their name
        return NextResponse.redirect(`${origin}/welcome?email=${encodeURIComponent(data.user.email ?? '')}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/signin?error=invite_failed`)
}
