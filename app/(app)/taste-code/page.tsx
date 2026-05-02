'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'

/**
 * /taste-code
 *
 * Permanent entry point to the taste reveal. Finds the user's most recent
 * completed session and redirects to its reveal page.
 * Falls back to /profile if no completed session exists yet.
 */
export default function TasteCodePage() {
  const router = useRouter()

  useEffect(() => {
    fetch('/api/onboarding/session/latest')
      .then(r => r.json())
      .then(data => {
        if (data.session_id) {
          router.replace(`/onboarding/reveal/${data.session_id}`)
        } else {
          // No completed session — go to profile where they can start setup
          router.replace('/profile')
        }
      })
      .catch(() => router.replace('/profile'))
  }, [router])

  return (
    <AppShell withAdd={false}>
      <div style={{ padding: '56px 64px' }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 11,
          color: 'var(--ink-4)', letterSpacing: '0.06em',
        }}>
          LOADING YOUR TASTE CODE…
        </div>
      </div>
    </AppShell>
  )
}
