'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function WelcomeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setErr('what should we call you?')
    if (pw.length < 6) return setErr('pick a password (6+ characters).')
    setLoading(true)
    setErr('')

    // Use the server-side admin route so Supabase doesn't send a confirmation email
    const res = await fetch('/api/auth/complete-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), password: pw }),
    })
    const data = await res.json()

    if (!res.ok) {
      setErr(data.error ?? 'something went wrong')
      setLoading(false)
      return
    }

    router.push('/onboarding')
  }

  return (
    <main style={{ padding: '64px 64px 96px', maxWidth: 560, margin: '0 auto' }}>
      <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>★ YOU'VE BEEN INVITED</div>
      <h1 className="t-display" style={{ fontSize: 56, lineHeight: 1, marginTop: 14 }}>
        what should we <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>call you</span>?
      </h1>
      <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)', marginTop: 16, lineHeight: 1.55, fontFamily: 'var(--serif-italic)', maxWidth: 420 }}>
        you're joining as <strong style={{ fontStyle: 'normal' }}>{email}</strong>. set your name and a password to finish.
      </p>

      <form onSubmit={submit} style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)' }}>★ YOUR NAME</span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Alex"
            autoFocus
            style={{ padding: '12px 14px', background: 'var(--paper)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, fontFamily: 'var(--serif-body)', fontSize: 15, color: 'var(--ink)', outline: 'none', width: '100%' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)' }}>★ PASSWORD</span>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="at least 6 characters"
            style={{ padding: '12px 14px', background: 'var(--paper)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, fontFamily: 'var(--serif-body)', fontSize: 15, color: 'var(--ink)', outline: 'none', width: '100%' }}
          />
        </label>
        {err && <p style={{ margin: 0, fontSize: 13, color: 'var(--p-ink)', fontStyle: 'italic', fontFamily: 'var(--serif-italic)' }}>{err}</p>}
        <div style={{ marginTop: 10 }}>
          <button type="submit" disabled={loading} className="btn" style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999 }}>
            {loading ? 'setting up…' : 'finish & enter →'}
          </button>
        </div>
      </form>
    </main>
  )
}

export default function WelcomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <header style={{ padding: '24px 36px' }}>
        <Link href="/" style={{ fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 600, display: 'inline-flex', alignItems: 'baseline', color: 'var(--ink)', textDecoration: 'none' }}>
          S<span style={{ color: 'var(--sun)', fontStyle: 'italic', padding: '0 1px' }}>&amp;</span>P
          <span style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-3)', marginLeft: 5, fontSize: 17 }}>reels</span>
        </Link>
      </header>
      <Suspense>
        <WelcomeForm />
      </Suspense>
    </div>
  )
}
