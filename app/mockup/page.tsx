'use client'

// ── Sample data — clearly divergent so the comparison is interesting ──────────
const MY   = { pace: -0.65, style: 0.72, complexity: 0.55, warmth: 0.80, tone: -0.30, story_engine: 0.48 }
const THEM = { pace:  0.40, style: -0.45, complexity: -0.50, warmth: 0.15, tone: 0.65, story_engine: -0.55 }

const AXES = [
  { key: 'pace',         neg: 'patient',      pos: 'kinetic'       },
  { key: 'style',        neg: 'restrained',   pos: 'expressive'    },
  { key: 'complexity',   neg: 'accessible',   pos: 'complex'       },
  { key: 'warmth',       neg: 'cold',         pos: 'warm'          },
  { key: 'tone',         neg: 'light',        pos: 'dark'          },
  { key: 'story_engine', neg: 'character',    pos: 'plot-driven'   },
] as const

type DimKey = typeof AXES[number]['key']
type Dims = Record<DimKey, number>

const N  = 6
const CX = 155
const CY = 150
const R  = 100

function angle(i: number) { return (i * (2 * Math.PI) / N) - Math.PI / 2 }
function pt(i: number, r: number) { const a = angle(i); return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) } }
function norm(v: number) { return Math.max(0, Math.min(1, (v + 1) / 2)) }
function polyPath(dims: Dims) {
  return AXES.map((ax, i) => pt(i, R * norm(dims[ax.key])))
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
}

// ── Shared radar SVG scaffolding ──────────────────────────────────────────────

function RadarBase() {
  const rings = [0.33, 0.66, 1].map(pct =>
    AXES.map((_, i) => pt(i, R * pct)).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
  )
  const spokes = AXES.map((_, i) => { const tip = pt(i, R); return `M ${CX} ${CY} L ${tip.x} ${tip.y}` })
  return (
    <>
      {rings.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--paper-edge)" strokeWidth={0.75} />)}
      {spokes.map((d, i) => <path key={i} d={d} stroke="var(--paper-edge)" strokeWidth={0.75} />)}
    </>
  )
}

