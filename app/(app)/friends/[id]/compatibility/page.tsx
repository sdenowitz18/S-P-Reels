'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/app-shell'
import { TasteDimensions } from '@/lib/prompts/taste-profile'

// ── Types ─────────────────────────────────────────────────────────────────────

interface GenreEntry { label: string; score: number; count: number; avgRating: number | null }
interface LibraryFilm {
  film_id: string; title: string; year: number | null; poster_path: string | null
  director: string | null; genres: string[]; cast: string[]; my_stars: number | null
}
interface TasteData {
  myName?: string
  friendName?: string
  dimensions: TasteDimensions
  genres: GenreEntry[]
  libraryFilms: LibraryFilm[]
  filmCount: number
  ratedCount: number
}

type DimKey = keyof TasteDimensions
type TabId = 'taste' | 'genre'

// ── Dimension metadata ────────────────────────────────────────────────────────

const DIMS: { key: DimKey; axis: string; neg: string; pos: string }[] = [
  { key: 'pace',         axis: 'Pace',          neg: 'patient',       pos: 'kinetic'       },
  { key: 'style',        axis: 'Visual Style',  neg: 'restrained',    pos: 'expressive'    },
  { key: 'complexity',   axis: 'Complexity',    neg: 'accessible',    pos: 'complex'       },
  { key: 'warmth',       axis: 'Warmth',        neg: 'cool',          pos: 'warm'          },
  { key: 'tone',         axis: 'Tone',          neg: 'light',         pos: 'dark'          },
  { key: 'story_engine', axis: 'Story Engine',  neg: 'character',     pos: 'plot-driven'   },
]

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

function dimWord(v: number, neg: string, pos: string): string {
  if (v > 0.4) return pos
  if (v < -0.4) return neg
  return 'in the middle'
}

function alignWord(diff: number): string {
  if (diff < 0.3) return 'strong'
  if (diff < 0.6) return 'decent'
  return 'weak'
}

function overallProseSegments(
  myName: string, theirName: string,
  myDims: TasteDimensions, theirDims: TasteDimensions
): ProseSegment[] {
  const my  = { name: myName,    color: 'var(--s-ink)' }
  const thy = { name: theirName, color: 'var(--p-ink)' }

  // Find strongest alignment and strongest divergence
  const diffs = DIMS.map(d => ({ ...d, diff: Math.abs(myDims[d.key] - theirDims[d.key]) }))
  const aligned = [...diffs].sort((a, b) => a.diff - b.diff).slice(0, 2)
  const diverged = [...diffs].sort((a, b) => b.diff - a.diff)[0]

  const a0 = aligned[0]
  const a1 = aligned[1]
  const myA0Word  = dimWord(myDims[a0.key],  a0.neg, a0.pos)
  const myA1Word  = dimWord(myDims[a1.key],  a1.neg, a1.pos)
  const myDivWord = dimWord(myDims[diverged.key],  diverged.neg, diverged.pos)
  const thDivWord = dimWord(theirDims[diverged.key], diverged.neg, diverged.pos)

  return buildSegments(
    my, ` and `, thy, ` both land on the `,
    `${myA0Word} end of ${a0.axis.toLowerCase()}, and tend toward `,
    `${myA1Word} on ${a1.axis.toLowerCase()} — `,
    `a solid foundation for picking films together. `,
    `The clearest gap is on ${diverged.axis.toLowerCase()}: `,
    my, ` runs ${myDivWord} while `, thy, ` pulls ${thDivWord}.`
  )
}

