'use client'

export interface CloudWord {
  label: string
  avgRating: number | null
  count: number
}

/**
 * Deterministic hash from a string — used to pick colour + vertical scatter
 * so the layout is stable across renders.
 */
function labelHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h * 31 + s.charCodeAt(i), 1) & 0xffff
  }
  return Math.abs(h)
}

// Six editorial colours that feel cinephile — navy, forest, plum, teal, umber, slate
const PALETTE = [
  '#1e3a5f', // deep navy
  '#2d5a3d', // forest
  '#5a2958', // plum
  '#1a5252', // dark teal
  '#7a4118', // umber
  '#3a4c6b', // slate-blue
]

interface GenreCloudProps {
  words: CloudWord[]
  /** Called when a word is clicked; receives the genre label */
  onSelect?: (label: string) => void
  /** Accent colour override for the largest words (CSS var or hex). */
  accentColor?: string
}

/**
 * Word-cloud visualisation — genres sized by avgRating, scattered naturally
 * via a seeded vertical offset on each word. No external library required.
 */
export function GenreCloud({ words, onSelect, accentColor }: GenreCloudProps) {
  if (words.length === 0) return null

  const ratings = words.map(w => w.avgRating ?? 2.5)
  const minR = Math.min(...ratings)
  const maxR = Math.max(...ratings)
  const range = maxR - minR || 0.5

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '4px 10px',
        padding: '20px 0 8px',
        lineHeight: 1,
      }}
    >
      {words.map(w => {
        const r = w.avgRating ?? 2.5
        const t = Math.max(0, Math.min(1, (r - minR) / range)) // 0 → 1

        // Font size: 12px (lowest rated) → 38px (highest rated)
        const fontSize = 12 + t * 26

        // Font weight: heavier for bigger words
        const fontWeight = t > 0.7 ? 700 : t > 0.4 ? 500 : 400

        const h = labelHash(w.label)

        // Colour: top 2 words use accent, rest cycle through palette
        const color =
          t > 0.85 && accentColor
            ? accentColor
            : PALETTE[h % PALETTE.length]

        // Vertical scatter: -10px to +14px, seeded so it never jumps on re-render
        const marginTop = (h % 25) - 10

        return (
          <span
            key={w.label}
            title={`${w.label} · ${w.avgRating?.toFixed(1) ?? '—'}★ avg · ${w.count} film${w.count !== 1 ? 's' : ''}`}
            onClick={() => onSelect?.(w.label)}
            style={{
              fontSize,
              fontFamily: 'var(--serif-display)',
              fontWeight,
              color,
              marginTop,
              cursor: onSelect ? 'pointer' : 'default',
              userSelect: 'none',
              transition: 'opacity 120ms',
              display: 'inline-block',
              lineHeight: 1.35,
            }}
            onMouseEnter={e => {
              if (onSelect) (e.currentTarget as HTMLElement).style.opacity = '0.65'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.opacity = '1'
            }}
          >
            {w.label}
          </span>
        )
      })}
    </div>
  )
}
