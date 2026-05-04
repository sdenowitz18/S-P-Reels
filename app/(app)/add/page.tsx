'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { TMDBSearchResult, posterUrl } from '@/lib/types'
import Image from 'next/image'

export default function AddSearchPage() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<TMDBSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (!q.trim()) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      setLoading(true)
      const res = await fetch(`/api/films/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data)
      setLoading(false)
    }, 300)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [q])

  const pick = (film: TMDBSearchResult) => {
    sessionStorage.setItem('sp_film', JSON.stringify(film))
    const slug = film.id
    router.push(`/add/${slug}/stage`)
  }

  return (
    <AppShell active="movies">
      <div style={{ padding: '14px 36px 0', maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => router.push('/home')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)',
        }}>cancel · exit to home ×</button>
      </div>

      <div style={{ padding: '40px 64px', maxWidth: 880, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>★ LOG A FILM · STEP 1</div>
          <button
            onClick={() => router.push('/quick-rate')}
            style={{
              background: 'none', border: '0.5px solid var(--paper-edge)', borderRadius: 999,
              padding: '6px 14px', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)',
              letterSpacing: '0.07em', textTransform: 'uppercase',
            }}
          >
            ★ quick rate many films →
          </button>
        </div>
        <h1 className="t-display" style={{ fontSize: 56, lineHeight: 1, marginTop: 18 }}>
          which film are we <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>sitting with</span>?
        </h1>
        <p style={{ fontStyle: 'italic', fontSize: 16, color: 'var(--ink-2)', marginTop: 14, lineHeight: 1.5, fontFamily: 'var(--serif-italic)' }}>
          finished or mid-reel — both routes start the same.
        </p>

        <div style={{ marginTop: 40 }}>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="search a title…"
            style={{
              width: '100%', padding: '20px 22px', background: 'var(--bone)',
              border: '0.5px solid var(--paper-edge)', borderRadius: 10,
              fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 500,
              color: 'var(--ink)', outline: 'none',
            }}
          />
        </div>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {loading && (
            <div style={{ padding: '14px 16px', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
              searching…
            </div>
          )}
          {!loading && results.map(f => {
            const poster = posterUrl(f.poster_path, 'w342')
            return (
              <button key={f.id} onClick={() => pick(f)} style={{
                textAlign: 'left', cursor: 'pointer', padding: '12px 16px',
                background: 'transparent', border: '0.5px solid transparent', borderRadius: 8,
                display: 'flex', alignItems: 'center', gap: 16, transition: 'background 120ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 36, height: 54, borderRadius: 2, overflow: 'hidden', flexShrink: 0, background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)' }}>
                  {poster
                    ? <Image src={poster} alt={f.title} width={36} height={54} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: 'var(--ink-3)', fontFamily: 'var(--mono)', textAlign: 'center' }}>NO IMG</div>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--serif-display)', fontSize: 17, fontWeight: 500 }}>{f.title}</div>
                  <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
                    {f.director ? `${f.director} · ` : ''}{f.year ?? ''}{f.kind === 'tv' ? ' · series' : ''}
                  </div>
                </div>
                <span style={{ color: 'var(--ink-3)' }}>→</span>
              </button>
            )
          })}
          {!loading && q.trim() && results.length === 0 && (
            <div style={{ padding: '14px 16px', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
              nothing found — try a different spelling.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
