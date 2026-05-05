'use client'
import Link from 'next/link'
import { AnimatedLetterBlocks } from '@/components/animated-letter-blocks'
import { useIsMobile } from '@/lib/use-is-mobile'

// ── Feature cards ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    verb: 'Build',
    headline: 'your honest taste profile',
    body: 'Rate films and shows you know, go through the interview, and get your taste code — four letters that map how you actually experience stories on screen.',
    tone: 's',
  },
  {
    verb: 'Find',
    headline: 'recommendations that are actually yours',
    body: 'Not what\'s trending. Titles chosen for your specific taste — matched to the twelve dimensions that define how you watch.',
    tone: 'p',
  },
  {
    verb: 'Refine',
    headline: 'a palate that sharpens as you go',
    body: 'Your own film expert. An AI that knows your taste, meets you where you\'re at, and goes as deep as you want.',
    tone: 's',
  },
  {
    verb: 'Share',
    headline: 'with people who get it',
    body: 'Compare codes with friends, see what they\'re watching, and find what to watch together — whether your tastes overlap or pull in opposite directions.',
    tone: 'sp',
  },
]

// ── Testimonials ──────────────────────────────────────────────────────────────

const QUOTES = [
  {
    quote: "I found my movie-watching Myers-Briggs. Showed it to everyone I know.",
    name: 'Lauren Denowitz',
    detail: 'HCPD · 312 titles logged',
  },
  {
    quote: "Me and my girlfriend can actually agree on what to watch now. That alone is worth it.",
    name: 'Steven Denowitz',
    detail: 'HFPD · 847 titles logged',
  },
  {
    quote: "Never gotten recommendations this good. It actually knows what I like, not what it thinks I should like.",
    name: 'Paula Juan',
    detail: 'DROI · 204 titles logged',
  },
  {
    quote: "I check Co-Star every morning and I still don't know why I cried at Paddington 2. This told me in five minutes.",
    name: 'Caroline Kowalski',
    detail: 'SVHW · 312 titles logged',
  },
  {
    quote: "My girlfriend Bianca has terrible taste in movies. Now I know why.",
    name: 'Avery Roth',
    detail: 'CHDI · 178 titles logged',
  },
  {
    quote: "I've been on Letterboxd for a decade. This is the first time I actually understand my own taste.",
    name: 'Stephen Shapero',
    detail: 'FPAH · 1,204 titles logged',
  },
]

