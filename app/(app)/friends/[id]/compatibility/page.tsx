'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/app-shell'
import { TasteDimensions } from '@/lib/prompts/taste-profile'
import { TasteCode, TasteCodeEntry, compareTaskCodes, POLE_BY_LETTER } from '@/lib/taste-code'
import { poleBadgeTier } from '@/components/taste-letter'

// ── Types ─────────────────────────────────────────────────────────────────────

interface GenreEntry { label: string; score: number; count: number; avgRating: number | null; weightedScore?: number }
interface SimpleGenreEntry { label: string; avgRating: number; count: number; weightedScore?: number }
interface LibraryFilm {
  film_id: string; title: string; year: number | null; poster_path: string | null
  director: string | null; genres: string[]; cast: string[]; my_stars: number | null
}
interface TasteData {
  myName?: string
  friendName?: string
  dimensions: TasteDimensions
  genres: GenreEntry[]
  simpleGenres: SimpleGenreEntry[]
  overallAvg: number
  libraryFilms: LibraryFilm[]
  filmCount: number
  ratedCount: number
  tasteCode?: TasteCode | null
}

type DimKey = keyof TasteDimensions
type TabId = 'taste' | 'genre'

// ── Prose builders ────────────────────────────────────────────────────────────

type ProseSegment = string | { name: string; color: string }
function buildSegments(...parts: ProseSegment[]): ProseSegment[] { return parts }

function renderSegments(segs: ProseSegment[]) {
  return segs.map((s, i) =>
    typeof s === 'string'
      ? <span key={i}>{s}</span>
      : <span key={i} style={{ fontWeight: 700, color: s.color, fontSize: '1.08em' }}>{s.name.split(' ')[0]}</span>
  )
}

// ── Dimension axis labels ─────────────────────────────────────────────────────

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

// ── Gap-based signal tier ─────────────────────────────────────────────────────

const STRONG_GAP   = 35
const MODERATE_GAP = 15

