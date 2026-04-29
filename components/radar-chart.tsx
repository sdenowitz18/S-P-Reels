'use client'
import { useState } from 'react'
import { TasteDimensions } from '@/lib/prompts/taste-profile'

const AXES: { key: keyof TasteDimensions; neg: string; pos: string }[] = [
  { key: 'pace',         neg: 'patient',     pos: 'kinetic'     },
  { key: 'style',        neg: 'restrained',  pos: 'expressive'  },
  { key: 'complexity',   neg: 'accessible',  pos: 'complex'     },
  { key: 'warmth',       neg: 'cold',        pos: 'warm'        },
  { key: 'tone',         neg: 'light',       pos: 'dark'        },
  { key: 'story_engine', neg: 'character',   pos: 'plot-driven' },
]

const AXIS_INFO: Record<keyof TasteDimensions, { title: string; describe: (v: number) => string }> = {
  pace: {
    title: 'Pace',
    describe: v =>
      v > 0.6  ? 'You strongly gravitate toward slow-burn films — patience, atmosphere, and deliberate storytelling over momentum.' :
      v > 0.25 ? 'You lean toward slower, more contemplative films over fast-paced ones.' :
      v > -0.25? 'You move between kinetic and patient films without a strong preference.' :
      v > -0.6 ? 'You lean toward kinetic, propulsive storytelling over slow-burn films.' :
                 'You strongly prefer fast-paced, kinetic cinema — urgency and momentum over contemplation.',
  },
  style: {
    title: 'Visual Style',
    describe: v =>
      v > 0.6  ? 'You\'re drawn to expressionist, highly stylized filmmaking — directors who treat visuals as a statement.' :
      v > 0.25 ? 'You lean toward expressive, visually distinct films over understated ones.' :
      v > -0.25? 'Style doesn\'t drive your taste — you respond to both minimalist and maximalist filmmaking.' :
      v > -0.6 ? 'You lean toward restrained, economical filmmaking over stylistic showmanship.' :
                 'You strongly prefer stripped-back cinema — nothing is there for decoration.',
  },
  complexity: {
    title: 'Complexity',
    describe: v =>
      v > 0.6  ? 'You\'re drawn to demanding, layered films — ambiguity, open endings, dense subtext.' :
      v > 0.25 ? 'You lean toward films with depth and layers over straightforward crowd-pleasers.' :
      v > -0.25? 'You move comfortably between accessible films and more challenging ones.' :
      v > -0.6 ? 'You lean toward clear, direct storytelling over films that demand decoding.' :
                 'You strongly prefer accessible, clearly told stories over arthouse difficulty.',
  },
  warmth: {
    title: 'Emotional Temperature',
    describe: v =>
      v > 0.6  ? 'You respond strongly to emotionally warm films — connection, sentimentality, and human tenderness.' :
      v > 0.25 ? 'You lean toward emotionally warm, human-centered films.' :
      v > -0.25? 'You move between cold and warm emotional registers without a strong preference.' :
      v > -0.6 ? 'You lean toward cooler, more detached filmmaking over emotional warmth.' :
                 'You\'re drawn to cold, clinical cinema — films that observe rather than embrace.',
  },
  tone: {
    title: 'Tone',
    describe: v =>
      v > 0.6  ? 'You gravitate strongly toward dark, serious, and bleak cinema.' :
      v > 0.25 ? 'You lean toward serious, heavy films over lighter fare.' :
      v > -0.25? 'Tone isn\'t decisive for you — you move easily between dark and light films.' :
      v > -0.6 ? 'You lean toward lighter, more comedic films over heavy dramas.' :
                 'You strongly prefer light, comedic, or uplifting films over heavy or dark ones.',
  },
  story_engine: {
    title: 'Story Engine',
    describe: v =>
      v > 0.6  ? 'You\'re driven by plot — twists, structure, and narrative propulsion keep you engaged.' :
      v > 0.25 ? 'You lean toward plot-driven storytelling over pure character study.' :
      v > -0.25? 'You respond equally to character-driven and plot-driven films.' :
      v > -0.6 ? 'You lean toward character study over plot-driven narrative.' :
                 'You\'re drawn to pure character study — interior lives and psychology over plot mechanics.',
  },
}

