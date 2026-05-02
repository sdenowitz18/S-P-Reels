'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import Image from 'next/image'

// ── Mock data ──────────────────────────────────────────────────────────────────

const MONTH        = 'April 2026'
const FILMS_LOGGED = 14
const AVG_RATING   = 4.1

// Top 4 letters — flag any that changed this month
interface TopLetter {
  letter:    string
  label:     string
  gap:       number
  prevLetter: string | null  // null = same as this month; different = changed
  isNew:     boolean         // brand new dimension entering top 4
}

const TOP_LETTERS: TopLetter[] = [
  { letter: 'H', label: 'Human',   gap: 58, prevLetter: null,  isNew: false },
  { letter: 'F', label: 'Familiar', gap: 34, prevLetter: null, isNew: false },
  { letter: 'P', label: 'Patient', gap: 40, prevLetter: 'K',   isNew: false }, // was 'K' (Kinetic) before
  { letter: 'D', label: 'Direct',  gap: 39, prevLetter: null,  isNew: false },
]

// Recent watches
interface RecentFilm {
  title:       string
  year:        number
  stars:       number
  poster_path: string | null
}

const RECENT_WATCHES: RecentFilm[] = [
  { title: 'Aftersun',              year: 2022, stars: 5,   poster_path: null },
  { title: 'All of Us Strangers',   year: 2023, stars: 4.5, poster_path: null },
  { title: 'Past Lives',            year: 2023, stars: 4.5, poster_path: null },
  { title: 'The Zone of Interest',  year: 2023, stars: 4,   poster_path: null },
  { title: 'Jeanne Dielman',        year: 1975, stars: 5,   poster_path: null },
  { title: 'Mission: Impossible',   year: 2023, stars: 3,   poster_path: null },
  { title: 'Killers of the Flower Moon', year: 2023, stars: 4, poster_path: null },
  { title: 'The Holdovers',         year: 2023, stars: 4,   poster_path: null },
]

// Biggest movers
interface FilmImpact {
  title:       string
  stars:       number
  impact:      number   // net impact on this dimension's gap
  poster_path: string | null
  dimScore:    number   // where this film sits on dimension axis: 0–100, 0=left pole, 100=right pole
                        // user's dominant pole is always left, so <50 = reinforces, >50 = pulls against
}

interface DimensionMove {
  dimKey:    string
  dimName:   string
  letter:    string
  label:     string      // user's dominant pole (left)
  oppLabel:  string      // opposite pole (right)
  delta:     number      // net gap change this month (signed)
  prevGap:   number
  currGap:   number
  films:     FilmImpact[]
}

