'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { ContradictionPair, ContradictionFilm } from '@/lib/taste/contradictions'
import { ALL_POLES } from '@/lib/taste-code'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ratingLabel(stars: number, sessionPath: string): string {
  if (sessionPath === 'cold_start') {
    if (stars >= 5) return 'loved it'
    if (stars >= 4) return 'liked it'
    if (stars >= 3) return 'it was ok'
    if (stars > 0)  return "didn't work"
    return ''
  }
  return `${stars}★`
}

function buildQuestion(
  pair:        ContradictionPair,
  outlier:     ContradictionFilm,
  sessionPath: string,
): string {
  const oppPole       = ALL_POLES.find(p => p.dimKey === pair.dim_key && p.pole !== pair.dominant_pole)
  const oppLabel      = oppPole?.label ?? 'opposite'
  const anchorRating  = ratingLabel(pair.anchor.stars, sessionPath)
  const outlierRating = ratingLabel(outlier.stars, sessionPath)

  const anchorStr  = anchorRating  ? ` (you ${anchorRating})` : ''
  const outlierStr = outlierRating ? ` (you ${outlierRating})` : ''

  return `you connected with both ${pair.anchor.title}${anchorStr} and ${outlier.title}${outlierStr} — but they sit at opposite ends of this spectrum. ${pair.anchor.title} is ${pair.dominant_label.toLowerCase()}; ${outlier.title} pulls ${oppLabel.toLowerCase()}. When do you reach for each? think about the mood, the moment, who you'd be watching with.`
}

// ── Movie poster card (center column) ────────────────────────────────────────

