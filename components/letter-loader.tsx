'use client'

/**
 * LetterLoader
 *
 * Universal loading indicator for sp-reels.
 * Four letter boxes that rapidly cycle through random taste-code letters,
 * giving a slot-machine feel while the app computes.
 *
 * Usage:
 *   <LetterLoader label="building your insight…" />
 */

import { useEffect, useRef, useState } from 'react'

// All valid taste-code letters
const ALL_LETTERS = 'LOVSPCNTWQIEFDHUJARXGMKZ'.split('')

function randomLetter() {
  return ALL_LETTERS[Math.floor(Math.random() * ALL_LETTERS.length)]
}

function CyclingLetter({ size = 96 }: { size?: number }) {
  const [letter, setLetter] = useState(randomLetter)

  useEffect(() => {
    const id = setInterval(() => setLetter(randomLetter()), 120)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      width: size, height: size,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '0.5px solid var(--paper-edge)',
      borderRadius: Math.round(size * 0.15),
      background: 'var(--bone)',
    }}>
      <span style={{
        fontFamily: 'var(--serif-display)',
        fontSize: Math.round(size * 0.58),
        fontWeight: 500,
        lineHeight: 1,
        color: 'var(--ink)',
        // Each letter change is instant (slot machine feel)
      }}>
        {letter}
      </span>
    </div>
  )
}

export function LetterLoader({
  label = 'loading…',
  size = 88,
}: {
  label?: string
  size?: number
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 28,
    }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <CyclingLetter size={size} />
        <CyclingLetter size={size} />
        <CyclingLetter size={size} />
        <CyclingLetter size={size} />
      </div>
      <p style={{
        fontFamily: 'var(--serif-italic)', fontStyle: 'italic',
        fontSize: 14, color: 'var(--ink-3)', margin: 0,
      }}>
        {label}
      </p>
    </div>
  )
}
