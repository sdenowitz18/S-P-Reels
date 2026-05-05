'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { FilmDetailPanel } from '@/components/film-detail-panel'
import { LibraryEntry, posterUrl } from '@/lib/types'
import { fetcher } from '@/lib/fetcher'
import { useIsMobile } from '@/lib/use-is-mobile'
import Image from 'next/image'
import { LetterLoader } from '@/components/letter-loader'

interface LibraryData { watched: LibraryEntry[]; nowPlaying: LibraryEntry[]; watchlist: LibraryEntry[] }

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

type MediaFilter = 'all' | 'movie' | 'tv'

export default function WatchListPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { data, mutate } = useSWR<LibraryData>('/api/library', fetcher)
  const allEntries: LibraryEntry[] = data?.watchlist ?? []
  const loading = !data
  const [panel, setPanel] = useState<LibraryEntry | null>(null)
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all')

  const entries = mediaFilter === 'all'
    ? allEntries
    : allEntries.filter(e => e.film?.kind === mediaFilter)

  const handleRemove = (id: string) => mutate(d => d ? { ...d, watchlist: d.watchlist.filter((e: LibraryEntry) => e.id !== id) } : d, false)

  const handleUpdate = (updated: LibraryEntry) => {
    mutate(d => d ? { ...d, watchlist: d.watchlist.map((e: LibraryEntry) => e.id === updated.id ? { ...e, ...updated } : e) } : d, false)
    setPanel(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev)
  }

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
          onUpdate={handleUpdate}
        />
      )}

      <div style={{ padding: isMobile ? '28px 16px 96px' : '56px 64px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'baseline', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', marginBottom: 32, gap: isMobile ? 16 : 0 }}>
          <div>
            <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>○ WATCH LIST</div>
            <h1 className="t-display" style={{ fontSize: isMobile ? 36 : 52, lineHeight: 1, margin: 0 }}>
              things you want to <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--forest)' }}>watch</span>.
            </h1>
          </div>
          <button className="btn" onClick={() => router.push('/watch-list/save')} style={{ padding: '11px 20px', fontSize: 13, borderRadius: 999 }}>
            + add
          </button>
        </div>

        {/* Media type filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28, alignItems: 'center' }}>
          {([
            { key: 'all'   as MediaFilter, label: 'all' },
            { key: 'movie' as MediaFilter, label: 'films' },
            { key: 'tv'    as MediaFilter, label: 'TV shows' },
          ]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setMediaFilter(opt.key)}
              style={{
                padding: '5px 16px', borderRadius: 999, cursor: 'pointer',
                border: mediaFilter === opt.key ? 'none' : '0.5px solid var(--paper-edge)',
                background: mediaFilter === opt.key ? 'var(--ink)' : 'var(--paper-2)',
                color: mediaFilter === opt.key ? 'var(--paper)' : 'var(--ink-3)',
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em',
                textTransform: 'uppercase', transition: 'all 100ms',
              }}
            >
              {opt.label}
              {mediaFilter !== opt.key && opt.key !== 'all' && (() => {
                const n = allEntries.filter(e => e.film?.kind === opt.key).length
                return n > 0 ? <span style={{ marginLeft: 6, opacity: 0.5 }}>{n}</span> : null
              })()}
            </button>
          ))}
          {!loading && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', marginLeft: 8 }}>
              {entries.length} title{entries.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <LetterLoader label="loading" />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div className="stamp" style={{ display: 'inline-block', marginBottom: 24 }}>empty</div>
            <p className="t-display" style={{ fontSize: 28, margin: '0 0 12px' }}>nothing saved yet.</p>
            <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', marginBottom: 32 }}>
              save films and shows you want to watch — the mood room can help you pick.
            </p>
            <button className="btn" onClick={() => router.push('/watch-list/save')} style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999 }}>
              add something →
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
