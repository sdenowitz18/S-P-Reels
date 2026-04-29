'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { FilmDetailPanel } from '@/components/film-detail-panel'
import { LibraryEntry, ReflectionResult, posterUrl } from '@/lib/types'
import Image from 'next/image'

interface EntryDetail {
  entry: LibraryEntry
  reflection: ReflectionResult | null
}

type KindFilter = 'all' | 'movie' | 'tv'
type SortBy = 'added' | 'rating' | 'year' | 'title'

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
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<EntryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Filters
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [filterRating, setFilterRating] = useState('')
  const [filterDecade, setFilterDecade] = useState('')
  const [filterGenre, setFilterGenre] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('added')

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
        setDetail(prev => prev ? { ...prev, reflection: data.reflection ?? null } : null)
      }
    } catch {}
    setDetailLoading(false)
  }

  const handleUpdate = (updated: LibraryEntry) => {
    setEntries(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
    setDetail(prev => prev ? { ...prev, entry: { ...prev.entry, ...updated } } : null)
  }

  // Derived filter options
  const hasBothKinds = useMemo(() => {
    const kinds = new Set(entries.map(e => e.film?.kind).filter(Boolean))
    return kinds.has('movie') && kinds.has('tv')
  }, [entries])

  const allGenres = useMemo(() => {
    const genreSet = new Map<string, number>()
    entries.forEach(e => {
      const genres = e.film?.ai_brief?.genres
      if (genres) genres.forEach(g => genreSet.set(g, (genreSet.get(g) ?? 0) + 1))
    })
    return [...genreSet.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g)
  }, [entries])

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

    if (filterGenre) {
      result = result.filter(e => e.film?.ai_brief?.genres?.includes(filterGenre) ?? false)
    }

    result = [...result]
    if (sortBy === 'rating') result.sort((a, b) => (b.my_stars ?? -1) - (a.my_stars ?? -1))
    else if (sortBy === 'year') result.sort((a, b) => (b.film?.year ?? 0) - (a.film?.year ?? 0))
    else if (sortBy === 'title') result.sort((a, b) => (a.film?.title ?? '').localeCompare(b.film?.title ?? ''))

    return result
  }, [entries, kindFilter, filterRating, filterDecade, filterGenre, sortBy])

  const isFiltered = kindFilter !== 'all' || filterRating || filterDecade || filterGenre || sortBy !== 'added'

  const clearFilters = () => {
    setKindFilter('all')
    setFilterRating('')
    setFilterDecade('')
    setFilterGenre('')
    setSortBy('added')
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
          onUpdate={handleUpdate}
        />
      )}

      <div style={{ padding: '56px 64px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ THE REEL</div>
            <h1 className="t-display" style={{ fontSize: 52, lineHeight: 1, margin: 0 }}>
              everything you've <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>watched</span>.
              {entries.length > 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 400, color: 'var(--ink-3)', marginLeft: 16 }}>{entries.length}</span>}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-soft" onClick={() => router.push('/import')} style={{ padding: '11px 20px', fontSize: 13, borderRadius: 999 }}>
              import from letterboxd
            </button>
            <button className="btn" onClick={() => router.push('/add')} style={{ padding: '11px 20px', fontSize: 13, borderRadius: 999 }}>
              + log a film
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {!loading && entries.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, flexWrap: 'wrap',
          }}>
            {/* Kind tabs — only shown if library has both */}
            {hasBothKinds && (
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
            )}

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

            {allGenres.length > 0 && (
              <FilterSelect value={filterGenre} onChange={setFilterGenre}>
                <option value="">genre</option>
                {allGenres.map(g => (
                  <option key={g} value={g}>{g}</option>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '32px 18px' }}>
            {filtered.map(entry => (
              <FilmCard key={entry.id} entry={entry} onClick={() => openDetail(entry)} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
