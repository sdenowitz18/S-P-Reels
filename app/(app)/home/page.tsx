'use client'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { useIsMobile } from '@/lib/use-is-mobile'
import useSWR from 'swr'
import Image from 'next/image'
import { useState } from 'react'
import type { FeedItem } from '@/app/api/friends/feed/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface ResumeSession {
  id:                  string
  path:                string
  contradictions_count: number
  needs_rating:        boolean
  current_step:        number
}

interface Friend { id: string; name: string }

// Assign a stable color to each friend based on their position in the list
const FRIEND_COLORS = [
  { ink: '#c25a2a', tint: '#fdf0e8' },  // --s-ink (rust)
  { ink: '#2f6b82', tint: '#e6f2f7' },  // --p-ink (slate blue)
  { ink: '#4a6b3e', tint: '#eaf2e8' },  // --forest (moss)
  { ink: '#8a5a9a', tint: '#f5eef8' },  // purple
  { ink: '#c25a6b', tint: '#fde8ec' },  // rose
  { ink: '#6b7a2a', tint: '#f2f4e0' },  // olive
]

function friendColor(index: number) {
  return FRIEND_COLORS[index % FRIEND_COLORS.length]
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
  const [activeFriend, setActiveFriend] = useState<string | null>(null) // null = All

  const { data: resumeData } = useSWR<{ session: ResumeSession | null }>('/api/onboarding/resume', fetcher)
  const resumeSession = resumeData?.session ?? null

  const { data: feedData } = useSWR<{ friends: Friend[]; items: FeedItem[] }>('/api/friends/feed', fetcher)
  const friends = feedData?.friends ?? []
  const allItems = feedData?.items ?? []

  // Build a stable color map: friendId → color
  const colorMap = new Map(friends.map((f, i) => [f.id, friendColor(i)]))

  const visibleItems = activeFriend
    ? allItems.filter(item => item.userId === activeFriend)
    : allItems

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
            cta="log a film →"
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

        {/* ── Friends section ──────────────────────────────────────────────── */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '0.5px solid var(--paper-edge)' }}>

          {/* Header row: label + Add Friend button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="t-meta" style={{ fontSize: 11, color: 'var(--ink-3)' }}>★ FRIENDS</div>
            <button
              onClick={() => router.push('/friends')}
              style={{
                background: 'none', border: '0.5px solid var(--paper-edge)',
                borderRadius: 999, cursor: 'pointer',
                padding: '5px 14px',
                fontFamily: 'var(--mono)', fontSize: 9,
                letterSpacing: '0.07em', color: 'var(--ink-3)',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ink)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--paper-edge)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-3)' }}
            >
              + ADD FRIEND
            </button>
          </div>

          {friends.length === 0 ? (
            /* No friends yet */
            <div style={{ padding: '24px 22px', background: 'var(--paper-2)', border: '0.5px dashed var(--paper-edge)', borderRadius: 12 }}>
              <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', margin: 0, lineHeight: 1.55, fontFamily: 'var(--serif-italic)' }}>
                add friends and you&apos;ll see what they&apos;re watching here.
              </p>
            </div>
          ) : (
            <>
              {/* Friend filter chips */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                <button
                  onClick={() => setActiveFriend(null)}
                  style={{
                    padding: '5px 14px', borderRadius: 999, cursor: 'pointer',
                    border: `0.5px solid ${activeFriend === null ? 'var(--ink)' : 'var(--paper-edge)'}`,
                    background: activeFriend === null ? 'var(--ink)' : 'transparent',
                    color: activeFriend === null ? 'var(--paper)' : 'var(--ink-3)',
                    fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.07em',
                    transition: 'all 120ms',
                  }}
                >
                  ALL
                </button>
                {friends.map((f, i) => {
                  const color = friendColor(i)
                  const isActive = activeFriend === f.id
                  return (
                    <button
                      key={f.id}
                      onClick={() => setActiveFriend(isActive ? null : f.id)}
                      style={{
                        padding: '5px 14px', borderRadius: 999, cursor: 'pointer',
                        border: `0.5px solid ${isActive ? color.ink : 'var(--paper-edge)'}`,
                        background: isActive ? color.ink : 'transparent',
                        color: isActive ? '#fff' : color.ink,
                        fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.07em',
                        transition: 'all 120ms',
                      }}
                    >
                      {f.name.split(' ')[0].toUpperCase()}
                    </button>
                  )
                })}
              </div>

              {/* Activity feed */}
              {visibleItems.length === 0 ? (
                <div style={{ padding: '20px 0', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
                  nothing logged in the last week.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {visibleItems.slice(0, 20).map(item => {
                    const color = colorMap.get(item.userId) ?? FRIEND_COLORS[0]
                    return (
                      <button
                        key={item.id}
                        onClick={() => router.push(`/films?panel=${item.film.id}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 0',
                          background: 'none', border: 'none',
                          borderBottom: '0.5px solid var(--paper-edge)',
                          cursor: 'pointer', textAlign: 'left', width: '100%',
                          transition: 'background 120ms',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--paper-2)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                      >
                        {/* Color bar */}
                        <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: color.ink, flexShrink: 0 }} />

                        {/* Poster */}
                        {item.film.poster_path ? (
                          <div style={{ width: 32, height: 48, borderRadius: 3, overflow: 'hidden', flexShrink: 0, background: 'var(--paper-edge)' }}>
                            <Image src={item.film.poster_path} alt={item.film.title} width={32} height={48} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                          </div>
                        ) : (
                          <div style={{ width: 32, height: 48, borderRadius: 3, background: 'var(--paper-edge)', flexShrink: 0 }} />
                        )}

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: color.ink, fontWeight: 600, letterSpacing: '0.06em', flexShrink: 0 }}>
                              {item.userName.split(' ')[0].toUpperCase()}
                            </span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>
                              {item.type === 'watch' ? 'watched' : item.type === 'watchlist' ? 'saved' : item.type === 'now_playing' ? 'watching' : 'recommended'}
                            </span>
                          </div>
                          <div style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.2, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.film.title}
                            {item.film.year ? <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', fontWeight: 400, marginLeft: 6 }}>{item.film.year}</span> : null}
                          </div>
                          {item.line && (
                            <div style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              "{item.line}"
                            </div>
                          )}
                        </div>

                        {/* Stars */}
                        {item.stars != null && (
                          <div style={{ fontFamily: 'var(--serif-display)', fontSize: 13, color: 'var(--sun)', fontWeight: 600, flexShrink: 0 }}>
                            {item.stars}★
                          </div>
                        )}

                        {/* Date */}
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', flexShrink: 0, letterSpacing: '0.03em' }}>
                          {new Date(item.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
