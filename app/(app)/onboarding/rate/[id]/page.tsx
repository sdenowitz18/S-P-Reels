'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { CALIBRATION_SEQUENCE } from '@/lib/taste/calibration-films'
import { ALL_POLES } from '@/lib/taste-code'
import type { FilmDimensionsV2 } from '@/lib/prompts/film-brief'

// ── Constants ─────────────────────────────────────────────────────────────────

const DIM_KEYS: (keyof FilmDimensionsV2)[] = [
  'narrative_legibility',
  'emotional_directness',
  'plot_vs_character',
  'naturalistic_vs_stylized',
  'narrative_closure',
  'intimate_vs_epic',
  'accessible_vs_demanding',
  'psychological_safety',
  'moral_clarity',
  'behavioral_realism',
  'sensory_vs_intellectual',
  'kinetic_vs_patient',
]

const ALL_TC_LETTERS = 'LOVSPWCNTQIEFDUHJAXRGMKZ'.split('')

// A dimension is "covered" when ≥2 films on each pole have been rated
const POLE_THRESHOLD    = 40
const MIN_FILMS_PER_POLE = 2

// ── Coverage helpers ──────────────────────────────────────────────────────────

interface DimCoverage {
  covered: boolean
  letter:  string | null
}

function computeCoverage(
  ratings: Record<string, number>,
  films:   typeof CALIBRATION_SEQUENCE,
): Record<string, DimCoverage> {
  const ratedFilms = films.filter(f => (ratings[f.tmdb_id] ?? 0) > 0)

  return Object.fromEntries(
    DIM_KEYS.map(dimKey => {
      const leftFilms  = ratedFilms.filter(f => f.dimensions_v2[dimKey] < POLE_THRESHOLD)
      const rightFilms = ratedFilms.filter(f => f.dimensions_v2[dimKey] > (100 - POLE_THRESHOLD))
      const covered    = leftFilms.length >= MIN_FILMS_PER_POLE && rightFilms.length >= MIN_FILMS_PER_POLE

      let letter: string | null = null
      if (covered) {
        const leftAvg  = leftFilms.reduce((s, f) => s + ratings[f.tmdb_id], 0) / leftFilms.length
        const rightAvg = rightFilms.reduce((s, f) => s + ratings[f.tmdb_id], 0) / rightFilms.length
        const pole     = rightAvg >= leftAvg ? 'right' : 'left'
        letter = ALL_POLES.find(p => p.dimKey === dimKey && p.pole === pole)?.letter ?? null
      }

      return [dimKey, { covered, letter }] as [string, DimCoverage]
    })
  )
}

// ── Letter slot ───────────────────────────────────────────────────────────────

