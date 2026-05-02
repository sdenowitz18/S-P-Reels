'use client'

import { useState, useEffect } from 'react'
import { useIsMobile } from '@/lib/use-is-mobile'

const TASTE_CODES = [
  [
    { letter: 'H', label: 'Human'     },
    { letter: 'C', label: 'Clear'     },
    { letter: 'P', label: 'Patient'   },
    { letter: 'D', label: 'Direct'    },
  ],
  [
    { letter: 'F', label: 'Familiar'  },
    { letter: 'R', label: 'Raw'       },
    { letter: 'I', label: 'Intimate'  },
    { letter: 'O', label: 'Open'      },
  ],
  [
    { letter: 'A', label: 'Ambiguous' },
    { letter: 'P', label: 'Patient'   },
    { letter: 'S', label: 'Sensory'   },
    { letter: 'H', label: 'Human'     },
  ],
  [
    { letter: 'C', label: 'Clear'     },
    { letter: 'D', label: 'Direct'    },
    { letter: 'E', label: 'Epic'      },
    { letter: 'T', label: 'True'      },
  ],
  [
    { letter: 'O', label: 'Open'      },
    { letter: 'H', label: 'Human'     },
    { letter: 'N', label: 'Natural'   },
    { letter: 'F', label: 'Familiar'  },
  ],
  [
    { letter: 'R', label: 'Raw'       },
    { letter: 'I', label: 'Intimate'  },
    { letter: 'A', label: 'Ambiguous' },
    { letter: 'C', label: 'Clear'     },
  ],
]

export function AnimatedLetterBlocks() {
  const [index,   setIndex]   = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % TASTE_CODES.length)
        setVisible(true)
      }, 500)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  const code = TASTE_CODES[index]
  const isMobile = useIsMobile()
  const blockW = isMobile ? 76 : 148
  const blockH = isMobile ? 94 : 182
  const fontSize = isMobile ? 42 : 80

  return (
    <div style={{ display: 'flex', gap: isMobile ? 8 : 16 }}>
      {code.map((l, i) => (
        <div
          key={i}
          style={{
            width: blockW, height: blockH,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: isMobile ? 6 : 12,
            border: '0.5px solid var(--paper-edge)', borderRadius: isMobile ? 10 : 16,
            background: 'var(--bone)',
            opacity: visible ? 1 : 0,
            transition: `opacity 500ms ease ${i * 70}ms`,
          }}
        >
          <span style={{
            fontFamily: 'var(--serif-display)', fontSize, fontWeight: 500,
            lineHeight: 1, color: 'var(--ink)',
          }}>
            {l.letter}
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: isMobile ? 7 : 9, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--ink-3)',
          }}>
            {l.label}
          </span>
        </div>
      ))}
    </div>
  )
}
