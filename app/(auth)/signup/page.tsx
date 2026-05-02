'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)' }}>★ {label.toUpperCase()}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '12px 14px',
          background: 'var(--paper)',
          border: '0.5px solid var(--paper-edge)',
          borderRadius: 8,
          fontFamily: 'var(--serif-body)', fontSize: 15, color: 'var(--ink)',
          outline: 'none', width: '100%',
        }}
      />
    </label>
  )
}

export default function SignUpPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setErr('what should we call you?')
    if (!email.trim() || !email.includes('@')) return setErr('we need an email that looks like one.')
    if (pw.length < 6) return setErr('pick a password (6+ characters).')
    setLoading(true)
    setErr('')

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pw,
      options: { data: { name: name.trim() } },
    })

    if (error) {
      setErr(error.message)
      setLoading(false)
      return
    }

    // create user profile row
    await fetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })

    // Email confirmation is disabled — go straight to onboarding
    router.push('/onboarding')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <header style={{ padding: '24px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 600, lineHeight: 1,
          display: 'inline-flex', alignItems: 'baseline', color: 'var(--ink)', textDecoration: 'none',
        }}>
          S<span style={{ color: 'var(--sun)', fontStyle: 'italic', padding: '0 1px' }}>&amp;</span>P
          <span style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-3)', marginLeft: 5, fontSize: 17 }}>reels</span>
        </Link>
        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <Link href="/signin" style={{ fontFamily: 'var(--serif-body)', fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none', padding: '8px 14px' }}>log in</Link>
        </div>
      </header>

      <main style={{ padding: '64px 64px 96px', maxWidth: 560, margin: '0 auto' }}>
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>★ MAKE AN ACCOUNT</div>
        <h1 className="t-display" style={{ fontSize: 60, lineHeight: 1, marginTop: 14 }}>
          tell us your <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>name</span>.
        </h1>
        <p style={{ fontStyle: 'italic', fontSize: 16, color: 'var(--ink-2)', marginTop: 16, lineHeight: 1.55, fontFamily: 'var(--serif-italic)' }}>
          this is the only sign-up. the rest of the room is built out of your watching.
        </p>

        <form onSubmit={submit} style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="your name" value={name} onChange={setName} placeholder="e.g. Steven" />
          <Field label="email"     value={email} onChange={setEmail} placeholder="you@somewhere" type="email" />
          <Field label="password"  value={pw}    onChange={setPw} type="password" placeholder="at least 6 characters" />
          {err && <div style={{ fontSize: 13, color: 'var(--p-ink)', fontStyle: 'italic', fontFamily: 'var(--serif-italic)' }}>{err}</div>}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
            <button type="submit" disabled={loading} className="btn" style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999 }}>
              {loading ? 'making your account…' : 'make my account  →'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', fontFamily: 'var(--serif-italic)' }}>
              already in? <Link href="/signin" style={{ color: 'var(--ink-2)' }}>log in</Link>
            </span>
          </div>
        </form>
      </main>
    </div>
  )
}