const BIG_MOVERS: DimensionMove[] = [
  {
    dimKey: 'accessible_vs_demanding', dimName: 'Accessibility',
    letter: 'F', label: 'Familiar', oppLabel: 'Demanding',
    delta: -18, prevGap: 52, currGap: 34,
    films: [
      { title: 'Jeanne Dielman',       stars: 5,   impact: -14, poster_path: null, dimScore: 88 },
      { title: 'The Zone of Interest', stars: 4,   impact: -8,  poster_path: null, dimScore: 74 },
      { title: 'Past Lives',           stars: 4.5, impact:  +4, poster_path: null, dimScore: 32 },
    ],
  },
  {
    dimKey: 'kinetic_vs_patient', dimName: 'Pacing',
    letter: 'P', label: 'Patient', oppLabel: 'Kinetic',
    delta: +12, prevGap: 28, currGap: 40,
    films: [
      { title: 'Aftersun',             stars: 5,   impact: +9,  poster_path: null, dimScore: 14 },
      { title: 'All of Us Strangers',  stars: 4.5, impact: +6,  poster_path: null, dimScore: 22 },
      { title: 'Mission: Impossible',  stars: 3,   impact: -3,  poster_path: null, dimScore: 81 },
    ],
  },
  {
    dimKey: 'emotional_directness', dimName: 'Emotional Directness',
    letter: 'D', label: 'Direct', oppLabel: 'Restrained',
    delta: +8, prevGap: 31, currGap: 39,
    films: [
      { title: 'All of Us Strangers',  stars: 4.5, impact: +7,  poster_path: null, dimScore: 18 },
      { title: 'Aftersun',             stars: 5,   impact: +5,  poster_path: null, dimScore: 24 },
    ],
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

// Approximate marker position from gap: user's pole is left, so lower pct = stronger left preference
function gapToMarkerPct(gap: number): number {
  return Math.round((100 - Math.min(gap, 95)) / 2)
}

function deltaColor(delta: number) {
  if (delta > 0) return '#52b788'
  if (delta < 0) return '#e07a5f'
  return 'var(--ink-4)'
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  return (
    <nav style={{
      display: 'inline-flex', gap: 2, alignItems: 'center',
      padding: '4px 6px', borderRadius: 999,
      background: 'var(--paper)', border: '0.5px solid var(--paper-edge)',
    }}>
      {(['taste', 'genre'] as const).map(t => {
        const isActive = active === t
        return (
          <button key={t} onClick={() => onChange(t)} style={{
            padding: '6px 18px', borderRadius: 999, cursor: 'pointer',
            fontFamily: 'var(--serif-body)', fontSize: 13.5,
            fontWeight: isActive ? 600 : 400,
            color: isActive ? 'var(--ink)' : 'var(--ink-3)',
            background: 'none', border: 'none', transition: 'color 120ms',
          }}>
            {t}
          </button>
        )
      })}
    </nav>
  )
}

// ── Before / after spectrum bar ───────────────────────────────────────────────

function BeforeAfterBar({ dim }: { dim: DimensionMove }) {
  const prevPct = gapToMarkerPct(dim.prevGap)
  const currPct = gapToMarkerPct(dim.currGap)

  return (
    <div>
      {/* Pole labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--serif-display)', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
          {dim.letter} · {dim.label}
        </span>
        <span style={{ fontFamily: 'var(--serif-display)', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' }}>
          {dim.oppLabel}
        </span>
      </div>

      {/* Bar with two markers */}
      <div style={{ position: 'relative', height: 4, borderRadius: 999, background: 'var(--paper-edge)' }}>

        {/* "Last month" ghost marker */}
        <div style={{
          position: 'absolute', top: '50%', left: `${prevPct}%`,
          transform: 'translate(-50%, -50%)',
          width: 14, height: 14, borderRadius: '50%',
          background: 'var(--paper)', border: '2px solid var(--ink-4)',
          transition: 'left 600ms ease',
        }} />

        {/* "Now" solid marker */}
        <div style={{
          position: 'absolute', top: '50%', left: `${currPct}%`,
          transform: 'translate(-50%, -50%)',
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--ink)', border: '3px solid var(--paper)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          transition: 'left 600ms ease',
        }} />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--paper)', border: '2px solid var(--ink-4)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)' }}>last month</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ink)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)' }}>now</span>
        </div>
      </div>
    </div>
  )
}

// ── Film impact row ───────────────────────────────────────────────────────────

function FilmImpactRow({ film, dim }: { film: FilmImpact; dim: DimensionMove }) {
  const reinforces = film.impact > 0
  const pct = film.dimScore  // 0 = far left (user's pole), 100 = far right (opp pole)

  return (
    <div style={{
      display: 'grid', alignItems: 'center',
      gridTemplateColumns: '44px 1fr 120px 36px',
      gap: 14, padding: '12px 0',
      borderBottom: '0.5px solid var(--paper-edge)',
    }}>
      {/* Poster */}
      <div style={{
        width: 44, height: 62, borderRadius: 5, overflow: 'hidden', flexShrink: 0,
        background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', position: 'relative',
      }}>
        {film.poster_path && (
          <Image src={film.poster_path} alt={film.title} fill style={{ objectFit: 'cover' }} />
        )}
      </div>

      {/* Title + stars */}
      <div>
        <p style={{ fontFamily: 'var(--serif-body)', fontSize: 14, color: 'var(--ink)', margin: '0 0 4px', fontWeight: 500 }}>
          {film.title}
        </p>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#c9a94a' }}>
          {'★'.repeat(Math.floor(film.stars))}{film.stars % 1 ? '½' : ''}
        </span>
      </div>

      {/* Mini dimension bar for this specific dimension */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)' }}>{dim.label}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)' }}>{dim.oppLabel}</span>
        </div>
        <div style={{ position: 'relative', height: 3, borderRadius: 999, background: 'var(--paper-edge)' }}>
          <div style={{
            position: 'absolute', top: '50%', left: `${pct}%`,
            transform: 'translate(-50%, -50%)',
            width: 8, height: 8, borderRadius: '50%',
            background: reinforces ? '#52b788' : '#e07a5f',
            border: '2px solid var(--paper)',
          }} />
        </div>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', margin: '4px 0 0', textAlign: 'center' }}>
          {pct < 30 ? `strongly ${dim.label.toLowerCase()}` : pct > 70 ? `strongly ${dim.oppLabel.toLowerCase()}` : 'mixed'}
        </p>
      </div>

      {/* Impact number */}
      <div style={{ textAlign: 'right' }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600,
          color: deltaColor(film.impact),
        }}>
          {film.impact > 0 ? `+${film.impact}` : film.impact}
        </span>
      </div>
    </div>
  )
}