function MovieCard({
  film,
  align,
  sessionPath,
}: {
  film:        ContradictionFilm
  align:       'left' | 'right'
  sessionPath: string
}) {
  const ratingText = ratingLabel(film.stars, sessionPath)

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           8,
      alignItems:    align === 'right' ? 'flex-end' : 'flex-start',
    }}>
      {/* Poster */}
      <div style={{
        width:        '100%',
        aspectRatio:  '2/3',
        background:   'var(--paper-edge)',
        borderRadius: 10,
        overflow:     'hidden',
        flexShrink:   0,
      }}>
        {film.poster_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={film.poster_path}
            alt={film.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--serif-italic)', fontStyle: 'italic',
            fontSize: 11, color: 'var(--ink-4)',
            padding: 10, textAlign: 'center',
          }}>
            {film.title}
          </div>
        )}
      </div>

      {/* Title + rating */}
      <div style={{ textAlign: align }}>
        <div style={{
          fontFamily: 'var(--serif-display)',
          fontSize:   13,
          fontWeight: 500,
          lineHeight: 1.3,
          color:      'var(--ink)',
        }}>
          {film.title}
        </div>
        {ratingText && (
          <div style={{
            fontFamily:    'var(--mono)',
            fontSize:      9,
            color:         'var(--s-ink)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            marginTop:     3,
          }}>
            {ratingText}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pole sidebar (outside the movie cards) ────────────────────────────────────

function PoleSide({
  letter,
  label,
  description,
  align,
}: {
  letter:      string
  label:       string
  description: string
  align:       'left' | 'right'
}) {
  return (
    <div style={{
      textAlign:     align,
      paddingTop:    4,
      display:       'flex',
      flexDirection: 'column',
      alignItems:    align === 'right' ? 'flex-end' : 'flex-start',
      gap:           6,
    }}>
      {/* Letter */}
      <div style={{
        fontFamily:    'var(--serif-display)',
        fontSize:      44,
        fontWeight:    700,
        lineHeight:    1,
        color:         'var(--forest)',
        letterSpacing: '-0.02em',
      }}>
        {letter}
      </div>
      {/* Label */}
      <div style={{
        fontFamily:    'var(--mono)',
        fontSize:      9,
        letterSpacing: '0.12em',
        color:         'var(--forest)',
        textTransform: 'uppercase' as const,
      }}>
        {label}
      </div>
      {/* Description */}
      <p style={{
        margin:     0,
        marginTop:  4,
        fontFamily: 'var(--serif-italic)',
        fontStyle:  'italic',
        fontSize:   13,
        lineHeight: 1.6,
        color:      'var(--ink-3)',
        maxWidth:   170,
      }}>
        {description}
      </p>
    </div>
  )
}

// ── Completed view ────────────────────────────────────────────────────────────

function CompletedView({ onGoToProfile }: { onGoToProfile: () => void }) {
  return (
    <AppShell withAdd={false}>
      <div style={{ padding: '56px 64px', maxWidth: 640, margin: '0 auto' }}>
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ TASTE INTERVIEW</div>
        <h1 className="t-display" style={{ fontSize: 44, lineHeight: 1, marginBottom: 16 }}>
          your results are ready.
        </h1>
        <p style={{
          fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)',
          fontFamily: 'var(--serif-italic)', margin: '0 0 40px', lineHeight: 1.6,
        }}>
          we&apos;ve mapped your taste across twelve cinematic dimensions. see what your ratings say.
        </p>
        <button
          onClick={onGoToProfile}
          className="btn"
          style={{ padding: '13px 26px', fontSize: 14, borderRadius: 999 }}
        >
          see my taste code →
        </button>
      </div>
    </AppShell>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InterviewPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [loading,        setLoading]        = useState(true)
  const [loadError,      setLoadError]      = useState<string | null>(null)
  const [contradictions, setContradictions] = useState<ContradictionPair[]>([])
  const [step,           setStep]           = useState(0)
  const [response,       setResponse]       = useState('')
  const [submitting,     setSubmitting]     = useState(false)
  const [completed,      setCompleted]      = useState(false)
  const [sessionPath,    setSessionPath]    = useState<string>('cold_start')

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/onboarding/session/${id}`)
        if (!res.ok) throw new Error('session not found')
        const data = await res.json()
        const s    = data.session
        setContradictions((s.contradictions ?? []) as ContradictionPair[])
        setStep(s.current_step ?? 0)
        setSessionPath(s.path ?? 'cold_start')
        if (s.status === 'completed') setCompleted(true)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'failed to load session')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleSubmit = useCallback(async () => {
    const pair    = contradictions[step]
    const outlier = pair?.outliers[0]
    if (!pair || !outlier || !response.trim() || submitting) return

    setSubmitting(true)
    const isLast = step === contradictions.length - 1

    const stepEntry = {
      step,
      type:      'contradiction',
      dim_key:   pair.dim_key,
      film_a_id: pair.anchor.film_id,
      film_b_id: outlier.film_id,
      question:  buildQuestion(pair, outlier, sessionPath),
      response:  response.trim(),
    }

    try {
      await fetch(`/api/onboarding/session/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ step_entry: stepEntry }),
      })

      if (isLast) {
        await fetch(`/api/onboarding/session/${id}/complete`, { method: 'POST' })
        setCompleted(true)
      } else {
        setStep(s => s + 1)
        setResponse('')
      }
    } finally {
      setSubmitting(false)
    }
  }, [contradictions, step, response, submitting, id, sessionPath])

  // ── Render states ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell withAdd={false}>
        <div style={{
          padding: '56px 64px',
          fontFamily: 'var(--mono)', fontSize: 11,
          color: 'var(--ink-4)', letterSpacing: '0.06em',
        }}>
          LOADING…
        </div>
      </AppShell>
    )
  }

  if (loadError) {
    return (
      <AppShell withAdd={false}>
        <div style={{ padding: '56px 64px', fontStyle: 'italic', color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
          {loadError}
        </div>
      </AppShell>
    )
  }

  if (completed) {
    return <CompletedView onGoToProfile={() => router.push(`/onboarding/reveal/${id}`)} />
  }

  const pair    = contradictions[step]
  const outlier = pair?.outliers[0]
  const total   = contradictions.length
  const isLast  = step === total - 1

  if (!pair || !outlier) {
    return (
      <AppShell withAdd={false}>
        <div style={{ padding: '56px 64px', fontStyle: 'italic', color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
          no questions to show — your library may need more rated films.
        </div>
      </AppShell>
    )
  }

  const dominantPole = ALL_POLES.find(p => p.dimKey === pair.dim_key && p.pole === pair.dominant_pole)
  const oppPole      = ALL_POLES.find(p => p.dimKey === pair.dim_key && p.pole !== pair.dominant_pole)

  return (
    <AppShell withAdd={false}>
      {/* Wider container to accommodate the 3-column flanked layout */}
      <div style={{ padding: '56px 64px', maxWidth: 940, margin: '0 auto' }}>

        {/* Header */}
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 28 }}>
          ★ TASTE INTERVIEW
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline', marginBottom: 8,
          }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em' }}>
              QUESTION {step + 1} OF {total}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>
              {Math.round(((step + 1) / total) * 100)}%
            </span>
          </div>
          <div style={{ height: 2, background: 'var(--paper-edge)', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{
              height:     '100%',
              width:      `${((step + 1) / total) * 100}%`,
              background: 'var(--forest)',
              borderRadius: 1,
              transition: 'width 400ms ease',
            }} />
          </div>
        </div>

        {/*
          3-column layout:
          [pole description]  [movie 1]  [movie 2]  [pole description]

          The pole text sits OUTSIDE the movie cards, flanking them on either side.
        */}
        <div style={{
          display:               'grid',
          gridTemplateColumns:   '190px 1fr 1fr 190px',
          gap:                   20,
          alignItems:            'center',
          marginBottom:          36,
        }}>

          {/* Left: VIVID description */}
          <PoleSide
            letter={dominantPole?.letter ?? pair.dominant_label.charAt(0)}
            label={dominantPole?.label   ?? pair.dominant_label}
            description={dominantPole?.description ?? ''}
            align="right"
          />

          {/* Center-left: anchor movie */}
          <MovieCard film={pair.anchor} align="left"  sessionPath={sessionPath} />

          {/* Center-right: outlier movie */}
          <MovieCard film={outlier}     align="right" sessionPath={sessionPath} />

          {/* Right: SUBTLE description */}
          <PoleSide
            letter={oppPole?.letter ?? ''}
            label={oppPole?.label   ?? ''}
            description={oppPole?.description ?? ''}
            align="left"
          />

        </div>

        {/* Question */}
        <p style={{
          fontFamily: 'var(--serif-display)',
          fontSize:   17,
          lineHeight: 1.65,
          margin:     '0 0 22px',
          color:      'var(--ink-1)',
        }}>
          {buildQuestion(pair, outlier, sessionPath)}
        </p>

        {/* Response */}
        <textarea
          value={response}
          onChange={e => setResponse(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
          placeholder="your thoughts…"
          rows={4}
          style={{
            width:        '100%',
            padding:      '14px 16px',
            fontFamily:   'var(--serif-italic)',
            fontStyle:    'italic',
            fontSize:     15,
            lineHeight:   1.65,
            borderRadius: 10,
            border:       '1px solid var(--paper-edge)',
            background:   'var(--paper-2)',
            resize:       'vertical',
            outline:      'none',
            boxSizing:    'border-box' as const,
            color:        'var(--ink-1)',
          }}
        />

        <div style={{
          marginTop: 6, marginBottom: 20,
          fontFamily: 'var(--mono)', fontSize: 9,
          color: 'var(--ink-4)', letterSpacing: '0.05em',
        }}>
          ⌘ + ENTER TO SUBMIT
        </div>

        {/* Footer: skip + submit */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => router.push('/home')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--serif-italic)', fontStyle: 'italic',
              fontSize: 13, color: 'var(--ink-4)', padding: 0,
            }}
          >
            finish later →
          </button>
          <button
            onClick={handleSubmit}
            disabled={!response.trim() || submitting}
            className="btn"
            style={{
              padding:      '12px 28px',
              fontSize:     14,
              borderRadius: 999,
              opacity:      !response.trim() || submitting ? 0.45 : 1,
              transition:   'opacity 150ms',
            }}
          >
            {submitting ? 'saving…' : isLast ? 'finish →' : 'next →'}
          </button>
        </div>

      </div>
    </AppShell>
  )
}
