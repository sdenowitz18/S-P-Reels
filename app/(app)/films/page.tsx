'use client'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/app-shell'
import { FilmPanel, type PanelFilm } from './film-panel'
import { GENRE_GROUPS } from '@/lib/genre-groups'
import { LetterLoader } from '@/components/letter-loader'

const NOT_FOR_ME_REASONS = [
  'Too old',
  'Foreign language',
  'Too long',
  'Not my genre',
  'Just not interested',
  'Other',
]

interface CatalogFilm extends PanelFilm {
  kind: 'movie' | 'tv'
}

interface RecSender { name: string; note: string | null }
interface RecCatalogFilm extends CatalogFilm { recSenders: RecSender[] }

/**
 * Display-only transform: stretches the algorithm's conservative 0–89 range
 * to feel more natural (similar to how Netflix/Spotify tune their displayed scores).
 * Formula: 2x − x²/100 — monotonically increasing, keeps 0→0 and 100→100,
 * lifts the 70–89 zone into 91–99. Does NOT change sort order.
 */
function displayScore(raw: number): number {
  return Math.min(99, Math.round(2 * raw - (raw * raw) / 100))
}

// Badge background colour by match tier (keyed to displayed score post-transform)
function matchBg(displayed: number): string {
  if (displayed >= 90) return '#1a5c32'
  if (displayed >= 80) return '#3d7a4a'
  if (displayed >= 70) return '#8a6a20'
  return '#6b4040'
}

function MatchBadge({ score }: { score: number | null }) {
  if (score == null) return null
  const displayed = displayScore(Math.round(score))
  return (
    <div style={{
      position: 'absolute', top: 6, right: 6,
      background: matchBg(displayed),
      borderRadius: 8, padding: '4px 8px',
      fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
      color: '#fff', letterSpacing: '0.01em', lineHeight: 1,
      boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    }}>
      {displayed}
    </div>
  )
}

function LibraryBadge({ status }: { status: CatalogFilm['libraryStatus'] }) {
  if (!status) return null
  const isWatched = status.list === 'watched'
  const label = isWatched
    ? (status.my_stars ? `${status.my_stars}★` : '✓')
    : status.list === 'watchlist' ? '+ list'
    : '▶'
  return (
    <div style={{
      position: 'absolute', bottom: 6, left: 6,
      background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(3px)',
      borderRadius: 6, padding: '3px 6px',
      fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
      color: isWatched ? '#f0c96a' : '#ccc',
      letterSpacing: '0.03em', lineHeight: 1,
    }}>
      {label}
    </div>
  )
}

function RecDot() {
  return (
    <div style={{
      position: 'absolute', bottom: 6, right: 6,
      width: 8, height: 8, borderRadius: '50%',
      background: 'var(--p-ink)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
    }} />
  )
}

const overlayActionStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.12)',
  border: '0.5px solid rgba(255,255,255,0.22)',
  borderRadius: 6,
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'var(--mono)',
  fontSize: 9,
  letterSpacing: '0.07em',
  padding: '6px 10px',
  transition: 'background 100ms',
  width: '100%',
  textAlign: 'center',
}

const overlayReasonStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '0.5px solid rgba(255,255,255,0.15)',
  borderRadius: 4,
  color: 'rgba(255,255,255,0.85)',
  cursor: 'pointer',
  fontFamily: 'var(--mono)',
  fontSize: 8,
  letterSpacing: '0.05em',
  padding: '4px 8px',
  transition: 'background 100ms',
  width: '100%',
  textAlign: 'center',
}