function gapTierFor(gap: number): 'strong' | 'moderate' | 'weak' {
  return gap >= STRONG_GAP ? 'strong' : gap >= MODERATE_GAP ? 'moderate' : 'weak'
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 72 ? 'var(--forest)' : score >= 52 ? 'var(--sun)' : 'var(--ink-4)'
  return (
    <div style={{ marginBottom: 40, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--serif-display)', fontSize: 36, fontWeight: 600, color, lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
          / 100
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', marginLeft: 8 }}>
          {label.toUpperCase()}
        </span>
      </div>
      <div style={{ width: 180, height: 3, background: 'var(--paper-edge)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
    </div>
  )
}

// ── Alignment scores ──────────────────────────────────────────────────────────

function tasteScore(a: TasteDimensions, b: TasteDimensions): number {
  const keys = Object.keys(a) as DimKey[]
  const avg = keys.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0) / keys.length
  return Math.round(Math.max(0, (1 - avg / 0.7) * 100))
}

function genreScore(myGenres: GenreEntry[], theirGenres: GenreEntry[]): number {
  const myMap = new Map(myGenres.map(g => [g.label, g.avgRating ?? 0]))
  const theirMap = new Map(theirGenres.map(g => [g.label, g.avgRating ?? 0]))
  const shared = [...myMap.keys()].filter(k => theirMap.has(k))
  if (shared.length === 0) return 50
  const diffs = shared.map(k => Math.abs((myMap.get(k) ?? 0) - (theirMap.get(k) ?? 0)))
  const avg = diffs.reduce((s, d) => s + d, 0) / diffs.length
  return Math.round(Math.max(0, Math.min(100, (1 - avg / 2.5) * 100)))
}

// ── compatProse ───────────────────────────────────────────────────────────────

function compatProse(
  compat: ReturnType<typeof compareTaskCodes>,
  myName: string, theirName: string,
): ProseSegment[] {
  const shared   = compat.filter(c => c.bucket === 'shared')
  const opposing = compat.filter(c => c.bucket === 'opposing')
  const my  = { name: myName,    color: 'var(--s-ink)' }
  const thy = { name: theirName, color: 'var(--p-ink)' }

  if (shared.length === 0 && opposing.length === 0) {
    return buildSegments(
      my, ' and ', thy,
      ' each bring completely distinct signals — no overlap on your four strongest dimensions. ',
      'That can mean genuine discovery: the films one of you loves may be off the other\'s radar entirely.',
    )
  }

  if (shared.length >= 3) {
    const labels = shared.map(c => c.myEntry!.label).join(', ')
    const segs: ProseSegment[] = [my, ' and ', thy, ` align on most of what matters: both ${labels}.`]
    if (opposing.length > 0) {
      const opp = opposing[0]
      segs.push(` The clearest split is `, my, ` leaning ${opp.myEntry!.label} while `, thy, ` pulls ${opp.theirEntry!.label} — worth knowing when pitching films that go hard in either direction.`)
    } else {
      segs.push(' With this much common ground, picking something together should be easy.')
    }
    return buildSegments(...segs)
  }

  if (shared.length > 0) {
    const sharedLabels = shared.map(c => c.myEntry!.label).join(' and ')
    const segs: ProseSegment[] = [my, ' and ', thy, ` share ${sharedLabels} as real common ground.`]
    if (opposing.length === 1) {
      const opp = opposing[0]
      segs.push(` The main difference: `, my, ` leans ${opp.myEntry!.label} where `, thy, ` pulls ${opp.theirEntry!.label}.`)
    } else if (opposing.length > 1) {
      segs.push(' But they diverge on ', ...opposing.map((opp, i) => [
        ...(i > 0 ? [' and '] as ProseSegment[] : []),
        `${opp.myEntry!.label} vs ${opp.theirEntry!.label}` as ProseSegment,
      ]).flat(), '.')
    }
    return buildSegments(...segs)
  }

  // No shared, only opposing/asymmetric
  const segs: ProseSegment[] = [my, ' and ', thy, ' sit on opposite sides of ']
  if (opposing.length === 1) {
    const opp = opposing[0]
    segs.push(`the ${opp.myEntry!.label.toLowerCase()} / ${opp.theirEntry!.label.toLowerCase()} axis — `)
    segs.push(`films that split the difference tend to be the safest bet together.`)
  } else {
    segs.push(`several key dimensions — `, my, `'s strongest signals are almost always `, thy, `'s weakest, and vice versa. `)
    segs.push('Films that genuinely hold both poles in tension are where they\'ll find common ground.')
  }
  return buildSegments(...segs)
}

// ── Entry detail (expanded dim view inside TasteCodeBlend) ───────────────────

function EntryDetail({ entry, color, isDislikes }: {
  entry: { description: string; filmCount: number; sampleFilms: { film_id: string; title: string; poster_path: string | null; stars: number }[] }
  color: string
  isDislikes: boolean
}) {
  const avgStars = entry.sampleFilms.length > 0
    ? entry.sampleFilms.reduce((s, f) => s + f.stars, 0) / entry.sampleFilms.length
    : null
  const displayFilms = isDislikes
    ? [...entry.sampleFilms].sort((a, b) => a.stars - b.stars).slice(0, 4)
    : [...entry.sampleFilms].sort((a, b) => b.stars - a.stars).slice(0, 4)
  return (
    <>
      <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 14, lineHeight: 1.65, color: 'var(--ink-2)', margin: '0 0 18px' }}>
        {entry.description}
      </p>
      <div style={{ display: 'flex', gap: 20, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 600, color, lineHeight: 1 }}>
            {avgStars != null ? avgStars.toFixed(2) : '—'}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 3 }}>AVG STARS</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 600, color: 'var(--ink)', lineHeight: 1 }}>
            {entry.filmCount}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 3 }}>IN THIS QUARTILE</div>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', letterSpacing: '0.08em', marginBottom: 10 }}>
        {isDislikes ? 'LOWEST RATED' : 'HIGHEST RATED'}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {displayFilms.map(f => (
          <div key={f.film_id} style={{ width: 72, textAlign: 'center' }}>
            <div style={{ width: 72, height: 108, borderRadius: 4, overflow: 'hidden', background: 'var(--paper-edge)', position: 'relative', marginBottom: 5 }}>
              {f.poster_path && <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} />}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color }}>{f.stars.toFixed(1)}★</div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Taste Code Blend ──────────────────────────────────────────────────────────

