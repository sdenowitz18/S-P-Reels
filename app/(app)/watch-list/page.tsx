'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { FilmDetailPanel } from '@/components/film-detail-panel'
import { LibraryEntry, posterUrl } from '@/lib/types'
import Image from 'next/image'

function WatchListCard({ entry, onOpen, onRemove, onStartWatching }: {
  entry: LibraryEntry
  onOpen: () => void
  onRemove: (id: string) => void
  onStartWatching: (entry: LibraryEntry) => void
}) {
  const film = entry.film
  const poster = film ? posterUrl(film.poster_path, 'w342') : null
  const [removing, setRemoving] = useState(false)

  const remove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setRemoving(true)
    await fetch(`/api/library/${entry.id}`, { method: 'DELETE' })
    onRemove(entry.id)
  }

  return (
    <div
      onClick={onOpen}
      style={{ display: 'flex', gap: 18, padding: '18px 22px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 12, alignItems: 'flex-start', cursor: 'pointer', transition: 'background 120ms' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bone)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--paper-2)')}
    >
      <div style={{ width: 52, height: 78, borderRadius: 3, overflow: 'hidden', flexShrink: 0, position: 'relative', background: 'var(--bone)' }}>
        {poster ? <Image src={poster} alt={film?.title ?? ''} fill style={{ objectFit: 'cover' }} /> : null}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--serif-display)', fontSize: 18, fontWeight: 500, lineHeight: 1.15 }}>{film?.title}</div>
        <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', marginTop: 3, fontFamily: 'var(--serif-italic)' }}>
          {film?.director}{film?.director && film?.year ? ' · ' : ''}{film?.year}
        </div>
        {entry.why && (
          <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-2)', margin: '8px 0 0', lineHeight: 1.4, fontFamily: 'var(--serif-italic)' }}>"{entry.why}"</p>
        )}
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button onClick={e => { e.stopPropagation(); onStartWatching(entry) }} className="btn" style={{ padding: '7px 14px', fontSize: 11, borderRadius: 999 }}>put it on →</button>
          <button onClick={remove} disabled={removing} className="btn btn-soft" style={{ padding: '7px 12px', fontSize: 11, borderRadius: 999, opacity: removing ? 0.4 : 1 }}>remove</button>
        </div>
      </div>
      <span style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)', paddingTop: 2 }}>details →</span>
    </div>
  )
}

export default function WatchListPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<LibraryEntry | null>(null)

  useEffect(() => {
    fetch('/api/library')
      .then(r => r.json())
      .then(d => { setEntries(d.watchlist ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleRemove = (id: string) => setEntries(prev => prev.filter(e => e.id !== id))

  const handleStartWatching = async (entry: LibraryEntry) => {
    await fetch(`/api/library/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list: 'now_playing', started_at: new Date().toISOString() }),
    })
    router.push('/now-playing')
  }

  return (
    <AppShell active="watch">
      {panel && (
        <FilmDetailPanel
          entry={panel}
          list="watchlist"
          onClose={() => setPanel(null)}
          onRemove={() => { handleRemove(panel.id); setPanel(null) }}
          onMove={() => { handleRemove(panel.id); setPanel(null); router.push('/now-playing') }}
        />
      )}

      <div style={{ padding: '56px 64px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 40 }}>
          <div>
            <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>○ WATCH LIST</div>
            <h1 className="t-display" style={{ fontSize: 52, lineHeight: 1, margin: 0 }}>
              films you want to <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--forest)' }}>see</span>.
            </h1>
          </div>
          <button className="btn" onClick={() => router.push('/watch-list/save')} style={{ padding: '11px 20px', fontSize: 13, borderRadius: 999 }}>
            + add a film
          </button>
        </div>

        {loading && (
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>loading…</p>
        )}

        {!loading && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div className="stamp" style={{ display: 'inline-block', marginBottom: 24 }}>empty</div>
            <p className="t-display" style={{ fontSize: 28, margin: '0 0 12px' }}>nothing saved yet.</p>
            <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', marginBottom: 32 }}>
              save films you want to watch — mood room can help you pick one.
            </p>
            <button className="btn" onClick={() => router.push('/watch-list/save')} style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999 }}>
              save a film →
            </button>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {entries.map(entry => (
              <WatchListCard
                key={entry.id}
                entry={entry}
                onOpen={() => setPanel(entry)}
                onRemove={handleRemove}
                onStartWatching={handleStartWatching}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
