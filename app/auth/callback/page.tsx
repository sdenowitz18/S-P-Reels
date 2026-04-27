'use client'
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function CallbackHandler() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/home'

  useEffect(() => {
    const supabase = createClient()

    const handle = async () => {
      // Parse tokens from URL hash
      const hash = window.location.hash.slice(1)
      const params = new URLSearchParams(hash)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
        if (!error && data.user) {
          const hasName = !!data.user.user_metadata?.name
          window.location.href = hasName ? next : `/welcome?email=${encodeURIComponent(data.user.email ?? '')}`
          return
        }
      }

      // Fallback: check if already signed in
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const hasName = !!session.user.user_metadata?.name
        window.location.href = hasName ? next : `/welcome?email=${encodeURIComponent(session.user.email ?? '')}`
        return
      }

      window.location.href = '/signin?error=invite_failed'
    }

    handle()
  }, [next])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontStyle: 'italic', fontFamily: 'var(--serif-italic)', fontSize: 16, color: 'var(--ink-3)' }}>
        signing you in…
      </p>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  )
}
