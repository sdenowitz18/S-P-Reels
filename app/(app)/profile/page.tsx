'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/app-shell'
import { FilmDetailPanel } from '@/components/film-detail-panel'
import { TasteDimensions } from '@/lib/prompts/taste-profile'
import { LibraryEntry } from '@/lib/types'
import { TasteCode, TasteCodeEntry } from '@/lib/taste-code'

interface GenreEntry { label: string; score: number; count: number; avgRating: number | null }
interface SignatureFilm { film_id: string; title: string; poster_path: string | null; stars: number }
interface TopFilm { film_id: string; title: string; poster_path: string | null; year: number | null; director: string | null; stars: number }
interface DirectorEntry { name: string; count: number; avgRating: number | null }
interface ActorEntry { name: string; count: number; avgRating: number | null }
interface DecadeEntry { decade: number; count: number; avgRating: number | null }
interface LibraryFilm {
  entry_id: string; film_id: string; title: string; year: number | null; poster_path: string | null
  director: string | null; genres: string[]; cast: string[]; my_stars: number | null
}

type CategoryType = 'director' | 'actor' | 'genre' | 'decade'
interface SelectedCategory { type: CategoryType; label: string; avgRating: number | null; count: number }

interface DiagnosticFilm {
  title: string; year: number | null; director: string | null; poster_path: string | null
  stars: number; deviation: number; skipped: boolean
  dimensions: { pace: number; story_engine: number; tone: number; warmth: number; complexity: number; style: number }
}

interface TasteProfile {
  dimensions: TasteDimensions
  genres: GenreEntry[]
  signature: SignatureFilm[]
  topRated: TopFilm[]
  prose: string | null
  directors: DirectorEntry[]
  actors: ActorEntry[]
  decades: DecadeEntry[]
  libraryFilms: LibraryFilm[]
  filmCount: number
  ratedCount: number
  tasteAvg: number
  diagnosticFilms: DiagnosticFilm[]
  tasteCode: TasteCode | null
}


// ── Taste Diagnostic ─────────────────────────────────────────────────────────

const DIM_KEYS = ['pace', 'story_engine', 'tone', 'warmth', 'complexity', 'style'] as const
const DIM_SHORT: Record<typeof DIM_KEYS[number], string> = {
  pace: 'PAC', story_engine: 'STR', tone: 'TON', warmth: 'WRM', complexity: 'CPX', style: 'STY',
}
const DIM_POLES: Record<typeof DIM_KEYS[number], [string, string]> = {
  pace:         ['patient', 'kinetic'],
  story_engine: ['character', 'plot'],
  tone:         ['light', 'dark'],
  warmth:       ['cold', 'warm'],
  complexity:   ['accessible', 'complex'],
  style:        ['restrained', 'expressive'],
}

function MiniDimBar({ value }: { value: number }) {
  const pct = ((value + 1) / 2) * 100
  const dotColor = value > 0.1 ? 'var(--s-ink)' : value < -0.1 ? 'var(--p-ink)' : 'var(--ink-4)'
  return (
    <div style={{ width: 44, height: 4, background: 'var(--paper-edge)', borderRadius: 999, position: 'relative', flexShrink: 0, margin: '0 auto' }}>
      <div style={{ position: 'absolute', left: '50%', top: -1, width: 1, height: 6, background: 'var(--ink-4)', opacity: 0.4 }} />
      <div style={{
        position: 'absolute', width: 6, height: 6, borderRadius: '50%',
        top: -1, left: `calc(${pct}% - 3px)`,
        background: dotColor,
      }} />
    </div>
  )
}

