'use client'

export interface QuadrantGenre {
  label: string
  /** Deviation from this user's overall avg rating (+= above avg, -= below avg) */
  myDev: number
  theirDev: number
  /** Number of films the user with fewer has seen in this genre */
  count: number
}

interface GenreQuadrantProps {
  genres: QuadrantGenre[]
  myName: string
  theirName: string
  myColor?: string
  theirColor?: string
}

// Colour per quadrant
const Q_COLORS = {
  topRight:   '#2d5a3d', // both love — forest green
  topLeft:    '#1a5252', // their thing — teal
  bottomRight:'#7a4118', // my thing — umber
  bottomLeft: '#6b7280', // mutual pass — slate
}

function quadrantColor(myDev: number, theirDev: number): string {
  if (myDev >= 0 && theirDev >= 0) return Q_COLORS.topRight
  if (myDev < 0  && theirDev >= 0) return Q_COLORS.topLeft
  if (myDev >= 0 && theirDev < 0)  return Q_COLORS.bottomRight
  return Q_COLORS.bottomLeft
}

/**
 * 4-quadrant scatter plot — genre deviation from personal average.
 *
 * X axis = logged-in user's deviation from their avg
 * Y axis = friend's deviation from their avg
 *
 * Only genres where both users have rated ≥2 films appear.
 * Dot radius scales with count; label anchoring adjusts to avoid chart edges.
 */
export function GenreQuadrant({ genres, myName, theirName, myColor = 'var(--s-ink)', theirColor = 'var(--p-ink)' }: GenreQuadrantProps) {
  const W = 480
  const H = 360
  const pad = { top: 44, right: 56, bottom: 44, left: 56 }
  const cw = W - pad.left - pad.right   // chart area width
  const ch = H - pad.top  - pad.bottom  // chart area height
  const cx = pad.left + cw / 2          // center x
  const cy = pad.top  + ch / 2          // center y

  if (genres.length === 0) {
    return (
      <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)', margin: 0 }}>
        Watch more films together to populate the genre map.
      </p>
    )
  }

  // Scale: fit all deviations with a little padding, min ±0.4 so chart isn't collapsed
  const maxDev = Math.max(0.4, ...genres.flatMap(g => [Math.abs(g.myDev), Math.abs(g.theirDev)]))
  const scale = 0.88 // leave 12% margin beyond outermost point

  function toX(dev: number) { return cx + (dev / maxDev) * (cw / 2) * scale }
  function toY(dev: number) { return cy - (dev / maxDev) * (ch / 2) * scale } // SVG y inverted

  // Dot radius: 4–9 px based on count
  const maxCount = Math.max(1, ...genres.map(g => g.count))
  function dotR(count: number) { return 4 + (count / maxCount) * 5 }

  const myFirst    = myName.split(' ')[0]
  const theirFirst = theirName.split(' ')[0]

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ fontFamily: 'var(--mono)', overflow: 'visible', maxWidth: '100%' }}
    >
      {/* Subtle quadrant backgrounds */}
      <rect x={pad.left} y={cy}      width={cw / 2} height={ch / 2} fill="rgba(0,0,0,0.018)" />
      <rect x={cx}       y={pad.top} width={cw / 2} height={ch / 2} fill="rgba(30,80,50,0.045)" />

      {/* Axis grid lines */}
      <line x1={pad.left} y1={cy} x2={W - pad.right} y2={cy}
        stroke="var(--paper-edge)" strokeWidth={1} />
      <line x1={cx} y1={pad.top} x2={cx} y2={H - pad.bottom}
        stroke="var(--paper-edge)" strokeWidth={1} />

      {/* Corner quadrant labels */}
      <text x={pad.left + 7} y={pad.top + 14} fontSize={7.5} fill="rgba(0,0,0,0.22)" letterSpacing="0.07em">
        {theirFirst.toUpperCase()}'S THING
      </text>
      <text x={W - pad.right - 7} y={pad.top + 14} fontSize={7.5} fill="rgba(0,0,0,0.32)" letterSpacing="0.07em" textAnchor="end">
        BOTH LOVE
      </text>
      <text x={pad.left + 7} y={H - pad.bottom - 7} fontSize={7.5} fill="rgba(0,0,0,0.18)" letterSpacing="0.07em">
        MUTUAL PASS
      </text>
      <text x={W - pad.right - 7} y={H - pad.bottom - 7} fontSize={7.5} fill="rgba(0,0,0,0.22)" letterSpacing="0.07em" textAnchor="end">
        {myFirst.toUpperCase()}'S THING
      </text>

      {/* Axis labels */}
      <text x={W - pad.right + 6} y={cy + 4} fontSize={8} fill={myColor} letterSpacing="0.04em">
        {myFirst} →
      </text>
      <text x={cx} y={pad.top - 10} fontSize={8} fill={theirColor} textAnchor="middle" letterSpacing="0.04em">
        ↑ {theirFirst}
      </text>
      <text x={pad.left - 6} y={cy + 4} fontSize={8} fill={myColor} letterSpacing="0.04em" textAnchor="end">
        ← {myFirst}
      </text>
      <text x={cx} y={H - pad.bottom + 16} fontSize={8} fill={theirColor} textAnchor="middle" letterSpacing="0.04em">
        ↓ {theirFirst}
      </text>

      {/* Genre dots + labels */}
      {genres.map(g => {
        const x   = toX(g.myDev)
        const y   = toY(g.theirDev)
        const r   = dotR(g.count)
        const col = quadrantColor(g.myDev, g.theirDev)

        // Smart label anchor: flip to left side if dot is in right 40% of chart
        const rightHeavy = x > cx + cw * 0.2
        const labelX     = rightHeavy ? x - r - 4 : x + r + 4
        const anchor     = rightHeavy ? 'end' : 'start'
        // Shift label up if dot is very near bottom edge
        const labelY     = y > H - pad.bottom - 20 ? y - r - 3 : y + r * 0.4 + 4

        return (
          <g key={g.label}>
            <title>{g.label}: {g.myDev > 0 ? '+' : ''}{g.myDev.toFixed(2)} / {g.theirDev > 0 ? '+' : ''}{g.theirDev.toFixed(2)}</title>
            <circle cx={x} cy={y} r={r} fill={col} opacity={0.82} />
            <text
              x={labelX}
              y={labelY}
              fontSize={9.5}
              fill={col}
              textAnchor={anchor}
              fontWeight={500}
              letterSpacing="0.01em"
            >
              {g.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
