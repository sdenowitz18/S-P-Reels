'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !pw.trim()) return setErr('fill both fields.')
    setLoading(true)
    setErr('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pw,
    })

    if (error) {
      setErr('no match — check your email and password.')
      setLoading(false)
      return
    }

    router.push('/onboarding')
  }

  return (
    <main style={{ padding: '64px 64px 96px', maxWidth: 540, margin: '0 auto' }}>
      <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>★ COME BACK IN</div>
      <h1 className="t-display" style={{ fontSize: 60, lineHeight: 1, marginTop: 14 }}>
        log <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>back in</span>.
      </h1>

      {errorParam === 'invite_failed' && (
        <div style={{ marginTop: 20, padding: '14px 18px', background: 'var(--p-tint)', border: '0.5px solid var(--p-ink)40', borderRadius: 10 }}>
          <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic', color: 'var(--p-ink)', fontFamily: 'var(--serif-italic)', lineHeight: 1.5 }}>
            that invite link has expired or already been used. ask your friend to send a new one, or{' '}
            <Link href="/signup" style={{ color: 'var(--p-ink)', fontWeight: 500 }}>create an account</Link> directly.
          </p>
        </div>
      )}

      <form onSubmit={submit} style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="email"    value={email} onChange={setEmail} placeholder="you@somewhere" type="email" />
        <Field label="password" value={pw}    onChange={setPw} type="password" />
        {err && <div style={{ fontSize: 13, color: 'var(--p-ink)', fontStyle: 'italic', fontFamily: 'var(--serif-italic)' }}>{err}</div>}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
          <button type="submit" disabled={loading} className="btn" style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999 }}>
            {loading ? 'logging in…' : 'log in  →'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', fontFamily: 'var(--serif-italic)' }}>
            new here? <Link href="/signup" style={{ color: 'var(--ink-2)' }}>sign up</Link>
          </span>
        </div>
      </form>
    </main>
  )
}

export default function SignInPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <header style={{ padding: '24px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{
          fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 600, lineHeight: 1,
          display: 'inline-flex', alignItems: 'baseline', color: 'var(--ink)', textDecoration: 'none',
        }}>
          S<span style={{ color: 'var(--sun)', fontStyle: 'italic', padding: '0 1px' }}>&amp;</span>P
          <span style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-3)', marginLeft: 5, fontSize: 17 }}>reels</span>
        </Link>
        <Link href="/signup" className="btn" style={{ padding: '8px 16px', fontSize: 13, borderRadius: 999, textDecoration: 'none' }}>
          sign up
        </Link>
      </header>
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  )
}
