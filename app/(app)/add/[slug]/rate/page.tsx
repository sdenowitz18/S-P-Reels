'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/app-shell'
import { LetterLoader } from '@/components/letter-loader'
import { TMDBSearchResult, posterUrl } from '@/lib/types'

// ── Dimension label lookup for Card 3 follow-up ───────────────────────────────

const DIM_LABELS: Record<string, { left: string; right: string }> = {
  narrative_legibility:    { left: 'how easy it was to follow',         right: 'how much it left unsaid' },
  emotional_directness:    { left: 'how it hit you emotionally',        right: 'how understated it was' },
  plot_vs_character:       { left: 'the story — what happened',         right: 'the character depth' },
  naturalistic_vs_stylized:{ left: 'how real it all felt',              right: 'the visual style' },
  narrative_closure:       { left: 'how it all came together',          right: 'how it left things open' },
  intimate_vs_epic:        { left: 'how personal and close it stayed',  right: 'the scale of it' },
  accessible_vs_demanding: { left: 'how easy it was to get into',       right: "it didn't hold your hand" },
  psychological_safety:    { left: 'where it ended up emotionally',     right: 'how uncomfortable it got' },
  moral_clarity:           { left: 'the clear sense of right and wrong', right: 'the moral grey area' },
  behavioral_realism:      { left: 'how human the characters felt',     right: 'the bigger-than-life characters' },
  sensory_vs_intellectual: { left: 'the atmosphere and feeling',        right: 'the ideas behind it' },
  kinetic_vs_patient:      { left: 'the energy and momentum',           right: 'the pacing — it took its time' },
}

function getTopFitLabels(dims: Record<string, number>): { dimKey: string; pole: 'left' | 'right'; label: string }[] {
  const extremes: { dimKey: string; pole: 'left' | 'right'; label: string; distance: number }[] = []
  for (const [key, score] of Object.entries(dims)) {
    const labels = DIM_LABELS[key]
    if (!labels) continue
    const distance = Math.abs(score - 50)
    if (distance >= 20) {
      const pole: 'left' | 'right' = score < 50 ? 'left' : 'right'
      extremes.push({ dimKey: key, pole, label: pole === 'left' ? labels.left : labels.right, distance })
    }
  }
  return extremes.sort((a, b) => b.distance - a.distance).slice(0, 4)
}

// ── Insight card helpers ──────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number) { return Math.min(max, Math.max(min, val)) }

// ── Taste shift types + helpers (pure, defined outside component) ──────────────
type TasteEntry = { dimKey: string; poleScore: number; letter: string; label: string; dominantPole: 'left' | 'right' }
type TasteShift = { letter: string; label: string; delta: number; direction: 'up' | 'down' }

function computeTasteShiftsFn(before: TasteEntry[], after: TasteEntry[]): TasteShift[] {
  return before
    .map(pre => {
      const post = after.find(e => e.dimKey === pre.dimKey)
      if (!post) return null
      const delta = post.dominantPole === pre.dominantPole
        ? post.poleScore - pre.poleScore
        : -(post.poleScore + pre.poleScore) / 2  // pole flipped — significant shift
      if (Math.abs(delta) < 0.5) return null
      return { letter: post.letter, label: post.label, delta, direction: delta > 0 ? 'up' as const : 'down' as const }
    })
    .filter((s): s is TasteShift => s != null)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4)
}

function shiftsProse(shifts: TasteShift[], filmTitle?: string): string {
  const strong = shifts.filter(s => Math.abs(s.delta) >= 1)
  if (strong.length === 0) return 'Small refinements to your profile — it keeps sharpening with every film you log.'
  const ups   = strong.filter(s => s.direction === 'up').map(s => s.label)
  const downs = strong.filter(s => s.direction === 'down').map(s => s.label)
  const parts: string[] = []
  if (ups.length)   parts.push(`${ups.join(' and ')} ${ups.length === 1 ? 'climbed' : 'climbed'}`)
  if (downs.length) parts.push(`${downs.join(' and ')} ${downs.length === 1 ? 'pulled back' : 'pulled back'}`)
  const base = parts.join(', ')
  if (filmTitle) {
    return `${filmTitle} moved your taste profile — ${base}.`
  }
  return `${base} in your taste profile.`
}

function deltaInterpretation(deltaZ: number): string {
  if (Math.abs(deltaZ) < 0.5) return 'right in line with what we expected.'
  if (deltaZ >= 1.0)  return 'notably more than we predicted.'
  if (deltaZ >= 0.5)  return 'a little above what we predicted.'
  if (deltaZ <= -1.0) return 'notably less than we predicted.'
  return 'a little below what we predicted.'
}

