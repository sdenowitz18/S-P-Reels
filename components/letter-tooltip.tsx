'use client'
import { useState } from 'react'

/**
 * Plain-language descriptions for every taste-code pole letter.
 * Shown as a tooltip when hovering over any letter in the app.
 */
export const POLE_PLAIN: Record<string, string> = {
  // intimate_vs_epic
  I: 'Intimate — small-scale and personal. Think small casts, quiet moments, kitchen-table drama.',
  E: 'Epic — big in scope. Large casts, sweeping locations, high stakes. More about the world than one person.',
  // plot_vs_character
  C: 'Character — the story is really about who people are. Psychology and inner life over what happens.',
  P: 'Plot — driven by what happens next. Events, twists, and forward momentum.',
  // kinetic_vs_patient
  Z: 'Zen — takes its time. Long takes, quiet scenes, room to breathe. Patience is rewarded.',
  K: 'Kinetic — always in motion. Propulsive, energetic, something always happening.',
  // naturalistic_vs_stylized
  N: 'Naturalistic — grounded and true-to-life. Feels like it could really happen.',
  T: 'Theatrical — heightened and stylized. Not trying to look like real life.',
  // emotional_directness
  S: 'Subtle — emotions shown through small gestures and silence. Nothing is over-explained.',
  V: 'Vivid — feelings right on the surface. Characters express themselves fully.',
  // narrative_closure
  W: 'Whole — stories end with resolution. You leave knowing how things turned out.',
  Q: 'Questioning — open-ended. Things are left unresolved. Trusts you to sit with uncertainty.',
  // narrative_legibility
  L: 'Legible — clear, easy-to-follow storytelling. You always know what\'s going on.',
  O: 'Opaque — layered and ambiguous. Not always easy to parse, rewards close attention.',
  // psychological_safety
  H: 'Hopeful — you leave feeling okay, even uplifted, whatever the subject.',
  U: 'Unsettling — leaves you with something uncomfortable — dread or moral unease.',
  // moral_clarity
  J: 'Just — clear moral stakes. You can tell who\'s right and who\'s wrong.',
  A: 'Ambiguous — morally complex. No one is purely good or bad.',
  // behavioral_realism
  R: 'Realistic — characters behave the way real people would. Psychologically grounded.',
  X: 'Archetypal — characters feel more like symbols or types than fully individual people.',
  // accessible_vs_demanding
  F: 'Familiar — accessible and welcoming. Easy to get into, no special knowledge required.',
  D: 'Demanding — asks something of you. Rewards patience and close attention.',
  // sensory_vs_intellectual
  G: 'Gut — you feel it before you think it. Visceral, in your body.',
  M: 'Mind — more cerebral than emotional. Ideas, puzzles, and concepts take center stage.',
}

interface Props {
  letter: string
  children: React.ReactNode
  /** Override tooltip position. Default is 'above'. */
  position?: 'above' | 'below'
  /**
   * Horizontal alignment of the tooltip bubble.
   * - 'center' (default): centered over the element
   * - 'left':  left edge of tooltip aligns with left edge of element (good for rightmost tiles)
   * - 'right': right edge of tooltip aligns with right edge of element (good for leftmost tiles)
   */
  align?: 'center' | 'left' | 'right'
}

/**
 * Wraps any taste-code letter with a hover tooltip showing a plain-language
 * description of what that pole means. Drop-in around any letter display.
 *
 * Usage:
 *   <LetterTooltip letter="Z">
 *     <span>Z</span>
 *   </LetterTooltip>
 */
export function LetterTooltip({ letter, children, position = 'above', align = 'center' }: Props) {
  const [show, setShow] = useState(false)
  const description = POLE_PLAIN[letter]
  if (!description) return <>{children}</>

  const isAbove = position === 'above'

  // Horizontal positioning + caret offset
  const hPos: React.CSSProperties =
    align === 'left'   ? { left: 0 } :
    align === 'right'  ? { right: 0 } :
    { left: '50%', transform: 'translateX(-50%)' }

  // Arrow caret horizontal alignment matches bubble
  const caretHPos: React.CSSProperties =
    align === 'left'   ? { left: 12 } :
    align === 'right'  ? { right: 12 } :
    { left: '50%', transform: 'translateX(-50%)' }

  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          style={{
            position: 'absolute',
            ...(isAbove
              ? { bottom: 'calc(100% + 8px)' }
              : { top: 'calc(100% + 8px)' }),
            ...hPos,
            background: 'var(--ink)',
            color: 'var(--paper)',
            padding: '7px 10px',
            borderRadius: 7,
            fontFamily: 'var(--mono)',
            fontSize: 9,
            whiteSpace: 'normal',
            width: 160,
            zIndex: 9999,
            letterSpacing: '0.02em',
            lineHeight: 1.5,
            boxShadow: '0 3px 14px rgba(0,0,0,0.22)',
            pointerEvents: 'none',
            textAlign: 'left',
          }}
        >
          {description}
          <span
            style={{
              position: 'absolute',
              ...(isAbove
                ? { top: '100%', borderTop: '5px solid var(--ink)' }
                : { bottom: '100%', borderBottom: '5px solid var(--ink)' }),
              ...caretHPos,
              width: 0, height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
            }}
          />
        </span>
      )}
    </span>
  )
}
