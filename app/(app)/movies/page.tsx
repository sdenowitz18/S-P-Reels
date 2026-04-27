'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { FilmDetailPanel } from '@/components/film-detail-panel'
import { LibraryEntry, ReflectionResult, posterUrl } from '@/lib/types'
import Image from 'next/image'

interface EntryDetail {
  entry: LibraryEntry
  reflection: ReflectionResult | null
}

function FilmCard({ entry, onClick }: { entry: LibraryEntry; onClick: () => void }) {
  const film = entry.film
  const poster = film ? posterUrl(film.poster_path, 'w342') : null

  return (
    <button onClick={onClick} style={{
      textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none', padding: 0,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{
        width: '100%', aspectRatio: '2/3', borderRadius: 6, overflow: 'hidden',
        background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
        position: 'relative', transition: 'opacity 120ms',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        {poster
          ? <Image src={poster} alt={film?.title ?? ''} fill style={{ objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--ink-4)', fontFamily: 'var(--mono)', textAlign: 'center', padding: 8 }}>{film?.title?.toUpperCase()}</div>
        }
        {entry.my_stars && (
          <div style={{ position: 'absolute', bottom: 6, left: 7, background: 'rgba(24,22,18,0.75)', borderRadius: 4, padding: '2px 6px', fontFamily: 'var(--mono)', fontSize: 9, color: '#f5e6c8', letterSpacing: '0.05em' }}>
            {entry.my_stars}★
          </div>
        )}
      </div>
      <div>
        <div style={{ fontFamily: 'var(--serif-display)', fontSize: 13, fontWeight: 500, lineHeight: 1.2 }}>{film?.title}</div>
        <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginTop: 2 }}>{film?.year}</div>
      </div>
    </button>
  )
}

export default function MoviesPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<EntryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    fetch('/api/library')
      .then(r => r.json())
      .then(d => { setEntries(d.watched ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const openDetail = async (entry: LibraryEntry) => {
    setDetailLoading(true)
    setDetail({ entry, reflection: null })
    try {
      const res = await fetch(`/api/library/${entry.id}/reflection`)
      if (res.ok) {
        const data = await res.json()
        setDetail({ entry, reflection: data.reflection ?? null })
      }
    } catch {}
    setDetailLoading(false)
  }

  return (
    <AppShell active="movies">
      {detail && (
        <FilmDetailPanel
          entry={detail.entry}
          list="watched"
          reflection={detail.reflection}
          onClose={() => setDetail(null)}
          onRemove={() => setEntries(prev => prev.filter(e => e.id !== detail.entry.id))}
        />
      )}

      <div style={{ padding: '56px 64px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 40 }}>
          <div>
            <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ THE REEL</div>
            <h1 className="t-display" style={{ fontSize: 52, lineHeight: 1, margin: 0 }}>
              everything you've <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>watched</span>.
              {entries.length > 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 400, color: 'var(--ink-3)', marginLeft: 16 }}>{entries.length}</span>}
            </h1>
          </div>
          <button className="btn" onClick={() => router.push('/add')} style={{ padding: '11px 20px', fontSize: 13, borderRadius: 999 }}>
            + log a film
          </button>
        </div>

        {loading && (
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>loading…</p>
        )}

        {!loading && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div className="stamp" style={{ display: 'inline-block', marginBottom: 24 }}>empty</div>
            <p className="t-display" style={{ fontSize: 28, margin: '0 0 12px' }}>nothing logged yet.</p>
            <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', marginBottom: 32 }}>
              your first watch is one search away.
            </p>
            <button className="btn" onClick={() => router.push('/add')} style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999 }}>
              log something →
            </button>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '32px 18px' }}>
            {entries.map(entry => (
              <FilmCard key={entry.id} entry={entry} onClick={() => openDetail(entry)} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
