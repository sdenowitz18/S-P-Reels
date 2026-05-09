'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { DimBreakdown } from '@/app/api/films/route'
import { LetterTooltip } from '@/components/letter-tooltip'

// ── Taste shift types (mirrors rate page) ────────────────────────────────────
type TasteEntry = { dimKey: string; poleScore: number; letter: string; label: string; dominantPole: 'left' | 'right' }
type TasteShift = { letter: string; label: string; delta: number; direction: 'up' | 'down' }

function computeTasteShiftsFn(before: TasteEntry[], after: TasteEntry[]): TasteShift[] {
  return before
    .map(pre => {
      const post = after.find(e => e.dimKey === pre.dimKey)
      if (!post) return null
      const delta = post.dominantPole === pre.dominantPole
        ? post.poleScore - pre.poleScore
        : -(post.poleScore + pre.poleScore) / 2
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
  if (ups.length)   parts.push(`${ups.join(' and ')} climbed`)
  if (downs.length) parts.push(`${downs.join(' and ')} pulled back`)
  const base = parts.join(', ')
  return filmTitle ? `${filmTitle} moved your taste profile — ${base}.` : `${base} in your taste profile.`
}

export interface PanelFilm {
  id: string
  title: string
  year: number | null
  poster_path: string | null
  director: string | null
  kind: 'movie' | 'tv'
  genres: string[]
  aiGenres: string[]
  synopsis?: string | null
  tmdb_id?: number | null
  tmdb_vote_average?: number | null
  tmdb_vote_count?: number | null
  imdb_rating?: number | null
  rt_score?: number | null
  metacritic?: number | null
  matchScore: number | null
  tasteScore: number | null
  compositeQuality: number | null
  dimBreakdown?: DimBreakdown[]
  libraryStatus: { list: string; my_stars: number | null } | null
  recommendedBy?: string[]
  /** Friends who've watched this film — populated in Network catalog mode */
  watchers?: { id: string; name: string; stars: number | null }[]
}

interface Props {
  film: PanelFilm | null
  onClose: () => void
  onLibraryChange: (filmId: string, status: { list: string; my_stars: number | null } | null) => void
}

/** Same display-only transform as the catalog grid — see page.tsx for rationale. */
function displayScore(raw: number): number {
  return Math.min(99, Math.round(2 * raw - (raw * raw) / 100))
}

function matchColor(displayed: number) {
  if (displayed >= 90) return '#1a5c32'
  if (displayed >= 80) return '#3d7a4a'
  if (displayed >= 70) return '#8a6a20'
  return '#6b4040'
}

// ── Dim tile helpers ─────────────────────────────────────────────────────────

function dimLetters(entry: DimBreakdown) {
  // leftLetter/rightLetter are now absolute (left = score 0 pole, right = score 100 pole)
  const filmLetter = entry.filmScore < 50 ? entry.leftLetter : entry.rightLetter
  const filmLabel  = entry.filmScore < 50 ? entry.leftLabel  : entry.rightLabel

  // User prefers right when userBias > 0 (they like high-scoring films on this dim)
  const userPrefersRight = entry.userBias > 0
  const userLetter = userPrefersRight ? entry.rightLetter : entry.leftLetter
  const userLabel  = userPrefersRight ? entry.rightLabel  : entry.leftLabel

  return { filmLetter, filmLabel, userLetter, userLabel, leftLabel: entry.leftLabel, rightLabel: entry.rightLabel }
}

type AlignTier = 'strong' | 'aligned' | 'neutral' | 'opposed'

// Based on how the user rates films at the pole this film leans toward (0–100 normalized)
function alignTier(filmPoleScore: number): AlignTier {
  if (filmPoleScore >= 68) return 'strong'
  if (filmPoleScore >= 52) return 'aligned'
  if (filmPoleScore >= 38) return 'neutral'
  return 'opposed'
}

const TIER_STYLE: Record<AlignTier, { bg: string; fg: string; label: string }> = {
  strong:  { bg: '#1a5c32', fg: '#fff',                   label: 'You love these' },
  aligned: { bg: '#3d7a4a', fg: '#fff',                   label: 'You like these' },
  neutral: { bg: 'var(--paper-edge)', fg: 'var(--ink-3)', label: 'Mixed'          },
  opposed: { bg: '#7a3030', fg: '#fff',                   label: 'Not your usual' },
}

// H/M/L based on how the user rates films at the pole THIS FILM leans toward.
// H = you tend to enjoy films like this. L = you tend not to.
function filmPoleTier(entry: DimBreakdown): 'H' | 'M' | 'L' {
  if (entry.filmPoleScore >= 65) return 'H'
  if (entry.filmPoleScore >= 35) return 'M'
  return 'L'
}

function dimDescription(entry: DimBreakdown): string {
  const { filmLabel, leftLabel, rightLabel } = dimLetters(entry)
  const tier     = alignTier(entry.filmPoleScore)
  const lean     = Math.abs(entry.filmScore - 50)
  const strength = lean >= 30 ? 'strongly' : lean >= 15 ? 'moderately' : 'slightly'

  // Does the user prefer this film's pole, or the opposite?
  const userPrefersFilmPole = entry.filmScore >= 50
    ? entry.userBias >= 0   // film leans right, user prefers right if bias >= 0
    : entry.userBias <= 0   // film leans left, user prefers left if bias <= 0
  const prefNote = userPrefersFilmPole
    ? 'which is also your preferred direction'
    : 'even though you slightly prefer the other end of this spectrum'

  if (tier === 'strong') {
    return `This film leans ${strength} ${filmLabel.toLowerCase()} on the ${leftLabel}–${rightLabel} spectrum. You tend to rate ${filmLabel.toLowerCase()} films very highly — ${prefNote}.`
  }
  if (tier === 'aligned') {
    return `This film leans ${strength} ${filmLabel.toLowerCase()} on the ${leftLabel}–${rightLabel} spectrum. You generally enjoy ${filmLabel.toLowerCase()} films, ${prefNote}.`
  }
  if (tier === 'opposed') {
    return `This film leans ${filmLabel.toLowerCase()} on the ${leftLabel}–${rightLabel} spectrum — a characteristic you tend to rate lower. This pulls its score down a bit.`
  }
  return `This film sits somewhere on the ${leftLabel}–${rightLabel} spectrum. Your ratings for films like this are mixed, so it doesn't move the score much either way.`
}

function DimTile({ entry, expanded, onToggle, tileIndex, tileCount }: {
  entry: DimBreakdown
  expanded: boolean
  onToggle: () => void
  tileIndex?: number
  tileCount?: number
}) {
  const { filmLetter, filmLabel } = dimLetters(entry)
  const tier   = alignTier(entry.filmPoleScore)
  const tstyle = TIER_STYLE[tier]

  // Smart tooltip alignment: right-align for leftmost tile, left-align for rightmost
  const count = tileCount ?? 4
  const idx   = tileIndex ?? 0
  // leftmost tile: anchor tooltip to left edge → extends rightward (stays in panel)
  // rightmost tile: anchor tooltip to right edge → extends leftward (stays in panel)
  const tooltipAlign: 'left' | 'center' | 'right' =
    idx === 0         ? 'left'  :
    idx === count - 1 ? 'right' :
    'center'

  return (
    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={onToggle}>
      {/* Letter tile */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        padding: '10px 6px',
        borderRadius: 8,
        background: expanded ? tstyle.bg + 'dd' : tstyle.bg + '22',
        border: `1px solid ${tstyle.bg}44`,
        transition: 'all 150ms',
      }}>
        <LetterTooltip letter={filmLetter} align={tooltipAlign}>
          <span style={{
            fontFamily: 'var(--serif-display)', fontSize: 28, fontWeight: 700, lineHeight: 1,
            color: expanded ? tstyle.fg : (tier === 'neutral' ? 'var(--ink-3)' : tstyle.bg),
          }}>
            {filmLetter}
          </span>
        </LetterTooltip>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 7, letterSpacing: '0.07em',
          textTransform: 'uppercase', lineHeight: 1,
          color: expanded ? tstyle.fg + 'cc' : 'var(--ink-4)',
        }}>
          {filmLabel}
        </span>
      </div>
      {/* Dim label */}
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 7.5, textAlign: 'center',
        color: 'var(--ink-4)', marginTop: 4, letterSpacing: '0.03em',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {filmLabel}
      </div>
    </div>
  )
}

