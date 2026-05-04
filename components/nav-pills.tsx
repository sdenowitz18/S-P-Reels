'use client'
import Link from 'next/link'

const TABS = [
  { id: 'movies',  label: 'watched',    href: '/movies' },
  { id: 'now',     label: 'now playing', href: '/now-playing' },
  { id: 'watch',   label: 'watch list', href: '/watch-list' },
  { id: 'films',   label: 'catalog',    href: '/films' },
  { id: 'mood',    label: 'mood room',  href: '/mood' },
  { id: 'friends', label: 'friends',    href: '/friends' },
]

interface NavPillsProps {
  active?: string
  counts?: Record<string, number>
}

export function NavPills({ active, counts = {} }: NavPillsProps) {
  return (
    <nav style={{
      display: 'inline-flex', gap: 2, alignItems: 'center',
      padding: '4px 6px', borderRadius: 999,
      background: 'var(--paper)',
      border: '0.5px solid var(--paper-edge)',
    }}>
      {TABS.map((t) => {
        const isActive = active === t.id
        const n = counts[t.id]
        return (
          <Link
            key={t.id}
            href={t.href}
            style={{
              padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
              fontFamily: 'var(--serif-body)',
              fontSize: 13.5,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--ink)' : 'var(--ink-3)',
              transition: 'color 120ms',
              display: 'inline-flex', alignItems: 'baseline', gap: 5,
              textDecoration: 'none',
            }}
          >
            <span>{t.label}</span>
            {typeof n === 'number' && n > 0 && (
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                color: isActive ? 'var(--ink-2)' : 'var(--ink-4)',
                fontWeight: 400,
              }}>
                {n}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
