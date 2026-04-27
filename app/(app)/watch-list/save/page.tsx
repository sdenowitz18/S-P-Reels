'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { TMDBSearchResult, posterUrl } from '@/lib/types'
import { RecommendToFriends } from '@/components/recommend-to-friends'
import Image from 'next/image'

export default function WatchListSavePage() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<TMDBSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<TMDBSearchResult | null>(null)
  const [why, setWhy] = useState('')
  const [saving, setSaving] = useState(false)
  const [showRecommend, setShowRecommend] = useState(false)
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

  const save = async () => {
    if (!selected || saving) return
    setSaving(true)
    await fetch('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filmId: selected.id,
        list: 'watchlist',
        audience: ['me'],
        why: why.trim() || null,
      }),
    })
    setSaving(false)
    setShowRecommend(true)
  }

  if (selected) {
    const poster = posterUrl(selected.poster_path, 'w342')

    if (showRecommend) {
      return (
        <AppShell active="watch">
          <div style={{ padding: '48px 64px', maxWidth: 680, margin: '0 auto' }}>
            <div className="stamp" style={{ display: 'inline-block', marginBottom: 28 }}>saved</div>
            <h1 className="t-display" style={{ fontSize: 38, lineHeight: 1, marginBottom: 6 }}>
              <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--forest)' }}>{selected.title}</span> is on your list.
            </h1>
            <RecommendToFriends
              filmId={selected.id}
              filmTitle={selected.title}
              onDone={() => router.push('/watch-list')}
              onSkip={() => router.push('/watch-list')}
            />
          </div>
        </AppShell>
      )
    }

    return (
      <AppShell active="watch">
        <div style={{ padding: '14px 36px 0', maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>← back to search</button>
        </div>
        <div style={{ padding: '48px 64px', maxWidth: 680, margin: '0 auto' }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>○ SAVE TO WATCH LIST</div>
          <div style={{ marginTop: 28, display: 'flex', gap: 20, alignItems: 'center' }}>
            {poster && (
              <div style={{ width: 72, height: 108, borderRadius: 4, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                <Image src={poster} alt={selected.title} fill style={{ objectFit: 'cover' }} />
              </div>
            )}
            <div>
              <h1 className="t-display" style={{ fontSize: 38, lineHeight: 1, margin: 0 }}>{selected.title}</h1>
              <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', marginTop: 6, fontFamily: 'var(--serif-italic)' }}>
                {selected.director ? `${selected.director} · ` : ''}{selected.year ?? ''}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 28 }}>
            <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>WHY DO YOU WANT TO WATCH IT? (OPTIONAL)</div>
            <input
              value={why}
              onChange={e => setWhy(e.target.value)}
              placeholder="remind future-you why you saved this…"
              style={{ width: '100%', padding: '14px 16px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink)', outline: 'none' }}
            />
          </div>
          <div style={{ marginTop: 28, display: 'flex', gap: 12 }}>
            <button className="btn" onClick={save} disabled={saving} style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999, opacity: saving ? 0.5 : 1 }}>
              {saving ? 'saving…' : 'save to watch list →'}
            </button>
            <button className="btn btn-soft" onClick={() => router.push('/watch-list')} style={{ padding: '10px 18px', fontSize: 13, borderRadius: 999 }}>cancel</button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell active="watch">
      <div style={{ padding: '14px 36px 0', maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => router.push('/watch-list')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>← back to list</button>
      </div>
      <div style={{ padding: '40px 64px', maxWidth: 880, margin: '0 auto' }}>
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>○ SAVE TO WATCH LIST</div>
        <h1 className="t-display" style={{ fontSize: 48, lineHeight: 1, marginTop: 18 }}>
          what do you want to <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--forest)' }}>see</span>?
        </h1>
        <div style={{ marginTop: 32 }}>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="search a title…"
            style={{ width: '100%', padding: '20px 22px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 10, fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 500, color: 'var(--ink)', outline: 'none' }}
          />
        </div>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {loading && (
            <div style={{ padding: '14px 16px', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>searching…</div>
          )}
          {!loading && results.map(f => {
            const poster = posterUrl(f.poster_path, 'w342')
            return (
              <button key={f.id} onClick={() => setSelected(f)} style={{
                textAlign: 'left', cursor: 'pointer', padding: '12px 16px',
                background: 'transparent', border: '0.5px solid transparent', borderRadius: 8,
                display: 'flex', alignItems: 'center', gap: 16, transition: 'background 120ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 36, height: 54, borderRadius: 2, overflow: 'hidden', flexShrink: 0, background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', position: 'relative' }}>
                  {poster ? <Image src={poster} alt={f.title} fill style={{ objectFit: 'cover' }} /> : null}
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
            <div style={{ padding: '14px 16px', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>nothing found — try a different spelling.</div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
