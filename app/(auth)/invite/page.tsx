'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Landing page for invite email links.
// Supabase redirects here with the auth token in the URL hash fragment
// (#access_token=...&type=invite). The Supabase browser client reads the
// hash automatically when getSession() is called, establishes the session,
// then we route the user appropriately.
export default function InvitePage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // getSession() triggers the Supabase client to parse the hash fragment
    // and exchange it for a valid session automatically.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const hasName = !!session.user.user_metadata?.name
        if (!hasName) {
          router.replace(`/welcome?email=${encodeURIComponent(session.user.email ?? '')}`)
        } else {
          // Already has a profile — they've been here before
          router.replace('/home')
        }
      } else {
        // Token expired or already used
        router.replace('/signin?error=invite_failed')
      }
    })
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
        setting things up…
      </p>
    </div>
  )
}
