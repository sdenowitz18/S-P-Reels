import Link from 'next/link'

export function Wordmark() {
  return (
    <Link href="/home" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'baseline', gap: 1 }}>
      <span style={{ fontFamily: 'var(--serif-display)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.02em' }}>S&amp;P</span>
      <span style={{ fontFamily: 'var(--serif-body)', fontWeight: 400, fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)', marginLeft: 4 }}>reels</span>
    </Link>
  )
}
