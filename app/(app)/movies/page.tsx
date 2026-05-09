'use client'
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/app-shell'
import { FilmDetailPanel } from '@/components/film-detail-panel'
import { LibraryEntry, ReflectionResult, posterUrl } from '@/lib/types'
import { fetcher } from '@/lib/fetcher'
import { useIsMobile } from '@/lib/use-is-mobile'
import useSWR from 'swr'
import { LetterLoader } from '@/components/letter-loader'
import { GENRE_GROUPS } from '@/lib/genre-groups'
import type { TasteCode } from '@/lib/taste-code'

interface LibraryData { watched: LibraryEntry[]; nowPlaying: LibraryEntry[]; watchlist: LibraryEntry[] }

interface EntryDetail {
  entry: LibraryEntry
  reflection: ReflectionResult | null
}

type KindFilter = 'all' | 'movie' | 'tv'
type SortBy = 'added' | 'rating' | 'year' | 'title'

interface Friend { id: string; name: string }
interface LensData {
  seenFilmIds: Record<string, number | null>
  tasteCode: TasteCode | null
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

function projectMatchScore(
  dimsV2: Record<string, number>,
  tasteCode: TasteCode
): number | null {
  const { entries } = tasteCode
  if (!entries.length) return null
  let total = 0, count = 0
  for (const e of entries) {
    const v = dimsV2[e.dimKey]
    if (v == null) continue
    const alignment = e.pole === 'right' ? v / 100 : (100 - v) / 100
    total += alignment
    count++
  }
  if (!count) return null
  return Math.min(99, Math.round((total / count) * 99))
}

const LensButton = forwardRef<HTMLButtonElement, {
  loading: boolean; open: boolean; onClick: () => void
}>(function LensButton({ loading, open, onClick }, ref) {
  const [tooltipVisible, setTooltipVisible] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={ref}
        onClick={onClick}
        disabled={loading}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        style={{
          padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
          border: 'none',
          background: open
            ? 'var(--ink)'
            : 'linear-gradient(135deg, #c25a2a 0%, #8a5a9a 100%)',
          fontFamily: 'var(--mono)', fontSize: 10,
          color: '#fff', letterSpacing: '0.07em', fontWeight: 600,
          opacity: loading ? 0.55 : 1,
          transition: 'all 150ms',
          boxShadow: open ? 'none' : '0 2px 10px rgba(194,90,42,0.3)',
        }}
      >
        {loading ? '★ loading…' : '★ Friend Lens'}
      </button>
      {tooltipVisible && !open && !loading && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--ink)', color: 'var(--paper)',
          borderRadius: 8, padding: '8px 12px',
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.04em',
          whiteSpace: 'nowrap', zIndex: 200, lineHeight: 1.5,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>★ Friend Lens</div>
          <div style={{ opacity: 0.7 }}>overlay a friend&apos;s ratings &amp; taste onto your list</div>
        </div>
      )}
    </div>
  )
})

interface LensBadgeData {
  seen: boolean
  stars?: number | null
  score?: number | null
}