function dimProseSegments(
  dim: { key: DimKey; axis: string; neg: string; pos: string },
  myName: string, theirName: string,
  myDims: TasteDimensions, theirDims: TasteDimensions
): ProseSegment[] {
  const my  = { name: myName,    color: 'var(--s-ink)' }
  const thy = { name: theirName, color: 'var(--p-ink)' }
  const v1 = myDims[dim.key]
  const v2 = theirDims[dim.key]
  const diff = Math.abs(v1 - v2)
  const sameDir = (v1 >= 0 && v2 >= 0) || (v1 <= 0 && v2 <= 0)
  const myWord = dimWord(v1, dim.neg, dim.pos)
  const thWord = dimWord(v2, dim.neg, dim.pos)
  const align = alignWord(diff)

  if (sameDir && diff < 0.35) {
    return buildSegments(
      `${align === 'strong' ? 'Strong alignment' : 'Decent alignment'} on ${dim.axis.toLowerCase()}. Both `,
      my, ` and `, thy, ` lean `, `${myWord}`,
      ` — you'll rarely disagree about `,
      dim.key === 'pace' ? 'whether a film moves too slow.' :
      dim.key === 'tone' ? 'whether a film is too heavy or too light.' :
      dim.key === 'warmth' ? 'whether a film has enough emotional depth.' :
      dim.key === 'complexity' ? 'whether a film is too dense or too simple.' :
      dim.key === 'style' ? 'whether the visual approach works.' :
      'the shape of the story.',
    )
  }

  if (!sameDir && diff > 0.5) {
    return buildSegments(
      `The biggest gap. `,
      my, ` leans `, `${myWord}`, ` while `, thy, ` goes `, `${thWord}`,
      `. This is where you'll need to compromise — the films in your sweet spot `,
      `will have to split the difference on ${dim.axis.toLowerCase()}.`
    )
  }

  return buildSegments(
    my, ` sits `, `${myWord}`, ` and `, thy, ` sits `, `${thWord}`,
    ` on ${dim.axis.toLowerCase()} — `,
    `some tension here, but nothing you can't navigate with the right pick.`
  )
}

// ── Alignment scores ──────────────────────────────────────────────────────────

function tasteScore(a: TasteDimensions, b: TasteDimensions): number {
  const keys = Object.keys(a) as DimKey[]
  const avg = keys.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0) / keys.length
  return Math.round((1 - avg / 2) * 100)
}

function genreScore(myGenres: GenreEntry[], theirGenres: GenreEntry[]): number {
  const myMap = new Map(myGenres.map(g => [g.label, g.avgRating ?? 0]))
  const theirMap = new Map(theirGenres.map(g => [g.label, g.avgRating ?? 0]))
  const shared = [...myMap.keys()].filter(k => theirMap.has(k))
  if (shared.length === 0) return 50
  const diffs = shared.map(k => Math.abs((myMap.get(k) ?? 0) - (theirMap.get(k) ?? 0)))
  const avg = diffs.reduce((s, d) => s + d, 0) / diffs.length
  return Math.round(Math.max(0, Math.min(100, (1 - avg / 5) * 100)))
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreDisplay({ score, label }: { score: number; label: string }) {
  const color = score >= 72 ? 'var(--forest)' : score >= 52 ? 'var(--sun)' : 'var(--ink-3)'
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontFamily: 'var(--serif-display)', fontSize: 56, fontWeight: 600, color, lineHeight: 1 }}>
        {score}
      </span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>
        / 100 {label}
      </span>
    </div>
  )
}

function PosterCard({
  film, myStars, theirStars, myColor, theirColor,
}: {
  film: LibraryFilm; myStars: number | null; theirStars: number | null
  myColor: string; theirColor: string
}) {
  return (
    <div style={{ width: 90, flexShrink: 0 }}>
      <div style={{
        width: 90, height: 134, borderRadius: 5, overflow: 'hidden',
        background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
        position: 'relative', marginBottom: 7,
      }}>
        {film.poster_path
          ? <Image src={film.poster_path} alt={film.title} fill style={{ objectFit: 'cover' }} />
          : <div style={{
              width: '100%', height: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: 6, fontSize: 8,
              fontFamily: 'var(--mono)', color: 'var(--ink-4)', textAlign: 'center',
            }}>{film.title.toUpperCase()}</div>
        }
      </div>
      <div style={{
        fontFamily: 'var(--serif-body)', fontSize: 10.5, lineHeight: 1.3,
        color: 'var(--ink)', marginBottom: 5,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {film.title}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {myStars != null && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: myColor, letterSpacing: '0.02em' }}>
            {myStars.toFixed(1)}★
          </span>
        )}
        {myStars != null && theirStars != null && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)' }}>·</span>
        )}
        {theirStars != null && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: theirColor, letterSpacing: '0.02em' }}>
            {theirStars.toFixed(1)}★
          </span>
        )}
      </div>
    </div>
  )
}

