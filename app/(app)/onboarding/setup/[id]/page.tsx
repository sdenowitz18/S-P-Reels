'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { FilmCandidate } from '@/app/api/onboarding/session/[id]/next-films/route'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'

// ── Types ────────────────────────────────────────────────────────────────────

type Rating = 'love' | 'like' | 'watching' | 'meh' | 'skip'

const MOVIE_RATING_OPTIONS: Array<{ value: Rating; label: string; emoji: string }> = [
  { value: 'love', label: 'loved it',     emoji: '♥' },
  { value: 'like', label: 'liked it',     emoji: '✓' },
  { value: 'meh',  label: "didn't work",  emoji: '✗' },
  { value: 'skip', label: "haven't seen", emoji: '—' },
]

const TV_RATING_OPTIONS: Array<{ value: Rating; label: string; emoji: string }> = [
  { value: 'love',     label: 'loved it',       emoji: '♥' },
  { value: 'like',     label: 'liked it',        emoji: '✓' },
  { value: 'watching', label: 'still watching',  emoji: '▶' },
  { value: 'meh',      label: "didn't work",     emoji: '✗' },
  { value: 'skip',     label: "haven't seen",    emoji: '—' },
]

// ── Film card ────────────────────────────────────────────────────────────────

function FilmCard({
  film,
  rating,
  onRate,
}: {
  film: FilmCandidate
  rating: Rating | null
  onRate: (r: Rating) => void
}) {
  const isTV = film.kind === 'tv'
  const ratingOptions = isTV ? TV_RATING_OPTIONS : MOVIE_RATING_OPTIONS

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      padding: '16px',
      background: rating ? 'var(--bone)' : 'var(--paper-2)',
      border: '0.5px solid var(--paper-edge)',
      borderRadius: 12,
      transition: 'background 150ms',
    }}>
      {/* Poster */}
      <div style={{
        width: '100%', aspectRatio: '2/3',
        background: 'var(--paper-edge)',
        borderRadius: 8, overflow: 'hidden',
      }}>
        {film.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={film.poster_url}
            alt={film.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--serif-italic)', fontStyle: 'italic',
            fontSize: 11, color: 'var(--ink-4)', padding: 12, textAlign: 'center',
          }}>
            {film.title}
          </div>
        )}
      </div>

      {/* Title + year + TV badge */}
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <div style={{
            fontFamily: 'var(--serif-display)', fontSize: 13,
            fontWeight: 500, lineHeight: 1.3, color: 'var(--ink)', flex: 1,
          }}>
            {film.title}
          </div>
          {isTV && (
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 7,
              letterSpacing: '0.08em', color: 'var(--ink-4)',
              background: 'var(--paper-edge)', borderRadius: 3,
              padding: '2px 5px', flexShrink: 0, marginTop: 2,
            }}>
              TV
            </div>
          )}
        </div>
        {film.year && (
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9,
            color: 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 2,
          }}>
            {film.year}
          </div>
        )}
      </div>

      {/* Rating buttons — 2-col grid; TV gets 5 options so last one spans */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 5,
      }}>
        {ratingOptions.map((opt, idx) => {
          const selected = rating === opt.value
          // "still watching" is the 3rd option for TV — make it span full width
          const spanFull = isTV && idx === 2
          return (
            <button
              key={opt.value}
              onClick={() => onRate(opt.value)}
              title={opt.label}
              style={{
                padding: '7px 6px', borderRadius: 6,
                border: selected ? '1px solid var(--s-ink)' : '0.5px solid var(--paper-edge)',
                background: selected ? 'var(--s-tint)' : 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--mono)', fontSize: 11,
                color: selected ? 'var(--s-ink)' : 'var(--ink-3)',
                transition: 'all 120ms',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                gridColumn: spanFull ? 'span 2' : undefined,
              }}
            >
              <span style={{ fontSize: 12 }}>{opt.emoji}</span>
              <span style={{ fontSize: 8, letterSpacing: '0.04em' }}>{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [films,       setFilms]       = useState<FilmCandidate[]>([])
  const [ratings,     setRatings]     = useState<Record<string, Rating>>({})
  const [loading,     setLoading]     = useState(true)
  const [submitting,  setSubmitting]  = useState(false)
  const [coveredPoles, setCoveredPoles] = useState(0)
  const [totalPoles,   setTotalPoles]   = useState(24)
  const [batchNum,    setBatchNum]    = useState(0)

  // Fetch next batch of films targeting uncovered poles
  const fetchNextBatch = useCallback(async () => {
    setLoading(true)
    setRatings({})
    try {
      const res  = await fetch(`/api/onboarding/session/${id}/next-films`)
      const data = await res.json()

      if (data.allCovered || data.poolExhausted) {
        // All poles covered — submit a no-op to trigger contradiction computation
        await fetch(`/api/onboarding/session/${id}/rate`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ratings: [], all_covered: true }),
        })
        router.push(`/onboarding/interview/${id}`)
        return
      }

      setFilms(data.films ?? [])
      setCoveredPoles(data.coveredPoles ?? 0)
      setTotalPoles(data.totalPoles ?? 24)
      setBatchNum(n => n + 1)
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { fetchNextBatch() }, [fetchNextBatch])

  const currentFilms   = films
  const allRated       = currentFilms.length > 0 && currentFilms.every(f => ratings[f.film_id] !== undefined)
  const ratedCount     = Object.keys(ratings).length

  const submitBatch = useCallback(async () => {
    if (!allRated || submitting) return
    setSubmitting(true)

    const batchRatings = currentFilms.map(f => ({
      film_id:       f.film_id,
      label:         ratings[f.film_id],
      title:         f.title,
      poster_url:    f.poster_url,
      dimensions_v2: f.dimensions_v2 as FilmDimensionsV2,
    }))

    try {
      const res  = await fetch(`/api/onboarding/session/${id}/rate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ratings: batchRatings, all_covered: false }),
      })
      const data = await res.json()

      if (data.ready) {
        router.push(`/onboarding/interview/${id}`)
        return
      }

      // Not done — fetch next batch
      await fetchNextBatch()
    } finally {
      setSubmitting(false)
    }
  }, [allRated, submitting, currentFilms, ratings, id, router, fetchNextBatch])

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell withAdd={false}>
        <div style={{
          padding: '56px 64px',
          fontFamily: 'var(--mono)', fontSize: 11,
          color: 'var(--ink-4)', letterSpacing: '0.06em',
        }}>
          {batchNum === 0 ? 'LOADING…' : 'LOADING NEXT SET…'}
        </div>
      </AppShell>
    )
  }

  const progressPct = Math.round((coveredPoles / totalPoles) * 100)

  return (
    <AppShell withAdd={false}>
      <div style={{ padding: '56px 64px', maxWidth: 800, margin: '0 auto' }}>

        {/* Header */}
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>
          ★ TASTE SETUP
        </div>
        <h1 className="t-display" style={{ fontSize: 44, lineHeight: 1.05, marginBottom: 12 }}>
          films you <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>know</span>.
        </h1>
        <p style={{
          fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)',
          fontFamily: 'var(--serif-italic)', lineHeight: 1.6,
          margin: '0 0 36px', maxWidth: 500,
        }}>
          rate each film you've seen — or mark it if you haven't. we'll keep going until we have enough signal across all twelve dimensions.
        </p>

        {/* Progress */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
              SET {batchNum}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>
              {coveredPoles} / {totalPoles} dimensions covered
            </span>
          </div>
          <div style={{ height: 2, background: 'var(--paper-edge)', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progressPct}%`,
              background: 'var(--sun)',
              borderRadius: 1,
              transition: 'width 500ms ease',
            }} />
          </div>
        </div>

        {/* Film grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 18,
          marginBottom: 40,
        }}>
          {currentFilms.map(film => (
            <FilmCard
              key={film.film_id}
              film={film}
              rating={ratings[film.film_id] ?? null}
              onRate={r => setRatings(prev => ({ ...prev, [film.film_id]: r }))}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => router.push('/home')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--serif-italic)', fontStyle: 'italic',
              fontSize: 13, color: 'var(--ink-4)', padding: 0,
            }}
          >
            skip for now →
          </button>
          <button
            onClick={submitBatch}
            disabled={!allRated || submitting}
            className="btn"
            style={{
              padding: '12px 28px', fontSize: 14, borderRadius: 999,
              opacity: !allRated || submitting ? 0.4 : 1,
              transition: 'opacity 150ms',
            }}
          >
            {submitting ? 'saving…' : 'next set →'}
          </button>
        </div>
        {!allRated && ratedCount > 0 && (
          <p style={{
            margin: '12px 0 0', textAlign: 'right',
            fontStyle: 'italic', fontSize: 12,
            color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)',
          }}>
            {currentFilms.length - ratedCount} left — use "haven't seen" if needed
          </p>
        )}
        {!allRated && ratedCount === 0 && (
          <p style={{
            margin: '12px 0 0', textAlign: 'right',
            fontStyle: 'italic', fontSize: 12,
            color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)',
          }}>
            rate all {currentFilms.length} to continue
          </p>
        )}
      </div>
    </AppShell>
  )
}