function FilmCard({ entry, onClick, lensMode = false, lensBadge, onRecommend, lensInkColor }: {
  entry: LibraryEntry
  onClick: () => void
  lensMode?: boolean
  lensBadge?: LensBadgeData
  onRecommend?: () => Promise<void>
  lensInkColor?: string
}) {
  const film = entry.film
  const poster = film ? posterUrl(film.poster_path, 'w342') : null
  const [hovered, setHovered] = useState(false)
  const [recommending, setRecommending] = useState(false)
  const [recommended, setRecommended] = useState(false)

  const handleRecommend = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (recommending || recommended || !onRecommend) return
    setRecommending(true)
    try {
      await onRecommend()
      setRecommended(true)
    } finally {
      setRecommending(false)
    }
  }

  const posterBorder = lensMode && lensInkColor
    ? `1.5px solid ${lensInkColor}55`
    : '0.5px solid var(--paper-edge)'

  return (
    <button onClick={onClick} style={{
      textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none', padding: 0,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div
        style={{
          width: '100%', aspectRatio: '2/3', borderRadius: 6, overflow: 'hidden',
          background: 'var(--paper-2)', border: posterBorder,
          position: 'relative', transition: 'opacity 120ms, box-shadow 120ms',
          opacity: !lensMode && hovered ? 0.85 : 1,
          boxShadow: lensMode && lensInkColor ? `0 0 0 1px ${lensInkColor}22` : undefined,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {poster
          ? <Image src={poster} alt={film?.title ?? ''} fill style={{ objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--ink-4)', fontFamily: 'var(--mono)', textAlign: 'center', padding: 8 }}>{film?.title?.toUpperCase()}</div>
        }

        {/* Normal star badge */}
        {!lensMode && entry.my_stars && (
          <div style={{ position: 'absolute', bottom: 6, left: 7, background: 'rgba(24,22,18,0.75)', borderRadius: 4, padding: '2px 6px', fontFamily: 'var(--mono)', fontSize: 9, color: '#f5e6c8', letterSpacing: '0.05em' }}>
            {entry.my_stars}★
          </div>
        )}

        {/* Lens badge — top-right, prominent */}
        {lensMode && lensBadge && !hovered && (
          <div style={{
            position: 'absolute', top: 5, right: 5,
            background: lensBadge.seen ? 'rgba(10,8,4,0.88)' : 'rgba(8,28,14,0.88)',
            backdropFilter: 'blur(4px)',
            borderRadius: 5, padding: '4px 7px',
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
            color: lensBadge.seen ? '#f5d97a' : '#7fe09c',
            letterSpacing: '0.02em', lineHeight: 1,
            boxShadow: '0 1px 6px rgba(0,0,0,0.35)',
          }}>
            {lensBadge.seen
              ? (lensBadge.stars ? `${lensBadge.stars}★` : '✓ seen')
              : (lensBadge.score != null ? `${lensBadge.score}% match` : '—')
            }
          </div>
        )}

        {/* Lens hover overlay: recommend button */}
        {lensMode && hovered && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.78)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '14px 12px', gap: 8,
            }}
          >
            {/* Show the badge in hover state too */}
            {lensBadge && (
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                color: lensBadge.seen ? '#f5d97a' : '#7fe09c',
                letterSpacing: '0.03em', marginBottom: 4,
              }}>
                {lensBadge.seen
                  ? (lensBadge.stars ? `they gave it ${lensBadge.stars}★` : 'they\'ve seen it')
                  : (lensBadge.score != null ? `${lensBadge.score}% predicted match` : 'not seen')
                }
              </div>
            )}
            {recommended ? (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#7fe09c', letterSpacing: '0.06em', textAlign: 'center' }}>
                ✓ sent!
              </div>
            ) : (
              <button
                onClick={handleRecommend}
                disabled={recommending}
                style={{
                  background: lensInkColor ?? 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: 6, color: '#fff', cursor: 'pointer',
                  fontFamily: 'var(--mono)', fontSize: 10,
                  letterSpacing: '0.07em', padding: '8px 14px',
                  opacity: recommending ? 0.5 : 1,
                  width: '100%', textAlign: 'center',
                  transition: 'opacity 100ms',
                  fontWeight: 600,
                }}
              >
                {recommending ? '…' : '★ recommend'}
              </button>
            )}
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

const SELECT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 10,
  letterSpacing: '0.06em',
  color: 'var(--ink-2)',
  background: 'var(--paper-2)',
  border: '0.5px solid var(--paper-edge)',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  paddingRight: 24,
  outline: 'none',
}

function FilterSelect({ value, onChange, children }: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={SELECT_STYLE}>
        {children}
      </select>
      <span style={{
        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', fontSize: 8, color: 'var(--ink-4)',
      }}>▾</span>
    </div>
  )
}

