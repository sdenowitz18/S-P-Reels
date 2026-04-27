import Link from 'next/link'

const FEATURE_CARDS = [
  { label: 'watched',       tag: "a wall of every film you've sat with.",                            tone: 's' },
  { label: 'now playing',   tag: 'the film rolling tonight, with first-thought notes.',              tone: 'p' },
  { label: 'watch list',    tag: 'films saved for later, with the reason you saved them.',           tone: 'sp' },
  { label: 'the interview', tag: 'a quiet six-minute conversation after each film.',                 tone: 's' },
  { label: 'mood room',     tag: "find something to watch — by mood, by taste, by talking it out.", tone: 'p' },
  { label: 'profile',       tag: 'a portrait of how you watch, made of films.',                     tone: 'sp' },
]

function tintFor(tone: string) {
  if (tone === 's') return 'var(--s-tint)'
  if (tone === 'p') return 'var(--p-tint)'
  return 'var(--sp-tint)'
}

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <header style={{ padding: '24px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 600, lineHeight: 1,
          display: 'inline-flex', alignItems: 'baseline', color: 'var(--ink)',
        }}>
          S<span style={{ color: 'var(--sun)', fontStyle: 'italic', padding: '0 1px' }}>&amp;</span>P
          <span style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-3)', marginLeft: 5, fontSize: 17 }}>reels</span>
        </div>
        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <Link href="/signin" style={{ fontFamily: 'var(--serif-body)', fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none', padding: '8px 14px' }}>log in</Link>
          <Link href="/signup" className="btn" style={{ padding: '8px 16px', fontSize: 13, borderRadius: 999, textDecoration: 'none' }}>sign up</Link>
        </div>
      </header>

      <main style={{ padding: '48px 64px 96px', maxWidth: 1280, margin: '0 auto' }}>
        <div className="t-meta" style={{ fontSize: 11, color: 'var(--ink-3)' }}>★ A LIVING FILM JOURNAL · BUILT BY HAND</div>
        <h1 className="t-display" style={{ fontSize: 104, lineHeight: 0.94, marginTop: 22, marginBottom: 0, maxWidth: 1100 }}>
          a quiet room for the<br />films <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>you sit with</span>.
        </h1>
        <p style={{ fontSize: 22, color: 'var(--ink-2)', marginTop: 32, lineHeight: 1.45, maxWidth: 760, fontStyle: 'italic', fontFamily: 'var(--serif-italic)' }}>
          not a feed, not a queue. a journal you make by hand — alone, with someone, or with a small circle of people who like to watch <em>well</em>.
        </p>

        <div style={{ marginTop: 44, display: 'inline-flex', gap: 12 }}>
          <Link href="/signup" className="btn" style={{ padding: '14px 24px', fontSize: 15, borderRadius: 999, textDecoration: 'none' }}>
            sign up — it&apos;s free →
          </Link>
          <Link href="/signin" className="btn btn-soft" style={{ padding: '14px 22px', fontSize: 15, borderRadius: 999, textDecoration: 'none' }}>
            i already have an account
          </Link>
        </div>

        <div style={{ marginTop: 88, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, maxWidth: 1120 }}>
          {FEATURE_CARDS.map((c, i) => (
            <div key={c.label} style={{
              padding: '28px 26px',
              background: tintFor(c.tone),
              border: '0.5px solid var(--paper-edge)',
              borderRadius: 14, minHeight: 180,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)' }}>★ {String(i + 1).padStart(2, '0')}</div>
              <div>
                <div className="t-display" style={{ fontSize: 30, lineHeight: 1.1 }}>{c.label}</div>
                <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.5, fontStyle: 'italic', fontFamily: 'var(--serif-italic)' }}>
                  {c.tag}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 64, padding: '28px 32px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 12, maxWidth: 760 }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>★ FOR ONE OR FOR FEW</div>
          <p style={{ fontFamily: 'var(--serif-body)', fontSize: 15.5, color: 'var(--ink)', lineHeight: 1.6, marginTop: 10, margin: '10px 0 0' }}>
            S&amp;P Reels works on its own — a journal of how you watch. Pair with another viewer (or several)
            to keep a shared list, leave each other lines, and find what to watch together.
          </p>
          <div style={{ marginTop: 18 }}>
            <Link href="/signup" style={{ fontFamily: 'var(--serif-body)', fontSize: 14, color: 'var(--ink)', textDecoration: 'underline', textDecorationColor: 'var(--sun)', textUnderlineOffset: 4 }}>
              start your movies →
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