function RadarPolygons({ my, them }: { my: Dims; them: Dims }) {
  return (
    <>
      <path d={polyPath(them)} fill="var(--p-ink)" fillOpacity={0.12} stroke="var(--p-ink)" strokeWidth={1.5} strokeLinejoin="round" />
      <path d={polyPath(my)}   fill="var(--s-ink)" fillOpacity={0.12} stroke="var(--s-ink)" strokeWidth={1.5} strokeLinejoin="round" />
      {AXES.map((ax, i) => {
        const pm = pt(i, R * norm(my[ax.key]))
        const pt2 = pt(i, R * norm(them[ax.key]))
        return (
          <>
            <circle key={`t${i}`} cx={pt2.x} cy={pt2.y} r={3.5} fill="var(--p-ink)" />
            <circle key={`m${i}`} cx={pm.x}  cy={pm.y}  r={3.5} fill="var(--s-ink)" />
          </>
        )
      })}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTION A — Radar with stacked dual labels at each tip
// Primary label = the "far" end (positive pole), bolder
// Secondary label = the "near" end (negative pole), smaller + muted
// ─────────────────────────────────────────────────────────────────────────────

function OptionA() {
  const LABEL_R = 126

  return (
    <div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--ink-3)', marginBottom: 12 }}>
        OPTION A — DUAL LABELS AT EACH TIP
      </div>
      <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Each axis tip shows the "far" label bold + the "near" (center) label muted below it.
        You know both ends without any extra chrome.
      </p>
      <svg width={310} height={300} viewBox="0 0 310 300" style={{ display: 'block', overflow: 'visible' }}>
        <RadarBase />
        <RadarPolygons my={MY} them={THEM} />

        {AXES.map((ax, i) => {
          const a = angle(i)
          const lp = { x: CX + LABEL_R * Math.cos(a), y: CY + LABEL_R * Math.sin(a) }
          const anchor = lp.x < CX - 5 ? 'end' : lp.x > CX + 5 ? 'start' : 'middle'

          // Vertical stacking: primary (pos) above, secondary (neg) below — or swap if axis points down
          const isTop = lp.y < CY
          const primaryDy  = isTop ? -12 : 4
          const secondaryDy = isTop ? 0  : 16

          return (
            <g key={ax.key}>
              {/* Primary = positive pole (far end) */}
              <text
                x={lp.x} y={lp.y + primaryDy}
                textAnchor={anchor}
                style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, fill: 'var(--ink)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
              >
                {ax.pos}
              </text>
              {/* Secondary = negative pole (center end), muted */}
              <text
                x={lp.x} y={lp.y + secondaryDy}
                textAnchor={anchor}
                style={{ fontFamily: 'var(--mono)', fontSize: 8, fill: 'var(--ink-4)', letterSpacing: '0.04em', fontStyle: 'italic' }}
              >
                ↙ {ax.neg}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 8 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--s-ink)' }}>● Steven</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--p-ink)' }}>● Paola</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTION B — Radar (clean, current labels) + compact axis bars below
// Bars show the full spectrum with both labels + two colored dots
// ─────────────────────────────────────────────────────────────────────────────

function AxisBar({ neg, pos, myVal, themVal }: { neg: string; pos: string; myVal: number; themVal: number }) {
  const myPct   = norm(myVal)   * 100
  const themPct = norm(themVal) * 100

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 72px', gap: 10, alignItems: 'center', padding: '5px 0' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', textAlign: 'right', letterSpacing: '0.02em' }}>
        {neg}
      </span>
      <div style={{ position: 'relative', height: 3, background: 'var(--paper-edge)', borderRadius: 2 }}>
        {/* Teal dot — them */}
        <div style={{
          position: 'absolute', left: `${themPct}%`,
          top: '50%', transform: 'translate(-50%, -50%)',
          width: 9, height: 9, borderRadius: '50%',
          background: 'var(--p-ink)', border: '1.5px solid var(--paper)',
          zIndex: 1,
        }} />
        {/* Terracotta dot — me */}
        <div style={{
          position: 'absolute', left: `${myPct}%`,
          top: '50%', transform: 'translate(-50%, -50%)',
          width: 9, height: 9, borderRadius: '50%',
          background: 'var(--s-ink)', border: '1.5px solid var(--paper)',
          zIndex: 2,
        }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.02em' }}>
        {pos}
      </span>
    </div>
  )
}

function OptionB() {
  const LABEL_R = 122

  return (
    <div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--ink-3)', marginBottom: 12 }}>
        OPTION B — RADAR + AXIS BARS
      </div>
      <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Radar unchanged. Six compact bars below each show the full spectrum.
        Both colored dots visible at a glance — close = aligned, far = gap.
      </p>
      <svg width={310} height={300} viewBox="0 0 310 300" style={{ display: 'block', overflow: 'visible' }}>
        <RadarBase />
        <RadarPolygons my={MY} them={THEM} />

        {/* Current-style single label at tip */}
        {AXES.map((ax, i) => {
          const a = angle(i)
          const lp = { x: CX + LABEL_R * Math.cos(a), y: CY + LABEL_R * Math.sin(a) }
          const avg = (MY[ax.key] + THEM[ax.key]) / 2
          const label = avg >= 0 ? ax.pos : ax.neg
          const anchor = lp.x < CX - 5 ? 'end' : lp.x > CX + 5 ? 'start' : 'middle'
          const dy = lp.y < CY - 5 ? -6 : lp.y > CY + 5 ? 14 : 4

          return (
            <text key={ax.key} x={lp.x} y={lp.y + dy} textAnchor={anchor}
              style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {label}
            </text>
          )
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', margin: '8px 0 20px' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--s-ink)' }}>● Steven</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--p-ink)' }}>● Paola</span>
      </div>

      {/* Axis bars */}
      <div style={{ borderTop: '0.5px solid var(--paper-edge)', paddingTop: 16 }}>
        {AXES.map(ax => (
          <AxisBar
            key={ax.key}
            neg={ax.neg}
            pos={ax.pos}
            myVal={MY[ax.key]}
            themVal={THEM[ax.key]}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTION C — Axis bars ONLY (no radar). For completeness / contrast.
// ─────────────────────────────────────────────────────────────────────────────

function OptionC() {
  return (
    <div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--ink-3)', marginBottom: 12 }}>
        OPTION C — BARS ONLY (no radar)
      </div>
      <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Shown for reference — what you lose without the radar.
        Overlap is harder to feel; the "shape" comparison is gone.
      </p>
      <div style={{ marginTop: 8 }}>
        {AXES.map(ax => (
          <div key={ax.key} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.1em', color: 'var(--ink-4)', marginBottom: 6, textTransform: 'uppercase' }}>
              {ax.key.replace('_', ' ')}
            </div>
            <AxisBar neg={ax.neg} pos={ax.pos} myVal={MY[ax.key]} themVal={THEM[ax.key]} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 18 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--s-ink)' }}>● Steven</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--p-ink)' }}>● Paola</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function RadarMockupPage() {
  return (
    <div className="spc" style={{ minHeight: '100vh', padding: '48px 48px 100px' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-4)', marginBottom: 8 }}>
        RADAR ENHANCEMENT — OPTIONS
      </div>
      <h1 className="t-display" style={{ fontSize: 32, margin: '0 0 8px' }}>Radar mockup</h1>
      <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', margin: '0 0 48px', lineHeight: 1.5 }}>
        Both users have clearly different taste profiles here so the comparison is meaningful.<br />
        Same sample data across all three options.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 56, alignItems: 'start' }}>
        <div style={{ background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 14, padding: '28px 24px' }}>
          <OptionA />
        </div>
        <div style={{ background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 14, padding: '28px 24px' }}>
          <OptionB />
        </div>
        <div style={{ background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 14, padding: '28px 24px' }}>
          <OptionC />
        </div>
      </div>
    </div>
  )
}