function FilmRow({
  title, films, myColor, theirColor, emptyText,
}: {
  title: string; films: { film: LibraryFilm; myStars: number | null; theirStars: number | null }[]
  myColor: string; theirColor: string; emptyText: string
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 14 }}>
        {title}
      </div>
      {films.length === 0 ? (
        <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)', margin: 0 }}>
          {emptyText}
        </p>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {films.map(({ film, myStars, theirStars }) => (
            <PosterCard
              key={film.film_id}
              film={film}
              myStars={myStars}
              theirStars={theirStars}
              myColor={myColor}
              theirColor={theirColor}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Radar (local, with clickable labels) ──────────────────────────────────────

const N = 6
const CX = 150
const CY = 145
const R  = 96
const LABEL_R = 124

function angleFor(i: number) { return (i * (2 * Math.PI) / N) - Math.PI / 2 }
function pt(i: number, radius: number) {
  const a = angleFor(i)
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) }
}
function norm(v: number) { return Math.max(0, Math.min(1, (v + 1) / 2)) }

function InteractiveRadar({
  myDims, theirDims, myName, theirName,
  selectedDim, onSelect,
}: {
  myDims: TasteDimensions; theirDims: TasteDimensions
  myName: string; theirName: string
  selectedDim: DimKey | null; onSelect: (k: DimKey | null) => void
}) {
  const rings = [0.33, 0.66, 1].map(pct => {
    const pts = DIMS.map((_, i) => pt(i, R * pct))
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
  })
  const axisLines = DIMS.map((_, i) => { const tip = pt(i, R); return `M ${CX} ${CY} L ${tip.x} ${tip.y}` })

  const myPts   = DIMS.map((d, i) => pt(i, R * norm(myDims[d.key])))
  const theirPts = DIMS.map((d, i) => pt(i, R * norm(theirDims[d.key])))
  const myPath    = myPts.map((p, i)    => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
  const theirPath = theirPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg width={300} height={290} viewBox="0 0 300 290" style={{ overflow: 'visible', display: 'block' }}>
        {rings.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--paper-edge)" strokeWidth={0.75} />
        ))}
        {axisLines.map((d, i) => (
          <path key={i} d={d} stroke="var(--paper-edge)" strokeWidth={0.75} />
        ))}

        {/* Their polygon */}
        <path d={theirPath} fill="var(--p-ink)" fillOpacity={0.12} stroke="var(--p-ink)" strokeWidth={1.5} strokeLinejoin="round" />
        {/* My polygon */}
        <path d={myPath} fill="var(--s-ink)" fillOpacity={0.12} stroke="var(--s-ink)" strokeWidth={1.5} strokeLinejoin="round" />

        {theirPts.map((p, i) => <circle key={`t-${i}`} cx={p.x} cy={p.y} r={3} fill="var(--p-ink)" />)}
        {myPts.map((p, i)    => <circle key={`m-${i}`} cx={p.x} cy={p.y} r={3} fill="var(--s-ink)" />)}

        {/* Axis labels — clickable */}
        {DIMS.map((dim, i) => {
          const angle = angleFor(i)
          const lp = { x: CX + LABEL_R * Math.cos(angle), y: CY + LABEL_R * Math.sin(angle) }
          const myVal = myDims[dim.key]
          const thVal = theirDims[dim.key]
          const avg   = (myVal + thVal) / 2
          const label = avg >= 0 ? dim.pos : dim.neg
          const anchor = lp.x < CX - 5 ? 'end' : lp.x > CX + 5 ? 'start' : 'middle'
          const dyOffset = lp.y < CY - 5 ? -6 : lp.y > CY + 5 ? 14 : 4
          const isSelected = selectedDim === dim.key

          return (
            <g
              key={dim.key}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelect(isSelected ? null : dim.key)}
            >
              <circle cx={lp.x} cy={lp.y} r={20} fill="transparent" />
              <text
                x={lp.x}
                y={lp.y + dyOffset}
                textAnchor={anchor}
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: isSelected ? 10 : 9,
                  fill: isSelected ? 'var(--ink)' : 'var(--ink-3)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: isSelected ? 700 : 400,
                  transition: 'all 120ms',
                  userSelect: 'none',
                }}
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 4 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--s-ink)', letterSpacing: '0.04em' }}>
          ● {myName.split(' ')[0]}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--p-ink)', letterSpacing: '0.04em' }}>
          ● {theirName.split(' ')[0]}
        </span>
      </div>
    </div>
  )
}

// ── Genre tab helpers ─────────────────────────────────────────────────────────