// ── Star picker (quick rate) ─────────────────────────────────────────────────

const STAR_VALUES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

function StarPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const active = hover ?? value

  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 1px',
              fontSize: isHalf ? 15 : 18, lineHeight: 1,
              color: filled ? 'var(--sun)' : 'var(--paper-edge)',
              transition: 'color 60ms',
              opacity: isHalf ? 0.8 : 1,
            }}
          >
            {isHalf ? '½' : '★'}
          </button>
        )
      })}
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function FilmPanel({ film, onClose, onLibraryChange }: Props) {
  const router = useRouter()
  const [saving, setSaving]                   = useState(false)
  const [expandedDim, setExpandedDim]         = useState<string | null>(null)
  const [quickRating, setQuickRating]         = useState<number | null>(null)
  const [showQuickRate, setShowQuickRate]     = useState(false)
  const [quickRateDone, setQuickRateDone]     = useState(false)
  const [tasteShifts, setTasteShifts]         = useState<TasteShift[]>([])
  const [shiftsLoading, setShiftsLoading]     = useState(false)
  const [trailerUrl, setTrailerUrl]           = useState<string | null>(null)
  const preTasteRef                           = useRef<TasteEntry[] | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Reset quick rate state when film changes, and fetch trailer
  useEffect(() => {
    setQuickRating(null)
    setShowQuickRate(false)
    setQuickRateDone(false)
    setTasteShifts([])
    setTrailerUrl(null)
    preTasteRef.current = null
    if (film?.id) {
      fetch(`/api/films/${film.id}/trailer`)
        .then(r => r.json())
        .then(d => { if (d.url) setTrailerUrl(d.url) })
        .catch(() => {})
    }
  }, [film?.id])

  const handleBackdrop = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
  }

  const addToWatchlist = async () => {
    if (!film || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filmId: film.id, list: 'watchlist', audience: ['me'] }),
      })
      if (res.ok) onLibraryChange(film.id, { list: 'watchlist', my_stars: null })
    } finally {
      setSaving(false)
    }
  }

  const openQuickRate = async () => {
    setShowQuickRate(true)
    // Grab pre-save taste entries in background
    try {
      const res = await fetch('/api/profile/taste').then(r => r.json())
      if (res?.tasteCode?.allEntries) preTasteRef.current = res.tasteCode.allEntries as TasteEntry[]
    } catch {}
  }

  const saveQuickRate = async () => {
    if (!film || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filmId: film.id, list: 'watched', audience: ['me'], myStars: quickRating }),
      })
      if (res.ok) {
        onLibraryChange(film.id, { list: 'watched', my_stars: quickRating })
        setQuickRateDone(true)
        // Compute taste shifts in background
        if (preTasteRef.current) {
          setShiftsLoading(true)
          try {
            const newRes = await fetch('/api/profile/taste').then(r => r.json())
            const postEntries = newRes?.tasteCode?.allEntries as TasteEntry[] | undefined
            if (postEntries && preTasteRef.current) {
              setTasteShifts(computeTasteShiftsFn(preTasteRef.current, postEntries))
            }
          } catch {}
          setShiftsLoading(false)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const goRate = () => {
    if (!film) return
    // Write the film into sessionStorage so the stage/rate pages pick up the right movie
    sessionStorage.setItem('sp_film', JSON.stringify({
      id:          film.id,
      title:       film.title,
      year:        film.year,
      kind:        film.kind,
      poster_path: film.poster_path,
      director:    film.director,
    }))
    router.push(`/add/${film.id}/stage`)
  }

  if (!film) return null

  const isWatched   = film.libraryStatus?.list === 'watched'
  const isWatchlist = film.libraryStatus?.list === 'watchlist'
  const justWatchUrl = `https://www.justwatch.com/us/search?q=${encodeURIComponent(film.title)}`

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        ref={panelRef}
        style={{
          width: 'min(420px, 95vw)', height: '100%',
          background: 'var(--paper)', borderLeft: '0.5px solid var(--paper-edge)',
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
          animation: 'slideIn 180ms ease',
        }}
      >
        <style>{`@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>

        {/* Close */}
        <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.08em', padding: '4px 8px' }}>
            ✕ close
          </button>
        </div>

        {/* Poster + core info */}
        <div style={{ padding: '12px 20px 20px', display: 'flex', gap: 16 }}>
          <div style={{ width: 100, flexShrink: 0, aspectRatio: '2/3', borderRadius: 6, overflow: 'hidden', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', position: 'relative' }}>
            {film.poster_path
              ? <Image src={film.poster_path} alt={film.title} fill style={{ objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--ink-4)', textAlign: 'center' }}>{film.title.toUpperCase()}</div>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
            <div style={{ fontFamily: 'var(--serif-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 5 }}>{film.title}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)', letterSpacing: '0.04em', marginBottom: 3 }}>
              {film.year ?? '—'}{film.director ? ` · ${film.director}` : ''}
            </div>
            {film.genres.length > 0 && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)', letterSpacing: '0.04em', marginBottom: 10 }}>
                {film.genres.slice(0, 3).join(' · ')}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {film.matchScore != null && (() => {
                const displayed = displayScore(Math.round(film.matchScore))
                return (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: matchColor(displayed), borderRadius: 6, padding: '4px 10px' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 800, color: '#fff' }}>{displayed}%</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.06em' }}>match</span>
                  </div>
                )
              })()}
              {film.rt_score != null && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 6, padding: '4px 9px' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)' }}>RT</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: film.rt_score >= 70 ? '#c0392b' : 'var(--ink-2)' }}>
                    {film.rt_score}%
                  </span>
                </div>
              )}
              {film.metacritic != null && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 6, padding: '4px 9px' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)' }}>MC</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                    {film.metacritic}
                  </span>
                </div>
              )}
              {film.imdb_rating != null && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 6, padding: '4px 9px' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)' }}>IMDb</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                    {film.imdb_rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
            {trailerUrl && (
              <a
                href={trailerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: 'var(--mono)', fontSize: 9.5,
                  textDecoration: 'none', letterSpacing: '0.04em',
                  padding: '7px 14px', borderRadius: 999,
                  border: '0.5px solid #c00',
                  background: '#fff0f0',
                  color: '#c00',
                  marginTop: 8,
                }}
              >
                ▶ trailer
              </a>
            )}
          </div>
        </div>

        <div style={{ borderTop: '0.5px solid var(--paper-edge)', margin: '0 20px' }} />

        {/* Actions */}
        <div style={{ padding: '16px 20px' }}>
          {isWatched ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={goRate} style={{ flex: 1, padding: '9px 0', borderRadius: 999, cursor: 'pointer', border: '0.5px solid var(--paper-edge)', background: 'var(--paper-2)', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.07em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
                ✓ {film.libraryStatus?.my_stars ? `${film.libraryStatus.my_stars}★` : 'watched'} · edit
              </button>
            </div>
          ) : quickRateDone ? (
            /* Post-save reveal */
            <div style={{ background: 'var(--bone)', borderRadius: 12, padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontFamily: 'var(--serif-display)', fontSize: 24, fontWeight: 700, color: 'var(--sun)', lineHeight: 1 }}>
                  {quickRating != null ? `${quickRating}★` : '—'}
                </span>
                <div>
                  <div style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>{film.title}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--s-ink)', letterSpacing: '0.06em', marginTop: 2 }}>✓ LOGGED</div>
                </div>
              </div>

              {/* Taste shifts */}
              {shiftsLoading ? (
                <p style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', margin: '0 0 12px', letterSpacing: '0.04em' }}>reading your profile…</p>
              ) : tasteShifts.length > 0 ? (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 7.5, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                    top movers
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {tasteShifts.map(s => {
                      const isUp = s.direction === 'up'
                      const accent = isUp ? 'var(--s-ink)' : 'var(--p-ink)'
                      return (
                        <div key={s.letter} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{
                            position: 'relative', width: 44, height: 44, borderRadius: 8,
                            background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                              {s.letter}
                            </span>
                            <div style={{
                              position: 'absolute', top: -4, right: -4, width: 14, height: 14,
                              borderRadius: '50%', background: 'var(--paper)', border: `1.5px solid ${accent}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 7, color: accent, fontWeight: 700,
                            }}>
                              {isUp ? '▲' : '▼'}
                            </div>
                          </div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 6.5, color: 'var(--ink-4)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em', maxWidth: 44, lineHeight: 1.3 }}>
                            {s.label}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>
                    {shiftsProse(tasteShifts, film.title)}
                  </p>
                </div>
              ) : (
                <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', margin: '0 0 12px', lineHeight: 1.55 }}>
                  Small refinements — your profile keeps sharpening with every film you log.
                </p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => router.push('/profile')}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 999, cursor: 'pointer', border: 'none', background: 'var(--ink)', color: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase' }}
                >
                  taste profile →
                </button>
                <button
                  onClick={onClose}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 999, cursor: 'pointer', border: '0.5px solid var(--paper-edge)', background: 'var(--paper-2)', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase' }}
                >
                  done
                </button>
              </div>
            </div>
          ) : showQuickRate ? (
            /* Quick rate widget */
            <div style={{ background: 'var(--bone)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 10 }}>
                how'd you like it?
              </div>
              <StarPicker value={quickRating} onChange={setQuickRating} />
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <button
                  onClick={saveQuickRate}
                  disabled={saving}
                  style={{
                    padding: '8px 20px', borderRadius: 999, cursor: saving ? 'default' : 'pointer',
                    border: 'none', background: 'var(--ink)', color: 'var(--paper)',
                    fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.07em',
                    textTransform: 'uppercase', opacity: saving ? 0.5 : 1,
                  }}
                >
                  {saving ? 'saving…' : 'save'}
                </button>
                <button
                  onClick={() => { setShowQuickRate(false); setQuickRating(null) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', padding: '8px 4px' }}
                >
                  cancel
                </button>
                <button
                  onClick={goRate}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--s-ink)', letterSpacing: '0.04em', padding: '8px 0', textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  log in full →
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={openQuickRate}
                style={{ flex: 1, padding: '9px 0', borderRadius: 999, cursor: 'pointer', border: 'none', background: 'var(--ink)', color: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase' }}
              >
                i've seen this ★
              </button>
              <button
                onClick={isWatchlist ? undefined : addToWatchlist}
                disabled={saving}
                style={{ flex: 1, padding: '9px 0', borderRadius: 999, cursor: isWatchlist ? 'default' : 'pointer', border: '0.5px solid var(--paper-edge)', background: 'var(--paper-2)', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.07em', color: isWatchlist ? 'var(--ink-4)' : 'var(--ink-3)', textTransform: 'uppercase', opacity: saving ? 0.5 : 1 }}
              >
                {isWatchlist ? '✓ on watchlist' : '+ watchlist'}
              </button>
            </div>
          )}
        </div>

        {/* Synopsis */}
        {film.synopsis && (
          <>
            <div style={{ borderTop: '0.5px solid var(--paper-edge)', margin: '0 20px' }} />
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 8 }}>synopsis</div>
              <p style={{ fontFamily: 'var(--serif-body)', fontStyle: 'italic', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {film.synopsis}
              </p>
            </div>
          </>
        )}

        {/* Why it matches — 4 tiles */}
        {(film.dimBreakdown?.length ?? 0) > 0 && (
          <>
            <div style={{ borderTop: '0.5px solid var(--paper-edge)', margin: '0 20px' }} />
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 12 }}>
                key film attributes
              </div>

              {/* 4 tiles in a row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {film.dimBreakdown!.map((entry, i) => (
                  <DimTile
                    key={entry.dimKey}
                    entry={entry}
                    expanded={expandedDim === entry.dimKey}
                    onToggle={() => setExpandedDim(prev => prev === entry.dimKey ? null : entry.dimKey)}
                    tileIndex={i}
                    tileCount={film.dimBreakdown!.length}
                  />
                ))}
              </div>

              {/* Expanded description */}
              {expandedDim && (() => {
                const entry = film.dimBreakdown!.find(e => e.dimKey === expandedDim)
                if (!entry) return null
                const tier   = alignTier(entry.filmPoleScore)
                const tstyle = TIER_STYLE[tier]
                return (
                  <div style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: tstyle.bg + '15',
                    border: `0.5px solid ${tstyle.bg}44`,
                    marginBottom: 8,
                  }}>
                    <p style={{ fontFamily: 'var(--serif-body)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>
                      {dimDescription(entry)}
                    </p>
                  </div>
                )
              })()}

              <p style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', lineHeight: 1.5, margin: 0, letterSpacing: '0.02em' }}>
                tap any letter to see why.
              </p>
            </div>
          </>
        )}

        {/* Your network has seen this */}
        {film.watchers && film.watchers.length > 0 && (
          <>
            <div style={{ borderTop: '0.5px solid var(--paper-edge)', margin: '0 20px' }} />
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 12 }}>
                your network
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {film.watchers.map(w => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'var(--paper-edge)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                      color: 'var(--ink-3)', flexShrink: 0,
                    }}>
                      {w.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500, color: 'var(--ink)', flex: 1 }}>
                      {w.name.split(' ')[0]}
                    </span>
                    {w.stars != null && (
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--sun)', letterSpacing: '0.02em' }}>
                        {w.stars}★
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Friend recs */}
        {film.recommendedBy && film.recommendedBy.length > 0 && (
          <>
            <div style={{ borderTop: '0.5px solid var(--paper-edge)', margin: '0 20px' }} />
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 8 }}>recommended by</div>
              <div style={{ fontFamily: 'var(--serif-body)', fontSize: 13.5, color: 'var(--ink-2)' }}>{film.recommendedBy.join(', ')}</div>
            </div>
          </>
        )}

        {/* Where to watch */}
        <>
          <div style={{ borderTop: '0.5px solid var(--paper-edge)', margin: '0 20px' }} />
          <div style={{ padding: '16px 20px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <a
                href={justWatchUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)', textDecoration: 'none', letterSpacing: '0.04em', padding: '7px 14px', borderRadius: 999, border: '0.5px solid var(--paper-edge)', background: 'var(--paper-2)' }}
              >
                search on JustWatch →
              </a>
            </div>
          </div>
        </>
      </div>
    </div>
  )
}