function DiagnosticPanel({ films, tasteAvg, myDimensions }: {
  films: DiagnosticFilm[]; tasteAvg: number; myDimensions: TasteDimensions
}) {
  const [open, setOpen] = useState(false)
  const [showSkipped, setShowSkipped] = useState(false)

  const active  = films.filter(f => !f.skipped)
  const skipped = films.filter(f => f.skipped)
  const visible = showSkipped ? films : active

  return (
    <div style={{ marginTop: 36, borderTop: '0.5px solid var(--paper-edge)', paddingTop: 24 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)',
          letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 7,
        }}
      >
        <span style={{ fontSize: 8 }}>{open ? '▾' : '▸'}</span>
        HOW YOUR TASTE VECTOR IS CALCULATED
      </button>

      {open && (
        <div style={{ marginTop: 20 }}>

          {/* Algorithm explanation */}
          <div style={{ padding: '16px 20px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 12, marginBottom: 24, lineHeight: 1.65, color: 'var(--ink-2)', fontSize: 13 }}>
            <p style={{ margin: '0 0 10px' }}>
              Every film in your library gets AI-scored on 6 dimensions from −1 to +1.
              For example, <em>pace</em> runs from patient/slow-burn (+1) to kinetic/fast (−1).
            </p>
            <p style={{ margin: '0 0 10px' }}>
              Your taste vector is built by looking at how much you <strong>deviated from your own average</strong>
              {' '}(currently <strong>{tasteAvg.toFixed(2)}★</strong> across {active.length + skipped.length} dimensioned films).
              A film you rated 1★ above your average pulls your vector toward that film's dimensions.
              A film rated 1★ below pushes away from them.
            </p>
            <p style={{ margin: 0 }}>
              Films within <strong>0.15★</strong> of your average are skipped entirely — they're too ambiguous to reveal a preference.
              If many of your films cancel each other out, you'll land near zero — that means genuinely wide taste, not broken data.
            </p>
          </div>

          {/* Your resulting vector */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 12 }}>YOUR RESULTING VECTOR</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
              {DIM_KEYS.map(d => {
                const v = myDimensions[d]
                const [neg, pos] = DIM_POLES[d]
                const strong = Math.abs(v) > 0.15
                return (
                  <div key={d} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', marginBottom: 4, letterSpacing: '0.08em' }}>{DIM_SHORT[d]}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: strong ? 'var(--ink)' : 'var(--ink-4)' }}>
                      {v >= 0 ? '+' : ''}{v.toFixed(2)}
                    </div>
                    <div style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 9, color: 'var(--ink-4)', marginTop: 3 }}>
                      {strong ? (v > 0 ? pos : neg) : 'mixed'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Per-film breakdown */}
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 10 }}>
            FILMS SORTED BY INFLUENCE (LARGEST DEVIATION FROM YOUR AVG FIRST)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--paper-edge)' }}>
                  <th style={{ textAlign: 'left', padding: '5px 8px', fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', fontWeight: 400, letterSpacing: '0.08em' }}>FILM</th>
                  <th style={{ textAlign: 'center', padding: '5px 8px', fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', fontWeight: 400 }}>YOU</th>
                  <th style={{ textAlign: 'center', padding: '5px 10px', fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', fontWeight: 400 }}>VS AVG</th>
                  {DIM_KEYS.map(d => (
                    <th key={d} style={{ textAlign: 'center', padding: '5px 4px', fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', fontWeight: 400 }}>
                      <div>{DIM_SHORT[d]}</div>
                      <div style={{ fontSize: 6, opacity: 0.6 }}>{DIM_POLES[d][0][0]}↔{DIM_POLES[d][1][0]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((f, i) => {
                  const devStr = f.deviation >= 0 ? `+${f.deviation.toFixed(1)}` : f.deviation.toFixed(1)
                  const devColor = f.skipped ? 'var(--ink-4)' :
                    f.deviation > 0 ? '#4a8c5c' : '#b04030'
                  return (
                    <tr key={i} style={{ borderBottom: '0.5px solid var(--paper-edge)', opacity: f.skipped ? 0.4 : 1, background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.012)' }}>
                      <td style={{ padding: '7px 8px', minWidth: 150, maxWidth: 200 }}>
                        <div style={{ fontFamily: 'var(--serif-display)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', marginTop: 1 }}>{f.year ?? '—'}{f.director ? ` · ${f.director.split(' ').pop()}` : ''}</div>
                      </td>
                      <td style={{ textAlign: 'center', padding: '7px 8px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--sun)', fontSize: 11 }}>{'★'.repeat(Math.floor(f.stars))}{f.stars % 1 ? '½' : ''}</span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '7px 10px' }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: devColor, fontWeight: 600 }}>
                          {f.skipped ? '≈ skip' : devStr}
                        </span>
                      </td>
                      {DIM_KEYS.map(d => (
                        <td key={d} style={{ padding: '7px 4px' }}>
                          <MiniDimBar value={f.dimensions[d]} />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {skipped.length > 0 && (
            <button
              onClick={() => setShowSkipped(s => !s)}
              style={{ marginTop: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.08em' }}
            >
              {showSkipped ? '▾' : '▸'} {skipped.length} FILMS SKIPPED (RATED WITHIN 0.15★ OF YOUR AVERAGE)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Taste Code Display ────────────────────────────────────────────────────────

const DIM_AXIS_LABEL: Record<string, string> = {
  narrative_legibility:    'Legible ← → Opaque',
  emotional_directness:    'Vivid ← → Subtle',
  plot_vs_character:       'Plot ← → Character',
  naturalistic_vs_stylized:'Naturalistic ← → Theatrical',
  narrative_closure:       'Whole ← → Questioning',
  intimate_vs_epic:        'Intimate ← → Epic',
  accessible_vs_demanding: 'Familiar ← → Demanding',
  psychological_safety:    'Hopeful ← → Unsettling',
  moral_clarity:           'Just ← → Ambiguous',
  behavioral_realism:      'Realistic ← → Archetypal',
  sensory_vs_intellectual: 'Gut ← → Mind',
  kinetic_vs_patient:      'Kinetic ← → Zen',
}

function TasteCodeDisplay({ code, prose, accentColor = 'var(--s-ink)', onViewFull }: {
  code: TasteCode; prose?: string | null; accentColor?: string; onViewFull?: () => void
}) {
  // Track by dimKey so it works in both LIKES and DISLIKES mode
  const [expandedDimKey, setExpandedDimKey] = useState<string | null>(null)
  const [view, setView] = useState<'likes' | 'dislikes'>('likes')

  // LIKES = top 4 entries by signal strength
  // DISLIKES = same 4 entries, shown as their opposite poles
  const baseEntries = code.entries
  const activeEntry = expandedDimKey ? baseEntries.find(e => e.dimKey === expandedDimKey) ?? null : null

  // In DISLIKES mode, display the opposite pole's letter/label/films
  const displayLetter = (e: TasteCodeEntry) => view === 'dislikes' ? e.oppLetter : e.letter
  const displayLabel  = (e: TasteCodeEntry) => view === 'dislikes' ? e.oppLabel  : e.label

  // Mini-thumbnails under each tile
  const tileFilms = (e: TasteCodeEntry) =>
    view === 'dislikes'
      ? [...e.oppSampleFilms].sort((a, b) => a.stars - b.stars).slice(0, 3)
      : [...e.sampleFilms].sort((a, b) => b.stars - a.stars).slice(0, 3)

  // Prose and films when a tile is clicked
  const clickProse = (e: TasteCodeEntry) =>
    view === 'dislikes' ? e.oppNegativeDescription : e.description

  const clickFilms = (e: TasteCodeEntry) =>
    view === 'dislikes'
      ? [...e.oppSampleFilms].sort((a, b) => a.stars - b.stars).slice(0, 4)
      : [...e.sampleFilms].sort((a, b) => b.stars - a.stars).slice(0, 4)

  // Overall DISLIKES prose (shown when tab is active but no tile selected)
  const dislikesProse = baseEntries.length > 0
    ? `The other side of your taste. ${baseEntries.map(e => e.oppLabel).join(', ')} films consistently land lower in your ratings — the mirror of your four strongest pulls. Tap any to see what doesn't connect.`
    : null

  return (
    <div style={{ marginBottom: 56 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 48, rowGap: 16 }}>

        {/* Row 1 left: eyebrow */}
        <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', paddingTop: 2 }}>★ TASTE CODE</div>

        {/* Row 1 right: axis label when expanded */}
        <div style={{ display: 'flex', alignItems: 'center', minHeight: 18 }}>
          {activeEntry && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>
              {DIM_AXIS_LABEL[activeEntry.dimKey] ?? activeEntry.dimKey}
            </div>
          )}
        </div>

        {/* Row 2 left: tiles + LIKES/DISLIKES pill */}
        <div style={{ flexShrink: 0, alignSelf: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {baseEntries.map(entry => {
              const isActive = expandedDimKey === entry.dimKey
              // LIKES → show gap (signal strength); DISLIKES → show oppositeScore (how low that pole scores)
              const strength = view === 'dislikes' ? entry.oppositeScore : entry.gap
              const films = tileFilms(entry)
              return (
                <div key={entry.dimKey} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => setExpandedDimKey(isActive ? null : entry.dimKey)}
                    style={{
                      background: isActive ? 'var(--ink)' : 'var(--paper-2)',
                      border: `0.5px solid ${isActive ? 'var(--ink)' : 'var(--paper-edge)'}`,
                      borderRadius: 10, width: 76, height: 76, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 120ms', gap: 4, padding: 0,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--serif-display)', fontSize: 38, fontWeight: 600, lineHeight: 1, color: isActive ? 'var(--paper)' : 'var(--ink)' }}>
                      {displayLetter(entry)}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 7, letterSpacing: '0.08em', textTransform: 'uppercase', color: isActive ? 'var(--paper-edge)' : 'var(--ink-4)' }}>
                      {displayLabel(entry)}
                    </span>
                  </button>
                  <div style={{ width: 76, height: 3, background: 'var(--paper-edge)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${strength}%`, height: '100%', background: isActive ? 'var(--ink)' : accentColor, borderRadius: 999, transition: 'all 120ms' }} />
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>
                    {strength}
                  </div>
                  {films.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                      {films.map(f => (
                        <div key={f.film_id} style={{
                          width: 22, height: 33, borderRadius: 2, overflow: 'hidden',
                          background: 'var(--paper-edge)', position: 'relative', flexShrink: 0,
                          opacity: isActive ? 1 : 0.65, transition: 'opacity 120ms',
                        }}>
                          {f.poster_path && <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* LIKES / DISLIKES pill */}
          <div style={{ display: 'flex', gap: 0, background: 'var(--paper-2)', borderRadius: 999, padding: 2, width: 'fit-content' }}>
            {(['likes', 'dislikes'] as const).map(v => (
              <button
                key={v}
                onClick={() => { setView(v); setExpandedDimKey(null) }}
                style={{
                  padding: '5px 14px', borderRadius: 999, cursor: 'pointer', border: 'none',
                  background: view === v ? accentColor : 'transparent',
                  color: view === v ? 'var(--paper)' : 'var(--ink-4)',
                  fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.1em',
                  textTransform: 'uppercase', transition: 'all 120ms',
                }}
              >
                {v}
              </button>
            ))}
          </div>

          {onViewFull && (
            <button
              onClick={onViewFull}
              style={{
                marginTop: 16, background: 'none', border: '0.5px solid var(--ink-3)', borderRadius: 999,
                padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--mono)',
                fontSize: 8.5, color: 'var(--ink-3)', letterSpacing: '0.08em',
                transition: 'all 120ms', display: 'block',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ink-3)'; e.currentTarget.style.color = 'var(--ink-3)' }}
            >
              VIEW FULL TASTE CODE →
            </button>
          )}
        </div>

        {/* Row 2 right: detail or prose */}
        <div style={{ alignSelf: 'flex-start' }}>
          {activeEntry ? (
            <>
              <p style={{
                fontFamily: 'var(--serif-italic)', fontStyle: 'italic',
                fontSize: 15, lineHeight: 1.65, color: 'var(--ink-2)', margin: '0 0 20px',
              }}>
                {clickProse(activeEntry)}
              </p>
              {clickFilms(activeEntry).length > 0 && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {clickFilms(activeEntry).map(f => (
                    <div key={f.film_id} style={{ textAlign: 'center', width: 80 }}>
                      <div style={{
                        width: 80, height: 120, borderRadius: 5, overflow: 'hidden',
                        background: 'var(--paper-edge)', position: 'relative', marginBottom: 6,
                      }}>
                        {f.poster_path
                          ? <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--ink-4)', textAlign: 'center' }}>{f.title.toUpperCase()}</div>
                        }
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: accentColor }}>{f.stars.toFixed(1)}★</div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setExpandedDimKey(null)}
                style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)', letterSpacing: '0.06em', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                ← back
              </button>
            </>
          ) : (
            <>
              {view === 'likes' && prose && (
                <p style={{ fontFamily: 'var(--serif-display)', fontSize: 19, lineHeight: 1.6, fontWeight: 400, color: 'var(--ink)', margin: '0 0 12px', fontStyle: 'italic' }}>
                  {prose}
                </p>
              )}
              {view === 'dislikes' && dislikesProse && (
                <p style={{ fontFamily: 'var(--serif-display)', fontSize: 19, lineHeight: 1.6, fontWeight: 400, color: 'var(--ink)', margin: '0 0 12px', fontStyle: 'italic' }}>
                  {dislikesProse}
                </p>
              )}
              <p style={{ margin: '0 0 16px', fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.5 }}>
                tap a letter to explore that signal.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function RankedList({ items, getLabel, onSelect }: {
  items: { name?: string; decade?: number; count: number; avgRating: number | null }[]
  getLabel: (item: { name?: string; decade?: number; count: number; avgRating: number | null }) => string
  onSelect: (label: string, avgRating: number | null, count: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, 5)

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visible.map((item, i) => (
          <button
            key={i}
            onClick={() => onSelect(getLabel(item), item.avgRating, item.count)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 0',
              background: 'none', border: 'none', borderBottom: '0.5px solid var(--paper-edge)',
              cursor: 'pointer', textAlign: 'left', width: '100%',
              transition: 'opacity 120ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.65')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', width: 14, textAlign: 'right', flexShrink: 0 }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getLabel(item)}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.04em', flexShrink: 0 }}>
              {item.count}×
            </div>
            {item.avgRating != null && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--s-ink)', letterSpacing: '0.04em', flexShrink: 0 }}>
                {item.avgRating.toFixed(1)}★
              </div>
            )}
          </button>
        ))}
      </div>
      {items.length > 5 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)',
            letterSpacing: '0.06em', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
          }}
        >
          {expanded ? 'show less ↑' : `show ${items.length - 5} more ↓`}
        </button>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null)
  const [taste, setTaste] = useState<TasteProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingBriefs, setGeneratingBriefs] = useState(false)
  const [briefsDone, setBriefsDone] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null)
  const [detailEntry, setDetailEntry] = useState<LibraryEntry | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [resumingSetup, setResumingSetup] = useState(false)

  const panelFilms = useMemo(() => {
    if (!selectedCategory || !taste?.libraryFilms) return []
    const { type, label } = selectedCategory
    return taste.libraryFilms
      .filter(f => {
        if (type === 'director') return f.director === label
        if (type === 'actor') return f.cast.includes(label)
        if (type === 'genre') return f.genres.includes(label)
        if (type === 'decade') return f.year != null && Math.floor(f.year / 10) * 10 === parseInt(label)
        return false
      })
      .sort((a, b) => (b.my_stars ?? -1) - (a.my_stars ?? -1))
  }, [selectedCategory, taste?.libraryFilms])

  function openCategory(type: CategoryType) {
    return (label: string, avgRating: number | null, count: number) =>
      setSelectedCategory({ type, label, avgRating, count })
  }

  async function openFilmDetail(entryId: string) {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/library/${entryId}`)
      if (res.ok) {
        const data = await res.json()
        setDetailEntry(data as LibraryEntry)
      }
    } catch {}
    setDetailLoading(false)
  }

  function handleDetailUpdate(updated: LibraryEntry) {
    setDetailEntry(updated)
    // Reflect star change in local libraryFilms so the panel list stays in sync
    setTaste(prev => {
      if (!prev) return prev
      return {
        ...prev,
        libraryFilms: prev.libraryFilms.map(f =>
          f.entry_id === updated.id ? { ...f, my_stars: updated.my_stars } : f
        ),
      }
    })
  }

  function handleDetailRemove(entryId: string) {
    setDetailEntry(null)
    setTaste(prev => {
      if (!prev) return prev
      return { ...prev, libraryFilms: prev.libraryFilms.filter(f => f.entry_id !== entryId) }
    })
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/profile/taste').then(r => r.json()),
    ]).then(([p, t]) => {
      setProfile(p)
      setTaste(t)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const hasEnoughData = (taste?.ratedCount ?? 0) >= 5

  const generateBriefs = async () => {
    setGeneratingBriefs(true)
    await fetch('/api/import/generate-briefs', { method: 'POST' })
    setBriefsDone(true)
    setGeneratingBriefs(false)
    const t = await fetch('/api/profile/taste').then(r => r.json())
    setTaste(t)
  }

  // Resume or start a taste setup session, routing to the right step
  const resumeTasteSetup = async () => {
    if (resumingSetup) return
    setResumingSetup(true)
    try {
      const res  = await fetch('/api/onboarding/session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ trigger: 'taste_page', preferred_path: 'cold_start' }),
      })
      const data = await res.json()
      if (!data.session_id) return

      const hasContradictions = Array.isArray(data.contradictions) && data.contradictions.length > 0
      if (data.path === 'taste_setup' || (data.path === 'resume' && !hasContradictions)) {
        router.push(`/onboarding/rate/${data.session_id}`)
      } else {
        router.push(`/onboarding/interview/${data.session_id}`)
      }
    } finally {
      setResumingSetup(false)
    }
  }

  const hasNumbers = taste && (
    taste.genres.length > 0 || taste.directors.length > 0 ||
    taste.actors.length > 0 || taste.decades.length > 0
  )

  return (
    <AppShell>
      <div style={{ padding: '56px 64px 100px', maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ YOUR PROFILE</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
            <h1 className="t-display" style={{ fontSize: 52, lineHeight: 1, margin: 0 }}>
              {profile?.name
                ? <>{profile.name.split(' ')[0]}'s <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--s-ink)' }}>taste</span>.</>
                : <>your <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--s-ink)' }}>taste</span>.</>
              }
            </h1>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, paddingBottom: 6 }}>
              {/* Taste code badge — just the letters, decorative */}
              {!loading && taste?.tasteCode && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                  {taste.tasteCode.entries.map(e => (
                    <span key={e.dimKey} style={{
                      fontFamily: 'var(--serif-display)',
                      fontSize: 28, fontWeight: 600,
                      lineHeight: 1, color: 'var(--ink)',
                      letterSpacing: '-0.01em',
                    }}>
                      {e.letter}
                    </span>
                  ))}
                </div>
              )}
              {/* Reveal link — always visible */}
              {!loading && (
                <button
                  onClick={() => router.push('/taste-code')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--mono)', fontSize: 10,
                    color: 'var(--s-ink)', letterSpacing: '0.06em',
                    textDecoration: 'underline', textUnderlineOffset: 3,
                    padding: 0,
                  }}
                >
                  {taste?.tasteCode ? 'see your reveal →' : 'build your taste code →'}
                </button>
              )}
              {/* Monthly update link */}
              {!loading && taste?.tasteCode && (
                <button
                  onClick={() => router.push('/taste-report')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--mono)', fontSize: 10,
                    color: 'var(--ink-3)', letterSpacing: '0.06em',
                    textDecoration: 'underline', textUnderlineOffset: 3,
                    padding: 0,
                  }}
                >
                  April update →
                </button>
              )}
              {!loading && taste && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em' }}>
                  {taste.filmCount} FILM{taste.filmCount !== 1 ? 'S' : ''} LOGGED
                </div>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>loading…</p>
        )}

        {!loading && taste && (
          <>
            {!taste.tasteCode && (
              <div style={{ marginBottom: 48, padding: '24px 28px', background: 'var(--bone)', borderRadius: 14, border: '0.5px solid var(--paper-edge)', maxWidth: 520 }}>
                <div className="t-meta" style={{ fontSize: 9, color: 'var(--s-ink)', marginBottom: 10 }}>★ TASTE PROFILE</div>
                <p style={{ margin: '0 0 18px', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', lineHeight: 1.65 }}>
                  {hasEnoughData
                    ? 'your taste profile is almost ready — finish the setup to unlock your taste code and film recommendations.'
                    : 'rate films you know and we\'ll map your cinematic identity. takes about 5 minutes.'}
                </p>
                <button
                  onClick={resumeTasteSetup}
                  disabled={resumingSetup}
                  className="btn"
                  style={{ padding: '11px 22px', fontSize: 13, borderRadius: 999, opacity: resumingSetup ? 0.6 : 1 }}
                >
                  {resumingSetup ? 'loading…' : 'continue building your taste profile →'}
                </button>
              </div>
            )}

            {/* ── SECTION 0: Taste Code ───────────────────────────────────── */}
            {taste.tasteCode && (
              <TasteCodeDisplay
                code={taste.tasteCode}
                prose={taste.prose}
                onViewFull={() => router.push('/profile/taste-code')}
              />
            )}

            {/* ── SECTION 2: Film Signature ───────────────────────────────── */}
            {taste.signature.length > 0 && (
              <div style={{ marginBottom: 72 }}>
                <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 4 }}>★ FILM SIGNATURE</div>
                <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)', margin: '0 0 18px' }}>
                  the films that most define your taste profile
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {taste.signature.map(f => (
                    <div key={f.film_id} style={{ textAlign: 'center' }}>
                      <div style={{
                        width: 80, height: 120, borderRadius: 5, overflow: 'hidden',
                        background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
                        position: 'relative', marginBottom: 6,
                      }}>
                        {f.poster_path
                          ? <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--ink-4)', textAlign: 'center' }}>{f.title.toUpperCase()}</div>
                        }
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--s-ink)', letterSpacing: '0.04em' }}>
                        {f.stars}★
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SECTION 3: By the Numbers ───────────────────────────────── */}
            {hasNumbers && (
              <div style={{ marginBottom: 72 }}>
                <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 36 }}>★ BY THE NUMBERS</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '48px 56px' }}>

                  {taste.genres.length > 0 && (
                    <div>
                      <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 3 }}>FAVORITE GENRES</div>
                      <p style={{ margin: '0 0 14px', fontStyle: 'italic', fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
                        by avg rating · min 3 films
                      </p>
                      <RankedList items={taste.genres.map(g => ({ name: g.label, count: g.count, avgRating: g.avgRating }))} getLabel={g => g.name ?? ''} onSelect={openCategory('genre')} />
                    </div>
                  )}

                  {taste.directors.length > 0 && (
                    <div>
                      <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 3 }}>FAVORITE DIRECTORS</div>
                      <p style={{ margin: '0 0 14px', fontStyle: 'italic', fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
                        by avg rating · min 3 films
                      </p>
                      <RankedList items={taste.directors} getLabel={d => d.name ?? ''} onSelect={openCategory('director')} />
                    </div>
                  )}

                  {taste.actors.length > 0 && (
                    <div>
                      <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 3 }}>FAVORITE ACTORS</div>
                      <p style={{ margin: '0 0 14px', fontStyle: 'italic', fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
                        by avg rating · min 3 films
                      </p>
                      <RankedList items={taste.actors} getLabel={a => a.name ?? ''} onSelect={openCategory('actor')} />
                    </div>
                  )}

                  {taste.decades.length > 0 && (
                    <div>
                      <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 3 }}>FAVORITE DECADES</div>
                      <p style={{ margin: '0 0 14px', fontStyle: 'italic', fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
                        by avg rating · min 3 films
                      </p>
                      <RankedList items={taste.decades.map(d => ({ name: `${d.decade}s`, count: d.count, avgRating: d.avgRating }))} getLabel={d => d.name ?? ''} onSelect={openCategory('decade')} />
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* ── SECTION 4: Top Rated ────────────────────────────────────── */}
            {taste.topRated.length > 0 && (
              <div style={{ marginBottom: 72 }}>
                <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 4 }}>★ TOP RATED</div>
                <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)', margin: '0 0 18px' }}>
                  your highest-rated films
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {taste.topRated.map(f => {
                    const lf = taste.libraryFilms.find(x => x.film_id === f.film_id)
                    return (
                      <button
                        key={f.film_id}
                        onClick={() => lf && openFilmDetail(lf.entry_id)}
                        disabled={!lf || detailLoading}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: lf ? 'pointer' : 'default', textAlign: 'center' }}
                      >
                        <div style={{
                          width: 80, height: 120, borderRadius: 5, overflow: 'hidden',
                          background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
                          position: 'relative', marginBottom: 6, transition: 'opacity 120ms',
                        }}
                          onMouseEnter={e => lf && ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                        >
                          {f.poster_path
                            ? <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--ink-4)', textAlign: 'center' }}>{f.title.toUpperCase()}</div>
                          }
                        </div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', marginBottom: 2 }}>{f.year}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--s-ink)', letterSpacing: '0.04em' }}>
                          {f.stars.toFixed(1)}★
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── BOTTOM: Generate briefs nudge ───────────────────────────── */}
            {!briefsDone && (taste.filmCount ?? 0) > (taste.ratedCount ?? 0) + 2 && (
              <div style={{ padding: '18px 22px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 12, maxWidth: 520 }}>
                <p style={{ margin: '0 0 12px', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', lineHeight: 1.55 }}>
                  some of your films are missing ai briefs — generate them to sharpen your radar chart and genre breakdown.
                </p>
                <button onClick={generateBriefs} disabled={generatingBriefs} className="btn"
                  style={{ padding: '9px 18px', fontSize: 12, borderRadius: 999, opacity: generatingBriefs ? 0.6 : 1 }}>
                  {generatingBriefs ? 'generating briefs… (a few minutes)' : 'generate missing briefs →'}
                </button>
              </div>
            )}

            {/* ── BOTTOM: Diagnostic / see the math ───────────────────────── */}
            {taste.diagnosticFilms?.length > 0 && (
              <DiagnosticPanel
                films={taste.diagnosticFilms}
                tasteAvg={taste.tasteAvg ?? 3}
                myDimensions={taste.dimensions}
              />
            )}
          </>
        )}
      </div>
      {/* ── Film Detail Panel (opens over category panel) ─────────────────── */}
      {detailEntry && (
        <FilmDetailPanel
          entry={detailEntry}
          list={detailEntry.list}
          onClose={() => setDetailEntry(null)}
          onUpdate={handleDetailUpdate}
          onRemove={() => handleDetailRemove(detailEntry.id)}
        />
      )}

      {/* ── Category Detail Panel ──────────────────────────────────────────── */}
      {selectedCategory && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSelectedCategory(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
              zIndex: 40, backdropFilter: 'blur(2px)',
            }}
          />

          {/* Panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
            background: 'var(--paper)', borderLeft: '0.5px solid var(--paper-edge)',
            zIndex: 50, overflowY: 'auto', display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
          }}>
            {/* Panel header */}
            <div style={{
              padding: '28px 28px 20px',
              borderBottom: '0.5px solid var(--paper-edge)',
              position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {selectedCategory.type === 'decade' ? 'decade' : selectedCategory.type}
                  </div>
                  <div style={{ fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 500, lineHeight: 1.1, color: 'var(--ink)' }}>
                    {selectedCategory.label}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 16, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                    <span>{panelFilms.length} film{panelFilms.length !== 1 ? 's' : ''}</span>
                    {selectedCategory.avgRating != null && (
                      <span style={{ color: 'var(--s-ink)' }}>{selectedCategory.avgRating.toFixed(1)}★ avg</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  style={{
                    background: 'none', border: '0.5px solid var(--paper-edge)', borderRadius: '50%',
                    width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0, color: 'var(--ink-3)', fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Film list */}
            <div style={{ padding: '16px 28px 40px', flex: 1 }}>
              {panelFilms.length === 0 ? (
                <p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)', marginTop: 24 }}>
                  no films found
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {panelFilms.map((f, i) => (
                    <button
                      key={f.film_id}
                      onClick={() => openFilmDetail(f.entry_id)}
                      disabled={detailLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 0', width: '100%', textAlign: 'left',
                        borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                        borderBottom: i < panelFilms.length - 1 ? '0.5px solid var(--paper-edge)' : 'none',
                        background: 'none',
                        cursor: 'pointer', transition: 'opacity 120ms',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.65')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      {/* Poster */}
                      <div style={{
                        width: 36, height: 54, borderRadius: 3, overflow: 'hidden',
                        flexShrink: 0, position: 'relative',
                        background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
                      }}>
                        {f.poster_path
                          ? <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%' }} />
                        }
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500,
                          lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: 'var(--ink)',
                        }}>
                          {f.title}
                        </div>
                        <div style={{
                          fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 11,
                          color: 'var(--ink-4)', marginTop: 2, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {[f.director, f.year].filter(Boolean).join(' · ')}
                        </div>
                      </div>

                      {/* Rating */}
                      {f.my_stars != null && (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--s-ink)', letterSpacing: '0.04em', flexShrink: 0 }}>
                          {f.my_stars.toFixed(1)}★
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}
