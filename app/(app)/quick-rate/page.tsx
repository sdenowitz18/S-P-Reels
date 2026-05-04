'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import type { TasteCode, TasteCodeEntry } from '@/lib/taste-code'

// ── Types ─────────────────────────────────────────────────────────────────────

type Stage = 'intro' | 'rating' | 'calculating' | 'result'

type RatingFilm = {
  id: string
  title: string
  year: number | null
  poster_path: string | null
  director: string | null
  kind: 'movie' | 'tv'
  matchScore: number | null
}

type StrengthTier = 'strong' | 'medium' | 'weak'

type DimShift = {
  dimKey: string
  preEntry: TasteCodeEntry
  postEntry: TasteCodeEntry
  poleSwitched: boolean
  direction: 'up' | 'down'
  deltaMagnitude: number
  preStrength: StrengthTier
  postStrength: StrengthTier
  strengthChange: 'stronger' | 'weaker' | 'same'
  isNewToTop4: boolean
  isDroppedFromTop4: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function strengthTier(poleScore: number): StrengthTier {
  if (poleScore >= 70) return 'strong'
  if (poleScore >= 40) return 'medium'
  return 'weak'
}

const TIER_LABEL: Record<StrengthTier, string> = { strong: 'H', medium: 'M', weak: 'L' }

function computeShifts(pre: TasteCode, post: TasteCode): DimShift[] {
  const preTop4  = new Set(pre.entries.map(e => e.dimKey))
  const postTop4 = new Set(post.entries.map(e => e.dimKey))
  const preMap   = new Map(pre.allEntries.map(e => [e.dimKey, e]))
  const postMap  = new Map(post.allEntries.map(e => [e.dimKey, e]))

  const shifts: DimShift[] = []
  for (const [dimKey, preEntry] of preMap) {
    const postEntry = postMap.get(dimKey)
    if (!postEntry) continue
    const poleSwitched   = preEntry.pole !== postEntry.pole
    const preStrength    = strengthTier(preEntry.poleScore)
    const postStrength   = strengthTier(postEntry.poleScore)
    const deltaMagnitude = poleSwitched
      ? preEntry.poleScore + postEntry.poleScore
      : Math.abs(postEntry.poleScore - preEntry.poleScore)
    const direction = poleSwitched
      ? (postEntry.poleScore > 50 ? 'up' : 'down')
      : postEntry.poleScore >= preEntry.poleScore ? 'up' : 'down'
    const strengthChange: DimShift['strengthChange'] =
      postStrength === preStrength ? 'same' :
      (postStrength === 'strong' || (postStrength === 'medium' && preStrength === 'weak')) ? 'stronger' : 'weaker'

    shifts.push({
      dimKey, preEntry, postEntry, poleSwitched, direction, deltaMagnitude,
      preStrength, postStrength, strengthChange,
      isNewToTop4:       !preTop4.has(dimKey) && postTop4.has(dimKey),
      isDroppedFromTop4:  preTop4.has(dimKey) && !postTop4.has(dimKey),
    })
  }
  return shifts.sort((a, b) => b.deltaMagnitude - a.deltaMagnitude)
}

function shiftsToInsights(shifts: DimShift[]): { type: string; text: string }[] {
  const out: { type: string; text: string }[] = []
  for (const s of shifts.filter(s => s.poleSwitched))
    out.push({ type: 'switch', text: `Your sense of ${s.postEntry.dimKey.replace(/_/g, ' ')} shifted — was leaning ${s.preEntry.label}, now leans ${s.postEntry.label}.` })
  for (const s of shifts.filter(s => !s.poleSwitched && s.strengthChange !== 'same'))
    out.push({ type: s.strengthChange === 'stronger' ? 'up' : 'down', text: `Your ${s.postEntry.label} signal ${s.strengthChange === 'stronger' ? 'sharpened' : 'softened'} — ${TIER_LABEL[s.preStrength]} → ${TIER_LABEL[s.postStrength]}.` })
  for (const s of shifts.filter(s => s.isNewToTop4 && !s.poleSwitched))
    out.push({ type: 'new', text: `${s.postEntry.label} entered your top signals — this taste is becoming more consistent.` })
  for (const s of shifts.filter(s => s.isDroppedFromTop4 && !s.poleSwitched))
    out.push({ type: 'dropped', text: `${s.preEntry.label} stepped back from your top signals — more mixed evidence now.` })
  return out.slice(0, 6)
}

// ── Letter tile (animating during calculation) ────────────────────────────────

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function AnimatedTile({ finalLetter, delay, size = 72 }: {
  finalLetter: string | null
  delay: number
  size?: number
}) {
  const [display, setDisplay] = useState(ALPHABET[Math.floor(Math.random() * 26)])
  const [locked, setLocked]   = useState(false)

  useEffect(() => {
    if (locked) return
    const iv = setInterval(() => setDisplay(ALPHABET[Math.floor(Math.random() * 26)]), 80)
    return () => clearInterval(iv)
  }, [locked])

  useEffect(() => {
    if (!finalLetter) return
    const timer = setTimeout(() => {
      let tick = 0
      const iv = setInterval(() => {
        tick++
        if (tick >= 10) { clearInterval(iv); setDisplay(finalLetter); setLocked(true) }
        else setDisplay(ALPHABET[Math.floor(Math.random() * 26)])
      }, 70)
      return () => clearInterval(iv)
    }, delay)
    return () => clearTimeout(timer)
  }, [finalLetter, delay])

  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size / 6),
      background: locked ? 'var(--ink)' : 'var(--paper-edge)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background 400ms ease',
    }}>
      <span style={{
        fontFamily: 'var(--serif-display)', fontSize: size * 0.53, fontWeight: 700,
        color: locked ? 'var(--paper)' : 'var(--ink-4)',
        transition: 'color 300ms ease', letterSpacing: '-0.01em',
      }}>
        {display}
      </span>
    </div>
  )
}