export default function MoviesPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { data, mutate } = useSWR<LibraryData>('/api/library', fetcher)
  const entries: LibraryEntry[] = data?.watched ?? []
  const loading = !data
  const [detail, setDetail] = useState<EntryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Pulse the Lens button when arriving from a Friend Lens recommendation notification
  const lensButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('from') === 'friend_lens') {
      const t = setTimeout(() => {
        lensButtonRef.current?.classList.add('lens-pulse')
        lensButtonRef.current?.addEventListener('animationend', () => {
          lensButtonRef.current?.classList.remove('lens-pulse')
        }, { once: true })
      }, 400)
      return () => clearTimeout(t)
    }
  }, [])

  // Filters
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [filterRating, setFilterRating] = useState('')
  const [filterDecade, setFilterDecade] = useState('')
  const [filterGenre, setFilterGenre] = useState('')
  const [filterRewatch, setFilterRewatch] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('added')
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null)

  // Friend Lens state
  const [lensDropdownOpen, setLensDropdownOpen] = useState(false)
  const [lensActive, setLensActive] = useState(false)
  const [lensFriend, setLensFriend] = useState<Friend | null>(null)
  const [lensColorIdx, setLensColorIdx] = useState(0)
  const [lensData, setLensData] = useState<LensData | null>(null)
  const [lensLoading, setLensLoading] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendsLoaded, setFriendsLoaded] = useState(false)
  const lensRef = useRef<HTMLDivElement>(null)

  // Load friends list when dropdown first opens
  useEffect(() => {
    if (!lensDropdownOpen || friendsLoaded) return
    fetch('/api/friends')
      .then(r => r.json())
      .then(d => { setFriends(d.friends ?? []); setFriendsLoaded(true) })
      .catch(() => setFriendsLoaded(true))
  }, [lensDropdownOpen, friendsLoaded])

  // Close dropdown on outside click
  useEffect(() => {
    if (!lensDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (lensRef.current && !lensRef.current.contains(e.target as Node)) {
        setLensDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [lensDropdownOpen])

  const activateLens = async (friend: Friend, colorIdx: number) => {
    setLensDropdownOpen(false)
    setLensFriend(friend)
    setLensColorIdx(colorIdx)
    setLensLoading(true)
    try {
      const res = await fetch(`/api/friends/${friend.id}/lens-data`)
      if (res.ok) {
        const d = await res.json()
        setLensData(d)
        setLensActive(true)
      }
    } finally {
      setLensLoading(false)
    }
  }

  const deactivateLens = () => {
    setLensActive(false)
    setLensFriend(null)
    setLensData(null)
  }

  const recommendFilm = async (filmId: string): Promise<void> => {
    if (!lensFriend) return
    const res = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filmId: String(filmId), toUserId: lensFriend.id, note: '', source: 'friend_lens' }),
    })
    if (!res.ok) throw new Error('recommend failed')
  }

  const getLensBadge = (entry: LibraryEntry): LensBadgeData | undefined => {
    if (!lensActive || !lensData) return undefined
    if (Object.prototype.hasOwnProperty.call(lensData.seenFilmIds, entry.film_id)) {
      return { seen: true, stars: lensData.seenFilmIds[entry.film_id] }
    }
    const dimsV2 = entry.film?.dimensions_v2 as Record<string, number> | null | undefined
    if (lensData.tasteCode && dimsV2) {
      return { seen: false, score: projectMatchScore(dimsV2, lensData.tasteCode) }
    }
    return { seen: false, score: null }
  }

  const openDetail = async (entry: LibraryEntry) => {
    setDetailLoading(true)
    setDetail({ entry, reflection: null })
    try {
      const res = await fetch(`/api/library/${entry.id}/reflection`)
      if (res.ok) {
        const d = await res.json()
        setDetail(prev => prev ? { ...prev, reflection: d.reflection ?? null } : null)
      }
    } catch {}
    setDetailLoading(false)
  }

  const handleUpdate = (updated: LibraryEntry) => {
    mutate(d => d ? { ...d, watched: d.watched.map((e: LibraryEntry) => e.id === updated.id ? { ...e, ...updated } : e) } : d, false)
    setDetail(prev => prev ? { ...prev, entry: { ...prev.entry, ...updated } } : null)
  }

  const allDecades = useMemo(() => {
    const decades = new Set<number>()
    entries.forEach(e => {
      if (e.film?.year) decades.add(Math.floor(e.film.year / 10) * 10)
    })
    return [...decades].sort((a, b) => b - a)
  }, [entries])

  const filtered = useMemo(() => {
    let result = entries

    if (kindFilter !== 'all') result = result.filter(e => e.film?.kind === kindFilter)

    if (filterRating === 'rated') {
      result = result.filter(e => e.my_stars != null)
    } else if (filterRating) {
      const min = parseFloat(filterRating)
      result = result.filter(e => e.my_stars != null && e.my_stars >= min)
    }

    if (filterDecade) {
      const decade = parseInt(filterDecade)
      result = result.filter(e => e.film?.year != null && e.film.year >= decade && e.film.year < decade + 10)
    }

    if (filterRewatch) result = result.filter(e => e.rewatch === true)

    if (activeKeyword) {
      const kw = activeKeyword.toLowerCase()
      result = result.filter(e => {
        const aiGenres: string[] = (e.film?.ai_brief?.genres ?? []) as string[]
        return aiGenres.some(g => g.toLowerCase().includes(kw))
      })
    } else if (activeGroup) {
      const group = GENRE_GROUPS.find(g => g.label === activeGroup)
      if (group) {
        const tmdbSet = new Set(group.tmdb as readonly string[])
        const kwList = (group.keywords as readonly string[]).map(k => k.toLowerCase())
        result = result.filter(e => {
          const tmdbGenres: string[] = (e.film?.tmdb_genres ?? []) as string[]
          const aiGenres: string[] = (e.film?.ai_brief?.genres ?? []) as string[]
          const matchesTmdb = tmdbGenres.some(g => tmdbSet.has(g))
          const matchesKw = aiGenres.some(g => kwList.some(k => g.toLowerCase().includes(k)))
          return matchesTmdb || matchesKw
        })
      }
    } else if (filterGenre) {
      result = result.filter(e => e.film?.ai_brief?.genres?.includes(filterGenre) ?? false)
    }

    result = [...result]
    if (sortBy === 'rating') result.sort((a, b) => (b.my_stars ?? -1) - (a.my_stars ?? -1))
    else if (sortBy === 'year') result.sort((a, b) => (b.film?.year ?? 0) - (a.film?.year ?? 0))
    else if (sortBy === 'title') result.sort((a, b) => (a.film?.title ?? '').localeCompare(b.film?.title ?? ''))

    return result
  }, [entries, kindFilter, filterRating, filterDecade, filterGenre, filterRewatch, activeGroup, activeKeyword, sortBy])

  const isFiltered = kindFilter !== 'all' || filterRating || filterDecade || filterGenre || filterRewatch || activeGroup || activeKeyword || sortBy !== 'added'

  const clearFilters = () => {
    setKindFilter('all')
    setFilterRating('')
    setFilterDecade('')
    setFilterGenre('')
    setFilterRewatch(false)
    setSortBy('added')
    setActiveGroup(null)
    setActiveKeyword(null)
  }

  const lensColor = friendColor(lensColorIdx)

  return (
    <AppShell active="movies">
      {detail && (
        <FilmDetailPanel
          entry={detail.entry}
          list="watched"
          reflection={detail.reflection}
          onClose={() => setDetail(null)}
          onRemove={() => mutate(d => d ? { ...d, watched: d.watched.filter((e: LibraryEntry) => e.id !== detail.entry.id) } : d, false)}
          onUpdate={handleUpdate}
        />
      )}

      <div style={{ padding: isMobile ? '28px 16px 96px' : '56px 64px', maxWidth: 1200, margin: '0 auto' }}>

        {/* Lens mode sticky indicator — fixed below nav, top-right */}
        {lensActive && lensFriend && (
          <div style={{
            position: 'fixed', top: 52, right: 24, zIndex: 80,
            background: lensColor.ink,
            color: '#fff',
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.07em',
            padding: '8px 14px 8px 12px',
            borderRadius: 999,
            boxShadow: `0 2px 16px ${lensColor.ink}55, 0 1px 4px rgba(0,0,0,0.18)`,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', flexShrink: 0, display: 'inline-block' }} />
            <span>Lens: {lensFriend.name.split(' ')[0]}</span>
            <button
              onClick={deactivateLens}
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

        {/* Lens mode top banner */}
        {lensActive && lensFriend && (
          <div style={{
            margin: isMobile ? '-28px -16px 28px' : '-56px -64px 36px',
            padding: isMobile ? '14px 16px' : '14px 64px',
            background: `linear-gradient(135deg, ${lensColor.ink} 0%, ${lensColor.ink}cc 100%)`,
            color: '#fff',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', opacity: 0.7, marginBottom: 3 }}>★ FRIEND LENS</div>
              <div style={{ fontFamily: 'var(--serif-display)', fontSize: 16, fontWeight: 500, lineHeight: 1.1 }}>
                {lensFriend.name}&apos;s perspective
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, opacity: 0.65, marginTop: 3, letterSpacing: '0.04em' }}>
                gold = they&apos;ve seen it · green % = predicted match from their taste
              </div>
            </div>
            <button
              onClick={deactivateLens}
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
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'flex-start', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', marginBottom: 32, gap: isMobile ? 16 : 0 }}>
          <div>
            <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ THE REEL</div>
            <h1 className="t-display" style={{ fontSize: isMobile ? 36 : 52, lineHeight: 1, margin: 0 }}>
              everything you&apos;ve <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>watched</span>.
              {entries.length > 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: isMobile ? 14 : 18, fontWeight: 400, color: 'var(--ink-3)', marginLeft: 16 }}>{entries.length}</span>}
            </h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, paddingTop: isMobile ? 0 : 4 }}>
            {/* Action buttons row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!isMobile && (
                <button
                  onClick={() => router.push('/import')}
                  style={{
                    padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
                    border: '0.5px solid var(--paper-edge)', background: 'var(--paper-2)',
                    fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
                    letterSpacing: '0.06em', transition: 'all 120ms',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ink-3)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--paper-edge)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-3)' }}
                >
                  import from letterboxd
                </button>
              )}
              <button
                onClick={() => router.push('/quick-rate')}
                style={{
                  padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
                  border: '0.5px solid var(--paper-edge)', background: 'var(--paper-2)',
                  fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
                  letterSpacing: '0.06em', transition: 'all 120ms',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ink-3)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--paper-edge)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-3)' }}
              >
                ★ quick rate
              </button>
              <button
                onClick={() => router.push('/add')}
                style={{
                  padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
                  border: '0.5px solid var(--paper-edge)', background: 'var(--paper-2)',
                  fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
                  letterSpacing: '0.06em', transition: 'all 120ms',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ink-3)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--paper-edge)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-3)' }}
              >
                + log a film
              </button>
            </div>

            {/* Friend Lens toggle — own row, right-aligned */}
            <div ref={lensRef} style={{ position: 'relative' }}>
              {lensActive ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 0,
                  border: `1.5px solid ${lensColor.ink}`,
                  borderRadius: 999, overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '7px 14px',
                    background: lensColor.ink,
                    fontFamily: 'var(--mono)', fontSize: 10,
                    color: '#fff', letterSpacing: '0.07em', fontWeight: 600,
                  }}>
                    ★ {lensFriend?.name.split(' ')[0]}
                  </div>
                  <button
                    onClick={deactivateLens}
                    style={{
                      background: lensColor.tint, border: 'none',
                      padding: '7px 11px', cursor: 'pointer',
                      color: lensColor.ink, fontSize: 13, lineHeight: 1,
                      fontWeight: 400,
                    }}
                  >×</button>
                </div>
              ) : (
                <LensButton
                  ref={lensButtonRef}
                  loading={lensLoading}
                  open={lensDropdownOpen}
                  onClick={() => setLensDropdownOpen(o => !o)}
                />
              )}

              {/* Friend picker dropdown */}
              {lensDropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  minWidth: 220, zIndex: 100,
                  background: 'var(--paper)', border: '0.5px solid var(--paper-edge)',
                  borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '10px 16px 8px', borderBottom: '0.5px solid var(--paper-edge)', fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    see your list through their eyes
                  </div>
                  {!friendsLoaded ? (
                    <div style={{ padding: '14px 16px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>loading…</div>
                  ) : friends.length === 0 ? (
                    <div style={{ padding: '14px 16px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>no friends yet</div>
                  ) : (
                    friends.map((f, i) => {
                      const color = friendColor(i)
                      return (
                        <button
                          key={f.id}
                          onClick={() => activateLens(f, i)}
                          style={{
                            width: '100%', textAlign: 'left',
                            padding: '11px 16px',
                            border: 'none',
                            borderBottom: i < friends.length - 1 ? '0.5px solid var(--paper-edge)' : 'none',
                            background: 'none', cursor: 'pointer',
                            fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500,
                            color: 'var(--ink)',
                            display: 'flex', alignItems: 'center', gap: 10,
                            transition: 'background 120ms',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = color.tint }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color.ink, flexShrink: 0, display: 'inline-block' }} />
                          {f.name}
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter bar */}
        {!loading && entries.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', border: '0.5px solid var(--paper-edge)', borderRadius: 7, overflow: 'hidden', marginRight: 8 }}>
              {(['all', 'movie', 'tv'] as KindFilter[]).map(k => (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  style={{
                    padding: '6px 12px',
                    fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em',
                    background: kindFilter === k ? 'var(--ink)' : 'var(--paper-2)',
                    color: kindFilter === k ? 'var(--paper)' : 'var(--ink-3)',
                    border: 'none', cursor: 'pointer',
                    borderRight: k !== 'tv' ? '0.5px solid var(--paper-edge)' : 'none',
                  }}
                >
                  {k === 'all' ? 'ALL' : k === 'movie' ? 'FILMS' : 'TV'}
                </button>
              ))}
            </div>

            <button
              onClick={() => setFilterRewatch(v => !v)}
              style={{
                padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                border: filterRewatch ? 'none' : '0.5px solid var(--paper-edge)',
                background: filterRewatch ? 'var(--s-ink)' : 'var(--paper-2)',
                color: filterRewatch ? '#fff' : 'var(--ink-3)',
                fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em',
                textTransform: 'uppercase', transition: 'all 100ms', flexShrink: 0,
              }}
            >
              ↺ rewatchable
            </button>

            <FilterSelect value={filterRating} onChange={setFilterRating}>
              <option value="">rating</option>
              <option value="rated">has rating</option>
              <option value="5">★★★★★ only</option>
              <option value="4.5">★★★★½+</option>
              <option value="4">★★★★+</option>
              <option value="3">★★★+</option>
              <option value="2">★★+</option>
            </FilterSelect>

            {allDecades.length > 1 && (
              <FilterSelect value={filterDecade} onChange={setFilterDecade}>
                <option value="">decade</option>
                {allDecades.map(d => (
                  <option key={d} value={String(d)}>{d}s</option>
                ))}
              </FilterSelect>
            )}

            <FilterSelect value={sortBy} onChange={v => setSortBy(v as SortBy)}>
              <option value="added">recently added</option>
              <option value="rating">highest rated</option>
              <option value="year">newest first</option>
              <option value="title">a → z</option>
            </FilterSelect>

            {isFiltered && (
              <button
                onClick={clearFilters}
                style={{
                  fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em',
                  color: 'var(--ink-4)', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '6px 4px', textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                clear
              </button>
            )}

            {isFiltered && filtered.length !== entries.length && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', marginLeft: 4 }}>
                {filtered.length} of {entries.length}
              </span>
            )}
          </div>
        )}

        {/* Two-level genre filter */}
        {!loading && entries.length > 0 && (
          <div style={{ marginBottom: 24 }}>
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
                  style={{ padding: '6px 10px', borderRadius: 999, cursor: 'pointer', border: 'none', background: 'none', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}
                >×</button>
              )}
            </div>

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
        )}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <LetterLoader label="loading" />
          </div>
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

        {!loading && entries.length > 0 && filtered.length === 0 && (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
              no films match these filters.
            </p>
            <button onClick={clearFilters} style={{ marginTop: 12, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--s-ink)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              clear filters
            </button>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(90px, 1fr))' : 'repeat(auto-fill, minmax(130px, 1fr))', gap: isMobile ? '20px 10px' : '32px 18px' }}>
            {filtered.map(entry => (
              <FilmCard
                key={entry.id}
                entry={entry}
                onClick={() => openDetail(entry)}
                lensMode={lensActive}
                lensBadge={getLensBadge(entry)}
                onRecommend={lensActive ? () => recommendFilm(entry.film_id) : undefined}
                lensInkColor={lensActive ? lensColor.ink : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