// ── Mover card ────────────────────────────────────────────────────────────────

function MoverCard({ dim }: { dim: DimensionMove }) {
  const [open, setOpen] = useState(false)
  const direction = dim.delta > 0
    ? `moving toward ${dim.label.toLowerCase()}`
    : `moving toward ${dim.oppLabel.toLowerCase()}`

  return (
    <div style={{
      border: '0.5px solid var(--paper-edge)', borderRadius: 14,
      overflow: 'hidden', background: 'var(--paper)',
    }}>
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: open ? 'var(--bone)' : 'none',
          border: 'none', cursor: 'pointer', padding: '18px 22px',
          display: 'flex', alignItems: 'center', gap: 16,
          textAlign: 'left', transition: 'background 150ms',
        }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'var(--bone)' }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'none' }}
      >
        {/* Letter block */}
        <div style={{
          width: 44, height: 54, borderRadius: 8, flexShrink: 0,
          background: 'var(--bone)', border: '0.5px solid var(--paper-edge)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--serif-display)', fontSize: 24, fontWeight: 500, color: 'var(--ink)',
        }}>
          {dim.letter}
        </div>

        {/* Name + direction */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--serif-display)', fontSize: 17, fontWeight: 500, color: 'var(--ink)', margin: '0 0 3px' }}>
            {dim.dimName}
          </p>
          <p style={{ fontFamily: 'var(--serif-body)', fontSize: 12.5, fontStyle: 'italic', color: 'var(--ink-4)', margin: 0 }}>
            {direction}
          </p>
        </div>

        {/* Delta */}
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700,
          color: deltaColor(dim.delta), flexShrink: 0,
        }}>
          {dim.delta > 0 ? `+${dim.delta}` : dim.delta}
        </span>

        {/* Chevron */}
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', flexShrink: 0,
          transition: 'transform 200ms', transform: open ? 'rotate(180deg)' : 'none',
        }}>
          ▾
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ padding: '0 22px 24px', borderTop: '0.5px solid var(--paper-edge)' }}>

          {/* Before / after slider */}
          <div style={{ padding: '24px 0 8px' }}>
            <BeforeAfterBar dim={dim} />
          </div>

          {/* Film impacts */}
          <div style={{ marginTop: 8 }}>
            <p style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', margin: '16px 0 0' }}>
              films · impact
            </p>
            {dim.films.map((f, i) => (
              <FilmImpactRow key={i} film={f} dim={dim} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Genre tab (unchanged for now) ─────────────────────────────────────────────

const GENRE_DATA = [
  { name: 'Drama',            prevRank: 1,  currRank: 1,  count: 8, totalCount: 142, isNew: false, films: ['Aftersun', 'All of Us Strangers', 'Past Lives'],       description: 'Your most-watched genre by a wide margin. This month continued the pattern with character-led, emotionally direct films.' },
  { name: 'Romance',          prevRank: 3,  currRank: 2,  count: 5, totalCount: 61,  isNew: false, films: ['Past Lives', 'All of Us Strangers'],                    description: 'Moved up two spots — the highest concentration of romance films you\'ve logged in a single month.' },
  { name: 'Arthouse',         prevRank: 4,  currRank: 3,  count: 4, totalCount: 48,  isNew: false, films: ['Jeanne Dielman', 'The Zone of Interest'],               description: 'Still climbing. Jeanne Dielman was the most demanding film you\'ve logged.' },
  { name: 'Thriller',         prevRank: 2,  currRank: 4,  count: 2, totalCount: 55,  isNew: false, films: ['The Zone of Interest'],                                 description: 'Fell two spots — fewer thrillers this month than usual.' },
  { name: 'Comedy',           prevRank: 5,  currRank: 5,  count: 2, totalCount: 38,  isNew: false, films: [],                                                       description: '' },
  { name: 'Sci-Fi',           prevRank: 6,  currRank: 6,  count: 1, totalCount: 29,  isNew: false, films: [],                                                       description: '' },
  { name: 'Horror',           prevRank: 8,  currRank: 7,  count: 2, totalCount: 22,  isNew: false, films: [],                                                       description: '' },
  { name: 'Documentary',      prevRank: 7,  currRank: 8,  count: 1, totalCount: 18,  isNew: false, films: [],                                                       description: '' },
  { name: 'Historical',       prevRank: 11, currRank: 9,  count: 2, totalCount: 12,  isNew: false, films: ['The Zone of Interest'],                                 description: 'Jumped two spots this month — both historical films were rated highly.' },
  { name: 'Foreign Language', prevRank: 0,  currRank: 10, count: 3, totalCount: 3,   isNew: true,  films: ['Jeanne Dielman', 'Past Lives'],                         description: 'New this month — first time in your top 10. Three foreign-language films logged, all rated 4+ stars.' },
]

function rankChange(prev: number, curr: number) {
  if (prev === 0) return null
  const diff = prev - curr
  if (diff > 0) return { symbol: `↑${diff}`, color: '#52b788' }
  if (diff < 0) return { symbol: `↓${Math.abs(diff)}`, color: 'var(--ink-4)' }
  return null
}

function GenreTab() {
  const [selected, setSelected] = useState(GENRE_DATA[0])
  return (
    <div style={{ width: '100%', maxWidth: 820, display: 'flex', gap: 48, alignItems: 'flex-start' }}>
      <div style={{ flex: '0 0 300px' }}>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-4)', margin: '0 0 16px' }}>top 10 genres</p>
        {GENRE_DATA.map(g => {
          const change = rankChange(g.prevRank, g.currRank)
          const isSel = selected.name === g.name
          return (
            <button key={g.name} onClick={() => setSelected(g)} style={{
              width: '100%', background: isSel ? 'var(--bone)' : 'none', border: 'none',
              borderBottom: '0.5px solid var(--paper-edge)', cursor: 'pointer',
              padding: '12px 10px', display: 'flex', alignItems: 'center', gap: 12,
              textAlign: 'left', borderRadius: isSel ? 8 : 0, transition: 'background 120ms',
            }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)', width: 18, textAlign: 'right', flexShrink: 0 }}>{g.currRank}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: 'var(--serif-body)', fontSize: 14, color: 'var(--ink)', fontWeight: isSel ? 600 : 400 }}>{g.name}</span>
                {g.isNew && <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontSize: 8, color: '#52b788', background: '#e8f5ee', padding: '2px 6px', borderRadius: 99 }}>new</span>}
              </div>
              {g.count > 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>{g.count} film{g.count !== 1 ? 's' : ''}</span>}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, width: 28, textAlign: 'right', color: change?.color ?? 'transparent' }}>
                {change?.symbol ?? (g.isNew ? '★' : '')}
              </span>
            </button>
          )
        })}
      </div>
      {selected && (
        <div style={{ flex: 1, paddingTop: 32 }}>
          <h2 style={{ fontFamily: 'var(--serif-display)', fontSize: 28, fontWeight: 400, color: 'var(--ink)', margin: '0 0 6px' }}>{selected.name}</h2>
          <div style={{ display: 'flex', gap: 28, marginBottom: 24 }}>
            <div>
              <p style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', margin: '0 0 3px' }}>this month</p>
              <p style={{ fontFamily: 'var(--serif-display)', fontSize: 22, color: 'var(--ink)', margin: 0 }}>{selected.count}</p>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', margin: '0 0 3px' }}>all time</p>
              <p style={{ fontFamily: 'var(--serif-display)', fontSize: 22, color: 'var(--ink)', margin: 0 }}>{selected.totalCount}</p>
            </div>
            {selected.prevRank > 0 && selected.prevRank !== selected.currRank && (
              <div>
                <p style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', margin: '0 0 3px' }}>rank</p>
                <p style={{ fontFamily: 'var(--serif-display)', fontSize: 22, color: 'var(--ink)', margin: 0 }}>#{selected.prevRank} → #{selected.currRank}</p>
              </div>
            )}
          </div>
          {selected.description && <p style={{ fontFamily: 'var(--serif-body)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink-3)', lineHeight: 1.8, margin: '0 0 28px', maxWidth: 400 }}>{selected.description}</p>}
          {selected.films.length > 0 && (
            <>
              <p style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', margin: '0 0 12px' }}>films this month</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.films.map((title, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 38, borderRadius: 4, background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--serif-body)', fontSize: 13.5, color: 'var(--ink)' }}>{title}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Taste tab ─────────────────────────────────────────────────────────────────

function TasteTab() {
  const anyChanged   = TOP_LETTERS.some(l => l.prevLetter !== null || l.isNew)
  const changedCount = TOP_LETTERS.filter(l => l.prevLetter !== null).length
  const newCount     = TOP_LETTERS.filter(l => l.isNew).length

  let changeSummary: string
  if (!anyChanged) {
    changeSummary = 'No change in your top four letters this month.'
  } else if (newCount > 0) {
    changeSummary = 'You have a new letter in your top four this month.'
  } else {
    changeSummary = `${changedCount} of your top four letters shifted this month.`
  }

  return (
    <div style={{ width: '100%', maxWidth: 700, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* ── Your 4 letters ── */}
      <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 18, justifyContent: 'center' }}>
          {TOP_LETTERS.map(l => (
            <div key={l.letter} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {/* "NEW" badge or changed-from badge */}
              <div style={{ minHeight: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {l.isNew ? (
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: '#52b788',
                    background: '#e8f5ee', padding: '3px 8px', borderRadius: 99,
                  }}>
                    new ★
                  </span>
                ) : l.prevLetter ? (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)' }}>
                    was {l.prevLetter}
                  </span>
                ) : null}
              </div>

              {/* Letter block */}
              <div style={{
                width: 96, height: 118,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                border: l.isNew
                  ? '1.5px solid #52b788'
                  : l.prevLetter
                  ? '1.5px solid var(--ink-3)'
                  : '0.5px solid var(--paper-edge)',
                borderRadius: 12,
                background: l.isNew ? '#e8f5ee' : 'var(--bone)',
              }}>
                <span style={{
                  fontFamily: 'var(--serif-display)', fontSize: 48, fontWeight: 500,
                  lineHeight: 1, color: l.isNew ? '#2d6a4f' : 'var(--ink)',
                }}>
                  {l.letter}
                </span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.07em',
                  textTransform: 'uppercase', color: l.isNew ? '#52b788' : 'var(--ink-3)',
                }}>
                  {l.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary sentence */}
        <p style={{
          fontFamily: 'var(--serif-body)', fontSize: 14, color: 'var(--ink-3)',
          fontStyle: 'italic', lineHeight: 1.7, margin: 0,
          textAlign: 'center', maxWidth: 480,
        }}>
          {changeSummary} You watched {FILMS_LOGGED} films with an average rating of {AVG_RATING}★. See below for the biggest movers.
        </p>
      </div>

      {/* ── Recent watches carousel ── */}
      <div style={{ marginBottom: 48, width: '100%' }}>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-4)', margin: '0 0 16px', textAlign: 'center' }}>
          recent watches
        </p>
        <div style={{
          display: 'flex', gap: 10, overflowX: 'auto',
          paddingBottom: 8, justifyContent: 'center', flexWrap: 'wrap',
          scrollbarWidth: 'none',
        }}>
          {RECENT_WATCHES.map((f, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{
                width: 72, height: 106, borderRadius: 7, overflow: 'hidden',
                background: 'var(--bone)', border: '0.5px solid var(--paper-edge)',
                position: 'relative',
              }}>
                {f.poster_path && (
                  <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} />
                )}
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#c9a94a' }}>
                {'★'.repeat(Math.floor(f.stars))}{f.stars % 1 ? '½' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Biggest movers ── */}
      <div style={{ width: '100%' }}>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-4)', margin: '0 0 16px', textAlign: 'center' }}>
          biggest movers this month
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BIG_MOVERS.map(dim => (
            <MoverCard key={dim.dimKey} dim={dim} />
          ))}
        </div>
      </div>

    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function TasteReportPage() {
  const [tab, setTab] = useState<'taste' | 'genre'>('taste')

  return (
    <AppShell>
      <div style={{ padding: '56px 7% 80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Page header */}
        <div style={{ width: '100%', maxWidth: 700, marginBottom: 40, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-4)', margin: '0 0 10px', textAlign: 'center' }}>
            monthly update
          </p>
          <h1 style={{ fontFamily: 'var(--serif-display)', fontSize: 36, fontWeight: 400, color: 'var(--ink)', margin: '0 0 28px', lineHeight: 1.1, textAlign: 'center' }}>
            {MONTH}
          </h1>
          <TabBar active={tab} onChange={t => setTab(t as 'taste' | 'genre')} />
        </div>

        {tab === 'taste' ? <TasteTab /> : <GenreTab />}

      </div>
    </AppShell>
  )
}
