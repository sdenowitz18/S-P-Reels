'use client'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { AppShell } from '@/components/app-shell'
import { FilmPanel, type PanelFilm } from './film-panel'
import { GENRE_GROUPS } from '@/lib/genre-groups'
import { LetterLoader } from '@/components/letter-loader'

interface CatalogFilm extends PanelFilm {
  kind: 'movie' | 'tv'
}

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

function FilmCard({ film, onClick, large = false }: {
  film: CatalogFilm
  onClick: () => void
  large?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
    >
      {/* Poster */}
      <div
        style={{
          width: '100%', aspectRatio: '2/3', borderRadius: large ? 8 : 6, overflow: 'hidden',
          background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
          position: 'relative', marginBottom: large ? 10 : 7,
          boxShadow: large ? '0 4px 16px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'box-shadow 150ms, transform 150ms',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.transform = 'translateY(-2px)'
          el.style.boxShadow = large ? '0 10px 28px rgba(0,0,0,0.18)' : '0 6px 16px rgba(0,0,0,0.14)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.transform = ''
          el.style.boxShadow = large ? '0 4px 16px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.08)'
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
        <LibraryBadge status={film.libraryStatus} />
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

type Mode      = 'all' | 'new'
type MediaType = 'both' | 'movie' | 'tv'


const PAGE_SIZE = 60

export default function FilmCatalogPage() {
  // ── Two-tier state ──────────────────────────────────────────────────────────
  // pageFilms: initial ~60 films (fast first paint, full panel data)
  // indexFilms: full scored catalog for instant genre filtering (loads in bg)
  const [pageFilms, setPageFilms]       = useState<CatalogFilm[]>([])
  const [indexFilms, setIndexFilms]     = useState<CatalogFilm[] | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loading, setLoading]           = useState(true)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [indexLoading, setIndexLoading] = useState(false)
  const [mode, setMode]                 = useState<Mode>('all')
  const [mediaType, setMediaType]       = useState<MediaType>('both')
  const [query, setQuery]               = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeGroup, setActiveGroup]     = useState<string | null>(null)
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null)
  const [hasMatchScores, setHasMatchScores] = useState(false)
  const [selectedFilm, setSelectedFilm]     = useState<CatalogFilm | null>(null)
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageFilmMapRef = useRef<Map<string, CatalogFilm>>(new Map())

  // ── Network fetch ───────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 280)
  }, [query])

  // Re-fetch only when search query or mode changes
  useEffect(() => {
    fetchFilms(debouncedQuery, mode)
  }, [debouncedQuery, mode, fetchFilms])

  // ── Source of truth ─────────────────────────────────────────────────────────
  // While searching: pageFilms (server-side results)
  // While browsing: indexFilms once loaded (all films, instant filters),
  //                 otherwise pageFilms (initial 60, fast first paint)
  const allFilms = useMemo(() => {
    if (debouncedQuery) return pageFilms
    return indexFilms ?? pageFilms
  }, [debouncedQuery, indexFilms, pageFilms])

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

  const visibleFilms = filteredFilms.slice(0, visibleCount)
  const hasMore      = visibleCount < filteredFilms.length

  const loadMore = () => {
    setLoadingMore(true)
    // Small artificial delay so the button feel snappy (data is already local)
    setTimeout(() => { setVisibleCount(v => v + PAGE_SIZE); setLoadingMore(false) }, 50)
  }

  const handleLibraryChange = (filmId: string, status: CatalogFilm['libraryStatus']) => {
    setPageFilms(prev  => prev.map(f => f.id === filmId ? { ...f, libraryStatus: status } : f))
    setIndexFilms(prev => prev ? prev.map(f => f.id === filmId ? { ...f, libraryStatus: status } : f) : prev)
    if (selectedFilm?.id === filmId) setSelectedFilm(prev => prev ? { ...prev, libraryStatus: status } : prev)
  }

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
            {!loading && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                {filteredFilms.length.toLocaleString()} titles
                {indexLoading && !debouncedQuery && (
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

          {/* Mode: All | New Releases */}
          <div style={{ display: 'flex', gap: 0, background: 'var(--paper-2)', borderRadius: 999, padding: 2, flexShrink: 0 }}>
            {([
              { key: 'all' as Mode, label: 'all titles' },
              { key: 'new' as Mode, label: 'new releases' },
            ]).map(opt => (
              <button
                key={opt.key}
                onClick={() => setMode(opt.key)}
                style={{
                  padding: '6px 14px', borderRadius: 999, cursor: 'pointer', border: 'none',
                  background: mode === opt.key ? 'var(--ink)' : 'transparent',
                  color: mode === opt.key ? 'var(--paper)' : 'var(--ink-3)',
                  fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em',
                  textTransform: 'uppercase', transition: 'all 120ms',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
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
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <LetterLoader label="loading" />
          </div>
        ) : filteredFilms.length === 0 ? (
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
            {activeGroup || activeKeyword ? 'no titles match this genre filter.' : mode === 'new' ? 'no recent releases found.' : 'no titles found.'}
          </p>
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
                  {visibleFilms.slice(0, 4).map(film => (
                    <FilmCard key={film.id} film={film} onClick={() => setSelectedFilm(film)} large />
                  ))}
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
              {(hasMatchScores ? visibleFilms.slice(4) : visibleFilms).map(film => (
                <FilmCard key={film.id} film={film} onClick={() => setSelectedFilm(film)} />
              ))}
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
                  {loadingMore ? 'loading…' : `show more (${filteredFilms.length - visibleCount} remaining)`}
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