function FilmCard({ film, onClick, large = false, onQuickAction, friendRating, friendName }: {
  film: CatalogFilm
  onClick: () => void
  large?: boolean
  onQuickAction?: (action: 'watched' | 'watchlist' | 'dismissed', filmId: string, extra?: { stars?: number; reason?: string }) => void
  friendRating?: number | null
  friendName?: string
}) {
  const [hovered, setHovered] = useState(false)
  const [overlayMode, setOverlayMode] = useState<'idle' | 'stars' | 'dismiss'>('idle')
  const [saving, setSaving] = useState(false)

  const handleMouseLeave = () => {
    setHovered(false)
    setOverlayMode('idle')
  }

  const handleWatchlist = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (saving) return
    setSaving(true)
    try {
      await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filmId: film.id, list: 'watchlist' }),
      })
      onQuickAction?.('watchlist', film.id)
      setHovered(false)
    } finally {
      setSaving(false)
    }
  }

  const handleStarPick = async (e: React.MouseEvent, stars: number) => {
    e.stopPropagation()
    if (saving) return
    setSaving(true)
    try {
      await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filmId: film.id, list: 'watched', myStars: stars }),
      })
      onQuickAction?.('watched', film.id, { stars })
      setHovered(false)
      setOverlayMode('idle')
    } finally {
      setSaving(false)
    }
  }

  const handleDismiss = async (e: React.MouseEvent, reason: string) => {
    e.stopPropagation()
    if (saving) return
    setSaving(true)
    try {
      await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filmId: film.id, list: 'dismissed', why: reason }),
      })
      onQuickAction?.('dismissed', film.id, { reason })
      setHovered(false)
      setOverlayMode('idle')
    } finally {
      setSaving(false)
    }
  }

  const alreadyWatched = film.libraryStatus?.list === 'watched'
  const alreadyOnList  = film.libraryStatus?.list === 'watchlist'

  return (
    <button
      onClick={onClick}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%', display: 'block' }}
    >
      {/* Poster */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={handleMouseLeave}
        style={{
          width: '100%', aspectRatio: '2/3', borderRadius: large ? 8 : 6, overflow: 'hidden',
          background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
          position: 'relative', marginBottom: large ? 10 : 7,
          boxShadow: hovered
            ? (large ? '0 10px 28px rgba(0,0,0,0.18)' : '0 6px 16px rgba(0,0,0,0.14)')
            : (large ? '0 4px 16px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.08)'),
          transform: hovered ? 'translateY(-2px)' : '',
          transition: 'box-shadow 150ms, transform 150ms',
        }}
      >
        {film.poster_path
          ? <Image src={film.poster_path} alt={film.title} fill style={{ objectFit: 'cover' }} />
          : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--ink-4)', textAlign: 'center', lineHeight: 1.4 }}>
              {film.title.toUpperCase()}
            </div>
          )
        }
        <MatchBadge score={film.matchScore} />
        {!hovered && <LibraryBadge status={film.libraryStatus} />}
        {/* Friend rating badge — shown when a Friend Lens is active */}
        {friendRating != null && !hovered && (
          <div style={{
            position: 'absolute', bottom: 6, right: 6,
            background: 'rgba(10,8,4,0.88)', backdropFilter: 'blur(4px)',
            borderRadius: 5, padding: '4px 7px',
            fontFamily: 'var(--mono)', fontSize: large ? 12 : 10, fontWeight: 700,
            color: '#f5d97a', letterSpacing: '0.02em', lineHeight: 1,
            boxShadow: '0 1px 6px rgba(0,0,0,0.35)',
          }}>
            {friendName ? `${friendName.split(' ')[0]} ` : ''}{friendRating}★
          </div>
        )}
        {film.recommendedBy && film.recommendedBy.length > 0 && <RecDot />}
        {film.kind === 'tv' && (
          <div style={{
            position: 'absolute', top: 6, left: 6,
            background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(3px)',
            borderRadius: 4, padding: '2px 5px',
            fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700,
            color: '#ccc', letterSpacing: '0.06em', lineHeight: 1,
          }}>
            TV
          </div>
        )}

        {/* ── Hover overlay — bottom gradient only; clicking above the buttons opens the panel ── */}
        {hovered && (
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: overlayMode === 'dismiss' ? '72%' : overlayMode === 'stars' ? '62%' : '48%',
              background: 'linear-gradient(to top, rgba(0,0,0,0.82) 55%, rgba(0,0,0,0))',
              display: 'flex', flexDirection: 'column',
              alignItems: 'stretch', justifyContent: 'flex-end',
              gap: overlayMode === 'dismiss' ? 3 : 6,
              padding: large ? '0 12px 12px' : '0 8px 8px',
              transition: 'height 120ms ease',
            }}
          >
            {/* ─ Default: 3 action buttons ─ */}
            {overlayMode === 'idle' && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); setOverlayMode('stars') }}
                  style={overlayActionStyle}
                >
                  {alreadyWatched ? 're-rate ★' : 'seen ★'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setOverlayMode('dismiss') }}
                  style={{ ...overlayActionStyle, color: 'rgba(255,255,255,0.55)' }}
                >
                  not for me
                </button>
                <button
                  onClick={handleWatchlist}
                  style={{ ...overlayActionStyle, color: alreadyOnList ? '#f0c96a' : '#fff' }}
                >
                  {alreadyOnList ? '✓ on list' : '+ list'}
                </button>
              </>
            )}

            {/* ─ Star picker (half-star) ─ */}
            {overlayMode === 'stars' && (
              <>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'rgba(255,255,255,0.5)', textAlign: 'center', letterSpacing: '0.06em', marginBottom: 2 }}>
                  how many stars?
                </div>
                {([
                  [0.5, 1, 1.5, 2, 2.5],
                  [3, 3.5, 4, 4.5, 5],
                ] as number[][]).map((row, ri) => (
                  <div key={ri} style={{ display: 'flex', gap: 3, justifyContent: 'center', marginBottom: ri === 0 ? 3 : 0 }}>
                    {row.map(s => (
                      <button
                        key={s}
                        onClick={e => handleStarPick(e, s)}
                        style={{
                          background: 'rgba(255,255,255,0.10)',
                          border: '0.5px solid rgba(255,255,255,0.20)',
                          borderRadius: 4, color: '#f0c96a',
                          cursor: 'pointer',
                          fontFamily: 'var(--mono)', fontSize: large ? 10 : 8,
                          fontWeight: 700, padding: large ? '5px 6px' : '3px 5px',
                          flex: 1, transition: 'background 80ms',
                        }}
                      >
                        {s % 1 === 0 ? `${s}` : `${Math.floor(s)}½`}★
                      </button>
                    ))}
                  </div>
                ))}
                <button onClick={e => { e.stopPropagation(); setOverlayMode('idle') }} style={{ ...overlayActionStyle, fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  ← back
                </button>
              </>
            )}

            {/* ─ Not for me: reason list ─ */}
            {overlayMode === 'dismiss' && (
              <>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'rgba(255,255,255,0.45)', textAlign: 'center', letterSpacing: '0.06em', marginBottom: 2 }}>
                  why not?
                </div>
                {NOT_FOR_ME_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={e => handleDismiss(e, reason)}
                    style={overlayReasonStyle}
                  >
                    {reason.toLowerCase()}
                  </button>
                ))}
                <button onClick={e => { e.stopPropagation(); setOverlayMode('idle') }} style={{ ...overlayReasonStyle, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                  ← back
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ fontSize: large ? 13 : 11, fontFamily: 'var(--serif-display)', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.25, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {film.title}
      </div>
      <div style={{ fontSize: large ? 10 : 9, fontFamily: 'var(--mono)', color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{film.year ?? '—'}</span>
        {film.matchScore != null && (() => {
          const d = displayScore(Math.round(film.matchScore))
          return (
            <span style={{
              color: d >= 90 ? 'var(--s-ink)' : d >= 80 ? '#6a9e72' : d >= 70 ? 'var(--sun)' : 'var(--ink-4)',
              fontWeight: 500,
            }}>
              · {d}%
            </span>
          )
        })()}
        {film.tmdb_vote_average != null && film.tmdb_vote_average > 0 && (
          <span style={{ color: 'var(--ink-4)' }}>
            · ★{film.tmdb_vote_average.toFixed(1)}
          </span>
        )}
      </div>
    </button>
  )
}

type Mode      = 'network' | 'new' | 'rec'
type MediaType = 'both' | 'movie' | 'tv'

interface NetworkFriend { id: string; name: string }
interface NetworkWatcher { id: string; name: string; stars: number | null }
interface NetworkCatalogFilm extends CatalogFilm {
  watchers: NetworkWatcher[]
  watcherCount: number
}

const FRIEND_COLORS = [
  { ink: '#c25a2a', tint: '#fdf0e8' },
  { ink: '#2f6b82', tint: '#e6f2f7' },
  { ink: '#4a6b3e', tint: '#eaf2e8' },
  { ink: '#8a5a9a', tint: '#f5eef8' },
  { ink: '#c25a6b', tint: '#fde8ec' },
  { ink: '#6b7a2a', tint: '#f2f4e0' },
]
function friendColor(idx: number) { return FRIEND_COLORS[idx % FRIEND_COLORS.length] }


function NetworkLensButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  const [tip, setTip] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        style={{
          padding: '8px 16px', borderRadius: 999, cursor: 'pointer', border: 'none',
          background: open ? 'var(--ink)' : 'linear-gradient(135deg, #c25a2a 0%, #8a5a9a 100%)',
          fontFamily: 'var(--mono)', fontSize: 10,
          color: '#fff', letterSpacing: '0.07em', fontWeight: 600,
          transition: 'all 150ms',
          boxShadow: open ? 'none' : '0 2px 10px rgba(194,90,42,0.3)',
        }}
      >★ Friend Lens</button>
      {tip && !open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--ink)', color: 'var(--paper)',
          borderRadius: 8, padding: '8px 12px',
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.04em',
          whiteSpace: 'nowrap', zIndex: 200, lineHeight: 1.5,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)', pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>★ Friend Lens</div>
          <div style={{ opacity: 0.7 }}>filter to one friend&apos;s watches</div>
        </div>
      )}
    </div>
  )
}