function StaticTile({ letter, size = 56 }: { letter: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size / 6),
      background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--serif-display)', fontSize: size * 0.53, fontWeight: 700,
        color: 'var(--paper)', letterSpacing: '-0.01em',
      }}>
        {letter}
      </span>
    </div>
  )
}

// ── Star picker ───────────────────────────────────────────────────────────────

const STAR_VALUES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

function StarPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const active = hover ?? value

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
      {STAR_VALUES.map(v => {
        const isHalf = v % 1 !== 0
        const filled = active != null && v <= active
        return (
          <button
            key={v}
            onMouseEnter={() => setHover(v)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onChange(v)}
            title={`${v}★`}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: isHalf ? '4px 2px' : '4px 3px',
              fontSize: isHalf ? 22 : 28, lineHeight: 1,
              color: filled ? 'var(--sun)' : 'var(--paper-edge)',
              transition: 'color 60ms, transform 60ms',
              transform: filled ? 'scale(1.08)' : 'scale(1)',
              opacity: isHalf ? 0.75 : 1,
            }}
          >
            {isHalf ? '½' : '★'}
          </button>
        )
      })}
    </div>
  )
}

// ── Insight card ──────────────────────────────────────────────────────────────

function InsightCard({ type, text }: { type: string; text: string }) {
  const accent = type === 'switch' ? 'var(--p-ink)' : type === 'up' ? 'var(--s-ink)' : type === 'down' ? '#7a3030' : 'var(--s-ink)'
  const icon   = type === 'switch' ? '⇄' : type === 'up' ? '▲' : type === 'down' ? '▼' : '★'
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '10px 12px', borderRadius: 8,
      background: accent + '12', border: `0.5px solid ${accent}33`,
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: accent, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>{text}</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuickRatePage() {
  const router = useRouter()

  const [stage, setStage]       = useState<Stage>('intro')
  const [films, setFilms]       = useState<RatingFilm[]>([])
  const [filmIndex, setFilmIndex] = useState(0)          // current film pointer
  const [ratedCount, setRatedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [justRated, setJustRated] = useState<number | null>(null)  // show brief confirm
  const [filmsLoading, setFilmsLoading] = useState(false)

  const preTasteRef  = useRef<TasteCode | null>(null)
  const [postTaste, setPostTaste]   = useState<TasteCode | null>(null)
  const [preLetters, setPreLetters] = useState<string>('')
  const [calcDone, setCalcDone]     = useState(false)

  // ── Load films ────────────────────────────────────────────────────────────
  const loadFilms = useCallback(async () => {
    setFilmsLoading(true)
    try {
      const data = await fetch('/api/films/index').then(r => r.json())
      const all: RatingFilm[] = data.index ?? []
      const movies = all.filter(f => f.kind === 'movie')
      const tv     = all.filter(f => f.kind === 'tv')
      // Interleave 50/50
      const maxLen = Math.max(movies.length, tv.length)
      const mixed: RatingFilm[] = []
      for (let i = 0; i < maxLen; i++) {
        if (movies[i]) mixed.push(movies[i])
        if (tv[i])     mixed.push(tv[i])
      }
      setFilms(mixed)
    } finally {
      setFilmsLoading(false)
    }
  }, [])

  // ── Fetch taste snapshot ──────────────────────────────────────────────────
  const fetchTaste = useCallback(async (): Promise<TasteCode | null> => {
    try {
      const res = await fetch('/api/profile/taste').then(r => r.json())
      if (res?.tasteCode) return res.tasteCode as TasteCode
    } catch {}
    return null
  }, [])

  // Fetch on mount to show current code in intro
  useEffect(() => {
    fetchTaste().then(tc => {
      if (tc) { preTasteRef.current = tc; setPreLetters(tc.letters ?? '') }
    })
  }, [fetchTaste])

  // ── Start ────────────────────────────────────────────────────────────────
  const startRating = async () => {
    setStage('rating')
    const [, tc] = await Promise.all([loadFilms(), fetchTaste()])
    if (tc) { preTasteRef.current = tc; setPreLetters(tc.letters ?? '') }
  }

  // ── Rate current film ────────────────────────────────────────────────────
  const rateFilm = useCallback(async (stars: number) => {
    const film = films[filmIndex]
    if (!film) return

    setJustRated(stars)
    setRatedCount(c => c + 1)

    // Save to library
    fetch('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filmId: film.id, list: 'watched', audience: ['me'], myStars: stars }),
    }).catch(() => {})

    // Brief confirmation delay then advance
    setTimeout(() => {
      setJustRated(null)
      setFilmIndex(i => i + 1)
    }, 500)
  }, [films, filmIndex])

  // ── Skip current film ────────────────────────────────────────────────────
  const skipFilm = useCallback(() => {
    setSkippedCount(c => c + 1)
    setFilmIndex(i => i + 1)
  }, [])

  // ── Done — calculate ─────────────────────────────────────────────────────
  const handleDone = useCallback(async () => {
    setStage('calculating')
    const [, tasteRes] = await Promise.all([
      new Promise(r => setTimeout(r, 2400)),
      fetchTaste(),
    ])
    setPostTaste(tasteRes)
    setCalcDone(true)
    await new Promise(r => setTimeout(r, 700))
    setStage('result')
  }, [fetchTaste])

  // ── Derived ──────────────────────────────────────────────────────────────
  const currentFilm  = films[filmIndex] ?? null
  const allSeen      = filmIndex >= films.length && films.length > 0
  const finalLetters = postTaste?.letters ?? preLetters
  const finalEntries = postTaste?.entries ?? preTasteRef.current?.entries ?? []
  const shifts       = (preTasteRef.current && postTaste) ? computeShifts(preTasteRef.current, postTaste) : []
  const insights     = shiftsToInsights(shifts)

  // ── INTRO ─────────────────────────────────────────────────────────────────
  if (stage === 'intro') {
    return (
      <AppShell active="films">
        <div style={{ maxWidth: 560, margin: '0 auto', padding: 'clamp(56px,9vw,100px) clamp(24px,5vw,48px)' }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 20 }}>★ QUICK RATE</div>
          <h1 className="t-display" style={{ fontSize: 'clamp(36px,5vw,56px)', lineHeight: 1.05, margin: '0 0 22px' }}>
            rate what{' '}
            <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--s-ink)' }}>you've seen.</span>
          </h1>
          <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.7, margin: '0 0 12px' }}>
            Films and TV shows, one at a time. Rate anything you've watched — love it,
            hate it, it all counts. Skip anything you haven't seen.
          </p>
          <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.6, margin: '0 0 44px' }}>
            Stop whenever you like — your ratings save as you go.
          </p>

          {preLetters && (
            <div style={{ marginBottom: 40 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 10 }}>YOUR CURRENT CODE</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {preLetters.split('').map((l, i) => <StaticTile key={i} letter={l} size={48} />)}
              </div>
            </div>
          )}

          <button
            onClick={startRating}
            style={{
              padding: '14px 40px', borderRadius: 999, cursor: 'pointer',
              border: 'none', background: 'var(--ink)', color: 'var(--paper)',
              fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}
          >
            start →
          </button>
          <button
            onClick={() => router.back()}
            style={{
              marginLeft: 16, background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.06em',
            }}
          >
            cancel
          </button>
        </div>
      </AppShell>
    )
  }

  // ── RATING ────────────────────────────────────────────────────────────────
  if (stage === 'rating') {
    return (
      <AppShell active="films">
        <div style={{
          minHeight: '100dvh', display: 'flex', flexDirection: 'column',
          padding: 'clamp(20px,3vw,36px) clamp(20px,4vw,40px)',
          maxWidth: 560, margin: '0 auto', boxSizing: 'border-box',
        }}>

          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
              {ratedCount > 0 && <span style={{ color: 'var(--s-ink)', fontWeight: 600 }}>{ratedCount} rated</span>}
              {ratedCount > 0 && skippedCount > 0 && <span style={{ color: 'var(--ink-4)' }}> · </span>}
              {skippedCount > 0 && <span>{skippedCount} skipped</span>}
              {ratedCount === 0 && skippedCount === 0 && <span>rate what you've seen</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => router.back()}
                style={{
                  background: 'none', border: '0.5px solid var(--paper-edge)', borderRadius: 999,
                  padding: '6px 14px', cursor: 'pointer',
                  fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)', letterSpacing: '0.06em',
                }}
              >
                cancel
              </button>
              {ratedCount > 0 && (
                <button
                  onClick={handleDone}
                  style={{
                    background: 'var(--ink)', border: 'none', borderRadius: 999,
                    padding: '6px 16px', cursor: 'pointer',
                    fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--paper)',
                    letterSpacing: '0.07em', textTransform: 'uppercase',
                  }}
                >
                  done →
                </button>
              )}
            </div>
          </div>

          {/* Film card — centered, takes remaining space */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>

            {filmsLoading ? (
              <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)' }}>loading…</p>
            ) : allSeen ? (
              /* Ran through all films */
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--serif-display)', fontSize: 22, color: 'var(--ink)', marginBottom: 12 }}>
                  that's everything we have.
                </div>
                <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', margin: '0 0 24px' }}>
                  You've been through the whole catalog.
                </p>
                {ratedCount > 0 && (
                  <button onClick={handleDone} style={{
                    padding: '12px 28px', borderRadius: 999, border: 'none', background: 'var(--ink)',
                    color: 'var(--paper)', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    see my profile →
                  </button>
                )}
              </div>
            ) : currentFilm ? (
              <>
                {/* Poster */}
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: 'clamp(180px, 45vw, 240px)',
                    aspectRatio: '2/3',
                    borderRadius: 12, overflow: 'hidden',
                    background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
                    position: 'relative',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                    transition: 'opacity 200ms',
                    opacity: justRated != null ? 0.6 : 1,
                  }}>
                    {currentFilm.poster_path
                      ? <Image src={currentFilm.poster_path} alt={currentFilm.title} fill style={{ objectFit: 'cover' }} priority />
                      : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-4)', textAlign: 'center', lineHeight: 1.4 }}>
                          {currentFilm.title.toUpperCase()}
                        </div>
                      )
                    }
                    {/* Kind badge */}
                    {currentFilm.kind === 'tv' && (
                      <div style={{
                        position: 'absolute', top: 8, left: 8,
                        background: 'rgba(0,0,0,0.65)', borderRadius: 4,
                        padding: '2px 6px', fontFamily: 'var(--mono)', fontSize: 8,
                        fontWeight: 700, color: '#ccc', letterSpacing: '0.06em',
                      }}>TV</div>
                    )}
                    {/* Rated confirmation overlay */}
                    {justRated != null && (
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.3)',
                      }}>
                        <span style={{ fontFamily: 'var(--serif-display)', fontSize: 36, fontWeight: 700, color: 'var(--sun)', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                          {justRated}★
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Film info */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--serif-display)', fontSize: 'clamp(16px,3.5vw,22px)', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 5 }}>
                    {currentFilm.title}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>
                    {currentFilm.year ?? '—'}
                    {currentFilm.director ? ` · ${currentFilm.director}` : ''}
                  </div>
                </div>

                {/* Stars */}
                <StarPicker
                  value={justRated}
                  onChange={rateFilm}
                />

                {/* Skip */}
                <button
                  onClick={skipFilm}
                  disabled={justRated != null}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)',
                    letterSpacing: '0.06em', padding: '4px 12px',
                    opacity: justRated != null ? 0.3 : 1, transition: 'opacity 150ms',
                  }}
                >
                  haven't seen it — skip →
                </button>
              </>
            ) : null}
          </div>

          {/* Bottom padding */}
          <div style={{ flexShrink: 0, height: 24 }} />
        </div>
      </AppShell>
    )
  }

  // ── CALCULATING ───────────────────────────────────────────────────────────
  if (stage === 'calculating') {
    return (
      <AppShell active="films">
        <div style={{
          minHeight: '70vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 40,
          padding: 'clamp(48px,8vw,96px) 24px',
        }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.12em' }}>★ CALCULATING</div>
          <div style={{ display: 'flex', gap: 14 }}>
            {(finalLetters || 'FILM').split('').map((letter, i) => (
              <AnimatedTile key={i} finalLetter={calcDone ? letter : null} delay={i * 300} size={80} />
            ))}
          </div>
          <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink-3)', margin: 0, textAlign: 'center' }}>
            {calcDone ? 'profile updated.' : 'reading your taste…'}
          </p>
        </div>
      </AppShell>
    )
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  return (
    <AppShell active="films">
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 'clamp(48px,7vw,80px) clamp(24px,5vw,48px) 100px' }}>

        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 20 }}>★ YOUR TASTE PROFILE</div>

        <h1 className="t-display" style={{ fontSize: 'clamp(28px,4vw,40px)', lineHeight: 1.1, margin: '0 0 28px' }}>
          {ratedCount} film{ratedCount !== 1 ? 's' : ''} rated.{' '}
          <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--s-ink)' }}>here's what moved.</span>
        </h1>

        {/* Code tiles */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 14 }}>YOUR CODE</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {finalLetters.split('').map((l, i) => <StaticTile key={i} letter={l} size={60} />)}
          </div>
          {finalEntries.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {finalEntries.map(e => (
                <span key={e.dimKey} style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {e.letter} = {e.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Top movers */}
        {shifts.filter(s => s.deltaMagnitude >= 12).length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>top movers</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {shifts.filter(s => s.deltaMagnitude >= 12).slice(0, 4).map(s => {
                const isUp   = s.direction === 'up'
                const accent = s.poleSwitched ? 'var(--p-ink)' : isUp ? 'var(--s-ink)' : '#7a3030'
                const icon   = s.poleSwitched ? '⇄' : isUp ? '▲' : '▼'
                return (
                  <div key={s.dimKey} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ position: 'relative', width: 54, height: 54, borderRadius: 9, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--serif-display)', fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                        {s.postEntry.letter}
                      </span>
                      <div style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: 'var(--paper)', border: `1.5px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: accent, fontWeight: 700 }}>
                        {icon}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em', maxWidth: 54, lineHeight: 1.3 }}>
                      {s.postEntry.label}
                    </div>
                    {s.strengthChange !== 'same' && (
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: accent, letterSpacing: '0.02em' }}>
                        {TIER_LABEL[s.preStrength]} → {TIER_LABEL[s.postStrength]}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Insights */}
        {insights.length > 0 ? (
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>what changed</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {insights.map((ins, i) => <InsightCard key={i} type={ins.type} text={ins.text} />)}
            </div>
          </div>
        ) : (
          <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.65, margin: '0 0 40px' }}>
            {postTaste
              ? 'Your profile is stable — these ratings confirm your existing taste. That means your signals are getting more reliable.'
              : 'Keep rating to sharpen your profile — more data means clearer signals.'}
          </p>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/profile')} style={{
            padding: '12px 28px', borderRadius: 999, cursor: 'pointer', border: 'none',
            background: 'var(--ink)', color: 'var(--paper)',
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            view full profile →
          </button>
          <button
            onClick={() => { setStage('intro'); setRatedCount(0); setSkippedCount(0); setFilmIndex(0); setPostTaste(null); setCalcDone(false); setFilms([]); preTasteRef.current = null }}
            style={{
              padding: '12px 22px', borderRadius: 999, cursor: 'pointer',
              border: '0.5px solid var(--paper-edge)', background: 'var(--paper-2)',
              fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            rate more
          </button>
        </div>
      </div>
    </AppShell>
  )
}