// ── Progress dots ─────────────────────────────────────────────────────────────

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: i < step ? 'var(--ink)' : i === step ? 'var(--ink)' : 'var(--paper-edge)',
          opacity: i < step ? 0.35 : 1,
          transition: 'all 200ms',
        }} />
      ))}
    </div>
  )
}

// ── Card nav bar ──────────────────────────────────────────────────────────────

function CardNav({ step, onBack, onSkip }: {
  step: number; onBack?: () => void; onSkip?: () => void
}) {
  return (
    <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none', cursor: onBack ? 'pointer' : 'default',
          opacity: onBack ? 1 : 0, fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)',
          fontFamily: 'var(--serif-italic)', padding: 0,
        }}
      >
        ← back
      </button>
      <ProgressDots step={step} total={5} />
      {onSkip ? (
        <button
          onClick={onSkip}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', padding: 0 }}
        >
          skip →
        </button>
      ) : (
        <div style={{ width: 40 }} />
      )}
    </div>
  )
}

// ── Star field (Card 1) ───────────────────────────────────────────────────────

function StarField({ stars, setStars, onPick }: {
  stars: number; setStars: (n: number) => void; onPick: (n: number) => void
}) {
  const handleClick = (slot: number, isLeft: boolean) => {
    const value = isLeft ? slot - 0.5 : slot
    const next = stars === value ? 0 : value
    setStars(next)
    if (next > 0) setTimeout(() => onPick(next), 160)
  }
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map(slot => {
        const filled = stars >= slot
        const half   = !filled && stars >= slot - 0.5
        return (
          <div key={slot} style={{ position: 'relative', width: 56, height: 56 }}>
            <span style={{ position: 'absolute', inset: 0, fontSize: 50, color: 'var(--paper-edge)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', lineHeight: 1 }}>★</span>
            {(filled || half) && (
              <span style={{ position: 'absolute', inset: 0, fontSize: 50, color: 'var(--sun)', display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: half ? 'inset(0 50% 0 0)' : 'none', pointerEvents: 'none', lineHeight: 1 }}>★</span>
            )}
            <button onClick={() => handleClick(slot, true)}  style={{ position: 'absolute', left: 0,   top: 0, width: '50%', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} />
            <button onClick={() => handleClick(slot, false)} style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} />
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RatePage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()

  // ── Flow state ──────────────────────────────────────────────────────────────
  const [card, setCard]         = useState(0)   // 0-4
  const [animating, setAnimating] = useState(false)

  // ── Card answers ────────────────────────────────────────────────────────────
  const [stars, setStars]       = useState(0)
  const [rewatch, setRewatch]   = useState<boolean | null>(null)
  const [rewatchScore, setRewatchScore] = useState(7)
  const [fitAnswer, setFitAnswer]       = useState<string | null>(null)
  const [fitDimension, setFitDimension] = useState<string | null>(null)
  const [fitPole, setFitPole]           = useState<'left' | 'right' | null>(null)
  const [selectedFitDims, setSelectedFitDims] = useState<{ dimKey: string; pole: 'left' | 'right'; label: string }[]>([])
  const [surpriseNote, setSurpriseNote] = useState('')
  const [comment, setComment]         = useState('')
  const [commentPublic, setCommentPublic] = useState(false)

  // ── Film + data ──────────────────────────────────────────────────────────────
  const [slug, setSlug]         = useState('')
  const [film, setFilm]         = useState<TMDBSearchResult | null>(null)
  const [filmDims, setFilmDims] = useState<Record<string, number> | null>(null)
  const [matchScore, setMatchScore] = useState<number | null>(null)
  const [ratingStats, setRatingStats] = useState<{ mu: number; sigma: number; count: number; normalized: boolean } | null>(null)

  // ── Post-save insight ───────────────────────────────────────────────────────
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [predictedStars, setPredictedStars] = useState<number | null>(null)
  const [deltaZ, setDeltaZ]     = useState<number | null>(null)

  // ── Taste code letter shifts ────────────────────────────────────────────────
  const [preTasteEntries, setPreTasteEntries] = useState<TasteEntry[] | null>(null)
  const [tasteShifts, setTasteShifts]         = useState<TasteShift[]>([])
  const [shiftsLoading, setShiftsLoading]     = useState(false)

  // ── Friend match scores (insight card) ─────────────────────────────────────
  const [friendScores, setFriendScores]       = useState<{ id: string; name: string; matchScore: number }[]>([])
  const [friendScoresLoading, setFriendScoresLoading] = useState(false)

  // ── Insight loading interstitial ─────────────────────────────────────────
  // true while we wait for panel re-fetch, taste shifts, and friend scores.
  // Card 4 won't reveal until this clears, so it always appears fully loaded.
  const [insightLoading, setInsightLoading] = useState(false)

  const initDone = useRef(false)

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true
    params.then(async p => {
      setSlug(p.slug)
      try { setFilm(JSON.parse(sessionStorage.getItem('sp_film') || '{}')) } catch {}

      // Fetch user taste stats + film match score in parallel
      try {
        const filmData: TMDBSearchResult = JSON.parse(sessionStorage.getItem('sp_film') || '{}')
        const filmId = filmData?.id

        const [tasteRes, scoreRes] = await Promise.all([
          fetch('/api/profile/taste').then(r => r.json()),
          // Lightweight score endpoint — no LLM, returns in ~100ms
          filmId ? fetch(`/api/recommendations/taste/${filmId}/score`).then(r => r.json()) : Promise.resolve(null),
        ])

        if (tasteRes?.ratingStats) setRatingStats(tasteRes.ratingStats)
        // Store pre-save taste entries for delta computation
        if (tasteRes?.tasteCode?.allEntries) setPreTasteEntries(tasteRes.tasteCode.allEntries as TasteEntry[])

        if (scoreRes?.score != null) setMatchScore(scoreRes.score)

        // Film dimensional scores for Card 2 fit-check follow-up labels
        if (scoreRes?.filmDims) setFilmDims(scoreRes.filmDims)
      } catch {}
    })
  }, [params])

  // ── Navigation ──────────────────────────────────────────────────────────────
  const advance = useCallback((to?: number) => {
    if (animating) return
    setAnimating(true)
    setTimeout(() => {
      setCard(prev => to ?? prev + 1)
      setAnimating(false)
    }, 180)
  }, [animating])

  const goBack = useCallback(() => {
    if (animating || card === 0) return
    setAnimating(true)
    setTimeout(() => {
      setCard(prev => prev - 1)
      setAnimating(false)
    }, 180)
  }, [animating, card])

  // ── Save ─────────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (saving) return
    setSaving(true)
    setSaveError(null)
    try {
      // Compute prediction + delta
      let computedPredicted: number | null = null
      let computedDeltaStars: number | null = null
      let computedDeltaZ: number | null = null

      if (ratingStats?.normalized && matchScore != null && stars > 0) {
        const { mu, sigma } = ratingStats
        const predicted_z = (matchScore - 50) / 25
        computedPredicted  = clamp(mu + predicted_z * sigma, 0.5, 5.0)
        computedDeltaStars = stars - computedPredicted
        computedDeltaZ     = computedDeltaStars / sigma
        setPredictedStars(computedPredicted)
        setDeltaZ(computedDeltaZ)
      }

      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filmId: film?.id,
          list: 'watched',
          audience: ['me'],
          myStars: stars || null,
          myLine: comment.trim() || null,
          commentPublic: commentPublic,
          // Phase 2 signal fields
          rewatch: rewatch,
          rewatchScore: rewatch === true ? rewatchScore : null,
          fitAnswer: fitAnswer ?? null,
          fitDimension: fitDimension ?? null,
          fitPole: fitPole ?? null,
          matchScoreAtLog: matchScore ?? null,
          predictedStars: computedPredicted,
          deltaStars: computedDeltaStars,
          deltaZ: computedDeltaZ,
          userMuAtLog: ratingStats?.mu ?? null,
          userSigmaAtLog: ratingStats?.sigma ?? null,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'save failed')
      }
      advance(4) // → card 4, but insightLoading = true gates the reveal

      // Show interstitial while all insight data loads in parallel
      setInsightLoading(true)

      // Parallel: re-fetch panel (for post-enrichment matchScore), taste shifts, friend scores
      const [panelResult, tasteResult, friendResult] = await Promise.allSettled([
        film?.id ? fetch(`/api/films/${film.id}/panel`).then(r => r.json()) : Promise.resolve(null),
        preTasteEntries ? fetch('/api/profile/taste').then(r => r.json()) : Promise.resolve(null),
        film?.id ? fetch(`/api/films/${film.id}/friend-scores`).then(r => r.json()) : Promise.resolve(null),
      ])

      // Update matchScore if enrichment completed during the rating flow
      if (panelResult.status === 'fulfilled' && panelResult.value?.matchScore != null) {
        const freshMatchScore: number = panelResult.value.matchScore
        setMatchScore(freshMatchScore)
        // Recompute prediction with fresh matchScore (only if stats exist)
        if (ratingStats && stars) {
          const { mu, sigma } = ratingStats
          const freshPredicted  = mu + ((freshMatchScore - 50) / 25) * sigma
          const freshDeltaStars = stars - freshPredicted
          const freshDeltaZ     = freshDeltaStars / sigma
          setPredictedStars(freshPredicted)
          setDeltaZ(freshDeltaZ)
          computedPredicted  = freshPredicted
          computedDeltaStars = freshDeltaStars
          computedDeltaZ     = freshDeltaZ
        }
      }

      // Taste shifts
      if (tasteResult.status === 'fulfilled' && tasteResult.value && preTasteEntries) {
        const postEntries = tasteResult.value?.tasteCode?.allEntries as TasteEntry[] | undefined
        if (postEntries) setTasteShifts(computeTasteShiftsFn(preTasteEntries, postEntries))
      }

      // Friend scores
      if (friendResult.status === 'fulfilled' && friendResult.value?.friends?.length > 0) {
        setFriendScores(friendResult.value.friends)
      }

      setInsightLoading(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'something went wrong — try again')
    } finally {
      setSaving(false)
    }
  }, [saving, stars, comment, commentPublic, rewatch, rewatchScore, fitAnswer, fitDimension, fitPole, matchScore, ratingStats, film, advance, preTasteEntries, setFriendScores, setFriendScoresLoading])

  // ── Fit labels from film dimensions ─────────────────────────────────────────
  const fitLabels = filmDims ? getTopFitLabels(filmDims) : []

  // ── Card rendering ───────────────────────────────────────────────────────────
  const poster = film ? posterUrl(film.poster_path, 'w342') : null

  const cardStyle: React.CSSProperties = {
    opacity: animating ? 0 : 1,
    transform: animating ? 'translateY(8px)' : 'translateY(0)',
    transition: 'opacity 180ms ease, transform 180ms ease',
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
  }

  // ── Card 0: Rating ──────────────────────────────────────────────────────────
  if (card === 0) {
    return (
      <AppShell active="movies">
        <div style={cardStyle}>
          <CardNav step={0} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 36px 60px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
            {poster && (
              <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 100, height: 150, borderRadius: 6, overflow: 'hidden', border: '0.5px solid var(--paper-edge)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', flexShrink: 0 }}>
                  <Image src={poster} alt={film?.title ?? ''} width={100} height={150} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                </div>
              </div>
            )}
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 14, textAlign: 'center', letterSpacing: '0.12em' }}>
              ★ LOG
            </div>
            <h1 style={{ fontFamily: 'var(--serif-display)', fontSize: 32, fontWeight: 600, lineHeight: 1.1, margin: '0 0 8px', textAlign: 'center' }}>
              how was{' '}
              <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>
                {film?.title}
              </span>
              ?
            </h1>
            <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-4)', margin: '0 0 36px', textAlign: 'center', lineHeight: 1.5 }}>
              tap a star to rate it and move on
            </p>
            <StarField stars={stars} setStars={setStars} onPick={() => advance()} />
          </div>
        </div>
      </AppShell>
    )
  }

  // ── Card 1: Rewatch ─────────────────────────────────────────────────────────
  if (card === 1) {
    return (
      <AppShell active="movies">
        <div style={cardStyle}>
          <CardNav step={1} onBack={goBack} onSkip={() => { setRewatch(null); advance() }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 36px 60px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 18, letterSpacing: '0.12em' }}>★ REWATCH</div>
            <h1 style={{ fontFamily: 'var(--serif-display)', fontSize: 36, fontWeight: 600, lineHeight: 1.1, margin: '0 0 36px' }}>
              would you rewatch this?
            </h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { val: true,  label: 'yes',  sub: "i'd sit down with it again" },
                { val: false, label: 'no',   sub: 'once was enough' },
              ].map(opt => (
                <button
                  key={String(opt.val)}
                  onClick={() => {
                    setRewatch(opt.val)
                    if (!opt.val) {
                      advance()
                    }
                    // If yes, stay on card to show slider
                  }}
                  style={{
                    padding: '18px 22px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    border: rewatch === opt.val ? '1.5px solid var(--ink)' : '0.5px solid var(--paper-edge)',
                    background: rewatch === opt.val ? 'var(--ink)' : 'var(--paper-2)',
                    color: rewatch === opt.val ? 'var(--paper)' : 'var(--ink)',
                    transition: 'all 120ms',
                  }}
                >
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{opt.label}</div>
                  <div style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, marginTop: 3, opacity: 0.6 }}>{opt.sub}</div>
                </button>
              ))}
            </div>

            {/* Slider — only shown when rewatch === true */}
            {rewatch === true && (
              <div style={{ marginTop: 32, padding: '24px 22px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 12, transition: 'all 200ms' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.1em', marginBottom: 16 }}>
                  HOW REWATCHABLE?
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={rewatchScore}
                    onChange={e => setRewatchScore(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--ink)', cursor: 'pointer' }}
                  />
                  <span style={{ fontFamily: 'var(--serif-display)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', minWidth: 28, textAlign: 'center', lineHeight: 1 }}>
                    {rewatchScore}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>RARELY</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>ANYTIME</span>
                </div>
                <button
                  onClick={() => advance()}
                  className="btn"
                  style={{ marginTop: 20, width: '100%', padding: '12px', borderRadius: 999, fontSize: 13 }}
                >
                  continue →
                </button>
              </div>
            )}
          </div>
        </div>
      </AppShell>
    )
  }

  // ── Card 2: Fit Check ───────────────────────────────────────────────────────
  if (card === 2) {
    const isSurprise = fitAnswer === 'surprisingly_yes' || fitAnswer === 'surprisingly_no'
    const showSurpriseNote = isSurprise
    const showFollowUp = fitAnswer !== null && !isSurprise && fitLabels.length > 0
    const fitCopy = fitAnswer === 'yes' || fitAnswer === 'surprisingly_yes' ? 'what pulled you in?' : "what didn't land?"

    const toggleFitDim = (dimKey: string, pole: 'left' | 'right', label: string) => {
      setSelectedFitDims(prev => {
        const exists = prev.find(d => d.dimKey === dimKey)
        if (exists) return prev.filter(d => d.dimKey !== dimKey)
        return [...prev, { dimKey, pole, label }]
      })
    }

    const advanceFromFit = (dimKey?: string, pole?: 'left' | 'right') => {
      // Store the primary selected dim for API
      if (dimKey && pole) { setFitDimension(dimKey); setFitPole(pole) }
      else if (selectedFitDims.length > 0) {
        setFitDimension(selectedFitDims[0].dimKey)
        setFitPole(selectedFitDims[0].pole)
      }
      // Pre-fill Card 3 with the surprise note if set
      if (surpriseNote.trim()) setComment(surpriseNote.trim())
      setTimeout(() => advance(), 160)
    }

    return (
      <AppShell active="movies">
        <div style={cardStyle}>
          <CardNav step={2} onBack={goBack} onSkip={() => { setFitAnswer(null); setFitDimension(null); setFitPole(null); setSurpriseNote(''); advance() }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 36px 60px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 18, letterSpacing: '0.12em' }}>★ FIT CHECK</div>
            <h1 style={{ fontFamily: 'var(--serif-display)', fontSize: 36, fontWeight: 600, lineHeight: 1.1, margin: '0 0 36px' }}>
              did this feel like your kind of film?
            </h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { id: 'yes',             label: 'yes',              sub: 'right in my wheelhouse' },
                { id: 'surprisingly_yes',label: 'surprisingly yes', sub: "didn't expect to like it this much" },
                { id: 'surprisingly_no', label: 'surprisingly no',  sub: "thought it'd be more me" },
                { id: 'no',              label: 'no',               sub: 'not really my thing' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setFitAnswer(opt.id)
                    const surprise = opt.id === 'surprisingly_yes' || opt.id === 'surprisingly_no'
                    // Non-surprise + no dim labels → auto-advance
                    if (!surprise && fitLabels.length === 0) {
                      setTimeout(() => advance(), 160)
                    }
                  }}
                  style={{
                    padding: '14px 18px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    border: fitAnswer === opt.id ? '1.5px solid var(--ink)' : '0.5px solid var(--paper-edge)',
                    background: fitAnswer === opt.id ? 'var(--ink)' : 'var(--paper-2)',
                    color: fitAnswer === opt.id ? 'var(--paper)' : 'var(--ink)',
                    transition: 'all 120ms',
                  }}
                >
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{opt.label}</div>
                  <div style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, marginTop: 2, opacity: 0.6 }}>{opt.sub}</div>
                </button>
              ))}
            </div>

            {/* Surprise follow-up: "what surprised you?" text + dim labels */}
            {showSurpriseNote && (
              <div style={{ marginTop: 28, padding: '20px 20px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 12 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.1em', marginBottom: 12 }}>
                  WHAT SURPRISED YOU?
                </div>
                <textarea
                  value={surpriseNote}
                  onChange={e => setSurpriseNote(e.target.value)}
                  placeholder={fitAnswer === 'surprisingly_yes' ? "what caught you off guard…" : "where did it miss for you…"}
                  rows={3}
                  autoFocus
                  style={{
                    width: '100%', padding: '12px 14px',
                    background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 8,
                    fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink)',
                    outline: 'none', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box',
                  }}
                />
                {fitLabels.length > 0 && (
                  <>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.08em', margin: '16px 0 10px' }}>
                      {fitCopy.toUpperCase()} <span style={{ opacity: 0.5 }}>— pick all that apply</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {fitLabels.map(({ dimKey, pole, label }) => {
                        const isSelected = selectedFitDims.some(d => d.dimKey === dimKey)
                        return (
                          <button
                            key={dimKey}
                            onClick={() => toggleFitDim(dimKey, pole, label)}
                            style={{
                              padding: '11px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                              border: isSelected ? '1.5px solid var(--ink)' : '0.5px solid var(--paper-edge)',
                              background: isSelected ? 'var(--ink)' : 'transparent',
                              color: isSelected ? 'var(--paper)' : 'var(--ink)',
                              fontFamily: 'var(--serif-body)', fontSize: 14,
                              transition: 'all 120ms',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}
                          >
                            <span>{label}</span>
                            {isSelected && <span style={{ fontSize: 12, opacity: 0.6 }}>✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
                <button
                  onClick={() => advanceFromFit()}
                  className="btn"
                  style={{ marginTop: 16, width: '100%', padding: '11px', borderRadius: 999, fontSize: 13 }}
                >
                  continue →
                </button>
              </div>
            )}

            {/* Non-surprise follow-up: dimensional labels — multi-select */}
            {showFollowUp && (
              <div style={{ marginTop: 28, padding: '20px 20px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 12 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.1em', marginBottom: 14 }}>
                  {fitCopy.toUpperCase()} <span style={{ opacity: 0.5, fontWeight: 400 }}>— pick all that apply</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {fitLabels.map(({ dimKey, pole, label }) => {
                    const isSelected = selectedFitDims.some(d => d.dimKey === dimKey)
                    return (
                      <button
                        key={dimKey}
                        onClick={() => toggleFitDim(dimKey, pole, label)}
                        style={{
                          padding: '11px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                          border: isSelected ? '1.5px solid var(--ink)' : '0.5px solid var(--paper-edge)',
                          background: isSelected ? 'var(--ink)' : 'transparent',
                          color: isSelected ? 'var(--paper)' : 'var(--ink)',
                          fontFamily: 'var(--serif-body)', fontSize: 14,
                          transition: 'all 120ms',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <span>{label}</span>
                        {isSelected && <span style={{ fontSize: 12, opacity: 0.6 }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                  <button
                    onClick={() => advanceFromFit()}
                    style={{ padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}
                  >
                    skip this part →
                  </button>
                  <button
                    onClick={() => advanceFromFit()}
                    className="btn"
                    style={{ padding: '9px 20px', borderRadius: 999, fontSize: 12 }}
                  >
                    continue →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </AppShell>
    )
  }

  // ── Card 3: Comment ─────────────────────────────────────────────────────────
  if (card === 3) {
    return (
      <AppShell active="movies">
        <div style={cardStyle}>
          <CardNav step={3} onBack={goBack} onSkip={() => { setComment(''); save() }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 36px 60px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 18, letterSpacing: '0.12em' }}>★ YOUR TAKE</div>
            <h1 style={{ fontFamily: 'var(--serif-display)', fontSize: 36, fontWeight: 600, lineHeight: 1.1, margin: '0 0 10px' }}>
              anything you want to remember?
            </h1>
            <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', margin: '0 0 28px', lineHeight: 1.5 }}>
              one line for future-you. optional.
            </p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="the thing you don't want to forget…"
              autoFocus
              rows={4}
              style={{
                width: '100%', padding: '14px 16px',
                background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 10,
                fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink)',
                outline: 'none', resize: 'none', lineHeight: 1.55, boxSizing: 'border-box',
              }}
            />
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setCommentPublic(p => !p)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontFamily: 'var(--serif-italic)', fontStyle: 'italic',
                  fontSize: 12, color: commentPublic ? 'var(--ink)' : 'var(--ink-4)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: '50%', border: '1px solid currentColor',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {commentPublic && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'block' }} />}
                </span>
                {commentPublic ? 'visible to friends' : 'make public'}
              </button>
            </div>
            {saveError && (
              <p style={{ marginTop: 12, fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
                {saveError}
              </p>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="btn"
              style={{ marginTop: 20, padding: '13px 28px', fontSize: 14, borderRadius: 999, opacity: saving ? 0.5 : 1 }}
            >
              {saving ? 'saving…' : 'done →'}
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  // ── Card 4: loading interstitial ─────────────────────────────────────────────
  // Shown while taste shifts, friend scores, and panel re-fetch are in flight.
  // Clears before the insight card renders, so the card is always fully loaded.
  if (card === 4 && insightLoading) {
    return (
      <AppShell active="movies">
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
          <LetterLoader label="loading your film insights…" size={92} />
        </div>
      </AppShell>
    )
  }

  // ── Card 4: Insight Card ────────────────────────────────────────────────────
  // hasFullPrediction: normalized stats + match score → predicted_stars is
  // μ + ((matchScore − 50) / 25) × σ. Delta is always vs that prediction.
  // Suppressed for users with < 10 logs (normalized = false) or film has no dims.
  const hasFullPrediction = ratingStats?.normalized && matchScore != null && predictedStars != null && deltaZ != null

  // ── Verdict: the editorial headline ─────────────────────────────────────────
  function verdict(): { headline: string; body: string; accent?: string } {
    if (hasFullPrediction && deltaZ != null && predictedStars != null) {
      const dz = deltaZ
      if (Math.abs(dz) < 0.5) return {
        headline: 'Spot on.',
        body: `We called ${predictedStars.toFixed(1)}★ — you gave it ${stars}★. Right in line with what your taste profile predicted.`,
        accent: 'var(--s-ink)',
      }
      if (dz >= 1.0) return {
        headline: 'You loved it more than expected.',
        body: `We had this at ${predictedStars.toFixed(1)}★. Your ${stars}★ points to something your profile hasn't fully mapped yet.`,
        accent: 'var(--sun)',
      }
      if (dz >= 0.5) return {
        headline: 'A little more than we figured.',
        body: `We predicted ${predictedStars.toFixed(1)}★ — you gave it ${stars}★. A modest upward surprise.`,
        accent: 'var(--sun)',
      }
      if (dz <= -1.0) return {
        headline: "Didn't connect the way we thought.",
        body: `We had this at ${predictedStars.toFixed(1)}★ for you. Your ${stars}★ is a strong signal against this territory.`,
        accent: 'var(--p-ink)',
      }
      return {
        headline: 'A little less than we figured.',
        body: `We predicted ${predictedStars.toFixed(1)}★ — you gave it ${stars}★. A small downward surprise.`,
        accent: 'var(--p-ink)',
      }
    }

    // No prediction — use fit answer
    if (fitAnswer === 'yes') return {
      headline: 'Right in your wheelhouse.',
      body: `${stars}★ and exactly the kind of film you connect with. Filed away.`,
      accent: 'var(--s-ink)',
    }
    if (fitAnswer === 'surprisingly_yes') return {
      headline: 'It surprised you.',
      body: `${stars}★ — more than you expected to like it. Those are the ones worth paying attention to.`,
      accent: 'var(--sun)',
    }
    if (fitAnswer === 'surprisingly_no') return {
      headline: "Didn't land like you thought.",
      body: `${stars}★. You came in expecting more. That gap is a useful signal.`,
      accent: 'var(--p-ink)',
    }
    if (fitAnswer === 'no') return {
      headline: 'Not your thing.',
      body: `${stars}★. Knowing what doesn't work for you is half the map.`,
      accent: 'var(--ink-3)',
    }

    // Nothing to go on — just the stars
    const starMsg = stars >= 4.5 ? 'One for the permanent collection.'
      : stars >= 4   ? 'A strong watch.'
      : stars >= 3   ? 'Worth the time.'
      : stars >= 2   ? "Didn't quite get there."
      : stars > 0    ? 'One to move past.'
      : 'Logged.'
    return { headline: starMsg, body: 'Your taste profile grows with every film you add.', accent: 'var(--ink-3)' }
  }

  // ── Why no prediction ────────────────────────────────────────────────────────
  function noPredictionNote(): string {
    if (!ratingStats?.normalized) return "Log a few more rated films and we'll start predicting before you watch."
    if (matchScore == null) return "We haven't analyzed this film yet — a prediction will be ready next time."
    return ''
  }

  const v = verdict()
  const noPredNote = noPredictionNote()

  return (
    <AppShell active="movies">
      <div style={cardStyle}>
        <CardNav step={4} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 36px 60px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
          <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 18, letterSpacing: '0.12em' }}>★ INSIGHT</div>

          {/* Film + rating header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
              {poster && (
                <div style={{ width: 52, height: 78, borderRadius: 4, overflow: 'hidden', flexShrink: 0, border: '0.5px solid var(--paper-edge)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
                  <Image src={poster} alt={film?.title ?? ''} width={52} height={78} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--serif-display)', fontSize: 20, fontWeight: 600, lineHeight: 1.2, color: 'var(--ink)', marginBottom: 6 }}>
                  {film?.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--serif-display)', fontSize: 28, fontWeight: 700, color: 'var(--sun)', lineHeight: 1 }}>
                    {stars > 0 ? `${stars}★` : '—'}
                  </span>
                  {hasFullPrediction && predictedStars != null && (
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>
                      predicted {predictedStars.toFixed(1)}★
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Verdict */}
            <div style={{ borderTop: '0.5px solid var(--paper-edge)', paddingTop: 20 }}>
              <h2 style={{
                fontFamily: 'var(--serif-display)', fontSize: 30, fontWeight: 600,
                lineHeight: 1.15, margin: '0 0 12px', color: v.accent ?? 'var(--ink)',
              }}>
                {v.headline}
              </h2>
              <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)', margin: 0, lineHeight: 1.6 }}>
                {v.body}
              </p>
            </div>
          </div>

          {/* ── Supporting detail pills ────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>

            {/* Dimensional note */}
            {fitDimension && fitPole && (
              <div style={{ padding: '13px 16px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 10 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 6 }}>
                  {fitAnswer === 'yes' || fitAnswer === 'surprisingly_yes' ? 'WHAT PULLED YOU IN' : "WHAT DIDN'T LAND"}
                </div>
                <div style={{ fontFamily: 'var(--serif-body)', fontSize: 14, color: 'var(--ink)' }}>
                  {DIM_LABELS[fitDimension]?.[fitPole]}
                </div>
              </div>
            )}

            {/* Rewatch */}
            {rewatch === true && (
              <div style={{ padding: '13px 16px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 4 }}>REWATCHABILITY</div>
                  <div style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)' }}>
                    {rewatchScore >= 8 ? "you'd return to this anytime" : rewatchScore >= 5 ? 'worth revisiting someday' : "you could rewatch it, no rush"}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--serif-display)', fontSize: 26, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, flexShrink: 0, marginLeft: 16 }}>
                  {rewatchScore}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ink-4)' }}>/10</span>
                </div>
              </div>
            )}

            {/* No-prediction note (small, secondary) */}
            {!hasFullPrediction && noPredNote && (
              <div style={{ padding: '11px 14px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 8 }}>
                <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', margin: 0, lineHeight: 1.5, letterSpacing: '0.02em' }}>
                  {noPredNote}
                </p>
              </div>
            )}

            {/* Taste code letter shifts — MBTI-style boxes */}
            {(tasteShifts.length > 0 || shiftsLoading) && (
              <div style={{ padding: '16px 18px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 10 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 14 }}>
                  WHAT SHIFTED IN YOUR PROFILE
                </div>
                {shiftsLoading ? (
                  <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', margin: 0, letterSpacing: '0.04em' }}>computing…</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                      {tasteShifts.map(s => {
                        const isUp = s.direction === 'up'
                        const accent = isUp ? 'var(--s-ink)' : 'var(--p-ink)'
                        return (
                          <div key={s.letter} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                            {/* MBTI-style tile */}
                            <div style={{
                              position: 'relative',
                              width: 56, height: 56,
                              borderRadius: 10,
                              background: accent,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: `0 2px 8px ${isUp ? 'rgba(100,140,100,0.35)' : 'rgba(140,80,80,0.35)'}`,
                            }}>
                              <span style={{
                                fontFamily: 'var(--serif-display)', fontSize: 28, fontWeight: 700,
                                color: '#fff', lineHeight: 1,
                              }}>
                                {s.letter}
                              </span>
                              {/* Arrow badge top-right */}
                              <div style={{
                                position: 'absolute', top: -5, right: -5,
                                width: 18, height: 18, borderRadius: '50%',
                                background: 'var(--paper)',
                                border: `1.5px solid ${accent}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 9, color: accent, fontWeight: 700,
                              }}>
                                {isUp ? '▲' : '▼'}
                              </div>
                            </div>
                            {/* Label */}
                            <div style={{
                              fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)',
                              letterSpacing: '0.05em', textTransform: 'uppercase',
                              textAlign: 'center', lineHeight: 1.3,
                              maxWidth: 56, wordBreak: 'break-word',
                            }}>
                              {s.label}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', margin: 0, lineHeight: 1.6 }}>
                      {shiftsProse(tasteShifts, film?.title)}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Friend match scores ──────────────────────────────────── */}
          {(friendScoresLoading || friendScores.length > 0) && (
            <div style={{ padding: '16px 18px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 12 }}>
                HOW YOUR FRIENDS WOULD RATE THIS
              </div>
              {friendScoresLoading ? (
                <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', margin: 0, letterSpacing: '0.04em' }}>checking…</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {friendScores.map(f => (
                    <div
                      key={f.id}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                    >
                      <button
                        onClick={async () => {
                          if (!film?.id) return
                          await fetch('/api/recommendations', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ filmId: film.id, toUserId: f.id, note: '' }),
                          })
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          fontFamily: 'var(--serif-italic)', fontStyle: 'italic',
                          fontSize: 13, color: 'var(--ink-2)', textAlign: 'left',
                          textDecoration: 'underline', textDecorationColor: 'var(--paper-edge)',
                        }}
                        title={`Recommend to ${f.name}`}
                      >
                        {f.name}
                      </button>
                      <div style={{
                        fontFamily: 'var(--mono)', fontSize: 11,
                        color: f.matchScore >= 70 ? 'var(--s-ink)' : f.matchScore >= 45 ? 'var(--ink-2)' : 'var(--p-ink)',
                        fontWeight: 600, flexShrink: 0,
                      }}>
                        {f.matchScore}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="btn"
              onClick={() => router.push('/profile')}
              style={{ padding: '13px 24px', fontSize: 14, borderRadius: 999 }}
            >
              see your taste profile →
            </button>
            <button
              className="btn btn-soft"
              onClick={() => router.push('/home')}
              style={{ padding: '11px 20px', fontSize: 13, borderRadius: 999 }}
            >
              back to home
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