function TasteCodeBlend({
  myCode, theirCode, myName, theirName,
}: {
  myCode: TasteCode; theirCode: TasteCode
  myName: string; theirName: string
}) {
  const [expandedDimKey, setExpandedDimKey] = useState<string | null>(null)
  const [view, setView] = useState<'likes' | 'dislikes'>('likes')
  const myFirst    = myName.split(' ')[0]
  const theirFirst = theirName.split(' ')[0]

  const likesCompat = useMemo(() => compareTaskCodes(myCode, theirCode), [myCode, theirCode])

  const myAllEntries    = myCode.allEntries ?? myCode.entries
  const theirAllEntries = theirCode.allEntries ?? theirCode.entries

  // DISLIKES = same top-4 entries, rendered as their opposite poles
  const myDisplayEntries    = myCode.entries
  const theirDisplayEntries = theirCode.entries

  // Entries for the selected dim (from full allEntries, not just display slice)
  const myEntry    = expandedDimKey ? myAllEntries.find(e => e.dimKey === expandedDimKey) ?? null : null
  const theirEntry = expandedDimKey ? theirAllEntries.find(e => e.dimKey === expandedDimKey) ?? null : null

  // Tone derived from actual gap strength (not rank position)
  const myTone: 'strong' | 'moderate' | 'weak' = myEntry ? gapTierFor(myEntry.gap) : 'weak'
  const theirTone: 'strong' | 'moderate' | 'weak' = theirEntry ? gapTierFor(theirEntry.gap) : 'weak'

  // Description text based on tone + view
  // isDislikes → show negative prose about the OPPOSITE pole (what doesn't connect)
  function descriptionFor(entry: TasteCodeEntry, tone: 'strong' | 'moderate' | 'weak', firstName: string, isDislikes: boolean): string {
    if (isDislikes) return entry.oppNegativeDescription
    if (tone === 'weak') return entry.negativeDescription
    if (tone === 'moderate') return `${firstName} has a moderate relationship with this dimension — it shows up in their library but isn't a defining pull.`
    return entry.description
  }

  function CodeRow({ displayEntries, allEntries, name, color, isMyRow }: {
    displayEntries: TasteCodeEntry[]
    allEntries: TasteCodeEntry[]
    name: string
    color: string
    isMyRow: boolean
  }) {
    // If expanded dim isn't in displayEntries, find it in allEntries to show as ghost tile
    const ghostEntry = expandedDimKey && !displayEntries.some(e => e.dimKey === expandedDimKey)
      ? allEntries.find(e => e.dimKey === expandedDimKey) ?? null
      : null

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color, letterSpacing: '0.1em' }}>
          {name.toUpperCase()}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {/* Ghost tile for right-side row goes LEFT (closest to the vs. divider) */}
          {ghostEntry && !isMyRow && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, opacity: 0.55 }}>
                <button
                  onClick={() => setExpandedDimKey(prev => prev === ghostEntry.dimKey ? null : ghostEntry.dimKey)}
                  style={{
                    width: 72, height: 72, borderRadius: 10, cursor: 'pointer',
                    border: '2px solid var(--ink)', background: 'var(--ink)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                    transition: 'all 120ms',
                  }}
                >
                  <span style={{ fontFamily: 'var(--serif-display)', fontSize: 30, fontWeight: 600, lineHeight: 1, color: 'var(--paper)' }}>
                    {view === 'dislikes' ? ghostEntry.oppLetter : ghostEntry.letter}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 6, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--paper-edge)', opacity: 0.8 }}>
                    {view === 'dislikes' ? ghostEntry.oppLabel : ghostEntry.label}
                  </span>
                </button>
                {/* ghost tile intentionally has no H/M/L badge — it's a dim context indicator only */}
                <div style={{ width: 52, height: 2, background: 'var(--paper-edge)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${view === 'dislikes' ? ghostEntry.oppositeScore : ghostEntry.gap}%`, height: '100%', background: 'var(--ink)', borderRadius: 999, opacity: 0.4 }} />
                </div>
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--paper-edge)', margin: '0 4px' }} />
            </>
          )}

          {displayEntries.map(e => {
            const isSelected = e.dimKey === expandedDimKey
            // In DISLIKES mode, show the opposite pole's letter/label
            const tileLetter = view === 'dislikes' ? e.oppLetter : e.letter
            const tileLabel  = view === 'dislikes' ? e.oppLabel  : e.label
            // Compat-based border (likes mode only)
            const compatEntry = isMyRow
              ? likesCompat.find(c => c.myEntry?.dimKey === e.dimKey)
              : likesCompat.find(c => c.theirEntry?.dimKey === e.dimKey)
            const bucket = compatEntry?.bucket ?? 'asymmetric'
            const normalBorder = view === 'likes'
              ? bucket === 'shared'   ? 'var(--forest)' :
                bucket === 'opposing' ? '#c05040'        : 'var(--paper-edge)'
              : 'var(--paper-edge)'
            const badgeScore = view === 'dislikes' ? e.oppositeScore : e.poleScore
            const tier = poleBadgeTier(badgeScore)
            return (
              <div key={e.dimKey} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <button
                  onClick={() => setExpandedDimKey(prev => prev === e.dimKey ? null : e.dimKey)}
                  style={{
                    width: 72, height: 72, borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${isSelected ? 'var(--ink)' : normalBorder}`,
                    background: isSelected ? 'var(--ink)' : 'transparent',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                    transition: 'all 120ms', position: 'relative',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: -5, right: -5,
                    minWidth: 14, height: 14, borderRadius: 999,
                    background: isSelected ? 'rgba(255,255,255,0.9)' : (tier === 'H' ? 'var(--forest, #225533)' : tier === 'M' ? 'var(--sun, #d4a847)' : 'var(--paper-edge, #ccc)'),
                    color: isSelected ? 'var(--ink)' : (tier === 'L' ? 'var(--ink-3)' : '#fff'),
                    fontSize: 7, fontFamily: 'var(--mono)', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 2px', pointerEvents: 'none', lineHeight: 1, zIndex: 1,
                  }}>{tier}</span>
                  <span style={{ fontFamily: 'var(--serif-display)', fontSize: 30, fontWeight: 600, lineHeight: 1, color: isSelected ? 'var(--paper)' : color }}>
                    {tileLetter}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 6, letterSpacing: '0.06em', textTransform: 'uppercase', color: isSelected ? 'var(--paper-edge)' : color, opacity: 0.8 }}>
                    {tileLabel}
                  </span>
                </button>
                <div style={{ width: 52, height: 2, background: 'var(--paper-edge)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${view === 'dislikes' ? e.oppositeScore : e.gap}%`, height: '100%', background: isSelected ? 'var(--ink)' : color, borderRadius: 999, transition: 'all 120ms', opacity: isSelected ? 1 : 0.5 }} />
                </div>
              </div>
            )
          })}

          {/* Ghost tile for left-side row goes RIGHT (closest to the vs. divider) */}
          {ghostEntry && isMyRow && (
            <>
              <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--paper-edge)', margin: '0 4px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, opacity: 0.55 }}>
                <button
                  onClick={() => setExpandedDimKey(prev => prev === ghostEntry.dimKey ? null : ghostEntry.dimKey)}
                  style={{
                    width: 72, height: 72, borderRadius: 10, cursor: 'pointer',
                    border: '2px solid var(--ink)', background: 'var(--ink)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                    transition: 'all 120ms',
                  }}
                >
                  <span style={{ fontFamily: 'var(--serif-display)', fontSize: 30, fontWeight: 600, lineHeight: 1, color: 'var(--paper)' }}>
                    {view === 'dislikes' ? ghostEntry.oppLetter : ghostEntry.letter}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 6, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--paper-edge)', opacity: 0.8 }}>
                    {view === 'dislikes' ? ghostEntry.oppLabel : ghostEntry.label}
                  </span>
                </button>
                {/* ghost tile intentionally has no H/M/L badge — it's a dim context indicator only */}
                <div style={{ width: 52, height: 2, background: 'var(--paper-edge)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${view === 'dislikes' ? ghostEntry.oppositeScore : ghostEntry.gap}%`, height: '100%', background: 'var(--ink)', borderRadius: 999, opacity: 0.4 }} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 48 }}>
      {/* Likes / Dislikes pill toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 0, background: 'var(--paper-2)', borderRadius: 999, padding: 2 }}>
          {(['likes', 'dislikes'] as const).map(v => (
            <button
              key={v}
              onClick={() => { setView(v); setExpandedDimKey(null) }}
              style={{
                padding: '6px 20px', borderRadius: 999, cursor: 'pointer', border: 'none',
                background: view === v ? 'var(--ink)' : 'transparent',
                color: view === v ? 'var(--paper)' : 'var(--ink-3)',
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em',
                textTransform: 'uppercase', transition: 'all 120ms',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Both rows centered */}
      <div style={{ display: 'flex', gap: 40, justifyContent: 'center', alignItems: 'flex-start', marginBottom: 36 }}>
        <CodeRow displayEntries={myDisplayEntries} allEntries={myAllEntries} name={myFirst} color="var(--s-ink)" isMyRow={true} />
        <div style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink-4)', paddingTop: 28 }}>vs.</div>
        <CodeRow displayEntries={theirDisplayEntries} allEntries={theirAllEntries} name={theirFirst} color="var(--p-ink)" isMyRow={false} />
      </div>

      <div style={{ borderTop: '0.5px solid var(--paper-edge)', marginBottom: 36 }} />

      {/* Expanded detail or prose */}
      {expandedDimKey && (myEntry || theirEntry) ? (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', textAlign: 'center', marginBottom: 28 }}>
            {myEntry ? DIM_AXIS_LABEL[myEntry.dimKey] ?? myEntry.dimKey : theirEntry ? DIM_AXIS_LABEL[theirEntry.dimKey] ?? theirEntry.dimKey : ''}
          </div>
          {(() => {
            // In DISLIKES mode, the "displayed pole" is the opposite of Steven's dominant for this dim.
            // e.g. if Steven's dominant = 'left' (Intimate), the displayed pole = 'right' (Epic).
            // We use this to determine whether Paola leans TOWARD or AWAY FROM the displayed pole.
            const displayedOppPole: 'left' | 'right' | null =
              view === 'dislikes' && myEntry
                ? (myEntry.pole === 'left' ? 'right' : 'left')
                : null

            // Header prefix — encodes signal strength + lean direction
            function leanPrefix(tone: 'strong' | 'moderate' | 'weak', leanToward: boolean): string {
              if (leanToward) {
                if (tone === 'strong') return 'LEANS HEAVILY'
                if (tone === 'moderate') return 'LEANS'
                return 'LEANS SLIGHTLY'
              } else {
                if (tone === 'strong') return 'AVOIDS'
                if (tone === 'moderate') return 'PULLS AWAY FROM'
                return 'SLIGHTLY AVOIDS'
              }
            }

            const sides = [
              { entry: myEntry,    first: myFirst,    color: 'var(--s-ink)', tone: myTone,
                // My side in DISLIKES: always showing my avoided (opposite) pole
                leanToward: view === 'dislikes' ? false : true },
              { entry: theirEntry, first: theirFirst, color: 'var(--p-ink)', tone: theirTone,
                // Their side: do they lean TOWARD or AWAY FROM the displayed pole?
                leanToward: view === 'dislikes' && displayedOppPole
                  ? (theirEntry?.pole === displayedOppPole)  // true = they like the pole Steven avoids
                  : true },
            ]

            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
                {sides.map(({ entry, first, color, tone, leanToward }) => {
                  const isDislikes = view === 'dislikes'

                  // The displayed pole's label — always the same regardless of lean direction
                  // (leanToward=true: entry.label = their dominant = the displayed pole)
                  // (leanToward=false: entry.oppLabel = their opposite = the displayed pole)
                  const poleLabel = isDislikes && entry
                    ? (leanToward ? entry.label : entry.oppLabel)
                    : entry?.label ?? ''

                  const headerSuffix = poleLabel
                    ? ` — ${leanPrefix(tone, leanToward)} ${poleLabel.toUpperCase()}`
                    : ''

                  // Prose: based on lean direction and signal strength
                  const prose = isDislikes && entry
                    ? leanToward
                      // They lean TOWARD the displayed pole — show positive/affirmative
                      ? tone === 'strong' ? entry.description
                        : tone === 'moderate' ? `${first} leans toward this end — it shows up in their library, though not as a defining trait.`
                        : `${first}'s ratings don't strongly separate these poles.`
                      // They lean AWAY FROM the displayed pole — show negative
                      : tone === 'strong' ? entry.oppNegativeDescription
                        : tone === 'moderate' ? `${first} shows some lean away from this end, though it isn't a defining aversion.`
                        : `${first}'s ratings don't clearly separate these poles.`
                    // LIKES mode: standard tone-based prose
                    : entry ? descriptionFor(entry, tone, first, false) : ''

                  // Films: toward = highest-rated from their dominant quartile; away = lowest from opp quartile
                  const allFilmsForDim = isDislikes && entry
                    ? leanToward ? entry.sampleFilms : entry.oppSampleFilms
                    : entry ? entry.sampleFilms : []

                  // Display: show at most 4 films (sorted by relevance)
                  const displayFilms = isDislikes && entry
                    ? leanToward
                      ? [...entry.sampleFilms].sort((a, b) => b.stars - a.stars).slice(0, 4)
                      : [...entry.oppSampleFilms].sort((a, b) => a.stars - b.stars).slice(0, 4)
                    : entry
                      ? [...entry.sampleFilms].sort((a, b) => b.stars - a.stars).slice(0, 4)
                      : []

                  // Avg computed from ALL films in that quartile, not just the 4 shown
                  const avgStars = allFilmsForDim.length > 0
                    ? (allFilmsForDim.reduce((s, f) => s + f.stars, 0) / allFilmsForDim.length).toFixed(2)
                    : '—'
                  const filmCount = isDislikes && entry
                    ? (leanToward ? entry.filmCount : entry.oppFilmCount)
                    : entry?.filmCount
                  const filmLabel = isDislikes
                    ? (leanToward ? 'HIGHEST RATED' : 'LOWEST RATED')
                    : 'HIGHEST RATED'

                  return (
                    <div key={first}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color, letterSpacing: '0.1em', marginBottom: 6 }}>
                        {first.toUpperCase()}{headerSuffix}
                      </div>
                      {entry ? (
                        <>
                          <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, lineHeight: 1.65, color: 'var(--ink-2)', margin: '0 0 18px', opacity: isDislikes ? 1 : tone === 'strong' ? 1 : tone === 'moderate' ? 0.82 : 0.65 }}>
                            {prose}
                          </p>
                          <div style={{ display: 'flex', gap: 20, marginBottom: 18 }}>
                            <div>
                              <div style={{ fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 600, color, lineHeight: 1 }}>{avgStars}</div>
                              <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 3 }}>AVG STARS</div>
                            </div>
                            <div>
                              <div style={{ fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 600, color: 'var(--ink)', lineHeight: 1 }}>{filmCount ?? '—'}</div>
                              <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 3 }}>IN THIS QUARTILE</div>
                            </div>
                          </div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', letterSpacing: '0.08em', marginBottom: 10 }}>{filmLabel}</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {displayFilms.map(f => (
                              <div key={f.film_id} style={{ width: 72, textAlign: 'center' }}>
                                <div style={{ width: 72, height: 108, borderRadius: 4, overflow: 'hidden', background: 'var(--paper-edge)', position: 'relative', marginBottom: 5 }}>
                                  {f.poster_path && <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} />}
                                </div>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color }}>{f.stars.toFixed(1)}★</div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-4)', margin: 0, lineHeight: 1.6 }}>
                          not a strong signal in {first}'s library yet.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <button
              onClick={() => setExpandedDimKey(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)', letterSpacing: '0.06em', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              ← back to overview
            </button>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          {view === 'likes' ? (
            <p style={{ fontFamily: 'var(--serif-display)', fontStyle: 'italic', fontSize: 18, lineHeight: 1.65, color: 'var(--ink)', margin: '0 0 20px' }}>
              {renderSegments(compatProse(likesCompat, myName, theirName))}
            </p>
          ) : (
            <p style={{ fontFamily: 'var(--serif-display)', fontStyle: 'italic', fontSize: 18, lineHeight: 1.65, color: 'var(--ink)', margin: '0 0 20px' }}>
              {renderSegments(buildSegments(
                'The flip side of each of your strongest pulls. Where ',
                { name: myFirst, color: 'var(--s-ink)' },
                ` leans ${myCode.entries.map(e => e.label).join(', ')}, the opposite ends reveal what doesn't connect — and the same goes for `,
                { name: theirFirst, color: 'var(--p-ink)' },
                `. Tap any letter to see what each of you pulls away from.`,
              ))}
            </p>
          )}
          <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-4)', margin: 0 }}>
            tap any letter to see what that dimension looks like for both of you.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Genre Code Blend ──────────────────────────────────────────────────────────