const PAGE_SIZE = 60

export default function FilmCatalogPage() {
  const router = useRouter()

  // ── Two-tier state ──────────────────────────────────────────────────────────
  // pageFilms: initial ~60 films (fast first paint, full panel data)
  // indexFilms: full scored catalog for instant genre filtering (loads in bg)
  const [pageFilms, setPageFilms]       = useState<CatalogFilm[]>([])
  const [indexFilms, setIndexFilms]     = useState<CatalogFilm[] | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loading, setLoading]           = useState(false)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [indexLoading, setIndexLoading] = useState(false)
  const [mode, setMode]                 = useState<Mode>('network')

  // Pre-select mode from URL param (e.g. /films?mode=rec from rec notification)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('mode')
    if (p === 'rec' || p === 'new') setMode(p)
  }, [])
  const [mediaType, setMediaType]       = useState<MediaType>('both')
  const [query, setQuery]               = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeGroup, setActiveGroup]     = useState<string | null>(null)
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null)
  const [hasMatchScores, setHasMatchScores] = useState(false)
  const [selectedFilm, setSelectedFilm]     = useState<CatalogFilm | null>(null)
  const [dismissedIds, setDismissedIds]     = useState<Set<string>>(new Set())
  const [recFilmsRaw, setRecFilmsRaw] = useState<RecCatalogFilm[]>([])
  const [recLoading, setRecLoading]   = useState(false)
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageFilmMapRef = useRef<Map<string, CatalogFilm>>(new Map())
  const indexFilmsRef  = useRef<CatalogFilm[] | null>(null)

  // ── Network mode state ───────────────────────────────────────────────────────
  const [networkFilms, setNetworkFilms]   = useState<NetworkCatalogFilm[]>([])
  const [networkLoading, setNetworkLoading] = useState(false)
  const [networkFriends, setNetworkFriends] = useState<NetworkFriend[]>([])
  const [lensOpen, setLensOpen]           = useState(false)
  const [lensFriend, setLensFriend]       = useState<NetworkFriend | null>(null)
  const [lensColorIdx, setLensColorIdx]   = useState(0)
  const lensRef = useRef<HTMLDivElement>(null)

  // ── Friend Lens: close dropdown on outside click ─────────────────────────────
  useEffect(() => {
    if (!lensOpen) return
    const handler = (e: MouseEvent) => {
      if (lensRef.current && !lensRef.current.contains(e.target as Node)) setLensOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [lensOpen])

  // ── Network films fetch ──────────────────────────────────────────────────────
  const fetchNetworkFilms = useCallback(async () => {
    setNetworkLoading(true)
    try {
      const data = await fetch('/api/friends/network-films').then(r => r.json())
      setNetworkFriends(data.friends ?? [])
      setNetworkFilms((data.films ?? []) as NetworkCatalogFilm[])
      if ((data.films ?? []).some((f: NetworkCatalogFilm) => f.matchScore != null)) setHasMatchScores(true)
    } finally {
      setNetworkLoading(false)
    }
  }, [])

  // ── Catalog fetch ────────────────────────────────────────────────────────────
  // For searches: server-side full-text fetch (index doesn't support text search)
  // For browsing: fast initial 60 + background full index for instant filters
  const fetchFilms = useCallback(async (q: string, m: Mode) => {
    setLoading(true)
    setVisibleCount(PAGE_SIZE)
    const newOnly = m === 'new'

    if (q) {
      // ── Search mode: server-side, no background index ──
      setIndexFilms(null)
      try {
        const params = new URLSearchParams({
          page: '0', limit: '100', sort: 'match', hideWatched: 'true', q,
          ...(newOnly ? { newOnly: 'true' } : {}),
        })
        const data = await fetch(`/api/films?${params}`).then(r => r.json())
        setPageFilms(data.films ?? [])
        setHasMatchScores(data.hasMatchScores ?? false)
      } finally {
        setLoading(false)
      }
    } else {
      // ── Browse mode: fast initial page + background full index ──
      // Both fetches kick off in parallel; initial page resolves first.
      const initParams = new URLSearchParams({
        page: '0', limit: '60', sort: 'match', hideWatched: 'true',
        ...(newOnly ? { newOnly: 'true' } : {}),
      })
      const indexParams = new URLSearchParams({
        ...(newOnly ? { newOnly: 'true' } : {}),
      })

      const initPromise  = fetch(`/api/films?${initParams}`).then(r => r.json())
      const indexPromise = fetch(`/api/films/index?${indexParams}`, { cache: 'no-store' }).then(r => r.json())

      // Show the first 60 as soon as they arrive
      initPromise
        .then((data) => {
          const films: CatalogFilm[] = data.films ?? []
          setPageFilms(films)
          // Build a map for later merging with the full index
          pageFilmMapRef.current = new Map(films.map(f => [f.id, f]))
          setHasMatchScores(data.hasMatchScores ?? false)
        })
        .catch(() => {})
        .finally(() => setLoading(false))

      // Full index loads in the background
      setIndexLoading(true)
      setIndexFilms(null)
      indexPromise
        .then((data) => {
          const raw: CatalogFilm[] = data.index ?? []
          // Merge: films already in pageFilms keep their full panel data
          const merged = raw.map(f => pageFilmMapRef.current.get(f.id) ?? f)
          setIndexFilms(merged)
          if (data.hasMatchScores != null) setHasMatchScores(data.hasMatchScores)
        })
        .catch(() => {})
        .finally(() => setIndexLoading(false))
    }
  }, [])

  // Keep ref in sync so rec-mode effects can read indexFilms without adding it as a dep
  useEffect(() => { indexFilmsRef.current = indexFilms }, [indexFilms])

  const fetchRecs = useCallback(async () => {
    setRecLoading(true)
    try {
      const data = await fetch('/api/recommendations/inbox').then(r => r.json())
      type RecRow = {
        film_id: string; note: string | null
        film: { id: string; title: string; year: number | null; poster_path: string | null; director: string | null }
        from_user: { id: string; name: string }
      }
      const recs: RecRow[] = data.recs ?? []
      const filmMap = new Map<string, { film: RecRow['film']; senders: RecSender[] }>()
      for (const rec of recs) {
        if (!filmMap.has(rec.film_id)) filmMap.set(rec.film_id, { film: rec.film, senders: [] })
        filmMap.get(rec.film_id)!.senders.push({ name: rec.from_user.name, note: rec.note })
      }
      setRecFilmsRaw(Array.from(filmMap.values()).map(({ film, senders }) => ({
        id: film.id, title: film.title, year: film.year, poster_path: film.poster_path,
        director: film.director, kind: 'movie' as const, matchScore: null,
        libraryStatus: null, recommendedBy: senders.map(s => s.name),
        genres: [], aiGenres: [], dimBreakdown: [], synopsis: null,
        tmdb_vote_average: null, tasteScore: null, compositeQuality: null,
        recSenders: senders,
      } as unknown as RecCatalogFilm)))
    } finally {
      setRecLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 280)
  }, [query])

  // Network fetch — fires once on mount (shared pool for both 'network' and 'all' modes)
  useEffect(() => {
    fetchNetworkFilms()
  }, [fetchNetworkFilms])

  // Catalog fetch — only for new releases (network + all reuse networkFilms pool)
  useEffect(() => {
    if (mode === 'new') fetchFilms(debouncedQuery, mode)
  }, [debouncedQuery, mode, fetchFilms])

  // Rec fetch — fires when mode switches to rec
  useEffect(() => {
    if (mode === 'rec') fetchRecs()
  }, [mode, fetchRecs])

  // Background index load when in rec mode — needed for genre/kind/matchScore enrichment
  useEffect(() => {
    if (mode !== 'rec' || indexFilmsRef.current) return
    setIndexLoading(true)
    fetch('/api/films/index', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const raw: CatalogFilm[] = data.index ?? []
        setIndexFilms(raw)
        if (data.hasMatchScores != null) setHasMatchScores(data.hasMatchScores)
      })
      .catch(() => {})
      .finally(() => setIndexLoading(false))
  }, [mode])

  // Rec films enriched with index data (genre / kind / matchScore)
  const recEnrichedFilms = useMemo<RecCatalogFilm[]>(() => {
    if (!recFilmsRaw.length) return recFilmsRaw
    const idxMap = new Map((indexFilms ?? []).map(f => [f.id, f]))
    return recFilmsRaw.map(raw => {
      const idx = idxMap.get(raw.id)
      return idx ? { ...idx, recSenders: raw.recSenders } as RecCatalogFilm : raw
    })
  }, [recFilmsRaw, indexFilms])

  // ── Source of truth ─────────────────────────────────────────────────────────
  // network + all: networkFilms pool (any user's watched films), client-side search
  //   network adds friend lens + attribution; all is the same pool, no social layer
  // new:           pageFilms / indexFilms (TMDB new releases, separate fetch)
  // rec:           recEnrichedFilms
  const allFilms = useMemo(() => {
    if (mode === 'network') {
      let result: NetworkCatalogFilm[] = networkFilms
      if (lensFriend) {
        result = result.filter(f => f.watchers.some((w: NetworkWatcher) => w.id === lensFriend.id))
      }
      if (debouncedQuery) {
        const q = debouncedQuery.toLowerCase()
        result = result.filter(f => f.title.toLowerCase().includes(q))
      }
      return result as CatalogFilm[]
    }
    if (mode === 'rec') {
      if (debouncedQuery) {
        const q = debouncedQuery.toLowerCase()
        return recEnrichedFilms.filter(f => f.title.toLowerCase().includes(q))
      }
      return recEnrichedFilms
    }
    // new releases
    if (debouncedQuery) return pageFilms
    return indexFilms ?? pageFilms
  }, [mode, networkFilms, lensFriend, recEnrichedFilms, debouncedQuery, indexFilms, pageFilms])

  // ── Client-side filtering — instant, no network ─────────────────────────────
  const filteredFilms = useMemo(() => {
    let result = allFilms
    // Media type
    if (mediaType !== 'both') result = result.filter(f => f.kind === mediaType)
    // Genre
    if (activeKeyword) {
      const kw = activeKeyword.toLowerCase()
      result = result.filter(f =>
        (f.aiGenres as string[]).some(g => g.toLowerCase().includes(kw))
      )
    } else if (activeGroup) {
      const group = GENRE_GROUPS.find(g => g.label === activeGroup)
      if (group) {
        const tmdbSet = new Set(group.tmdb as readonly string[])
        const kwList  = (group.keywords as readonly string[]).map(k => k.toLowerCase())
        result = result.filter(f => {
          const matchesTmdb = (f.genres as string[]).some(g => tmdbSet.has(g))
          const matchesKw   = (f.aiGenres as string[]).some(g => kwList.some(k => g.toLowerCase().includes(k)))
          return matchesTmdb || matchesKw
        })
      }
    }
    return result
  }, [allFilms, mediaType, activeGroup, activeKeyword])

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [mediaType, activeGroup, activeKeyword])

  const undismissedFilms = useMemo(
    () => dismissedIds.size > 0 ? filteredFilms.filter(f => !dismissedIds.has(f.id)) : filteredFilms,
    [filteredFilms, dismissedIds]
  )

  const visibleFilms = undismissedFilms.slice(0, visibleCount)
  const hasMore      = visibleCount < undismissedFilms.length

  const loadMore = () => {
    setLoadingMore(true)
    // Small artificial delay so the button feel snappy (data is already local)
    setTimeout(() => { setVisibleCount(v => v + PAGE_SIZE); setLoadingMore(false) }, 50)
  }

  const handleLibraryChange = (filmId: string, status: CatalogFilm['libraryStatus']) => {
    setPageFilms(prev  => prev.map(f => f.id === filmId ? { ...f, libraryStatus: status } : f))
    setIndexFilms(prev => prev ? prev.map(f => f.id === filmId ? { ...f, libraryStatus: status } : f) : prev)
    setNetworkFilms(prev => prev.map(f => f.id === filmId ? { ...f, libraryStatus: status } : f))
    if (selectedFilm?.id === filmId) setSelectedFilm(prev => prev ? { ...prev, libraryStatus: status } : prev)
  }

  const handleQuickAction = useCallback((
    action: 'watched' | 'watchlist' | 'dismissed',
    filmId: string,
    extra?: { stars?: number; reason?: string }
  ) => {
    if (action === 'dismissed') {
      setDismissedIds(prev => new Set([...prev, filmId]))
    } else {
      const newStatus: CatalogFilm['libraryStatus'] = action === 'watched'
        ? { list: 'watched', my_stars: extra?.stars ?? null }
        : { list: 'watchlist', my_stars: null }
      handleLibraryChange(filmId, newStatus)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── On-demand panel enrichment ──────────────────────────────────────────────
  // Films from the lean index don't carry dimBreakdown or synopsis.
  // When one is selected, fetch the full panel data and patch selectedFilm in place.
  useEffect(() => {
    if (!selectedFilm) return
    // Already has panel data (initial 60) — nothing to do
    if (selectedFilm.dimBreakdown && selectedFilm.dimBreakdown.length > 0) return
    // Also skip if synopsis is already present (partial enrichment)
    if (selectedFilm.synopsis != null) return

    let cancelled = false
    fetch(`/api/films/${selectedFilm.id}/panel`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setSelectedFilm(prev =>
          prev?.id === selectedFilm.id ? { ...prev, ...data } : prev
        )
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [selectedFilm?.id])

  return (
    <AppShell active="films">
      <div style={{ padding: 'clamp(28px,5vw,56px) clamp(16px,5vw,48px) 100px', maxWidth: 1200, margin: '0 auto' }}>

        {/* Friend Lens sticky indicator */}
        {mode === 'network' && lensFriend && (
          <div style={{
            position: 'fixed', top: 52, right: 24, zIndex: 80,
            background: friendColor(lensColorIdx).ink,
            color: '#fff',
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.07em',
            padding: '8px 14px 8px 12px',
            borderRadius: 999,
            boxShadow: `0 2px 16px ${friendColor(lensColorIdx).ink}55, 0 1px 4px rgba(0,0,0,0.18)`,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', flexShrink: 0, display: 'inline-block' }} />
            <span>Lens: {lensFriend.name.split(' ')[0]}</span>
            <button
              onClick={() => { setLensFriend(null) }}
              style={{
                background: 'rgba(255,255,255,0.2)', border: 'none',
                borderRadius: '50%', width: 18, height: 18,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff', fontSize: 11, lineHeight: 1,
                marginLeft: 2, padding: 0,
              }}
            >×</button>
          </div>
        )}

        {/* Friend Lens top banner */}
        {mode === 'network' && lensFriend && (
          <div style={{
            margin: 'clamp(-28px,-5vw,-56px) clamp(-16px,-5vw,-48px) 36px',
            padding: '14px clamp(16px,5vw,48px)',
            background: `linear-gradient(135deg, ${friendColor(lensColorIdx).ink} 0%, ${friendColor(lensColorIdx).ink}cc 100%)`,
            color: '#fff',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', opacity: 0.7, marginBottom: 3 }}>★ FRIEND LENS</div>
              <div style={{ fontFamily: 'var(--serif-display)', fontSize: 16, fontWeight: 500, lineHeight: 1.1 }}>
                {lensFriend.name}&apos;s watches
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, opacity: 0.65, marginTop: 3, letterSpacing: '0.04em' }}>
                films {lensFriend.name.split(' ')[0]} has seen
              </div>
            </div>
            <button
              onClick={() => { setLensFriend(null) }}
              style={{
                marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', border: 'none',
                borderRadius: 999, color: '#fff', cursor: 'pointer',
                fontFamily: 'var(--mono)', fontSize: 9, padding: '6px 12px',
                letterSpacing: '0.06em', flexShrink: 0,
              }}
            >exit lens ×</button>
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ CATALOG</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <h1 className="t-display" style={{ fontSize: 'clamp(28px,4vw,44px)', lineHeight: 1, margin: 0 }}>
              {hasMatchScores
                ? <>cinema, <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--s-ink)' }}>ranked for you.</span></>
                : <>the <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--s-ink)' }}>catalog.</span></>
              }
            </h1>
            {!(mode === 'rec' ? recLoading : loading) && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                {undismissedFilms.length.toLocaleString()} titles
                {indexLoading && !debouncedQuery && mode !== 'rec' && (
                  <span style={{ fontSize: 8, letterSpacing: '0.06em', opacity: 0.5, fontStyle: 'italic' }}>indexing…</span>
                )}
              </div>
            )}
          </div>
          {!hasMatchScores && !loading && (
            <p style={{ marginTop: 10, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>
              rate more films & shows to unlock your personal match scores.
            </p>
          )}
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="search by title…"
            style={{
              flex: '1 1 200px', padding: '8px 14px', borderRadius: 999,
              border: '0.5px solid var(--paper-edge)', background: 'var(--bone)',
              fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink)',
              outline: 'none', minWidth: 0,
            }}
          />

          {/* Media type: Films | TV | Both */}
          <div style={{ display: 'flex', gap: 0, background: 'var(--paper-2)', borderRadius: 999, padding: 2, flexShrink: 0 }}>
            {([
              { key: 'both'  as MediaType, label: 'all' },
              { key: 'movie' as MediaType, label: 'films' },
              { key: 'tv'    as MediaType, label: 'TV' },
            ]).map(opt => (
              <button
                key={opt.key}
                onClick={() => setMediaType(opt.key)}
                style={{
                  padding: '6px 14px', borderRadius: 999, cursor: 'pointer', border: 'none',
                  background: mediaType === opt.key ? 'var(--ink)' : 'transparent',
                  color: mediaType === opt.key ? 'var(--paper)' : 'var(--ink-3)',
                  fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em',
                  textTransform: 'uppercase', transition: 'all 120ms',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* New Releases + Recommended toggles */}
          {(['new', 'rec'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(mode === m ? 'network' : m); setLensFriend(null) }}
              style={{
                padding: '6px 14px', borderRadius: 999, cursor: 'pointer', flexShrink: 0,
                border: mode === m ? 'none' : '0.5px solid var(--paper-edge)',
                background: mode === m ? 'var(--ink)' : 'var(--paper-2)',
                color: mode === m ? 'var(--paper)' : 'var(--ink-3)',
                fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em',
                textTransform: 'uppercase', transition: 'all 120ms',
              }}
            >
              {m === 'new' ? 'new releases' : 'recommended'}
            </button>
          ))}

          {/* Friend Lens — only in default (network) mode */}
          {mode === 'network' && (
          <div ref={lensRef} style={{ position: 'relative', flexShrink: 0 }}>
            {lensFriend ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 0,
                border: `1.5px solid ${friendColor(lensColorIdx).ink}`,
                borderRadius: 999, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '7px 14px',
                  background: friendColor(lensColorIdx).ink,
                  fontFamily: 'var(--mono)', fontSize: 10,
                  color: '#fff', letterSpacing: '0.07em', fontWeight: 600,
                }}>
                  ★ {lensFriend.name.split(' ')[0]}
                </div>
                <button
                  onClick={() => { setLensFriend(null) }}
                  style={{
                    background: friendColor(lensColorIdx).tint, border: 'none',
                    padding: '7px 11px', cursor: 'pointer',
                    color: friendColor(lensColorIdx).ink, fontSize: 13, lineHeight: 1,
                  }}
                >×</button>
              </div>
            ) : (
              <NetworkLensButton open={lensOpen} onClick={() => setLensOpen(o => !o)} />
            )}

            {/* Friend picker dropdown */}
            {lensOpen && mode === 'network' && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  minWidth: 220, zIndex: 100,
                  background: 'var(--paper)', border: '0.5px solid var(--paper-edge)',
                  borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '10px 16px 8px', borderBottom: '0.5px solid var(--paper-edge)', fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    filter to one friend
                  </div>
                  {networkFriends.length === 0 ? (
                    <div style={{ padding: '14px 16px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>no friends yet</div>
                  ) : networkFriends.map((f, i) => {
                    const color = friendColor(i)
                    const count = networkFilms.filter(film => film.watchers.some((w: NetworkWatcher) => w.id === f.id)).length
                    return (
                      <button
                        key={f.id}
                        onClick={() => { setLensFriend(f); setLensColorIdx(i); setLensOpen(false) }}
                        style={{
                          width: '100%', textAlign: 'left',
                          padding: '11px 16px',
                          border: 'none',
                          borderBottom: i < networkFriends.length - 1 ? '0.5px solid var(--paper-edge)' : 'none',
                          background: 'none', cursor: 'pointer',
                          fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500,
                          color: 'var(--ink)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                          transition: 'background 120ms',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = color.tint }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color.ink, flexShrink: 0, display: 'inline-block' }} />
                          {f.name}
                        </div>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)' }}>{count}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Genre filter — two-level pills */}
        <div style={{ marginBottom: 24 }}>
          {/* Row 1: broad category pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: activeGroup ? 10 : 0 }}>
            {GENRE_GROUPS.map(group => {
              const isActive = activeGroup === group.label
              return (
                <button
                  key={group.label}
                  onClick={() => {
                    if (isActive) { setActiveGroup(null); setActiveKeyword(null) }
                    else { setActiveGroup(group.label); setActiveKeyword(null) }
                  }}
                  style={{
                    padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
                    border: isActive ? 'none' : '0.5px solid var(--paper-edge)',
                    background: isActive ? 'var(--ink)' : 'var(--paper-2)',
                    color: isActive ? 'var(--paper)' : 'var(--ink-3)',
                    fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em',
                    textTransform: 'uppercase', transition: 'all 100ms',
                  }}
                >
                  {group.label}
                </button>
              )
            })}
            {activeGroup && (
              <button
                onClick={() => { setActiveGroup(null); setActiveKeyword(null) }}
                style={{
                  padding: '6px 10px', borderRadius: 999, cursor: 'pointer',
                  border: 'none', background: 'none',
                  fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)',
                }}
              >×</button>
            )}
          </div>

          {/* Row 2: subgenre keyword chips — only shown when a broad group is selected */}
          {activeGroup && (() => {
            const group = GENRE_GROUPS.find(g => g.label === activeGroup)
            if (!group) return null
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 2 }}>
                {group.keywords.map(kw => {
                  const isActive = activeKeyword === kw
                  return (
                    <button
                      key={kw}
                      onClick={() => setActiveKeyword(isActive ? null : kw)}
                      style={{
                        padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                        border: isActive ? 'none' : '0.5px solid var(--paper-edge)',
                        background: isActive ? 'var(--s-ink)' : 'transparent',
                        color: isActive ? '#fff' : 'var(--ink-4)',
                        fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.06em',
                        transition: 'all 80ms',
                      }}
                    >
                      {kw}
                    </button>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Grid */}
        {(mode === 'network' ? networkLoading : mode === 'rec' ? recLoading : loading) ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <LetterLoader label="loading" />
          </div>
        ) : mode === 'network' && networkFriends.length === 0 ? (
          <div style={{ maxWidth: 400, marginTop: 24 }}>
            <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', lineHeight: 1.6, margin: '0 0 20px' }}>
              add a friend to fill up your catalog — you&apos;ll see everything they&apos;ve watched, ranked for your taste.
            </p>
            <button
              onClick={() => router.push('/friends')}
              className="btn"
              style={{ padding: '11px 22px', fontSize: 13, borderRadius: 999 }}
            >
              add a friend &rarr;
            </button>
          </div>
        ) : undismissedFilms.length === 0 ? (
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
            {mode === 'network' && lensFriend
              ? `${lensFriend.name.split(' ')[0]} hasn't logged anything yet.`
              : mode === 'network'
                ? "your friends haven't logged any films yet."
              : mode === 'rec'
                ? 'no recommendations yet. ask a friend to send you something.'
                : activeGroup || activeKeyword
                  ? 'no titles match this genre filter.'
                  : mode === 'new'
                    ? 'no recent releases found.'
                    : 'no titles found.'}
          </p>
        ) : mode === 'rec' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 16,
          }}>
            {(undismissedFilms as RecCatalogFilm[]).map(film => (
              <div key={film.id}>
                <FilmCard film={film} onClick={() => setSelectedFilm(film)} onQuickAction={handleQuickAction} />
                <div style={{
                  fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--ink-4)',
                  marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  from {film.recSenders.map(s => s.name).join(', ')}
                </div>
                {film.recSenders[0]?.note && (
                  <div style={{
                    fontSize: 9, fontFamily: 'var(--serif-italic)', fontStyle: 'italic',
                    color: 'var(--ink-4)', marginTop: 1, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    &ldquo;{film.recSenders[0].note}&rdquo;
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Top picks — larger hero row (first 4, only when match scores exist) */}
            {hasMatchScores && visibleFilms.length > 0 && (
              <>
                <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.10em', marginBottom: 12 }}>
                  ★ TOP PICKS FOR YOU
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 18, marginBottom: 32,
                }}>
                  {visibleFilms.slice(0, 4).map(film => {
                    const nf = mode === 'network' ? film as NetworkCatalogFilm : null
                    const fr = lensFriend ? nf?.watchers?.find(w => w.id === lensFriend.id)?.stars ?? null : undefined
                    const attribution = (mode === 'network' && !lensFriend && nf?.watchers?.length)
                      ? nf.watchers.slice(0, 3).map(w => w.stars != null ? `${w.name.split(' ')[0]} ${w.stars}★` : w.name.split(' ')[0]).join(' · ')
                      : null
                    return (
                      <div key={film.id}>
                        <FilmCard film={film} onClick={() => setSelectedFilm(film)} large onQuickAction={handleQuickAction} friendRating={fr} friendName={lensFriend?.name} />
                        {attribution && <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--ink-4)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attribution}</div>}
                      </div>
                    )
                  })}
                </div>
                {visibleFilms.length > 4 && (
                  <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.10em', marginBottom: 12 }}>
                    MORE
                  </div>
                )}
              </>
            )}

            {/* Regular grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 16,
            }}>
              {(hasMatchScores ? visibleFilms.slice(4) : visibleFilms).map(film => {
                const nf = mode === 'network' ? film as NetworkCatalogFilm : null
                const fr = lensFriend ? nf?.watchers?.find(w => w.id === lensFriend.id)?.stars ?? null : undefined
                const attribution = (mode === 'network' && !lensFriend && nf?.watchers?.length)
                  ? nf.watchers.slice(0, 3).map(w => w.stars != null ? `${w.name.split(' ')[0]} ${w.stars}★` : w.name.split(' ')[0]).join(' · ')
                  : null
                return (
                  <div key={film.id}>
                    <FilmCard film={film} onClick={() => setSelectedFilm(film)} onQuickAction={handleQuickAction} friendRating={fr} friendName={lensFriend?.name} />
                    {attribution && <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--ink-4)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attribution}</div>}
                  </div>
                )
              })}
            </div>

            {hasMore && (
              <div style={{ marginTop: 36, textAlign: 'center' }}>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{
                    background: 'none', border: '0.5px solid var(--ink-3)', borderRadius: 999,
                    padding: '10px 24px', cursor: 'pointer', fontFamily: 'var(--mono)',
                    fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.08em',
                    opacity: loadingMore ? 0.5 : 1, transition: 'all 120ms',
                  }}
                >
                  {loadingMore ? 'loading…' : `show more (${undismissedFilms.length - visibleCount} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Film panel */}
      {selectedFilm && (
        <FilmPanel
          film={selectedFilm}
          onClose={() => setSelectedFilm(null)}
          onLibraryChange={handleLibraryChange}
        />
      )}
    </AppShell>
  )
}
