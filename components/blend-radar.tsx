'use client'
import { useState } from 'react'
import { TasteDimensions } from '@/lib/prompts/taste-profile'

interface Props {
  myDimensions: TasteDimensions
  theirDimensions: TasteDimensions
  myName: string
  theirName: string
}

const AXES: { key: keyof TasteDimensions; neg: string; pos: string }[] = [
  { key: 'pace',         neg: 'patient',     pos: 'kinetic'     },
  { key: 'style',        neg: 'restrained',  pos: 'expressive'  },
  { key: 'complexity',   neg: 'accessible',  pos: 'complex'     },
  { key: 'warmth',       neg: 'cold',        pos: 'warm'        },
  { key: 'tone',         neg: 'light',       pos: 'dark'        },
  { key: 'story_engine', neg: 'character',   pos: 'plot-driven' },
]

const AXIS_TITLES: Record<keyof TasteDimensions, string> = {
  pace: 'Pace',
  style: 'Visual Style',
  complexity: 'Complexity',
  warmth: 'Emotional Temperature',
  tone: 'Tone',
  story_engine: 'Story Engine',
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

function compat(v1: number, v2: number): 'high' | 'medium' | 'low' {
  const sameDir = (v1 >= 0 && v2 >= 0) || (v1 <= 0 && v2 <= 0) || Math.abs(v1) < 0.15 || Math.abs(v2) < 0.15
  const diff = Math.abs(v1 - v2)
  if (sameDir && diff < 0.45) return 'high'
  if (!sameDir && Math.abs(v1) > 0.3 && Math.abs(v2) > 0.3) return 'low'
  return 'medium'
}

export function BlendRadar({ myDimensions, theirDimensions, myName, theirName }: Props) {
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

  const myPts = AXES.map((axis, i) => {
    const v = norm(myDimensions[axis.key])
    return pt(i, R * v)
  })
  const myPath = myPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

  const theirPts = AXES.map((axis, i) => {
    const v = norm(theirDimensions[axis.key])
    return pt(i, R * v)
  })
  const theirPath = theirPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

  const hoveredAxis = hovered ? AXES.find(a => a.key === hovered) : null
  const hoveredMyVal = hovered ? myDimensions[hovered] : null
  const hoveredTheirVal = hovered ? theirDimensions[hovered] : null
  const hoveredCompat = (hoveredMyVal != null && hoveredTheirVal != null) ? compat(hoveredMyVal, hoveredTheirVal) : null

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

        {/* Their polygon (drawn first, behind) */}
        <path
          d={theirPath}
          fill="var(--p-ink)"
          fillOpacity={0.15}
          stroke="var(--p-ink)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* My polygon (drawn on top) */}
        <path
          d={myPath}
          fill="var(--s-ink)"
          fillOpacity={0.15}
          stroke="var(--s-ink)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Their dots */}
        {theirPts.map((p, i) => (
          <circle key={`t-${i}`} cx={p.x} cy={p.y} r={3} fill="var(--p-ink)" />
        ))}

        {/* My dots */}
        {myPts.map((p, i) => (
          <circle key={`m-${i}`} cx={p.x} cy={p.y} r={3} fill="var(--s-ink)" />
        ))}

        {/* Axis labels */}
        {AXES.map((axis, i) => {
          const angle = angleFor(i)
          const lp = { x: CX + LABEL_R * Math.cos(angle), y: CY + LABEL_R * Math.sin(angle) }
          const myVal = myDimensions[axis.key]
          const theirVal = theirDimensions[axis.key]
          const avg = (myVal + theirVal) / 2
          const label = avg >= 0 ? axis.pos : axis.neg
          const anchor = lp.x < CX - 5 ? 'end' : lp.x > CX + 5 ? 'start' : 'middle'
          const dyOffset = lp.y < CY - 5 ? -6 : lp.y > CY + 5 ? 14 : 4
          const isHovered = hovered === axis.key

          return (
            <g
              key={axis.key}
              style={{ cursor: 'default' }}
              onMouseEnter={e => {
                setHovered(axis.key)
                setTooltipPos({
                  x: lp.x / 320,
                  y: (lp.y + dyOffset) / 310,
                })
              }}
            >
              <circle cx={lp.x} cy={lp.y} r={18} fill="transparent" />
              <text
                x={lp.x}
                y={lp.y + dyOffset}
                textAnchor={anchor}
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  fill: isHovered ? 'var(--ink)' : 'var(--ink-3)',
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
      {hovered && hoveredAxis && hoveredMyVal != null && hoveredTheirVal != null && hoveredCompat && (
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
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.1em', color: 'var(--ink-2)', marginBottom: 8, textTransform: 'uppercase' }}>
            {AXIS_TITLES[hovered]}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--s-ink)' }}>
              {myName}: {hoveredMyVal > 0 ? '+' : ''}{hoveredMyVal.toFixed(2)}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--p-ink)' }}>
              {theirName}: {hoveredTheirVal > 0 ? '+' : ''}{hoveredTheirVal.toFixed(2)}
            </div>
          </div>
          <div style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)' }}>
            {hoveredCompat === 'high' ? '😊 aligned' : hoveredCompat === 'medium' ? '😐 mixed' : '😕 tension'}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 4 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--s-ink)', letterSpacing: '0.04em' }}>
          ● {myName}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--p-ink)', letterSpacing: '0.04em' }}>
          ● {theirName}
        </span>
      </div>
    </div>
  )
}
