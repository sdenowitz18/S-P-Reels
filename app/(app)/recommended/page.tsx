'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { posterUrl } from '@/lib/types'
import Image from 'next/image'
import { LetterLoader } from '@/components/letter-loader'

interface Rec {
  id: string
  note: string | null
  created_at: string
  film: { id: string; title: string; year: number | null; poster_path: string | null; director: string | null }
  from_user: { id: string; name: string }
}

interface FriendEntry {
  user_id: string
  list: string
  my_stars: number | null
  my_line: string | null
  user: { id: string; name: string }
}

interface TasteFilm {
  id: string
  title: string
  year: number | null
  director: string | null
  poster_path: string | null
  tone: string | null
  genres: string[]
  score: number
}

type SavedAs = { list: 'watchlist' } | { list: 'watched'; stars: number | null }

interface MatchPanel {
  film: TasteFilm
  match: string | null
  matchLoading: boolean
  // log flow
  logMode: 'idle' | 'rating' | 'done'
  savedAs: SavedAs | null
  hoverStars: number | null
  pendingStars: number | null
  saving: boolean
}

// ── Inline half-star rating ─────────────────────────────────────────────────
function QuickStars({ value, hover, onMove, onClick, onLeave }: {
  value: number | null
  hover: number | null
  onMove: (stars: number) => void
  onClick: (stars: number) => void
  onLeave: () => void
}) {
  const display = hover ?? value ?? 0
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }} onMouseLeave={onLeave}>
      {[1,2,3,4,5].map(n => {
        const full = display >= n
        const half = !full && display >= n - 0.5
        return (
          <div
            key={n}
            style={{ position: 'relative', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseMove={e => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
              onMove(e.clientX - r.left < r.width / 2 ? n - 0.5 : n)
            }}
            onClick={e => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
              onClick(e.clientX - r.left < r.width / 2 ? n - 0.5 : n)
            }}
          >
            <span style={{ fontSize: 24, color: (full || half) ? 'var(--s-ink)' : 'var(--ink-4)', lineHeight: 1 }}>
              {half ? '½' : '★'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function RecommendedPage() {
  const router = useRouter()
  const [recs, setRecs] = useState<Rec[]>([])
  const [loading, setLoading] = useState(true)
  const [reacting, setReacting] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, string>>({})

  // Taste recommendations
  const [tasteFilms, setTasteFilms] = useState<TasteFilm[]>([])
  const [tasteLoading, setTasteLoading] = useState(true)
  const [matchPanel, setMatchPanel] = useState<MatchPanel | null>(null)
  const [matchPanelFriends, setMatchPanelFriends] = useState<FriendEntry[]>([])
  const carouselRef = useRef<HTMLDivElement>(null)

  // Fetch friends' entries whenever the match panel opens on a new film
  useEffect(() => {
    if (!matchPanel?.film.id) { setMatchPanelFriends([]); return }
    fetch(`/api/films/${matchPanel.film.id}/friends`)
      .then(r => r.json())
      .then(d => setMatchPanelFriends(d.friends ?? []))
      .catch(() => setMatchPanelFriends([]))
  }, [matchPanel?.film.id])

  const loadTasteFilms = useCallback(async (forceRefresh = false) => {
    setTasteLoading(true)
    try {
      const url = forceRefresh
        ? '/api/recommendations/taste?refresh=1'
        : '/api/recommendations/taste'
      const d = await fetch(url).then(r => r.json())
      setTasteFilms(d.films ?? [])
    } catch {}
    setTasteLoading(false)
  }, [])

  useEffect(() => {
    fetch('/api/recommendations/inbox')
      .then(r => r.json())
      .then(d => { setRecs(d.recs ?? []); setLoading(false) })
      .catch(() => setLoading(false))

    loadTasteFilms()
  }, [loadTasteFilms])

  const react = async (recId: string, action: 'watched' | 'watching' | 'save') => {
    setReacting(recId)
    await fetch(`/api/recommendations/${recId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setDone(prev => ({ ...prev, [recId]: action }))
    setReacting(null)
  }

  const openMatch = (film: TasteFilm) => {
    setMatchPanel({ film, match: null, matchLoading: false, logMode: 'idle', savedAs: null, hoverStars: null, pendingStars: null, saving: false })
  }

  const loadMatch = async (film: TasteFilm) => {
    setMatchPanel(prev => prev ? { ...prev, matchLoading: true } : null)
    try {
      const res = await fetch(`/api/recommendations/taste/${film.id}/match`)
      if (res.ok) {
        const data = await res.json()
        setMatchPanel(prev => prev ? { ...prev, match: data.match ?? null, matchLoading: false } : null)
      } else {
        setMatchPanel(prev => prev ? { ...prev, matchLoading: false } : null)
      }
    } catch {
      setMatchPanel(prev => prev ? { ...prev, matchLoading: false } : null)
    }
  }

  const saveFilm = async (list: 'watchlist' | 'watched', stars?: number) => {
    if (!matchPanel) return
    setMatchPanel(prev => prev ? { ...prev, saving: true } : null)
    await fetch(`/api/recommendations/taste/${matchPanel.film.id}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list, stars }),
    })
    const savedAs: SavedAs = list === 'watched' ? { list: 'watched', stars: stars ?? null } : { list: 'watchlist' }
    setMatchPanel(prev => prev ? { ...prev, saving: false, savedAs, logMode: 'done' } : null)
  }

  const ACTION_LABEL: Record<string, string> = {
    watched: '✓ marked as watched',
    watching: '▶ added to now playing',
    save: '+ saved to watch list',
  }

  const filmPoster = matchPanel ? posterUrl(matchPanel.film.poster_path, 'w342') : null

  return (
    <AppShell active="recommended">
      {/* Taste match panel */}
      {matchPanel && (
        <>
          <div
            onClick={() => setMatchPanel(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(24,22,18,0.35)', backdropFilter: 'blur(2px)' }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, zIndex: 50,
            background: 'var(--paper)', borderLeft: '0.5px solid var(--paper-edge)',
            overflowY: 'auto', padding: '44px 36px',
            display: 'flex', flexDirection: 'column', gap: 0,
          }}>
            <button
              onClick={() => setMatchPanel(null)}
              style={{ position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em' }}
            >
              ✕ close
            </button>

            {/* Film header */}
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', marginBottom: 28 }}>
              {filmPoster && (
                <div style={{ width: 80, height: 120, borderRadius: 5, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                  <Image src={filmPoster} alt={matchPanel.film.title} fill style={{ objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ paddingTop: 2 }}>
                <div className="t-meta" style={{ fontSize: 8, color: 'var(--s-ink)', marginBottom: 7 }}>★ PICKED FOR YOU</div>
                <div style={{ fontFamily: 'var(--serif-display)', fontSize: 20, fontWeight: 500, lineHeight: 1.2 }}>
                  {matchPanel.film.title}
                </div>
                <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', marginTop: 4, fontFamily: 'var(--serif-italic)' }}>
                  {[matchPanel.film.director, matchPanel.film.year].filter(Boolean).join(' · ')}
                </div>
                {matchPanel.film.tone && (
                  <div style={{ marginTop: 6, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                    {matchPanel.film.tone}
                  </div>
                )}
                {matchPanel.film.genres.length > 0 && (
                  <div style={{ marginTop: 7, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {matchPanel.film.genres.map(g => (
                      <span key={g} style={{
                        fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-3)',
                        background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
                        borderRadius: 4, padding: '2px 6px', letterSpacing: '0.04em',
                      }}>{g}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Would I like this */}
            <div style={{ borderTop: '0.5px solid var(--paper-edge)', paddingTop: 22, marginBottom: 24 }}>
              <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 14 }}>WOULD I LIKE THIS?</div>

              {!matchPanel.match && !matchPanel.matchLoading && (
                <button className="btn btn-soft" onClick={() => loadMatch(matchPanel.film)} style={{ padding: '9px 18px', fontSize: 12, borderRadius: 999 }}>
                  analyse my taste →
                </button>
              )}

              {matchPanel.matchLoading && (
                <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', lineHeight: 1.5 }}>
                  reading your taste profile…
                </p>
              )}

              {matchPanel.match && !matchPanel.matchLoading && (
                <p style={{ fontFamily: 'var(--serif-display)', fontSize: 15, lineHeight: 1.7, color: 'var(--ink)', margin: 0, fontStyle: 'italic', fontWeight: 400 }}>
                  {matchPanel.match}
                </p>
              )}
            </div>

            {/* Friends who have this film */}
            {matchPanelFriends.length > 0 && (
              <div style={{ borderTop: '0.5px solid var(--paper-edge)', paddingTop: 22, marginBottom: 0 }}>
                <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 12 }}>★ YOUR FRIENDS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {matchPanelFriends.map((fe, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'var(--p-tint)', border: '0.5px solid var(--p-ink)40',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--serif-display)', fontSize: 12, fontWeight: 600,
                        color: 'var(--p-ink)', flexShrink: 0,
                      }}>
                        {fe.user?.name?.[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontFamily: 'var(--serif-body)', fontSize: 13, fontWeight: 500 }}>{fe.user?.name}</span>
                        <span style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginLeft: 6 }}>
                          {{ watched: 'watched', now_playing: 'watching', watchlist: 'wants to watch' }[fe.list] ?? fe.list}
                        </span>
                      </div>
                      {fe.my_stars != null && (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--s-ink)', letterSpacing: '0.04em', flexShrink: 0 }}>
                          {fe.my_stars.toFixed(1)}★
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Log section */}
            <div style={{ borderTop: '0.5px solid var(--paper-edge)', paddingTop: 22 }}>
              {matchPanel.logMode === 'idle' && (
                <>
                  <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 14 }}>ADD TO YOUR LIBRARY</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className="btn"
                      onClick={() => setMatchPanel(prev => prev ? { ...prev, logMode: 'rating' } : null)}
                      disabled={matchPanel.saving}
                      style={{ padding: '10px 18px', fontSize: 13, borderRadius: 999 }}
                    >
                      ✓ i watched this
                    </button>
                    <button
                      className="btn btn-soft"
                      onClick={() => saveFilm('watchlist')}
                      disabled={matchPanel.saving}
                      style={{ padding: '10px 18px', fontSize: 13, borderRadius: 999 }}
                    >
                      + save for later
                    </button>
                  </div>
                </>
              )}

              {matchPanel.logMode === 'rating' && (
                <>
                  <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 14 }}>RATE IT</div>
                  <QuickStars
                    value={matchPanel.pendingStars}
                    hover={matchPanel.hoverStars}
                    onMove={s => setMatchPanel(prev => prev ? { ...prev, hoverStars: s } : null)}
                    onLeave={() => setMatchPanel(prev => prev ? { ...prev, hoverStars: null } : null)}
                    onClick={s => setMatchPanel(prev => prev ? { ...prev, pendingStars: s } : null)}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      className="btn"
                      onClick={() => saveFilm('watched', matchPanel.pendingStars ?? undefined)}
                      disabled={matchPanel.saving}
                      style={{ padding: '10px 18px', fontSize: 13, borderRadius: 999, opacity: matchPanel.saving ? 0.6 : 1 }}
                    >
                      {matchPanel.pendingStars ? `log ${matchPanel.pendingStars}★` : 'log without rating'}
                    </button>
                    <button
                      onClick={() => setMatchPanel(prev => prev ? { ...prev, logMode: 'idle', pendingStars: null } : null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', textDecoration: 'underline', textUnderlineOffset: 3 }}
                    >
                      cancel
                    </button>
                  </div>
                </>
              )}

              {matchPanel.logMode === 'done' && matchPanel.savedAs && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {matchPanel.savedAs.list === 'watched' ? (
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--forest)', letterSpacing: '0.05em' }}>
                      ✓ logged to watched{matchPanel.savedAs.stars ? ` · ${matchPanel.savedAs.stars}★` : ''}
                    </div>
                  ) : (
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--forest)', letterSpacing: '0.05em' }}>
                      ✓ saved to watchlist
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => router.push('/movies')} className="btn btn-soft" style={{ padding: '9px 16px', fontSize: 12, borderRadius: 999 }}>
                      view watched →
                    </button>
                    <button onClick={() => setMatchPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                      dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div style={{ padding: 'clamp(28px,5vw,56px) clamp(16px,5vw,64px) clamp(96px,10vw,96px)', maxWidth: 860, margin: '0 auto' }}>
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ RECOMMENDED</div>
        <h1 className="t-display" style={{ fontSize: 52, lineHeight: 1, marginBottom: 48 }}>
          what to <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--forest)' }}>watch next</span>.
        </h1>

        {/* ── Taste picks ───────────────────────────────────────── */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)' }}>★ PICKED FOR YOUR TASTE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                onClick={() => loadTasteFilms(true)}
                disabled={tasteLoading}
                style={{
                  background: 'none', border: 'none', cursor: tasteLoading ? 'default' : 'pointer',
                  fontFamily: 'var(--mono)', fontSize: 9, color: tasteLoading ? 'var(--ink-4)' : 'var(--ink-3)',
                  letterSpacing: '0.06em', opacity: tasteLoading ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <span style={{ display: 'inline-block', transform: tasteLoading ? 'rotate(0deg)' : undefined }}>↺</span>
                {tasteLoading ? 'refreshing…' : 'refresh'}
              </button>
              <button
                onClick={() => router.push('/profile')}
                style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.05em', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                taste profile
              </button>
            </div>
          </div>
          <p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', margin: '0 0 20px', lineHeight: 1.5 }}>
            based on your ratings and taste profile — click any film to see if it's right for you.
          </p>

          {tasteLoading && !tasteFilms.length && (
            <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>finding films for your taste…</p>
          )}

          {!tasteLoading && tasteFilms.length === 0 && (
            <div style={{ padding: '20px 24px', background: 'var(--bone)', borderRadius: 12, border: '0.5px solid var(--paper-edge)', maxWidth: 440 }}>
              <p style={{ margin: 0, fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', lineHeight: 1.6 }}>
                rate a few more films on your watched list and we'll start picking films for your taste.
              </p>
            </div>
          )}

          {tasteFilms.length > 0 && (
            <div
              ref={carouselRef}
              style={{
                display: 'flex', gap: 14, overflowX: 'auto',
                paddingBottom: 12, scrollbarWidth: 'thin',
                scrollbarColor: 'var(--paper-edge) transparent',
                opacity: tasteLoading ? 0.5 : 1, transition: 'opacity 200ms',
              }}
            >
              {tasteFilms.map(film => {
                const poster = posterUrl(film.poster_path, 'w342')
                return (
                  <button
                    key={film.id}
                    onClick={() => openMatch(film)}
                    style={{ flexShrink: 0, width: 110, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div
                      style={{
                        width: 110, height: 165, borderRadius: 6, overflow: 'hidden',
                        background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
                        position: 'relative', marginBottom: 8,
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.opacity = '0.8'
                        const overlay = (e.currentTarget as HTMLElement).querySelector('.hover-label') as HTMLElement | null
                        if (overlay) overlay.style.opacity = '1'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.opacity = '1'
                        const overlay = (e.currentTarget as HTMLElement).querySelector('.hover-label') as HTMLElement | null
                        if (overlay) overlay.style.opacity = '0'
                      }}
                    >
                      {poster
                        ? <Image src={poster} alt={film.title} fill style={{ objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'var(--ink-4)', fontFamily: 'var(--mono)', textAlign: 'center', padding: 8 }}>
                            {film.title.toUpperCase()}
                          </div>
                      }
                      <div
                        className="hover-label"
                        style={{
                          position: 'absolute', inset: 0, opacity: 0, transition: 'opacity 150ms',
                          background: 'rgba(24,22,18,0.55)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <span style={{ fontFamily: 'var(--serif-display)', fontSize: 13, color: '#f5e6c8', fontStyle: 'italic', textAlign: 'center', padding: '0 8px', lineHeight: 1.3 }}>
                          for me?
                        </span>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--serif-display)', fontSize: 12, fontWeight: 500, lineHeight: 1.25 }}>{film.title}</div>
                    <div style={{ fontStyle: 'italic', fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)', marginTop: 2 }}>{film.year}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Friend recs ───────────────────────────────────────── */}
        <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 20 }}>FROM YOUR FRIENDS</div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <LetterLoader label="loading" size={64} />
          </div>
        )}

        {!loading && recs.length === 0 && (
          <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.5, fontFamily: 'var(--serif-italic)', maxWidth: 520 }}>
            nothing yet — when a friend recommends something it'll appear here.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {recs.map(rec => {
            const poster = posterUrl(rec.film?.poster_path, 'w342')
            const reaction = done[rec.id]
            return (
              <div key={rec.id} style={{
                padding: '24px 28px', background: 'var(--bone)',
                border: '0.5px solid var(--paper-edge)', borderRadius: 14,
                display: 'flex', gap: 22, alignItems: 'flex-start',
              }}>
                {poster && (
                  <div style={{ width: 64, height: 96, borderRadius: 3, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                    <Image src={poster} alt={rec.film?.title ?? ''} fill style={{ objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginBottom: 6 }}>
                    from <strong style={{ fontStyle: 'normal', fontWeight: 600, color: 'var(--ink-2)' }}>{rec.from_user?.name}</strong>
                    {' · '}
                    <button onClick={() => router.push(`/friends/${rec.from_user?.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', padding: 0 }}>
                      view thread →
                    </button>
                  </div>
                  <div style={{ fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 500, lineHeight: 1.2 }}>{rec.film?.title}</div>
                  <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', marginTop: 3, fontFamily: 'var(--serif-italic)' }}>
                    {rec.film?.director}{rec.film?.director && rec.film?.year ? ' · ' : ''}{rec.film?.year}
                  </div>
                  {rec.note && (
                    <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.5, fontFamily: 'var(--serif-italic)' }}>
                      "{rec.note}"
                    </p>
                  )}
                  {reaction ? (
                    <div style={{ marginTop: 14, fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
                      {ACTION_LABEL[reaction]}
                    </div>
                  ) : (
                    <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        { action: 'watched' as const, label: '✓ already watched' },
                        { action: 'watching' as const, label: '▶ now watching' },
                        { action: 'save' as const, label: '+ save for later' },
                      ].map(({ action, label }) => (
                        <button
                          key={action}
                          onClick={() => react(rec.id, action)}
                          disabled={reacting === rec.id}
                          style={{
                            padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                            fontFamily: 'var(--serif-body)', fontSize: 12,
                            border: '0.5px solid var(--paper-edge)', background: 'var(--paper)', color: 'var(--ink)',
                            opacity: reacting === rec.id ? 0.5 : 1, transition: 'all 120ms',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--paper)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--paper)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)' }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
