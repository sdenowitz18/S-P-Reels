'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { useIsMobile } from '@/lib/use-is-mobile'

export default function WelcomeClient({ name }: { name: string }) {
  const router  = useRouter()
  const isMobile = useIsMobile()
  const [starting, setStarting] = useState(false)

  const startTasteSetup = async () => {
    setStarting(true)
    try {
      const res  = await fetch('/api/onboarding/session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ trigger: 'taste_page', preferred_path: 'cold_start' }),
      })
      const data = await res.json()
      if (data.session_id) {
        // cold_start → single-film rating page
        // resume with no contradictions yet → back to rating
        // resume with contradictions → interview
        // anything else (letterboxd, hybrid) → interview directly
        let dest: string
        if (data.path === 'taste_setup') {
          dest = `/onboarding/rate/${data.session_id}`
        } else if (data.path === 'resume' && data.session_path === 'cold_start') {
          const hasContradictions = Array.isArray(data.contradictions) && data.contradictions.length > 0
          dest = hasContradictions
            ? `/onboarding/interview/${data.session_id}`
            : `/onboarding/rate/${data.session_id}`
        } else {
          dest = `/onboarding/interview/${data.session_id}`
        }
        router.push(dest)
      }
    } catch {
      setStarting(false)
    }
  }

  return (
    <AppShell withAdd={false}>
      <div style={{ padding: isMobile ? '28px 20px 96px' : '56px 64px', maxWidth: 720, margin: '0 auto' }}>

        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 14 }}>
          ★ WELCOME
        </div>

        <h1 className="t-display" style={{ fontSize: isMobile ? 36 : 48, lineHeight: 1.05, marginBottom: 16 }}>
          good to have you,{' '}
          <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>
            {name}
          </span>
          .
        </h1>

        <p style={{
          fontStyle: 'italic', fontSize: isMobile ? 14 : 16, color: 'var(--ink-2)',
          fontFamily: 'var(--serif-italic)', lineHeight: 1.65,
          margin: isMobile ? '0 0 32px' : '0 0 52px', maxWidth: 520,
        }}>
          let's build your taste profile. it'll shape your recommendations, your compatibility with friends, and how we talk about films with you.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 12 : 18, marginBottom: 32 }}>

          {/* Option A — Letterboxd */}
          <button
            onClick={() => router.push('/import')}
            style={{
              textAlign: 'left', cursor: 'pointer',
              padding: isMobile ? '22px 20px 26px' : '28px 26px 32px',
              background: 'var(--bone)',
              border: '0.5px solid var(--paper-edge)',
              borderRadius: 14,
              display: 'flex', flexDirection: 'column', gap: 0,
              transition: 'all 180ms',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'var(--sun-tint)'
              el.style.border = '1px solid var(--sun)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'var(--bone)'
              el.style.border = '0.5px solid var(--paper-edge)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="t-meta" style={{ fontSize: 9, color: 'var(--sun)' }}>
                ★ IMPORT YOUR HISTORY
              </div>
              <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-4)' }}>
                ~5–10 min
              </div>
            </div>
            <div className="t-display" style={{ fontSize: 22, lineHeight: 1.15, marginBottom: 14 }}>
              import from{' '}
              <span style={{ fontStyle: 'italic', fontWeight: 300 }}>letterboxd</span>
            </div>
            <p style={{
              margin: '0 0 22px', fontSize: 13, color: 'var(--ink-2)',
              fontStyle: 'italic', fontFamily: 'var(--serif-italic)', lineHeight: 1.6, flex: 1,
            }}>
              bring your watching history. we'll build your taste profile from your actual ratings — the most accurate way to start.
            </p>
            <div style={{ fontFamily: 'var(--serif-display)', fontSize: 13, fontWeight: 500 }}>
              upload my export →
            </div>
          </button>

          {/* Option B — Taste Setup */}
          <button
            onClick={startTasteSetup}
            disabled={starting}
            style={{
              textAlign: 'left', cursor: starting ? 'wait' : 'pointer',
              padding: isMobile ? '22px 20px 26px' : '28px 26px 32px',
              background: 'var(--bone)',
              border: '0.5px solid var(--paper-edge)',
              borderRadius: 14,
              display: 'flex', flexDirection: 'column', gap: 0,
              transition: 'all 180ms',
              opacity: starting ? 0.6 : 1,
            }}
            onMouseEnter={e => {
              if (starting) return
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'var(--s-tint)'
              el.style.border = '1px solid var(--s-ink)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'var(--bone)'
              el.style.border = '0.5px solid var(--paper-edge)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="t-meta" style={{ fontSize: 9, color: 'var(--s-ink)' }}>
                ★ START FRESH
              </div>
              <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-4)' }}>
                ~5–10 min
              </div>
            </div>
            <div className="t-display" style={{ fontSize: 22, lineHeight: 1.15, marginBottom: 14 }}>
              taste{' '}
              <span style={{ fontStyle: 'italic', fontWeight: 300 }}>setup</span>
            </div>
            <p style={{
              margin: '0 0 22px', fontSize: 13, color: 'var(--ink-2)',
              fontStyle: 'italic', fontFamily: 'var(--serif-italic)', lineHeight: 1.6, flex: 1,
            }}>
              no letterboxd? we'll walk you through a short interview using films you know to understand what you're drawn to.
            </p>
            <div style={{ fontFamily: 'var(--serif-display)', fontSize: 13, fontWeight: 500 }}>
              {starting ? 'starting…' : 'start the interview →'}
            </div>
          </button>

        </div>

        <p style={{ fontSize: 12, color: 'var(--ink-4)', fontStyle: 'italic', fontFamily: 'var(--serif-italic)' }}>
          you can always import from letterboxd later if you want to switch.
        </p>

      </div>
    </AppShell>
  )
}
