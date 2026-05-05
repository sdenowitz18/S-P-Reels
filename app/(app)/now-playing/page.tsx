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

function NowPlayingCard({ entry, onFinish, onOpenPanel }: { entry: LibraryEntry; onFinish: (id: string) => void; onOpenPanel: () => void }) {
  const film = entry.film
  const poster = film ? posterUrl(film.poster_path, 'w342') : null
  const [note, setNote] = useState('')
  const [notes, setNotes] = useState<{ at: string; text: string }[]>(entry.live_notes ?? [])
  const [saving, setSaving] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [showFinish, setShowFinish] = useState(false)

  const addNote = async () => {
    if (!note.trim() || saving) return
    setSaving(true)
    const res = await fetch(`/api/library/now-playing/${entry.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'note', text: note.trim() }),
    })
    const data = await res.json()
    setNotes(data.live_notes ?? notes)
    setNote('')
    setSaving(false)
  }

  const finish = async () => {
    setFinishing(true)
    await fetch(`/api/library/now-playing/${entry.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'finish' }),
    })
    onFinish(entry.id)
  }

  return (
    <div style={{ padding: '28px 32px', background: 'var(--p-tint)', border: `0.5px solid var(--p-ink)40`, borderRadius: 14 }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ width: 64, height: 96, borderRadius: 4, overflow: 'hidden', flexShrink: 0, position: 'relative', background: 'var(--paper-2)' }}>
          {poster ? <Image src={poster} alt={film?.title ?? ''} fill style={{ objectFit: 'cover' }} /> : null}
        </div>
        <div style={{ flex: 1 }}>
          <div className="t-meta" style={{ fontSize: 9, color: 'var(--p-ink)', marginBottom: 6 }}>◐ NOW PLAYING</div>
          <div style={{ fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 500, lineHeight: 1.15 }}>{film?.title}</div>
          <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', marginTop: 4, fontFamily: 'var(--serif-italic)' }}>
            {film?.director}{film?.director && film?.year ? ' · ' : ''}{film?.year}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {showFinish ? (
              <>
                <button
                  onClick={finish}
                  disabled={finishing}
                  className="btn"
                  style={{ padding: '8px 16px', fontSize: 12, borderRadius: 999, background: 'var(--forest)', opacity: finishing ? 0.5 : 1 }}
                >
                  {finishing ? 'finishing…' : 'yes, mark finished →'}
                </button>
                <button onClick={() => setShowFinish(false)} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999 }}>cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => setShowFinish(true)} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999 }}>
                  finished watching →
                </button>
                <button onClick={onOpenPanel} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999 }}>
                  details / recommend
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {notes.length > 0 && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map((n, i) => (
            <div key={i} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.5)', borderRadius: 8, border: '0.5px solid var(--paper-edge)' }}>
              <p style={{ margin: 0, fontStyle: 'italic', fontSize: 13, lineHeight: 1.5, fontFamily: 'var(--serif-italic)', color: 'var(--ink-2)' }}>{n.text}</p>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', marginTop: 4 }}>
                {new Date(n.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNote() } }}
          placeholder="drop a thought while it's rolling…"
          style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.7)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink)', outline: 'none' }}
        />
        <button
          onClick={addNote}
          disabled={!note.trim() || saving}
          className="btn"
          style={{ padding: '10px 18px', fontSize: 13, borderRadius: 999, opacity: !note.trim() || saving ? 0.4 : 1 }}
        >
          →
        </button>
      </div>
    </div>
  )
}

export default function NowPlayingPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { data, mutate } = useSWR<LibraryData>('/api/library', fetcher)
  const entries: LibraryEntry[] = data?.nowPlaying ?? []
  const loading = !data
  const [panel, setPanel] = useState<LibraryEntry | null>(null)

  const handleFinish = (id: string) => mutate(d => d ? { ...d, nowPlaying: d.nowPlaying.filter((e: LibraryEntry) => e.id !== id) } : d, false)

  return (
    <AppShell active="now">
      {panel && (
        <FilmDetailPanel
          entry={panel}
          list="now_playing"
          onClose={() => setPanel(null)}
          onRemove={() => { handleFinish(panel.id); setPanel(null) }}
          onMove={() => { handleFinish(panel.id); setPanel(null); router.push('/watch-list') }}
        />
      )}
      <div style={{ padding: isMobile ? '28px 16px 96px' : '56px 64px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ marginBottom: 40 }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>◐ NOW PLAYING</div>
          <h1 className="t-display" style={{ fontSize: isMobile ? 36 : 52, lineHeight: 1, margin: 0 }}>
            what's <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--p-ink)' }}>rolling</span> right now.
          </h1>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <LetterLoader label="loading" />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div className="stamp" style={{ display: 'inline-block', marginBottom: 24 }}>quiet</div>
            <p className="t-display" style={{ fontSize: 28, margin: '0 0 12px' }}>nothing rolling.</p>
            <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', marginBottom: 32 }}>
              start something and it'll appear here while you watch.
            </p>
            <button className="btn" onClick={() => router.push('/add')} style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999 }}>
              put something on →
            </button>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {entries.map(entry => (
              <NowPlayingCard key={entry.id} entry={entry} onFinish={handleFinish} onOpenPanel={() => setPanel(entry)} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
