'use client'
import { TasteDimensions } from '@/lib/prompts/taste-profile'

interface Props {
  myDimensions: TasteDimensions
  theirDimensions: TasteDimensions
  myName: string
  theirName: string
  selectedDim?: keyof TasteDimensions | null
  onSelectDim?: (k: keyof TasteDimensions | null) => void
}

const AXES: { key: keyof TasteDimensions; label: string }[] = [
  { key: 'pace',         label: 'PACE'       },
  { key: 'style',        label: 'STYLE'      },
  { key: 'complexity',   label: 'COMPLEXITY' },
  { key: 'warmth',       label: 'WARMTH'     },
  { key: 'tone',         label: 'TONE'       },
  { key: 'story_engine', label: 'STORY'      },
]

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

export function BlendRadar({
  myDimensions,
  theirDimensions,
  myName,
  theirName,
  selectedDim = null,
  onSelectDim,
}: Props) {
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

  return (
    <div style={{ display: 'inline-block' }}>
      <svg
        width={320}
        height={310}
        viewBox="0 0 320 310"
        style={{ overflow: 'visible', display: 'block' }}
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

        {/* Axis labels — title only, clickable if onSelectDim provided */}
        {AXES.map((axis, i) => {
          const angle = angleFor(i)
          const lp = { x: CX + LABEL_R * Math.cos(angle), y: CY + LABEL_R * Math.sin(angle) }
          const anchor = lp.x < CX - 5 ? 'end' : lp.x > CX + 5 ? 'start' : 'middle'
          const dyOffset = lp.y < CY - 5 ? -6 : lp.y > CY + 5 ? 14 : 4
          const isSelected = selectedDim === axis.key

          return (
            <g
              key={axis.key}
              style={{ cursor: onSelectDim ? 'pointer' : 'default' }}
              onClick={() => onSelectDim?.(isSelected ? null : axis.key)}
            >
              <circle cx={lp.x} cy={lp.y} r={20} fill="transparent" />
              <text
                x={lp.x}
                y={lp.y + dyOffset}
                textAnchor={anchor}
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  fill: isSelected ? 'var(--ink)' : 'var(--ink-3)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  transition: 'fill 120ms',
                  fontWeight: isSelected ? 700 : 400,
                  userSelect: 'none',
                }}
              >
                {axis.label}
              </text>
            </g>
          )
        })}
      </svg>

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