function findGenreConverge(
  myGenres: GenreEntry[], theirGenres: GenreEntry[],
  myFilms: LibraryFilm[], theirFilms: LibraryFilm[],
): { film: LibraryFilm; myStars: number | null; theirStars: number | null }[] {
  const myHighGenres = new Set(myGenres.filter(g => (g.avgRating ?? 0) >= 3.8).map(g => g.label))
  const thHighGenres = new Set(theirGenres.filter(g => (g.avgRating ?? 0) >= 3.8).map(g => g.label))
  const sharedGenres = [...myHighGenres].filter(g => thHighGenres.has(g))
  if (sharedGenres.length === 0) return []

  const theirMap = new Map(theirFilms.map(f => [f.film_id, f]))
  return myFilms
    .filter(f => f.genres.some(g => sharedGenres.includes(g)) && theirMap.has(f.film_id))
    .sort((a, b) => ((b.my_stars ?? 0) + (theirMap.get(b.film_id)?.my_stars ?? 0)) -
                    ((a.my_stars ?? 0) + (theirMap.get(a.film_id)?.my_stars ?? 0)))
    .slice(0, 6)
    .map(f => ({ film: f, myStars: f.my_stars, theirStars: theirMap.get(f.film_id)?.my_stars ?? null }))
}

function findGenreDiverge(
  myGenres: GenreEntry[], theirGenres: GenreEntry[],
  myFilms: LibraryFilm[], theirFilms: LibraryFilm[],
): { film: LibraryFilm; myStars: number | null; theirStars: number | null }[] {
  const theirMap = new Map(theirFilms.map(f => [f.film_id, f]))
  const myHigh  = new Set(myGenres.filter(g => (g.avgRating ?? 0) >= 4).map(g => g.label))
  const thHigh  = new Set(theirGenres.filter(g => (g.avgRating ?? 0) >= 4).map(g => g.label))

  // Genres one loves, other doesn't prioritize
  const onlyMine  = [...myHigh].filter(g => !thHigh.has(g))
  const onlyTheirs = [...thHigh].filter(g => !myHigh.has(g))

  const results: { film: LibraryFilm; myStars: number | null; theirStars: number | null }[] = []

  // My divergent picks — highly rated by me, in genre they don't prioritize
  const myPicks = myFilms
    .filter(f => f.genres.some(g => onlyMine.includes(g)) && (f.my_stars ?? 0) >= 4)
    .sort((a, b) => (b.my_stars ?? 0) - (a.my_stars ?? 0))
    .slice(0, 3)
  for (const f of myPicks) {
    results.push({ film: f, myStars: f.my_stars, theirStars: theirMap.get(f.film_id)?.my_stars ?? null })
  }

  // Their divergent picks — highly rated by them, in genre I don't prioritize
  const theirPicks = theirFilms
    .filter(f => f.genres.some(g => onlyTheirs.includes(g)) && (f.my_stars ?? 0) >= 4)
    .sort((a, b) => (b.my_stars ?? 0) - (a.my_stars ?? 0))
    .slice(0, 3)
  const myMap = new Map(myFilms.map(f => [f.film_id, f]))
  for (const f of theirPicks) {
    results.push({ film: f, myStars: myMap.get(f.film_id)?.my_stars ?? null, theirStars: f.my_stars })
  }

  return results.slice(0, 6)
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
  const [selectedDim, setSelectedDim] = useState<DimKey | null>(null)

  // Genre find-movies state
  const [findingMovies, setFindingMovies] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [suggestedFilms, setSuggestedFilms] = useState<LibraryFilm[] | null>(null)

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

  // Taste tab — converge / diverge from both-watched films
  const tasteConverge = useMemo(() => {
    if (!myData || !theirData) return []
    const theirMap = new Map(theirData.libraryFilms.map(f => [f.film_id, f]))
    return myData.libraryFilms
      .filter(f => (f.my_stars ?? 0) >= 3.5 && (theirMap.get(f.film_id)?.my_stars ?? 0) >= 3.5 &&
        Math.abs((f.my_stars ?? 0) - (theirMap.get(f.film_id)?.my_stars ?? 0)) < 1)
      .sort((a, b) => ((b.my_stars ?? 0) + (theirMap.get(b.film_id)?.my_stars ?? 0)) -
                      ((a.my_stars ?? 0) + (theirMap.get(a.film_id)?.my_stars ?? 0)))
      .slice(0, 6)
      .map(f => ({ film: f, myStars: f.my_stars, theirStars: theirMap.get(f.film_id)?.my_stars ?? null }))
  }, [myData, theirData])

  const tasteDiverge = useMemo(() => {
    if (!myData || !theirData) return []
    const theirMap = new Map(theirData.libraryFilms.map(f => [f.film_id, f]))
    return myData.libraryFilms
      .filter(f => f.my_stars != null && theirMap.has(f.film_id) &&
        Math.abs((f.my_stars ?? 0) - (theirMap.get(f.film_id)?.my_stars ?? 0)) >= 1.5)
      .sort((a, b) =>
        Math.abs((b.my_stars ?? 0) - (theirMap.get(b.film_id)?.my_stars ?? 0)) -
        Math.abs((a.my_stars ?? 0) - (theirMap.get(a.film_id)?.my_stars ?? 0)))
      .slice(0, 6)
      .map(f => ({ film: f, myStars: f.my_stars, theirStars: theirMap.get(f.film_id)?.my_stars ?? null }))
  }, [myData, theirData])

  // Genre tab
  const genreConverge = useMemo(() => {
    if (!myData || !theirData) return []
    return findGenreConverge(myData.genres, theirData.genres, myData.libraryFilms, theirData.libraryFilms)
  }, [myData, theirData])

  const genreDiverge = useMemo(() => {
    if (!myData || !theirData) return []
    return findGenreDiverge(myData.genres, theirData.genres, myData.libraryFilms, theirData.libraryFilms)
  }, [myData, theirData])

  // Active prose
  const activeProseSegs = useMemo(() => {
    if (!myData || !theirData) return []
    const dim = DIMS.find(d => d.key === selectedDim)
    if (dim) return dimProseSegments(dim, myName, friendName, myData.dimensions, theirData.dimensions)
    return overallProseSegments(myName, friendName, myData.dimensions, theirData.dimensions)
  }, [selectedDim, myData, theirData, myName, friendName])

  // Find movies we both like (algorithmic — films in DB neither has seen, scored against avg taste vector)
  const handleFindMovies = async () => {
    if (!myData || !theirData) return
    setFindingMovies(true)
    setConfirming(false)
    try {
      const watchedSet = new Set([
        ...myData.libraryFilms.map(f => f.film_id),
        ...theirData.libraryFilms.map(f => f.film_id),
      ])
      const res = await fetch(`/api/friends/${friendId}/find-together`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludeFilmIds: [...watchedSet] }),
      })
      if (res.ok) {
        const data = await res.json()
        setSuggestedFilms(data.films ?? [])
      }
    } finally {
      setFindingMovies(false)
    }
  }

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
            <div style={{ borderBottom: '0.5px solid var(--paper-edge)', display: 'flex', gap: 0, marginBottom: 40 }}>
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
                    display: 'inline-flex', alignItems: 'baseline', gap: 10,
                  }}
                >
                  {t.label}
                  {t.score != null && (
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 10,
                      color: tab === t.id ? 'var(--ink-2)' : 'var(--ink-4)',
                    }}>
                      {t.score}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ══ TASTE ALIGNMENT TAB ══════════════════════════════════ */}
            {tab === 'taste' && (
              <>
                {tScore != null && (
                  <div style={{ marginBottom: 32 }}>
                    <ScoreDisplay score={tScore} label="TASTE ALIGNMENT" />
                  </div>
                )}

                {/* Radar + prose */}
                <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start', marginBottom: 56, flexWrap: 'wrap' }}>
                  <div style={{ flex: '0 0 auto' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)', letterSpacing: '0.08em', marginBottom: 10 }}>
                      CLICK A LABEL TO FOCUS
                    </div>
                    <InteractiveRadar
                      myDims={myData.dimensions}
                      theirDims={theirData.dimensions}
                      myName={myName}
                      theirName={friendName}
                      selectedDim={selectedDim}
                      onSelect={setSelectedDim}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 260, paddingTop: 28 }}>
                    {selectedDim && (
                      <div style={{
                        fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)',
                        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12,
                      }}>
                        {DIMS.find(d => d.key === selectedDim)?.axis}
                      </div>
                    )}
                    <p style={{
                      fontFamily: 'var(--serif-display)',
                      fontSize: 18,
                      lineHeight: 1.65,
                      color: 'var(--ink)',
                      margin: 0,
                      fontStyle: 'italic',
                      fontWeight: 400,
                    }}>
                      {renderSegments(activeProseSegs)}
                    </p>
                    {selectedDim && (
                      <button
                        onClick={() => setSelectedDim(null)}
                        style={{
                          marginTop: 14, background: 'none', border: 'none', cursor: 'pointer',
                          fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)',
                          letterSpacing: '0.06em', padding: 0, textDecoration: 'underline',
                          textUnderlineOffset: 3,
                        }}
                      >
                        ← back to overview
                      </button>
                    )}
                  </div>
                </div>

                {/* Converge / Diverge */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
                  <FilmRow
                    title="★ WHERE YOU CONVERGE"
                    films={tasteConverge}
                    myColor="var(--s-ink)"
                    theirColor="var(--p-ink)"
                    emptyText="No films you've both rated highly yet."
                  />
                  <FilmRow
                    title="★ WHERE YOU DIVERGE"
                    films={tasteDiverge}
                    myColor="var(--s-ink)"
                    theirColor="var(--p-ink)"
                    emptyText="No strong disagreements yet."
                  />
                </div>
              </>
            )}

            {/* ══ GENRE ALIGNMENT TAB ══════════════════════════════════ */}
            {tab === 'genre' && (() => {
              // Compute genre lists for display
              const myMap  = new Map(myData.genres.map(g => [g.label, g]))
              const thMap  = new Map(theirData.genres.map(g => [g.label, g]))
              const allLabels = new Set([...myMap.keys(), ...thMap.keys()])

              const sharedGenres: { label: string; myAvg: number; thAvg: number }[] = []
              const myOnlyGenres: { label: string; myAvg: number }[] = []
              const thOnlyGenres: { label: string; thAvg: number }[] = []

              for (const label of allLabels) {
                const my = myMap.get(label)
                const th = thMap.get(label)
                const myAvg = my?.avgRating ?? 0
                const thAvg = th?.avgRating ?? 0
                if (my && th) {
                  sharedGenres.push({ label, myAvg, thAvg })
                } else if (my && myAvg >= 3.8) {
                  myOnlyGenres.push({ label, myAvg })
                } else if (th && thAvg >= 3.8) {
                  thOnlyGenres.push({ label, thAvg })
                }
              }
              sharedGenres.sort((a, b) => (b.myAvg + b.thAvg) - (a.myAvg + a.thAvg))
              myOnlyGenres.sort((a, b) => b.myAvg - a.myAvg)
              thOnlyGenres.sort((a, b) => b.thAvg - a.thAvg)

              return (
                <>
                  {gScore != null && (
                    <div style={{ marginBottom: 40 }}>
                      <ScoreDisplay score={gScore} label="GENRE ALIGNMENT" />
                    </div>
                  )}

                  {/* ── Genre map ─────────────────────────────────────── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginBottom: 52 }}>

                    {/* Shared / converge */}
                    <div>
                      <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 16 }}>★ SHARED TASTES</div>
                      {sharedGenres.length === 0 ? (
                        <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
                          No genres you've both explored yet.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {sharedGenres.slice(0, 8).map(g => (
                            <div key={g.label} style={{
                              display: 'grid', gridTemplateColumns: '1fr auto auto',
                              gap: 12, alignItems: 'center',
                              padding: '10px 0',
                              borderBottom: '0.5px solid var(--paper-edge)',
                            }}>
                              <span style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500 }}>{g.label}</span>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--s-ink)', letterSpacing: '0.04em', minWidth: 36, textAlign: 'right' }}>
                                {g.myAvg.toFixed(1)}★
                              </span>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--p-ink)', letterSpacing: '0.04em', minWidth: 36, textAlign: 'right' }}>
                                {g.thAvg.toFixed(1)}★
                              </span>
                            </div>
                          ))}
                          <div style={{ marginTop: 10, display: 'flex', gap: 20 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--s-ink)', letterSpacing: '0.04em' }}>{myFirst}</span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--p-ink)', letterSpacing: '0.04em' }}>{theirFirst}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Divergent genres */}
                    <div>
                      <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 16 }}>★ DIFFERENT TERRITORY</div>
                      {myOnlyGenres.length === 0 && thOnlyGenres.length === 0 ? (
                        <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
                          No strong genre divergence yet.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {myOnlyGenres.slice(0, 4).map(g => (
                            <div key={`my-${g.label}`} style={{
                              display: 'grid', gridTemplateColumns: '1fr auto',
                              gap: 12, alignItems: 'center',
                              padding: '10px 0',
                              borderBottom: '0.5px solid var(--paper-edge)',
                            }}>
                              <div>
                                <span style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500 }}>{g.label}</span>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--s-ink)', letterSpacing: '0.06em', marginLeft: 8 }}>{myFirst.toUpperCase()}</span>
                              </div>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--s-ink)', letterSpacing: '0.04em' }}>
                                {g.myAvg.toFixed(1)}★
                              </span>
                            </div>
                          ))}
                          {thOnlyGenres.slice(0, 4).map(g => (
                            <div key={`th-${g.label}`} style={{
                              display: 'grid', gridTemplateColumns: '1fr auto',
                              gap: 12, alignItems: 'center',
                              padding: '10px 0',
                              borderBottom: '0.5px solid var(--paper-edge)',
                            }}>
                              <div>
                                <span style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500 }}>{g.label}</span>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--p-ink)', letterSpacing: '0.06em', marginLeft: 8 }}>{theirFirst.toUpperCase()}</span>
                              </div>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--p-ink)', letterSpacing: '0.04em' }}>
                                {g.thAvg.toFixed(1)}★
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Representative films ───────────────────────────── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginBottom: 64 }}>
                    <FilmRow
                      title="★ FILMS FROM SHARED GENRES"
                      films={genreConverge}
                      myColor="var(--s-ink)"
                      theirColor="var(--p-ink)"
                      emptyText="No films in shared genres you've both seen yet."
                    />
                    <FilmRow
                      title="★ FROM YOUR DIFFERENT WORLDS"
                      films={genreDiverge}
                      myColor="var(--s-ink)"
                      theirColor="var(--p-ink)"
                      emptyText="No divergent-genre picks yet."
                    />
                  </div>

                  {/* ── Find movies CTA ────────────────────────────────── */}
                  <div style={{
                    borderTop: '0.5px solid var(--paper-edge)', paddingTop: 40,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                  }}>
                    {suggestedFilms ? (
                      <>
                        <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 4, textAlign: 'center' }}>
                          ★ FILMS YOU SHOULD WATCH TOGETHER
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {suggestedFilms.map(f => (
                            <PosterCard
                              key={f.film_id}
                              film={f}
                              myStars={null}
                              theirStars={null}
                              myColor="var(--s-ink)"
                              theirColor="var(--p-ink)"
                            />
                          ))}
                        </div>
                        <button
                          onClick={() => { setSuggestedFilms(null); setConfirming(false) }}
                          style={{
                            marginTop: 8, background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)',
                            letterSpacing: '0.06em', padding: 0, textDecoration: 'underline',
                            textUnderlineOffset: 3,
                          }}
                        >
                          find new suggestions
                        </button>
                      </>
                    ) : confirming ? (
                      <div style={{ textAlign: 'center' }}>
                        <p style={{
                          fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 15,
                          color: 'var(--ink-2)', margin: '0 0 18px', lineHeight: 1.6,
                        }}>
                          Find films neither{' '}
                          <span style={{ fontWeight: 600, color: 'var(--s-ink)' }}>{myFirst}</span>
                          {' '}nor{' '}
                          <span style={{ fontWeight: 600, color: 'var(--p-ink)' }}>{theirFirst}</span>
                          {' '}has logged yet?
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                          <button onClick={handleFindMovies} className="btn" style={{ padding: '10px 22px', fontSize: 13, borderRadius: 999 }}>
                            {findingMovies ? 'searching…' : 'generate →'}
                          </button>
                          <button onClick={() => setConfirming(false)} className="btn btn-soft" style={{ padding: '10px 18px', fontSize: 13, borderRadius: 999 }}>
                            cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setConfirming(true)} className="btn" style={{ padding: '13px 28px', fontSize: 14, borderRadius: 999 }}>
                        find movies we both like →
                      </button>
                    )}
                  </div>
                </>
              )
            })()}
          </>
        ) : (
          <p style={{ fontStyle: 'italic', color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>could not load compatibility data.</p>
        )}
      </div>
    </AppShell>
  )
}