function GenreCodeBlend({
  myGenres, theirGenres, myLibraryFilms, theirLibraryFilms, myName, theirName,
  myDetailGenres, theirDetailGenres,
}: {
  myGenres: SimpleGenreEntry[]
  theirGenres: SimpleGenreEntry[]
  myLibraryFilms: LibraryFilm[]
  theirLibraryFilms: LibraryFilm[]
  myName: string
  theirName: string
  myDetailGenres?: GenreEntry[]
  theirDetailGenres?: GenreEntry[]
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [view, setView] = useState<'likes' | 'dislikes'>('likes')
  const myFirst    = myName.split(' ')[0]
  const theirFirst = theirName.split(' ')[0]

  const myFiltered    = [...myGenres].filter(g => g.count >= 2 && g.avgRating != null)
  const theirFiltered = [...theirGenres].filter(g => g.count >= 2 && g.avgRating != null)

  const myTop4     = myFiltered.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0)).slice(0, 4)
  const theirTop4  = theirFiltered.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0)).slice(0, 4)
  const myBottom4  = [...myFiltered].sort((a, b) => (a.avgRating ?? 0) - (b.avgRating ?? 0)).slice(0, 4)
  const theirBottom4 = [...theirFiltered].sort((a, b) => (a.avgRating ?? 0) - (b.avgRating ?? 0)).slice(0, 4)

  const myDisplay    = view === 'likes' ? myTop4    : myBottom4
  const theirDisplay = view === 'likes' ? theirTop4 : theirBottom4
  const mySet     = new Set(myDisplay.map(g => g.label))
  const theirSet  = new Set(theirDisplay.map(g => g.label))

  const myExpandedEntry    = expanded ? myGenres.find(g => g.label === expanded) ?? null : null
  const theirExpandedEntry = expanded ? theirGenres.find(g => g.label === expanded) ?? null : null
  // For dislikes view, show lowest-rated films in that genre; for likes, show highest-rated
  const myFilms    = expanded ? [...myLibraryFilms].filter(f => f.genres?.some(g => g.toLowerCase().includes(expanded.toLowerCase()))).sort((a, b) => view === 'dislikes' ? (a.my_stars ?? 0) - (b.my_stars ?? 0) : (b.my_stars ?? 0) - (a.my_stars ?? 0)).slice(0, 4) : []
  const theirFilms = expanded ? [...theirLibraryFilms].filter(f => f.genres?.some(g => g.toLowerCase().includes(expanded.toLowerCase()))).sort((a, b) => view === 'dislikes' ? (a.my_stars ?? 0) - (b.my_stars ?? 0) : (b.my_stars ?? 0) - (a.my_stars ?? 0)).slice(0, 4) : []

  // Subgenres: nuanced AI genres that contain the expanded genre name
  // For dislikes view, sort subgenres by lowest rating; for likes, by highest
  const mySubgenres    = expanded && myDetailGenres
    ? myDetailGenres.filter(g => g.label.toLowerCase().includes(expanded.toLowerCase()) && g.label !== expanded && (g.count ?? 0) >= 1).sort((a, b) => view === 'dislikes' ? (a.avgRating ?? 0) - (b.avgRating ?? 0) : (b.avgRating ?? 0) - (a.avgRating ?? 0)).slice(0, 6)
    : []
  const theirSubgenres = expanded && theirDetailGenres
    ? theirDetailGenres.filter(g => g.label.toLowerCase().includes(expanded.toLowerCase()) && g.label !== expanded && (g.count ?? 0) >= 1).sort((a, b) => view === 'dislikes' ? (a.avgRating ?? 0) - (b.avgRating ?? 0) : (b.avgRating ?? 0) - (a.avgRating ?? 0)).slice(0, 6)
    : []

  function GenreTile({ genre, isShared, personColor }: { genre: SimpleGenreEntry; isShared: boolean; personColor: string }) {
    const isSelected = expanded === genre.label
    return (
      <button
        onClick={() => setExpanded(prev => prev === genre.label ? null : genre.label)}
        style={{
          display: 'block', width: '100%', padding: '12px 16px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
          border: `1.5px solid ${isSelected ? 'var(--ink)' : isShared ? 'var(--forest)' : personColor}`,
          background: isSelected ? 'var(--ink)' : isShared ? 'rgba(74,107,62,0.06)' : 'transparent',
          transition: 'all 120ms',
        }}
      >
        <div style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500, lineHeight: 1.2, color: isSelected ? 'var(--paper)' : isShared ? 'var(--forest)' : personColor }}>
          {genre.label}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: isSelected ? 'var(--paper-edge)' : 'var(--ink-4)', marginTop: 4 }}>
          {genre.avgRating?.toFixed(1)}★ · {genre.count} films
        </div>
      </button>
    )
  }

  return (
    <div style={{ marginBottom: 48 }}>
      {/* Likes / Dislikes pill toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 0, background: 'var(--paper-2)', borderRadius: 999, padding: 2 }}>
          {(['likes', 'dislikes'] as const).map(v => (
            <button
              key={v}
              onClick={() => { setView(v); setExpanded(null) }}
              style={{
                padding: '6px 20px', borderRadius: 999, cursor: 'pointer', border: 'none',
                background: view === v ? 'var(--ink)' : 'transparent',
                color: view === v ? 'var(--paper)' : 'var(--ink-3)',
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em',
                textTransform: 'uppercase', transition: 'all 120ms',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Two columns centered */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, maxWidth: 680, margin: '0 auto 28px' }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--s-ink)', letterSpacing: '0.1em', marginBottom: 12 }}>
            {myFirst.toUpperCase()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {myDisplay.length === 0
              ? <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', margin: 0, gridColumn: '1 / -1' }}>not enough rated films yet</p>
              : myDisplay.map(g => <GenreTile key={g.label} genre={g} isShared={theirSet.has(g.label)} personColor="var(--s-ink)" />)
            }
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--p-ink)', letterSpacing: '0.1em', marginBottom: 12 }}>
            {theirFirst.toUpperCase()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {theirDisplay.length === 0
              ? <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', margin: 0, gridColumn: '1 / -1' }}>not enough rated films yet</p>
              : theirDisplay.map(g => <GenreTile key={g.label} genre={g} isShared={mySet.has(g.label)} personColor="var(--p-ink)" />)
            }
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 32 }}>
        {[
          { dot: '●', color: 'var(--forest)', label: 'in both top 4' },
          { dot: '○', color: 'var(--ink-4)',   label: 'unique to one' },
        ].map(({ dot, color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color }}>{dot}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '0.5px solid var(--paper-edge)', paddingTop: 36, maxWidth: 680, margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 500, textAlign: 'center', marginBottom: 32 }}>
            {expanded}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
            {[
              { first: myFirst, color: 'var(--s-ink)', genreEntry: myExpandedEntry, films: myFilms, subgenres: mySubgenres },
              { first: theirFirst, color: 'var(--p-ink)', genreEntry: theirExpandedEntry, films: theirFilms, subgenres: theirSubgenres },
            ].map(({ first, color, genreEntry, films, subgenres }) => (
              <div key={first}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color, letterSpacing: '0.1em', marginBottom: 16 }}>
                  {first.toUpperCase()}
                </div>
                {genreEntry ? (
                  <>
                    <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--serif-display)', fontSize: 26, fontWeight: 600, color, lineHeight: 1 }}>
                          {genreEntry.avgRating?.toFixed(1)}
                        </div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 3 }}>AVG STARS</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: 'var(--serif-display)', fontSize: 26, fontWeight: 600, color: 'var(--ink)', lineHeight: 1 }}>
                          {genreEntry.count}
                        </div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 3 }}>FILMS SEEN</div>
                      </div>
                    </div>
                    {films.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                        {films.map(f => (
                          <div key={f.film_id} style={{ width: 68, textAlign: 'center' }}>
                            <div style={{ width: 68, height: 102, borderRadius: 4, overflow: 'hidden', background: 'var(--paper-edge)', position: 'relative', marginBottom: 5 }}>
                              {f.poster_path && <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} />}
                            </div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color }}>{(f.my_stars ?? 0).toFixed(1)}★</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {subgenres.length > 0 && (
                      <div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>SUBGENRES</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {subgenres.map(sg => (
                            <div key={sg.label} style={{
                              padding: '4px 10px', borderRadius: 999,
                              border: '0.5px solid var(--paper-edge)',
                              background: 'var(--paper-2)',
                            }}>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-3)' }}>{sg.label}</span>
                              {sg.avgRating != null && (
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', marginLeft: 5 }}>{sg.avgRating.toFixed(1)}★</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-4)', margin: 0, lineHeight: 1.6 }}>
                    hasn't rated many {expanded} films yet.
                  </p>
                )}
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <button
              onClick={() => setExpanded(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)', letterSpacing: '0.06em', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              ← back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CompatibilityPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [friendId, setFriendId] = useState('')
  const [myName, setMyName] = useState('')
  const [friendName, setFriendName] = useState('')
  const [myData, setMyData] = useState<TasteData | null>(null)
  const [theirData, setTheirData] = useState<TasteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('taste')

  useEffect(() => {
    params.then(async ({ id }) => {
      setFriendId(id)
      const [mine, theirs] = await Promise.all([
        fetch('/api/profile/taste').then(r => r.json()),
        fetch(`/api/friends/${id}/taste`).then(r => r.json()),
      ])
      setMyData(mine)
      setTheirData(theirs)
      setMyName(mine?.myName ?? 'you')
      setFriendName(theirs?.friendName ?? '')
      setLoading(false)
    })
  }, [params])

  const tScore = useMemo(() =>
    myData && theirData ? tasteScore(myData.dimensions, theirData.dimensions) : null,
  [myData, theirData])

  const gScore = useMemo(() =>
    myData && theirData ? genreScore(myData.genres, theirData.genres) : null,
  [myData, theirData])

  const myFirst    = myName.split(' ')[0]
  const theirFirst = friendName.split(' ')[0]

  return (
    <AppShell active="friends">
      <div style={{ padding: '40px 64px 100px', maxWidth: 1060, margin: '0 auto' }}>

        {/* Nav */}
        <button
          onClick={() => router.push(`/friends/${friendId}`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', padding: 0, marginBottom: 36 }}
        >
          ← blend
        </button>

        {loading ? (
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>loading…</p>
        ) : myData && theirData ? (
          <>
            {/* ── Page header ──────────────────────────────────────── */}
            <div style={{ marginBottom: 40 }}>
              <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ COMPATIBILITY</div>
              <h1 className="t-display" style={{ fontSize: 46, margin: 0, lineHeight: 1 }}>
                <span style={{ color: 'var(--s-ink)' }}>{myFirst}</span>
                <span style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontWeight: 300, fontSize: 34, margin: '0 12px' }}>&amp;</span>
                <span style={{ color: 'var(--p-ink)' }}>{theirFirst}</span>
              </h1>
            </div>

            {/* ── Tabs ─────────────────────────────────────────────── */}
            <div style={{ borderBottom: '0.5px solid var(--paper-edge)', display: 'flex', gap: 0, marginBottom: 40, justifyContent: 'center' }}>
              {([
                { id: 'taste' as TabId, label: 'Taste Alignment', score: tScore },
                { id: 'genre' as TabId, label: 'Genre Alignment',  score: gScore },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: '13px 24px', cursor: 'pointer', background: 'transparent', border: 'none',
                    borderBottom: tab === t.id ? '2px solid var(--ink)' : '2px solid transparent',
                    fontFamily: 'var(--serif-body)', fontSize: 14,
                    fontWeight: tab === t.id ? 600 : 400,
                    color: tab === t.id ? 'var(--ink)' : 'var(--ink-3)',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                  }}
                >
                  {t.label}
                  {t.score != null && (
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 10,
                      color: t.score >= 72 ? 'var(--forest)' : t.score >= 52 ? 'var(--sun)' : 'var(--ink-4)',
                      letterSpacing: '0.04em',
                    }}>
                      {t.score} / 100
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ══ TASTE ALIGNMENT TAB ══════════════════════════════════ */}
            {tab === 'taste' && (
              <>
                {tScore != null && <ScoreBar score={tScore} label="Taste Alignment" />}
                {myData.tasteCode && theirData.tasteCode ? (
                  <TasteCodeBlend
                    myCode={myData.tasteCode}
                    theirCode={theirData.tasteCode}
                    myName={myName}
                    theirName={friendName}
                  />
                ) : (
                  <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
                    taste profiles are still being built.
                  </p>
                )}
              </>
            )}

            {/* ══ GENRE ALIGNMENT TAB ══════════════════════════════════ */}
            {tab === 'genre' && (
              <>
                {gScore != null && <ScoreBar score={gScore} label="Genre Alignment" />}
                <GenreCodeBlend
                  myGenres={myData.simpleGenres}
                  theirGenres={theirData.simpleGenres}
                  myLibraryFilms={myData.libraryFilms}
                  theirLibraryFilms={theirData.libraryFilms}
                  myName={myName}
                  theirName={friendName}
                  myDetailGenres={myData.genres}
                  theirDetailGenres={theirData.genres}
                />
              </>
            )}
          </>
        ) : (
          <p style={{ fontStyle: 'italic', color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>could not load compatibility data.</p>
        )}
      </div>
    </AppShell>
  )
}
