'use client'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { useIsMobile } from '@/lib/use-is-mobile'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface ResumeSession {
  id:                  string
  path:                string
  contradictions_count: number
  needs_rating:        boolean
  current_step:        number
}

function DoorCard({ tag, title, sub, cta, onClick, tint, ink, paper }: {
  tag: string; title: React.ReactNode; sub: string; cta: string
  onClick: () => void; tint: string; ink: string; paper: string
}) {
  return (
    <button
      onClick={onClick}
      className="door-card"
      style={{
        textAlign: 'left', cursor: 'pointer', width: '100%',
        padding: '28px 28px 32px',
        background: paper,
        border: '0.5px solid var(--paper-edge)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-card)',
        display: 'flex', flexDirection: 'column', minHeight: 240, gap: 0,
        transition: 'all 180ms',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = tint
        el.style.border = `1px solid ${ink}`
        el.style.boxShadow = '0 14px 32px -18px rgba(40,20,10,.35)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = paper
        el.style.border = '0.5px solid var(--paper-edge)'
        el.style.boxShadow = 'var(--shadow-card)'
      }}
    >
      <div className="t-meta" style={{ fontSize: 10, color: ink }}>★ {tag.toUpperCase()}</div>
      <div className="t-display" style={{ fontSize: 28, marginTop: 14, marginBottom: 14, lineHeight: 1.1 }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, flex: 1, fontStyle: 'italic', fontFamily: 'var(--serif-italic)' }}>
        {sub}
      </div>
      <div style={{ marginTop: 22, fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
        {cta}
      </div>
    </button>
  )
}

export default function HomePage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const day = new Date().toLocaleDateString('en', { weekday: 'long' }).toLowerCase()

  const { data: resumeData } = useSWR<{ session: ResumeSession | null }>('/api/onboarding/resume', fetcher)
  const resumeSession = resumeData?.session ?? null

  return (
    <AppShell active="home">
      <div style={{ padding: isMobile ? '28px 16px 96px' : '56px 64px 80px', maxWidth: 1280, margin: '0 auto' }}>
        <div className="t-meta" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          ★ {day.toUpperCase()} EVENING · YOUR ROOM
        </div>

        {/* Resume taste setup banner */}
        {resumeSession && (
          <button
            onClick={() => {
              const dest = resumeSession.needs_rating
                ? `/onboarding/rate/${resumeSession.id}`
                : `/onboarding/interview/${resumeSession.id}`
              router.push(dest)
            }}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              marginTop: 20, padding: isMobile ? '14px 16px' : '16px 22px',
              background: 'var(--s-paper)', border: '1px solid var(--s-ink)',
              borderRadius: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 12,
              transition: 'all 150ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--s-tint)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--s-paper)' }}
          >
            <div>
              <div className="t-meta" style={{ fontSize: 9, color: 'var(--s-ink)', marginBottom: 4 }}>
                ★ TASTE SETUP IN PROGRESS
              </div>
              <div style={{ fontFamily: 'var(--serif-display)', fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>
                {resumeSession.needs_rating
                  ? 'continue rating films →'
                  : `continue your interview · question ${resumeSession.current_step + 1} of ${resumeSession.contradictions_count} →`}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--s-ink)', whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
              RESUME
            </div>
          </button>
        )}

        <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 12 : 22 }}>
          <DoorCard
            tag="01 · log"
            title="log something i've watched"
            sub="a film or show — finished or mid-reel, we'll route it the right way."
            cta="open the room  →"
            onClick={() => router.push('/add')}
            tint="var(--sun-tint)" ink="var(--sun)" paper="var(--bone)"
          />
          <DoorCard
            tag="02 · find"
            title="find something to watch"
            sub="the mood room — describe the night, we'll suggest from your taste."
            cta="step inside  →"
            onClick={() => router.push('/mood')}
            tint="var(--s-tint)" ink="var(--s-ink)" paper="var(--s-paper)"
          />
          <DoorCard
            tag="03 · save"
            title="save for later"
            sub="add to the watch list. we'll hold it for the right night."
            cta="put it on the list  →"
            onClick={() => router.push('/watch-list/save')}
            tint="var(--p-tint)" ink="var(--p-ink)" paper="var(--p-paper)"
          />
        </div>

        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '0.5px solid var(--paper-edge)' }}>
          <div className="t-meta" style={{ fontSize: 11, color: 'var(--ink-3)' }}>★ FROM YOUR FRIENDS · LAST 3 DAYS</div>
          <h2 className="t-display" style={{ fontSize: 32, lineHeight: 1.1, marginTop: 12, marginBottom: 28 }}>
            what they&apos;ve been watching.
          </h2>
          <div style={{ padding: '24px 22px', background: 'var(--paper-2)', border: '0.5px dashed var(--paper-edge)', borderRadius: 12 }}>
            <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', margin: 0, lineHeight: 1.55, fontFamily: 'var(--serif-italic)' }}>
              add friends and you&apos;ll see what they&apos;re watching here.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
