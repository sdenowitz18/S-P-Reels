'use client'

/**
 * TasteLetter — renders a single taste code letter with its H/M/L pole badge.
 *
 * The badge reflects how much the user likes films at this specific pole
 * (absolute pole score, 0–100), independent of which pole dominates.
 * It replaces the raw numeric score that was previously shown.
 *
 * Badge thresholds:
 *   H  ≥ 65  →  forest green
 *   M  35–64 →  amber
 *   L  < 35  →  muted gray
 */

export type PoleBadgeTier = 'H' | 'M' | 'L'

export function poleBadgeTier(poleScore: number): PoleBadgeTier {
  if (poleScore >= 65) return 'H'
  if (poleScore >= 35) return 'M'
  return 'L'
}

const BADGE_COLORS: Record<PoleBadgeTier, { bg: string; fg: string }> = {
  H: { bg: 'var(--forest,       #225533)', fg: '#fff' },
  M: { bg: 'var(--sun,          #d4a847)', fg: '#fff' },
  L: { bg: 'var(--paper-edge,   #ccc)',    fg: 'var(--ink-3)' },
}

interface TasteLetterProps {
  /** The letter to display (e.g. 'C', 'Z') */
  letter:    string
  /** Normalized pole score 0–100 — drives the H/M/L badge */
  poleScore: number
  /** Visual size of the letter */
  size?:     'sm' | 'md' | 'lg'
  /** Whether this letter is the currently active / selected one */
  active?:   boolean
  /** Muted styling (e.g. for opposite pole or non-dominant entries) */
  muted?:    boolean
  onClick?:  () => void
}

const SIZE: Record<'sm' | 'md' | 'lg', {
  letterSize:  number
  badgeSize:   number
  badgeFont:   number
  badgeOffset: number
}> = {
  sm: { letterSize: 14, badgeSize: 12, badgeFont: 7,  badgeOffset: -4 },
  md: { letterSize: 22, badgeSize: 14, badgeFont: 8,  badgeOffset: -5 },
  lg: { letterSize: 32, badgeSize: 16, badgeFont: 9,  badgeOffset: -6 },
}

export function TasteLetter({
  letter,
  poleScore,
  size     = 'md',
  active   = false,
  muted    = false,
  onClick,
}: TasteLetterProps) {
  const tier    = poleBadgeTier(poleScore)
  const colors  = BADGE_COLORS[tier]
  const sz      = SIZE[size]

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      style={{
        position:    'relative',
        display:     'inline-flex',
        alignItems:  'center',
        justifyContent: 'center',
        cursor:      onClick ? 'pointer' : 'default',
        userSelect:  'none',
      }}
    >
      {/* Letter */}
      <span style={{
        fontFamily:    'var(--serif-display)',
        fontSize:      sz.letterSize,
        fontWeight:    700,
        letterSpacing: '-0.01em',
        color: muted
          ? 'var(--ink-4)'
          : active
          ? 'var(--forest, #225533)'
          : 'var(--ink)',
        lineHeight: 1,
        transition: 'color 200ms ease',
      }}>
        {letter}
      </span>

      {/* H/M/L badge — top-right corner */}
      <span style={{
        position:    'absolute',
        top:         sz.badgeOffset,
        right:       sz.badgeOffset - 2,
        minWidth:    sz.badgeSize,
        height:      sz.badgeSize,
        borderRadius: 999,
        background:  muted ? 'var(--paper-edge)' : colors.bg,
        color:       muted ? 'var(--ink-4)'       : colors.fg,
        fontSize:    sz.badgeFont,
        fontFamily:  'var(--mono)',
        fontWeight:  700,
        letterSpacing: '0.02em',
        display:     'flex',
        alignItems:  'center',
        justifyContent: 'center',
        lineHeight:  1,
        padding:     '0 2px',
        pointerEvents: 'none',
      }}>
        {tier}
      </span>
    </div>
  )
}

/**
 * TasteCode — renders a row of 4 taste code letters with badges.
 * Convenience wrapper for the common "show your code" pattern.
 */
export function TasteCodeDisplay({
  letters,
  entries,
  size    = 'md',
  gap     = 12,
  onSelect,
  selected,
}: {
  letters:   string
  /** Full TasteCodeEntry array — used to get poleScore per letter */
  entries:   Array<{ letter: string; poleScore: number }>
  size?:     'sm' | 'md' | 'lg'
  gap?:      number
  onSelect?: (letter: string) => void
  selected?: string | null
}) {
  const scoreByLetter = Object.fromEntries(entries.map(e => [e.letter, e.poleScore]))

  return (
    <div style={{ display: 'flex', gap, alignItems: 'center' }}>
      {letters.split('').map(l => (
        <TasteLetter
          key={l}
          letter={l}
          poleScore={scoreByLetter[l] ?? 50}
          size={size}
          active={selected === l}
          onClick={onSelect ? () => onSelect(l) : undefined}
        />
      ))}
    </div>
  )
}