function LetterSlot({
  dimKey,
  coverage,
  flickerLetter,
  justLocked,
  pulse,
}: {
  dimKey:        string
  coverage:      DimCoverage
  flickerLetter: string
  justLocked:    boolean
  pulse?:        boolean
}) {
  const [lockAnim, setLockAnim] = useState(false)

  useEffect(() => {
    if (justLocked && coverage.covered) {
      setLockAnim(true)
      const t = setTimeout(() => setLockAnim(false), 600)
      return () => clearTimeout(t)
    }
  }, [justLocked, coverage.covered])

  const letter = coverage.covered ? (coverage.letter ?? '?') : flickerLetter
  const locked = coverage.covered

  return (
    <div style={{ width: 30, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div style={{
        position:     'absolute',
        inset:        0,
        borderRadius: 5,
        background:   locked ? 'var(--forest-tint, rgba(34,85,51,0.08))' : 'var(--paper-2)',
        border:       locked ? '1px solid var(--forest, #225533)' : '0.5px solid var(--paper-edge)',
        transition:   'all 300ms ease',
        animation:    pulse && locked ? 'slotPulse 1.4s ease-in-out infinite' : undefined,
      }} />
      <span style={{
        position:      'relative',
        fontFamily:    'var(--serif-display)',
        fontSize:      14,
        fontWeight:    700,
        color:         locked ? 'var(--forest, #225533)' : 'var(--ink-4)',
        letterSpacing: '-0.01em',
        transition:    locked ? 'color 300ms ease, transform 300ms ease' : undefined,
        transform:     lockAnim ? 'scale(1.25)' : 'scale(1)',
        display:       'block',
      }}>
        {letter || '·'}
      </span>
    </div>
  )
}

// ── Half-star rating ──────────────────────────────────────────────────────────

const starAnimStyles = `
  @keyframes slideInRight {
    from { transform: translateX(110%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  .film-card-enter {
    animation: slideInRight 320ms cubic-bezier(0.4,0,0.2,1) forwards;
  }
  @keyframes slotPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34,85,51,0.15); }
    50%       { box-shadow: 0 0 0 5px rgba(34,85,51,0.0); }
  }
`

function StarRating({ onRate, disabled }: { onRate: (n: number) => void; disabled: boolean }) {
  const [hovered, setHovered] = useState(0)

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>, n: number) => {
    if (disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x    = e.clientX - rect.left
    setHovered(x < rect.width / 2 ? n - 0.5 : n)
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>, n: number) => {
    if (disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x    = e.clientX - rect.left
    onRate(x < rect.width / 2 ? n - 0.5 : n)
  }

  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => {
        const isFull = hovered >= n
        const isHalf = !isFull && hovered >= n - 0.5

        return (
          <button
            key={n}
            disabled={disabled}
            onMouseMove={e => handleMouseMove(e, n)}
            onMouseLeave={() => setHovered(0)}
            onClick={e => handleClick(e, n)}
            style={{
              background: 'none',
              border:     'none',
              cursor:     disabled ? 'not-allowed' : 'pointer',
              padding:    '6px 3px',
              fontSize:   36,
              lineHeight: 1,
              position:   'relative',
              display:    'flex',
              alignItems: 'center',
            }}
          >
            {/* Empty star base */}
            <span style={{ color: 'var(--paper-edge)', display: 'block' }}>★</span>
            {/* Filled overlay (full or half via clip-path) */}
            {(isFull || isHalf) && (
              <span style={{
                position:  'absolute',
                left:      3,
                top:       6,
                fontSize:  36,
                lineHeight: 1,
                color:     'var(--sun, #d4a847)',
                clipPath:  isHalf ? 'inset(0 50% 0 0)' : 'none',
                pointerEvents: 'none',
              }}>★</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Film card ─────────────────────────────────────────────────────────────────

function FilmCard({
  film,
  filmData,
  animating,
}: {
  film:      typeof CALIBRATION_SEQUENCE[0]
  filmData:  { poster_url: string | null; title: string | null; year: number | null } | undefined
  animating: 'out' | 'in' | null
}) {
  const posterUrl = filmData?.poster_url ?? null
  // Use TMDB-fetched title/year as source of truth to avoid ID mismatches
  const title     = filmData?.title ?? film.title
  const year      = filmData?.year  ?? film.year

  const style: React.CSSProperties = animating === 'out'
    ? { transition: 'transform 300ms cubic-bezier(0.4,0,0.2,1), opacity 280ms ease', transform: 'translateX(-110%)', opacity: 0 }
    : {}
  const className = animating === 'in' ? 'film-card-enter' : undefined

  return (
    <div style={style} className={className}>
      <div style={{
        width: 220, aspectRatio: '2/3', background: 'var(--paper-edge)',
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)', margin: '0 auto',
      }}>
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8,
            fontFamily: 'var(--serif-italic)', fontStyle: 'italic',
            fontSize: 13, color: 'var(--ink-4)', padding: 20, textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, opacity: 0.3 }}>◻</div>
            {title}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <div style={{ fontFamily: 'var(--serif-display)', fontSize: 18, fontWeight: 500, lineHeight: 1.25, color: 'var(--ink)', marginBottom: 3 }}>
          {title}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em' }}>
          {year}
        </div>
      </div>
    </div>
  )
}

// ── Generating screen ─────────────────────────────────────────────────────────

const generatingMessages = [
  'mapping your cinema language…',
  'weighing your affinities…',
  'locking in your dimensions…',
  'composing your taste code…',
]

function GeneratingScreen({ coverage, flickerMap }: {
  coverage:   Record<string, DimCoverage>
  flickerMap: Record<string, string>
}) {
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % generatingMessages.length), 1100)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      minHeight:      '80vh',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '56px 32px',
      textAlign:      'center',
    }}>
      <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 32, letterSpacing: '0.12em' }}>
        ★ BUILDING YOUR TASTE PROFILE
      </div>

      {/* Letter slots — all locked, gently pulsing */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
        {DIM_KEYS.map(dimKey => (
          <LetterSlot
            key={dimKey}
            dimKey={dimKey}
            coverage={coverage[dimKey] ?? { covered: false, letter: null }}
            flickerLetter={flickerMap[dimKey] ?? '·'}
            justLocked={false}
            pulse
          />
        ))}
      </div>

      {/* Rotating message */}
      <p style={{
        fontFamily: 'var(--serif-italic)',
        fontStyle:  'italic',
        fontSize:   16,
        color:      'var(--ink-3)',
        lineHeight: 1.6,
        margin:     0,
        minHeight:  28,
        transition: 'opacity 300ms ease',
      }}>
        {generatingMessages[msgIdx]}
      </p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RatePage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [filmIndex,  setFilmIndex]  = useState(0)
  const [ratings,    setRatings]    = useState<Record<string, number>>({})
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [animating,  setAnimating]  = useState<'out' | 'in' | null>(null)
  const [flickerMap, setFlickerMap] = useState<Record<string, string>>({})
  const [filmDataMap, setFilmDataMap] = useState<Record<string, { poster_url: string | null; title: string | null; year: number | null }>>({})
  const [justLocked, setJustLocked] = useState<string | null>(null)
  const [finalizing, setFinalizing] = useState(false)

  const films = CALIBRATION_SEQUENCE
  const total = films.length

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/onboarding/session/${id}`)
        if (!res.ok) return
        const { session } = await res.json()

        const existing: Record<string, number> = {}
        for (const e of (session.transcript ?? []) as Array<{ type: string; film_id: string; stars: number }>) {
          if (e.type === 'calibration_rating') existing[e.film_id] = e.stars
        }
        setRatings(existing)

        const firstUnrated = films.findIndex(f => !(f.tmdb_id in existing))
        setFilmIndex(firstUnrated >= 0 ? firstUnrated : total)
      } finally {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // ── Fetch poster URLs + real titles from TMDB ─────────────────────────────

  useEffect(() => {
    const ids = films.map(f => f.tmdb_id).join(',')
    fetch(`/api/onboarding/calibration-films?ids=${ids}`)
      .then(r => r.json())
      .then(data => {
        const map: Record<string, { poster_url: string | null; title: string | null; year: number | null }> = {}
        for (const f of (data.films ?? []) as Array<{ tmdb_id: string; poster_url: string | null; title: string | null; year: number | null }>) {
          map[f.tmdb_id] = { poster_url: f.poster_url, title: f.title, year: f.year }
        }
        setFilmDataMap(map)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Coverage ──────────────────────────────────────────────────────────────

  const coverage    = useMemo(() => computeCoverage(ratings, films), [ratings, films])
  const allCovered  = DIM_KEYS.every(k => coverage[k]?.covered)
  const lockedCount = DIM_KEYS.filter(k => coverage[k]?.covered).length

  // ── Letter flicker ────────────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      setFlickerMap(prev => {
        const next = { ...prev }
        for (const dimKey of DIM_KEYS) {
          if (!coverage[dimKey]?.covered) {
            next[dimKey] = ALL_TC_LETTERS[Math.floor(Math.random() * ALL_TC_LETTERS.length)]
          }
        }
        return next
      })
    }, 160)
    return () => clearInterval(interval)
  }, [coverage])

  // ── Current film ──────────────────────────────────────────────────────────

  const currentFilm = filmIndex < total ? films[filmIndex] : null

  // ── Rate a film ───────────────────────────────────────────────────────────

  const advance = useCallback(async (stars: number) => {
    if (!currentFilm || submitting || finalizing) return
    setSubmitting(true)

    const filmId     = currentFilm.tmdb_id
    const newRatings = { ...ratings, [filmId]: stars }

    const newCoverage    = computeCoverage(newRatings, films)
    const newlyLockedDim = DIM_KEYS.find(k => !coverage[k]?.covered && newCoverage[k]?.covered) ?? null

    setRatings(newRatings)
    if (newlyLockedDim) setJustLocked(newlyLockedDim)

    // Fire-and-forget rating save
    fetch(`/api/onboarding/session/${id}/rate-film`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ film_id: filmId, stars }),
    }).catch(console.error)

    const newAllCovered = DIM_KEYS.every(k => newCoverage[k]?.covered)
    const isLast        = filmIndex >= total - 1

    if (newAllCovered || isLast) {
      // All dimensions covered (or out of films) — finalize and show generating screen
      setFinalizing(true)
      try {
        await fetch(`/api/onboarding/session/${id}/finalize-ratings`, { method: 'POST' })
        await fetch(`/api/onboarding/session/${id}/complete`, { method: 'POST' })
      } catch {
        // Best-effort
      }
      // Brief pause on the generating screen, then go to reveal
      setTimeout(() => router.push(`/onboarding/reveal/${id}`), 2800)
      return
    }

    // Animate to next film
    setAnimating('out')
    setTimeout(() => {
      setFilmIndex(i => i + 1)
      setJustLocked(null)
      setAnimating('in')
      setTimeout(() => {
        setAnimating(null)
        setSubmitting(false)
      }, 320)
    }, 300)

  }, [currentFilm, submitting, finalizing, ratings, films, coverage, filmIndex, total, id, router])

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell withAdd={false}>
        <div style={{ padding: '56px 64px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
          LOADING…
        </div>
      </AppShell>
    )
  }

  if (finalizing) {
    return (
      <AppShell withAdd={false}>
        <style>{starAnimStyles}</style>
        <GeneratingScreen coverage={coverage} flickerMap={flickerMap} />
      </AppShell>
    )
  }

  const progressPct = Math.round((filmIndex / total) * 100)

  return (
    <AppShell withAdd={false}>
      <style>{starAnimStyles}</style>
      <div style={{ padding: '56px 64px', maxWidth: 540, margin: '0 auto' }}>

        {/* Header */}
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 6 }}>★ TASTE SETUP</div>

        {/* 12 Letter Slots */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
            {DIM_KEYS.map(dimKey => (
              <LetterSlot
                key={dimKey}
                dimKey={dimKey}
                coverage={coverage[dimKey] ?? { covered: false, letter: null }}
                flickerLetter={flickerMap[dimKey] ?? '·'}
                justLocked={justLocked === dimKey}
              />
            ))}
          </div>
          <div style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.08em' }}>
            {lockedCount < 12 ? `${lockedCount} / 12 dimensions mapped` : 'taste profile complete'}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
              FILM {Math.min(filmIndex + 1, total)} OF {total}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)' }}>
              {Object.values(ratings).filter(s => s > 0).length} rated
            </span>
          </div>
          <div style={{ height: 2, background: 'var(--paper-edge)', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--sun)', borderRadius: 1, transition: 'width 300ms ease' }} />
          </div>
        </div>

        {/* Film card */}
        <div style={{ overflow: 'hidden', marginBottom: 28 }}>
          {currentFilm && (
            <FilmCard
              film={currentFilm}
              filmData={filmDataMap[currentFilm.tmdb_id]}
              animating={animating}
            />
          )}
        </div>

        {/* Rating UI */}
        {currentFilm && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <StarRating onRate={advance} disabled={submitting} />
            <button
              onClick={() => advance(0)}
              disabled={submitting}
              style={{
                background: 'none', border: 'none',
                cursor:     submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--serif-italic)', fontStyle: 'italic',
                fontSize:   13, color: 'var(--ink-4)', padding: '4px 0',
                opacity:    submitting ? 0.4 : 1, transition: 'color 120ms, opacity 120ms',
              }}
              onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-4)' }}
            >
              haven&apos;t seen →
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => router.push('/home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', padding: 0 }}
          >
            finish later →
          </button>
          <p style={{ margin: 0, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-4)', textAlign: 'right', maxWidth: 200, lineHeight: 1.5 }}>
            rate {MIN_FILMS_PER_POLE}+ films per dimension to unlock each slot
          </p>
        </div>

      </div>
    </AppShell>
  )
}