function tintFor(tone: string) {
  if (tone === 's')  return 'var(--s-tint)'
  if (tone === 'p')  return 'var(--p-tint)'
  return 'var(--sp-tint)'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const isMobile = useIsMobile()
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>

      {/* ── Nav ── */}
      <header style={{ padding: isMobile ? '16px 20px' : '20px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          fontFamily: 'var(--serif-display)', fontSize: 32, fontWeight: 600, lineHeight: 1,
          display: 'inline-flex', alignItems: 'baseline', color: 'var(--ink)',
        }}>
          S<span style={{ color: 'var(--sun)', fontStyle: 'italic', padding: '0 1px' }}>&amp;</span>P
          <span style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-3)', marginLeft: 6, fontSize: 24 }}>reels</span>
        </div>
        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <Link href="/signin" style={{ fontFamily: 'var(--serif-body)', fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none', padding: '8px 14px' }}>log in</Link>
          <Link href="/signup" className="btn" style={{ padding: '8px 16px', fontSize: 13, borderRadius: 999, textDecoration: 'none' }}>sign up</Link>
        </div>
      </header>

      <main>

        {/* ── Hero ── */}
        <section style={{
          padding: isMobile ? '24px 20px 48px' : '28px 36px 64px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center',
        }}>

          {/* Animated letter blocks — the brand moment */}
          <div style={{ marginBottom: isMobile ? 28 : 44 }}>
            <AnimatedLetterBlocks />
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: 'var(--serif-display)', fontSize: isMobile ? 34 : 52, fontWeight: 400,
            lineHeight: 1.15, color: 'var(--ink)', margin: '0 0 16px',
            maxWidth: 640,
          }}>
            You have a taste.{' '}
            <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--ink-3)' }}>
              We just help you see it.
            </span>
          </h1>

          {/* Subline */}
          <p style={{
            fontFamily: 'var(--serif-body)', fontSize: isMobile ? 15 : 18, fontStyle: 'italic',
            color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 32px',
            maxWidth: 520,
          }}>
            A living record of how you watch — and a mirror that shows you exactly what kind of viewer you are.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, alignItems: 'center' }}>
            <Link href="/signup" className="btn" style={{ padding: isMobile ? '13px 22px' : '14px 26px', fontSize: 15, borderRadius: 999, textDecoration: 'none' }}>
              get your taste code →
            </Link>
            <Link href="/signin" className="btn btn-soft" style={{ padding: isMobile ? '11px 18px' : '14px 22px', fontSize: isMobile ? 13 : 15, borderRadius: 999, textDecoration: 'none' }}>
              i already have an account
            </Link>
          </div>
        </section>

        {/* ── Features: Build · Find · Refine · Share ── */}
        <section style={{ padding: isMobile ? '0 20px 64px' : '0 48px 96px', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 14 }}>
            {FEATURES.map(f => (
              <div key={f.verb} style={{
                padding: isMobile ? '20px 16px' : '32px 28px',
                background: tintFor(f.tone),
                border: '0.5px solid var(--paper-edge)',
                borderRadius: isMobile ? 12 : 16,
                display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 12,
              }}>
                <div style={{
                  fontFamily: 'var(--serif-display)', fontSize: isMobile ? 26 : 38, fontWeight: 500,
                  lineHeight: 1, color: 'var(--ink)',
                }}>
                  {f.verb}
                </div>
                <div style={{
                  fontFamily: 'var(--serif-body)', fontSize: isMobile ? 12 : 14, fontWeight: 600,
                  color: 'var(--ink-2)', lineHeight: 1.3,
                }}>
                  {f.headline}
                </div>
                {!isMobile && <div style={{
                  fontFamily: 'var(--serif-body)', fontSize: 13.5, fontStyle: 'italic',
                  color: 'var(--ink-3)', lineHeight: 1.65,
                }}>
                  {f.body}
                </div>}
              </div>
            ))}
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section style={{
          padding: isMobile ? '48px 20px 64px' : '72px 48px 96px',
          background: 'var(--bone)',
          borderTop: '0.5px solid var(--paper-edge)',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>

            <div style={{ textAlign: 'center', marginBottom: isMobile ? 32 : 52 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 12 }}>
                ★ from our users
              </div>
              <h2 style={{ fontFamily: 'var(--serif-display)', fontSize: isMobile ? 26 : 34, fontWeight: 400, color: 'var(--ink)', margin: 0, fontStyle: 'italic' }}>
                what people are saying
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 16 }}>
              {QUOTES.map((q, i) => (
                <div key={i} style={{
                  padding: '28px 26px',
                  background: 'var(--paper)',
                  border: '0.5px solid var(--paper-edge)',
                  borderRadius: 14,
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20,
                }}>
                  <p style={{
                    fontFamily: 'var(--serif-body)', fontSize: 15.5, fontStyle: 'italic',
                    color: 'var(--ink)', lineHeight: 1.65, margin: 0,
                  }}>
                    &ldquo;{q.quote}&rdquo;
                  </p>
                  <div>
                    <div style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 3 }}>
                      {q.name}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.07em', color: 'var(--ink-4)' }}>
                      {q.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ── Footer CTA ── */}
        <section style={{
          padding: isMobile ? '52px 24px' : '80px 36px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        }}>
          <h2 style={{ fontFamily: 'var(--serif-display)', fontSize: isMobile ? 30 : 42, fontWeight: 400, color: 'var(--ink)', margin: '0 0 18px', lineHeight: 1.15 }}>
            Find out what your four letters are.
          </h2>
          <p style={{ fontFamily: 'var(--serif-body)', fontSize: 16, fontStyle: 'italic', color: 'var(--ink-3)', margin: '0 0 36px', maxWidth: 400, lineHeight: 1.6 }}>
            It takes about five minutes. Starts with films and shows you already know.
          </p>
          <Link href="/signup" className="btn" style={{ padding: '16px 32px', fontSize: 16, borderRadius: 999, textDecoration: 'none' }}>
            get your taste code — it&apos;s free →
          </Link>
        </section>

      </main>
    </div>
  )
}