const N = AXES.length
const CX = 160
const CY = 155
const R = 100
const LABEL_R = 128

function angleFor(i: number) {
  return (i * (2 * Math.PI) / N) - Math.PI / 2
}

function pt(i: number, radius: number) {
  const a = angleFor(i)
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) }
}

function norm(v: number) {
  return Math.max(0, Math.min(1, (v + 1) / 2))
}

export function RadarChart({ dimensions }: { dimensions: TasteDimensions }) {
  const [hovered, setHovered] = useState<keyof TasteDimensions | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const rings = [0.33, 0.66, 1].map(pct => {
    const pts = AXES.map((_, i) => pt(i, R * pct))
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
  })

  const axisLines = AXES.map((_, i) => {
    const tip = pt(i, R)
    return `M ${CX} ${CY} L ${tip.x} ${tip.y}`
  })

  const profilePts = AXES.map((axis, i) => {
    const v = norm(dimensions[axis.key])
    return pt(i, R * v)
  })
  const profilePath = profilePts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

  const hoveredInfo = hovered ? AXIS_INFO[hovered] : null
  const hoveredValue = hovered ? dimensions[hovered] : null

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg
        width={320}
        height={310}
        viewBox="0 0 320 310"
        style={{ overflow: 'visible', display: 'block' }}
        onMouseLeave={() => setHovered(null)}
      >
        {rings.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--paper-edge)" strokeWidth={0.75} />
        ))}
        {axisLines.map((d, i) => (
          <path key={i} d={d} stroke="var(--paper-edge)" strokeWidth={0.75} />
        ))}
        <path
          d={profilePath}
          fill="var(--s-ink)"
          fillOpacity={0.12}
          stroke="var(--s-ink)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {profilePts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--s-ink)" />
        ))}

        {AXES.map((axis, i) => {
          const angle = angleFor(i)
          const lp = { x: CX + LABEL_R * Math.cos(angle), y: CY + LABEL_R * Math.sin(angle) }
          const v = dimensions[axis.key]
          const label = v >= 0 ? axis.pos : axis.neg
          const anchor = lp.x < CX - 5 ? 'end' : lp.x > CX + 5 ? 'start' : 'middle'
          const dyOffset = lp.y < CY - 5 ? -6 : lp.y > CY + 5 ? 14 : 4
          const isHovered = hovered === axis.key

          return (
            <g
              key={axis.key}
              style={{ cursor: 'default' }}
              onMouseEnter={e => {
                setHovered(axis.key)
                const rect = (e.currentTarget.closest('svg') as SVGElement).getBoundingClientRect()
                setTooltipPos({
                  x: lp.x / 320,
                  y: (lp.y + dyOffset) / 310,
                })
              }}
            >
              {/* Invisible hit area */}
              <circle cx={lp.x} cy={lp.y} r={18} fill="transparent" />
              <text
                x={lp.x}
                y={lp.y + dyOffset}
                textAnchor={anchor}
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  fill: isHovered ? 'var(--s-ink)' : 'var(--ink-3)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  transition: 'fill 120ms',
                  fontWeight: isHovered ? 600 : 400,
                }}
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Hover tooltip */}
      {hovered && hoveredInfo && hoveredValue !== null && (
        <div style={{
          position: 'absolute',
          left: `${tooltipPos.x * 100}%`,
          top: `${tooltipPos.y * 100}%`,
          transform: tooltipPos.x > 0.6 ? 'translate(-100%, 8px)' : tooltipPos.x < 0.4 ? 'translate(0, 8px)' : 'translate(-50%, 8px)',
          zIndex: 20,
          background: 'var(--paper)',
          border: '0.5px solid var(--paper-edge)',
          borderRadius: 8,
          padding: '12px 14px',
          maxWidth: 220,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          pointerEvents: 'none',
        }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.1em', color: 'var(--s-ink)', marginBottom: 6, textTransform: 'uppercase' }}>
            {hoveredInfo.title}
          </div>
          <p style={{ margin: 0, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55 }}>
            {hoveredInfo.describe(hoveredValue)}
          </p>
          <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)' }}>
            {hoveredValue > 0 ? '+' : ''}{hoveredValue.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  )
}
