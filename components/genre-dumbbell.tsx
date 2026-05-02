'use client'

export interface DumbbellGenre {
  label: string
  myAvg: number
  theirAvg: number
  myCount: number
  theirCount: number
}

export type DumbbellMode = 'rating' | 'count'

interface GenreDumbbellProps {
  genres: DumbbellGenre[]
  mode: DumbbellMode
  myName: string
  theirName: string
  myColor?: string
  theirColor?: string
  /** Optional label shown above this column */
  columnLabel?: string
}

const RATING_MIN = 1.5
const RATING_MAX = 5.0
const DOT_R = 5

/**
 * Horizontal dumbbell chart — one row per genre.
 * mode='rating': X axis = avg star rating (1.5–5★)
 * mode='count':  X axis = films watched (0–max)
 * Each row annotates the difference between the two users.
 */
export function GenreDumbbell({
  genres,
  mode,
  myName,
  theirName,
  myColor = 'var(--s-ink)',
  theirColor = 'var(--p-ink)',
  columnLabel,
}: GenreDumbbellProps) {
  if (genres.length === 0) {
    return (
      <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)', margin: 0 }}>
        Not enough shared data yet.
      </p>
    )
  }

  const LABEL_W = 120
  const GAP     = 16
  const TRACK_W = 200
  const ROW_H   = 30
  const HEADER_H = 30
  const SVG_W   = LABEL_W + GAP + TRACK_W + 8
  const SVG_H   = HEADER_H + genres.length * ROW_H + 8

  // Scale bounds
  const maxCount = mode === 'count'
    ? Math.max(1, ...genres.flatMap(g => [g.myCount, g.theirCount]))
    : 1

  function tx(val: number): number {
    if (mode === 'rating') {
      return LABEL_W + GAP + ((Math.max(RATING_MIN, Math.min(RATING_MAX, val)) - RATING_MIN) / (RATING_MAX - RATING_MIN)) * TRACK_W
    }
    return LABEL_W + GAP + (Math.min(val, maxCount) / maxCount) * TRACK_W
  }

  function myVal(g: DumbbellGenre)    { return mode === 'rating' ? g.myAvg    : g.myCount    }
  function theirVal(g: DumbbellGenre) { return mode === 'rating' ? g.theirAvg : g.theirCount }
  function diffLabel(g: DumbbellGenre): string {
    const d = theirVal(g) - myVal(g)
    const sign = d >= 0 ? '+' : ''
    return mode === 'rating'
      ? `${sign}${d.toFixed(1)}★`
      : `${sign}${Math.round(d)}`
  }

  const myFirst    = myName.split(' ')[0]
  const theirFirst = theirName.split(' ')[0]

  // Scale ticks
  const ticks = mode === 'rating'
    ? [2, 3, 4, 5]
    : Array.from({ length: 5 }, (_, i) => Math.round((maxCount / 4) * i))

  return (
    <div>
      {columnLabel && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.1em',
          color: 'var(--ink-4)', marginBottom: 8, textTransform: 'uppercase',
        }}>
          {columnLabel}
        </div>
      )}
      <svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ fontFamily: 'var(--mono)', overflow: 'visible', maxWidth: '100%' }}
      >
        {/* Tick lines + scale labels */}
        {ticks.map(r => (
          <g key={r}>
            <line
              x1={tx(r)} y1={HEADER_H - 4}
              x2={tx(r)} y2={HEADER_H + genres.length * ROW_H}
              stroke="var(--paper-edge)" strokeWidth={0.5}
            />
            <text x={tx(r)} y={HEADER_H - 9} fontSize={7} fill="var(--ink-4)" textAnchor="middle">
              {mode === 'rating' ? `${r}★` : `${r}`}
            </text>
          </g>
        ))}

        {/* Legend */}
        <circle cx={LABEL_W + GAP + 2} cy={10} r={DOT_R} fill={myColor} />
        <text x={LABEL_W + GAP + 10} y={14} fontSize={8} fill={myColor} letterSpacing="0.06em">
          {myFirst.toUpperCase()}
        </text>
        <circle cx={LABEL_W + GAP + 56} cy={10} r={DOT_R} fill={theirColor} />
        <text x={LABEL_W + GAP + 64} y={14} fontSize={8} fill={theirColor} letterSpacing="0.06em">
          {theirFirst.toUpperCase()}
        </text>

        {/* Rows */}
        {genres.map((g, i) => {
          const cy  = HEADER_H + i * ROW_H + ROW_H / 2
          const x1  = tx(myVal(g))
          const x2  = tx(theirVal(g))
          const gap = Math.abs(myVal(g) - theirVal(g))
          const lineOpacity = 0.2 + Math.min(gap / (mode === 'rating' ? 2 : maxCount / 2), 0.65)
          const dl  = diffLabel(g)
          const midX = (x1 + x2) / 2

          return (
            <g key={g.label}>
              {i % 2 === 0 && (
                <rect x={0} y={HEADER_H + i * ROW_H} width={SVG_W} height={ROW_H} fill="rgba(0,0,0,0.018)" />
              )}

              {/* Genre label */}
              <text
                x={LABEL_W} y={cy + 4}
                fontSize={11} fill="var(--ink)"
                textAnchor="end"
                fontFamily="var(--serif-display)"
                fontWeight={500}
              >
                {g.label}
              </text>

              {/* Connecting line */}
              {x1 !== x2 && (
                <line
                  x1={Math.min(x1, x2)} y1={cy}
                  x2={Math.max(x1, x2)} y2={cy}
                  stroke="var(--ink-3)" strokeWidth={1.5} opacity={lineOpacity}
                />
              )}

              {/* Difference annotation above midpoint */}
              {gap > (mode === 'rating' ? 0.15 : 1) && (
                <text
                  x={midX} y={cy - 7}
                  fontSize={7.5} fill="var(--ink-4)"
                  textAnchor="middle" letterSpacing="0.02em"
                >
                  {dl}
                </text>
              )}

              {/* Dots */}
              <circle cx={x1} cy={cy} r={DOT_R} fill={myColor} />
              <circle cx={x2} cy={cy} r={DOT_R} fill={theirColor} />

              <title>{g.label}: {myFirst} {myVal(g)}{mode === 'rating' ? '★' : ' films'} · {theirFirst} {theirVal(g)}{mode === 'rating' ? '★' : ' films'}</title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
